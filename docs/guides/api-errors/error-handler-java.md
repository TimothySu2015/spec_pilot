# Java (Spring Boot) 錯誤處理範例

本文件示範如何在 Spring Boot 專案中實作符合 SpecPilot AI 診斷需求的標準化錯誤處理機制。

## 目錄

- [核心元件](#核心元件)
- [設定檔](#設定檔)
- [自訂例外類別](#自訂例外類別)
- [錯誤回應模型](#錯誤回應模型)
- [全域例外處理器](#全域例外處理器)
- [錯誤格式化器](#錯誤格式化器)
- [使用範例](#使用範例)
- [測試範例](#測試範例)
- [與 SpecPilot 整合](#與-specpilot-整合)

---

## 核心元件

### 專案相依性 (pom.xml)

```xml
<dependencies>
    <!-- Spring Boot Starter Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <version>3.2.0</version>
    </dependency>

    <!-- Spring Boot Starter Validation -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
        <version>3.2.0</version>
    </dependency>

    <!-- Lombok (Optional) -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.30</version>
        <scope>provided</scope>
    </dependency>

    <!-- Jackson for JSON -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
        <version>2.16.0</version>
    </dependency>

    <!-- SLF4J & Logback -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-logging</artifactId>
    </dependency>
</dependencies>
```

---

## 設定檔

### application.yml

```yaml
spring:
  application:
    name: my-api-service
  profiles:
    active: ${APP_ENV:development}

server:
  port: 8080
  error:
    include-message: always
    include-binding-errors: always
    include-stacktrace: on_param  # Spring Boot 預設隱藏，我們自己控制
    include-exception: false

logging:
  level:
    root: INFO
    com.example.myapi: DEBUG
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"

# 自訂錯誤處理設定
error-handling:
  environments:
    development:
      include-stack-trace: true
      include-source-context: true
      max-stack-depth: 20
      sanitize-sensitive-data: true
    staging:
      include-stack-trace: true
      include-source-context: true
      max-stack-depth: 10
      sanitize-sensitive-data: true
    production:
      include-stack-trace: false
      include-source-context: false
      max-stack-depth: 0
      sanitize-sensitive-data: true
```

---

## 自訂例外類別

### DiagnosticException.java (基礎例外類別)

```java
package com.example.myapi.exception;

import lombok.Getter;
import java.util.Map;

/**
 * 診斷型例外基礎類別
 * 所有自訂例外都應繼承此類別以提供標準化的錯誤資訊
 */
@Getter
public class DiagnosticException extends RuntimeException {

    private final String errorCode;
    private final int statusCode;
    private final String hint;
    private final Map<String, Object> details;
    private final String documentationUrl;

    /**
     * 建構診斷型例外
     *
     * @param errorCode 錯誤代碼 (例如: "AUTHENTICATION_FAILED")
     * @param message 錯誤訊息 (使用者友善的描述)
     * @param statusCode HTTP 狀態碼
     * @param hint 診斷提示 (可選，幫助快速定位問題)
     * @param details 額外細節 (可選，提供更多除錯資訊)
     */
    public DiagnosticException(
        String errorCode,
        String message,
        int statusCode,
        String hint,
        Map<String, Object> details
    ) {
        super(message);
        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.hint = hint;
        this.details = details;
        this.documentationUrl = null;
    }

    public DiagnosticException(String errorCode, String message, int statusCode) {
        this(errorCode, message, statusCode, null, null);
    }

    public DiagnosticException(String errorCode, String message, int statusCode, String hint) {
        this(errorCode, message, statusCode, hint, null);
    }
}
```

### 常見錯誤類型

```java
package com.example.myapi.exception;

import java.util.Map;

/**
 * 認證失敗例外
 */
public class AuthenticationException extends DiagnosticException {
    public AuthenticationException(String message, String hint) {
        super("AUTHENTICATION_FAILED", message, 401, hint, null);
    }

    public AuthenticationException(String message) {
        this(message, "請確認提供的認證憑證是否正確");
    }
}

/**
 * 授權失敗例外
 */
public class AuthorizationException extends DiagnosticException {
    public AuthorizationException(String message, String hint) {
        super("AUTHORIZATION_FAILED", message, 403, hint, null);
    }

    public AuthorizationException(String message) {
        this(message, "請確認當前使用者是否有足夠權限執行此操作");
    }
}

/**
 * 資源未找到例外
 */
public class ResourceNotFoundException extends DiagnosticException {
    public ResourceNotFoundException(String resourceType, String resourceId) {
        super(
            "RESOURCE_NOT_FOUND",
            String.format("找不到 %s 資源: %s", resourceType, resourceId),
            404,
            String.format("請確認 %s ID '%s' 是否正確", resourceType, resourceId),
            Map.of("resource_type", resourceType, "resource_id", resourceId)
        );
    }
}

/**
 * 資料驗證失敗例外
 */
public class ValidationException extends DiagnosticException {
    public ValidationException(String message, Map<String, Object> details) {
        super(
            "VALIDATION_FAILED",
            message,
            422,
            "請檢查請求資料格式與必填欄位",
            details
        );
    }
}

/**
 * 資料庫操作失敗例外
 */
public class DatabaseException extends DiagnosticException {
    public DatabaseException(String message, String hint) {
        super("DATABASE_ERROR", message, 500, hint, null);
    }

    public static DatabaseException connectionFailed() {
        return new DatabaseException(
            "無法連線至資料庫",
            "請檢查資料庫連線設定與網路狀態"
        );
    }

    public static DatabaseException queryTimeout() {
        return new DatabaseException(
            "資料庫查詢逾時",
            "請檢查查詢語法效能或增加逾時設定"
        );
    }
}

/**
 * 外部 API 呼叫失敗例外
 */
public class ExternalApiException extends DiagnosticException {
    public ExternalApiException(String serviceName, int statusCode, String message) {
        super(
            "EXTERNAL_API_ERROR",
            String.format("外部服務 '%s' 呼叫失敗: %s", serviceName, message),
            502,
            String.format("請檢查 %s 服務狀態或稍後重試", serviceName),
            Map.of("service_name", serviceName, "external_status_code", statusCode)
        );
    }
}

/**
 * 業務邏輯錯誤例外
 */
public class BusinessLogicException extends DiagnosticException {
    public BusinessLogicException(String errorCode, String message, String hint) {
        super(errorCode, message, 400, hint, null);
    }
}
```

---

## 錯誤回應模型

### DiagnosticErrorResponse.java

```java
package com.example.myapi.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 標準化錯誤回應格式
 * 符合 SpecPilot AI 診斷需求
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DiagnosticErrorResponse {

    /**
     * 錯誤代碼 (例如: "AUTHENTICATION_FAILED")
     */
    @JsonProperty("error")
    private String error;

    /**
     * 使用者友善的錯誤訊息
     */
    @JsonProperty("message")
    private String message;

    /**
     * 診斷提示，幫助快速定位問題
     */
    @JsonProperty("hint")
    private String hint;

    /**
     * Stack Trace (僅在開發/測試環境)
     */
    @JsonProperty("stack_trace")
    private List<String> stackTrace;

    /**
     * 錯誤發生的原始碼位置 (僅在開發/測試環境)
     */
    @JsonProperty("source_context")
    private SourceContext sourceContext;

    /**
     * 請求追蹤 ID
     */
    @JsonProperty("request_id")
    private String requestId;

    /**
     * 錯誤發生時間戳記
     */
    @JsonProperty("timestamp")
    private Instant timestamp;

    /**
     * HTTP 狀態碼
     */
    @JsonProperty("status_code")
    private Integer statusCode;

    /**
     * 請求路徑
     */
    @JsonProperty("path")
    private String path;

    /**
     * 額外的除錯細節
     */
    @JsonProperty("details")
    private Map<String, Object> details;

    /**
     * 相關文件連結
     */
    @JsonProperty("documentation_url")
    private String documentationUrl;

    /**
     * 原始碼位置資訊
     */
    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SourceContext {
        @JsonProperty("file")
        private String file;

        @JsonProperty("line")
        private Integer line;

        @JsonProperty("method")
        private String method;

        @JsonProperty("class")
        private String className;
    }
}
```

---

## 錯誤格式化器

### ErrorFormatter.java

```java
package com.example.myapi.util;

import com.example.myapi.exception.DiagnosticException;
import com.example.myapi.model.DiagnosticErrorResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 錯誤格式化器
 * 根據環境設定產生適當的錯誤回應
 */
@Component
public class ErrorFormatter {

    private static final Logger logger = LoggerFactory.getLogger(ErrorFormatter.class);

    @Value("${spring.profiles.active:production}")
    private String environment;

    @Value("${error-handling.environments.${spring.profiles.active:production}.include-stack-trace:false}")
    private boolean includeStackTrace;

    @Value("${error-handling.environments.${spring.profiles.active:production}.include-source-context:false}")
    private boolean includeSourceContext;

    @Value("${error-handling.environments.${spring.profiles.active:production}.max-stack-depth:0}")
    private int maxStackDepth;

    @Value("${error-handling.environments.${spring.profiles.active:production}.sanitize-sensitive-data:true}")
    private boolean sanitizeSensitiveData;

    private static final Set<String> SENSITIVE_KEYS = Set.of(
        "password", "token", "secret", "apiKey", "authorization",
        "jwt", "bearer", "credentials", "api_key", "access_token"
    );

    private static final Pattern PROJECT_PACKAGE_PATTERN =
        Pattern.compile("^com\\.example\\.myapi.*");

    /**
     * 格式化診斷型例外
     */
    public DiagnosticErrorResponse format(
        DiagnosticException exception,
        String requestId,
        String path
    ) {
        var builder = DiagnosticErrorResponse.builder()
            .error(exception.getErrorCode())
            .message(exception.getMessage())
            .hint(exception.getHint())
            .requestId(requestId)
            .timestamp(Instant.now())
            .statusCode(exception.getStatusCode())
            .path(path);

        // 敏感資料遮罩
        Map<String, Object> details = exception.getDetails();
        if (details != null && sanitizeSensitiveData) {
            details = maskSensitiveData(details);
        }
        builder.details(details);

        // Stack Trace (僅開發/測試環境)
        if (includeStackTrace && maxStackDepth > 0) {
            List<String> stackTrace = formatStackTrace(exception);
            builder.stackTrace(stackTrace);
        }

        // Source Context (僅開發/測試環境)
        if (includeSourceContext) {
            DiagnosticErrorResponse.SourceContext sourceContext =
                extractSourceContext(exception);
            builder.sourceContext(sourceContext);
        }

        return builder.build();
    }

    /**
     * 格式化一般例外
     */
    public DiagnosticErrorResponse format(
        Exception exception,
        String requestId,
        String path,
        int statusCode
    ) {
        var builder = DiagnosticErrorResponse.builder()
            .error("INTERNAL_SERVER_ERROR")
            .message("伺服器處理請求時發生錯誤")
            .hint("請稍後重試，若問題持續請聯繫技術支援")
            .requestId(requestId)
            .timestamp(Instant.now())
            .statusCode(statusCode)
            .path(path);

        // Stack Trace (僅開發/測試環境)
        if (includeStackTrace && maxStackDepth > 0) {
            List<String> stackTrace = formatStackTrace(exception);
            builder.stackTrace(stackTrace);
        }

        // Source Context (僅開發/測試環境)
        if (includeSourceContext) {
            DiagnosticErrorResponse.SourceContext sourceContext =
                extractSourceContext(exception);
            builder.sourceContext(sourceContext);
        }

        return builder.build();
    }

    /**
     * 格式化 Stack Trace
     */
    private List<String> formatStackTrace(Throwable throwable) {
        return Arrays.stream(throwable.getStackTrace())
            .limit(maxStackDepth)
            .map(this::formatStackTraceElement)
            .filter(line -> !line.isEmpty())
            .collect(Collectors.toList());
    }

    /**
     * 格式化單一 Stack Trace 元素
     */
    private String formatStackTraceElement(StackTraceElement element) {
        String className = element.getClassName();
        String methodName = element.getMethodName();
        String fileName = element.getFileName();
        int lineNumber = element.getLineNumber();

        // 簡化專案內部路徑
        if (PROJECT_PACKAGE_PATTERN.matcher(className).matches()) {
            String simplifiedClass = className.substring(className.lastIndexOf('.') + 1);
            return String.format("at %s.%s(%s:%d)",
                simplifiedClass, methodName, fileName, lineNumber);
        }

        // 保留完整路徑給外部函式庫
        return String.format("at %s.%s(%s:%d)",
            className, methodName, fileName, lineNumber);
    }

    /**
     * 提取原始碼位置資訊
     */
    private DiagnosticErrorResponse.SourceContext extractSourceContext(Throwable throwable) {
        StackTraceElement[] stackTrace = throwable.getStackTrace();
        if (stackTrace == null || stackTrace.length == 0) {
            return null;
        }

        // 找到第一個專案內部的 Stack Frame
        for (StackTraceElement element : stackTrace) {
            if (PROJECT_PACKAGE_PATTERN.matcher(element.getClassName()).matches()) {
                return DiagnosticErrorResponse.SourceContext.builder()
                    .file(element.getFileName())
                    .line(element.getLineNumber())
                    .method(element.getMethodName())
                    .className(element.getClassName())
                    .build();
            }
        }

        return null;
    }

    /**
     * 遮罩敏感資料
     */
    private Map<String, Object> maskSensitiveData(Map<String, Object> data) {
        Map<String, Object> masked = new HashMap<>();

        for (Map.Entry<String, Object> entry : data.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();

            if (isSensitiveKey(key)) {
                masked.put(key, "***");
            } else if (value instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> nestedMap = (Map<String, Object>) value;
                masked.put(key, maskSensitiveData(nestedMap));
            } else if (value instanceof List) {
                @SuppressWarnings("unchecked")
                List<Object> list = (List<Object>) value;
                masked.put(key, maskSensitiveList(list));
            } else {
                masked.put(key, value);
            }
        }

        return masked;
    }

    /**
     * 遮罩 List 中的敏感資料
     */
    private List<Object> maskSensitiveList(List<Object> list) {
        return list.stream()
            .map(item -> {
                if (item instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> map = (Map<String, Object>) item;
                    return maskSensitiveData(map);
                }
                return item;
            })
            .collect(Collectors.toList());
    }

    /**
     * 檢查是否為敏感欄位
     */
    private boolean isSensitiveKey(String key) {
        String lowerKey = key.toLowerCase();
        return SENSITIVE_KEYS.stream()
            .anyMatch(lowerKey::contains);
    }
}
```

---

## 全域例外處理器

### GlobalExceptionHandler.java

```java
package com.example.myapi.handler;

import com.example.myapi.exception.*;
import com.example.myapi.model.DiagnosticErrorResponse;
import com.example.myapi.util.ErrorFormatter;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 全域例外處理器
 * 統一處理所有未捕捉的例外
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Autowired
    private ErrorFormatter errorFormatter;

    /**
     * 處理診斷型例外
     */
    @ExceptionHandler(DiagnosticException.class)
    public ResponseEntity<DiagnosticErrorResponse> handleDiagnosticException(
        DiagnosticException ex,
        HttpServletRequest request
    ) {
        String requestId = getOrGenerateRequestId(request);
        String path = request.getRequestURI();

        // 記錄錯誤日誌
        logger.error("DiagnosticException occurred: {} - {} (requestId: {})",
            ex.getErrorCode(), ex.getMessage(), requestId, ex);

        // 格式化錯誤回應
        DiagnosticErrorResponse response = errorFormatter.format(ex, requestId, path);

        return ResponseEntity
            .status(ex.getStatusCode())
            .body(response);
    }

    /**
     * 處理驗證失敗例外 (Spring Validation)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<DiagnosticErrorResponse> handleValidationException(
        MethodArgumentNotValidException ex,
        HttpServletRequest request
    ) {
        String requestId = getOrGenerateRequestId(request);
        String path = request.getRequestURI();

        Map<String, Object> validationErrors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            validationErrors.put(fieldName, errorMessage);
        });

        logger.warn("Validation failed for request {} (requestId: {}): {}",
            path, requestId, validationErrors);

        ValidationException validationException = new ValidationException(
            "請求資料驗證失敗",
            Map.of("validation_errors", validationErrors)
        );

        DiagnosticErrorResponse response = errorFormatter.format(
            validationException, requestId, path
        );

        return ResponseEntity
            .status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(response);
    }

    /**
     * 處理所有未預期的例外
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<DiagnosticErrorResponse> handleGenericException(
        Exception ex,
        HttpServletRequest request
    ) {
        String requestId = getOrGenerateRequestId(request);
        String path = request.getRequestURI();

        logger.error("Unexpected exception occurred (requestId: {})", requestId, ex);

        DiagnosticErrorResponse response = errorFormatter.format(
            ex, requestId, path, HttpStatus.INTERNAL_SERVER_ERROR.value()
        );

        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(response);
    }

    /**
     * 取得或產生 Request ID
     */
    private String getOrGenerateRequestId(HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-ID");
        if (requestId == null || requestId.isEmpty()) {
            requestId = UUID.randomUUID().toString();
        }
        return requestId;
    }
}
```

---

## 使用範例

### UserController.java

```java
package com.example.myapi.controller;

import com.example.myapi.exception.*;
import com.example.myapi.model.User;
import com.example.myapi.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    /**
     * 使用者登入
     * 示範：認證失敗例外
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody @Valid LoginRequest request) {
        User user = userService.findByEmail(request.getEmail());

        if (user == null) {
            throw new AuthenticationException(
                "找不到此電子郵件對應的使用者帳號",
                "請確認電子郵件是否正確或註冊新帳號"
            );
        }

        if (!userService.verifyPassword(user, request.getPassword())) {
            throw new AuthenticationException(
                "密碼錯誤",
                "請確認密碼是否正確，連續失敗 5 次將鎖定帳號 30 分鐘"
            );
        }

        String token = userService.generateToken(user);
        return ResponseEntity.ok(Map.of(
            "token", token,
            "user_id", user.getId()
        ));
    }

    /**
     * 取得使用者資訊
     * 示範：資源未找到例外
     */
    @GetMapping("/{userId}")
    public ResponseEntity<User> getUser(@PathVariable String userId) {
        User user = userService.findById(userId);

        if (user == null) {
            throw new ResourceNotFoundException("User", userId);
        }

        return ResponseEntity.ok(user);
    }

    /**
     * 更新使用者資訊
     * 示範：授權失敗例外
     */
    @PutMapping("/{userId}")
    public ResponseEntity<User> updateUser(
        @PathVariable String userId,
        @RequestBody @Valid UpdateUserRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        String currentUserId = userService.extractUserIdFromToken(authHeader);

        // 檢查權限：只能修改自己的資料，除非是管理員
        if (!currentUserId.equals(userId) && !userService.isAdmin(currentUserId)) {
            throw new AuthorizationException(
                "您沒有權限修改此使用者的資料",
                "只能修改自己的資料，或具備管理員權限"
            );
        }

        User updatedUser = userService.update(userId, request);
        return ResponseEntity.ok(updatedUser);
    }

    /**
     * 刪除使用者
     * 示範：業務邏輯錯誤例外
     */
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable String userId) {
        User user = userService.findById(userId);

        if (user == null) {
            throw new ResourceNotFoundException("User", userId);
        }

        // 業務規則：有進行中訂單的使用者不能刪除
        if (userService.hasActiveOrders(userId)) {
            throw new BusinessLogicException(
                "USER_HAS_ACTIVE_ORDERS",
                "此使用者有進行中的訂單，無法刪除帳號",
                "請先完成或取消所有進行中的訂單"
            );
        }

        userService.delete(userId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
```

### UserService.java (簡化範例)

```java
package com.example.myapi.service;

import com.example.myapi.exception.DatabaseException;
import com.example.myapi.model.User;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    /**
     * 示範：資料庫例外處理
     */
    public User findById(String userId) {
        try {
            // 模擬資料庫查詢
            return userRepository.findById(userId).orElse(null);
        } catch (DataAccessException ex) {
            throw DatabaseException.connectionFailed();
        }
    }

    // 其他業務邏輯方法...
}
```

---

## 測試範例

### UserControllerTest.java

```java
package com.example.myapi.controller;

import com.example.myapi.exception.AuthenticationException;
import com.example.myapi.exception.ResourceNotFoundException;
import com.example.myapi.model.DiagnosticErrorResponse;
import com.example.myapi.service.UserService;
import com.example.myapi.util.ErrorFormatter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@WebMvcTest(UserController.class)
@ActiveProfiles("development")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    @MockBean
    private ErrorFormatter errorFormatter;

    @Test
    void testLoginWithInvalidCredentials_ShouldReturnDiagnosticError() throws Exception {
        // Arrange
        when(userService.findByEmail(anyString())).thenReturn(null);

        String loginRequest = """
            {
                "email": "test@example.com",
                "password": "wrongpassword"
            }
            """;

        // Act & Assert
        MvcResult result = mockMvc.perform(post("/api/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginRequest))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("AUTHENTICATION_FAILED"))
            .andExpect(jsonPath("$.message").exists())
            .andExpect(jsonPath("$.hint").exists())
            .andExpect(jsonPath("$.request_id").exists())
            .andExpect(jsonPath("$.timestamp").exists())
            .andReturn();

        // Verify response structure
        String responseBody = result.getResponse().getContentAsString();
        DiagnosticErrorResponse response = objectMapper.readValue(
            responseBody, DiagnosticErrorResponse.class
        );

        assertThat(response.getError()).isEqualTo("AUTHENTICATION_FAILED");
        assertThat(response.getMessage()).contains("找不到此電子郵件");
        assertThat(response.getHint()).isNotNull();
        assertThat(response.getStackTrace()).isNotNull(); // 開發環境應包含 stack trace
    }

    @Test
    void testGetUserNotFound_ShouldReturnDiagnosticError() throws Exception {
        // Arrange
        when(userService.findById("999")).thenReturn(null);

        // Act & Assert
        mockMvc.perform(get("/api/users/999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("找不到 User 資源: 999"))
            .andExpect(jsonPath("$.hint").exists())
            .andExpect(jsonPath("$.details.resource_type").value("User"))
            .andExpect(jsonPath("$.details.resource_id").value("999"));
    }
}
```

---

## 與 SpecPilot 整合

### OpenAPI 規格範例 (openapi.yaml)

```yaml
openapi: 3.0.3
info:
  title: My API Service
  version: 1.0.0

paths:
  /api/users/login:
    post:
      summary: 使用者登入
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: 登入成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: 認證失敗
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DiagnosticError'

components:
  schemas:
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          format: password

    LoginResponse:
      type: object
      properties:
        token:
          type: string
        user_id:
          type: string

    DiagnosticError:
      type: object
      required:
        - error
        - message
        - request_id
        - timestamp
        - status_code
      properties:
        error:
          type: string
          description: 錯誤代碼
          example: "AUTHENTICATION_FAILED"
        message:
          type: string
          description: 使用者友善的錯誤訊息
          example: "找不到此電子郵件對應的使用者帳號"
        hint:
          type: string
          description: 診斷提示
          example: "請確認電子郵件是否正確或註冊新帳號"
        stack_trace:
          type: array
          items:
            type: string
          description: Stack trace (僅開發環境)
        source_context:
          $ref: '#/components/schemas/SourceContext'
        request_id:
          type: string
          format: uuid
        timestamp:
          type: string
          format: date-time
        status_code:
          type: integer
        path:
          type: string
        details:
          type: object
          additionalProperties: true

    SourceContext:
      type: object
      properties:
        file:
          type: string
        line:
          type: integer
        method:
          type: string
        class:
          type: string
```

### SpecPilot 測試流程 (user_login_flow.yaml)

```yaml
id: user-login-test
name: "使用者登入流程測試"

steps:
  - name: "測試 - 登入失敗（錯誤的電子郵件）"
    request:
      method: "POST"
      path: "/api/users/login"
      body:
        email: "nonexistent@example.com"
        password: "anypassword"
    expectations:
      status: 401
      schema: "DiagnosticError"
      body:
        error: "AUTHENTICATION_FAILED"
        message:
          contains: "找不到此電子郵件"
        hint:
          notNull: true
        stack_trace:
          notNull: true  # 開發環境應包含
        request_id:
          notNull: true
        timestamp:
          notNull: true

  - name: "測試 - 登入失敗（錯誤的密碼）"
    request:
      method: "POST"
      path: "/api/users/login"
      body:
        email: "test@example.com"
        password: "wrongpassword"
    expectations:
      status: 401
      schema: "DiagnosticError"
      body:
        error: "AUTHENTICATION_FAILED"
        message:
          contains: "密碼錯誤"
        hint:
          contains: "連續失敗"

  - name: "測試 - 登入成功"
    request:
      method: "POST"
      path: "/api/users/login"
      body:
        email: "test@example.com"
        password: "correctpassword"
    expectations:
      status: 200
      schema: "LoginResponse"
      body:
        token:
          notNull: true
        user_id:
          notNull: true
```

---

## 最佳實踐建議

### 1. 環境變數管理

建議使用不同的 `application-{env}.yml` 檔案：

```yaml
# application-development.yml
error-handling:
  environments:
    development:
      include-stack-trace: true
      include-source-context: true
      max-stack-depth: 20

# application-production.yml
error-handling:
  environments:
    production:
      include-stack-trace: false
      include-source-context: false
      max-stack-depth: 0
```

### 2. 結構化日誌

使用 Logback 的 JSON encoder：

```xml
<!-- logback-spring.xml -->
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE" />
    </root>
</configuration>
```

### 3. Request ID 傳遞

建立 Filter 自動產生和傳遞 Request ID：

```java
@Component
public class RequestIdFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = request.getHeader("X-Request-ID");
        if (requestId == null || requestId.isEmpty()) {
            requestId = UUID.randomUUID().toString();
        }

        MDC.put("requestId", requestId);
        response.setHeader("X-Request-ID", requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("requestId");
        }
    }
}
```

### 4. 自訂驗證器

擴充 Spring Validation 以產生診斷型錯誤：

```java
@Validated
@RestController
public class UserController {

    @PostMapping("/users")
    public ResponseEntity<User> createUser(
        @Valid @RequestBody CreateUserRequest request
    ) {
        // Spring 會自動觸發 MethodArgumentNotValidException
        // GlobalExceptionHandler 會轉換為 DiagnosticError
    }
}
```

---

## 總結

此 Spring Boot 錯誤處理範例提供：

✅ **標準化錯誤格式** - 符合 SpecPilot AI 診斷需求
✅ **環境感知** - 開發環境顯示 Stack Trace，正式環境隱藏
✅ **敏感資料保護** - 自動遮罩密碼、Token 等敏感欄位
✅ **強類型例外** - 使用 Java 類型系統確保錯誤處理一致性
✅ **全域攔截** - 透過 @RestControllerAdvice 統一處理例外
✅ **可測試性** - 完整的單元測試範例
✅ **OpenAPI 整合** - 與 SpecPilot 測試流程無縫整合

**開發團隊只需要**：
1. 繼承 `DiagnosticException` 建立自訂例外
2. 在業務邏輯中拋出適當的例外
3. `GlobalExceptionHandler` 自動處理並格式化錯誤回應

這樣可確保所有 API 錯誤都能被 AI 正確診斷與分析。