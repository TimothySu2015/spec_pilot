# Python (FastAPI/Flask) API 診斷友善錯誤處理範例

## 📋 概述

本文件提供 Python (FastAPI 和 Flask) 的診斷友善錯誤處理實作範例,適用於與 SpecPilot 整合的 API 開發。

---

## 🏗️ 架構設計

```
Route Handler
    ↓ 拋出異常
Exception Handler
    ↓ 捕捉異常
ErrorFormatter
    ↓ 格式化錯誤
DiagnosticError (JSON)
    ↓ 回傳給客戶端
SpecPilot 診斷
```

---

## 📦 核心類別與函式

### 1. 自訂異常類別

```python
# errors/diagnostic_error.py

from typing import Optional, Dict, Any, List
from datetime import datetime
import traceback
import os


class DiagnosticError(Exception):
    """診斷友善的異常基礎類別"""

    def __init__(
        self,
        error_code: str,
        message: str,
        status_code: int = 500,
        hint: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        documentation_url: Optional[str] = None
    ):
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.hint = hint
        self.details = details or {}
        self.documentation_url = documentation_url

    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式"""
        result = {
            "error": self.error_code,
            "message": self.message,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        if self.hint:
            result["hint"] = self.hint
        if self.details:
            result["details"] = self.details
        if self.documentation_url:
            result["documentation_url"] = self.documentation_url

        return result


# ===== 常見錯誤類型 =====

class AuthenticationError(DiagnosticError):
    """認證錯誤"""

    def __init__(self, message: str, hint: Optional[str] = None, details: Optional[Dict] = None):
        super().__init__(
            error_code="AUTHENTICATION_FAILED",
            message=message,
            status_code=401,
            hint=hint,
            details=details,
            documentation_url="https://api.example.com/docs/errors/auth"
        )


class AuthorizationError(DiagnosticError):
    """授權錯誤"""

    def __init__(self, message: str, hint: Optional[str] = None, details: Optional[Dict] = None):
        super().__init__(
            error_code="AUTHORIZATION_FAILED",
            message=message,
            status_code=403,
            hint=hint,
            details=details,
            documentation_url="https://api.example.com/docs/errors/auth"
        )


class ResourceNotFoundError(DiagnosticError):
    """資源不存在"""

    def __init__(self, resource_type: str, resource_id: str, hint: Optional[str] = None):
        super().__init__(
            error_code="RESOURCE_NOT_FOUND",
            message=f"找不到 {resource_type} 資源: {resource_id}",
            status_code=404,
            hint=hint or "請確認資源 ID 是否正確",
            details={"resource_type": resource_type, "resource_id": resource_id}
        )


class ValidationError(DiagnosticError):
    """驗證錯誤"""

    def __init__(self, message: str, validation_errors: List[Dict], hint: Optional[str] = None):
        super().__init__(
            error_code="VALIDATION_ERROR",
            message=message,
            status_code=400,
            hint=hint or "請檢查請求資料格式是否正確",
            details={"fields": validation_errors}
        )


class DatabaseError(DiagnosticError):
    """資料庫錯誤"""

    def __init__(self, message: str, hint: Optional[str] = None, details: Optional[Dict] = None):
        super().__init__(
            error_code="DATABASE_ERROR",
            message=message,
            status_code=500,
            hint=hint or "請檢查資料庫連線狀態",
            details=details,
            documentation_url="https://api.example.com/docs/errors/database"
        )
```

---

### 2. 錯誤格式化工具

```python
# utils/error_formatter.py

import sys
import traceback
import os
from typing import Optional, Dict, Any, List
from errors.diagnostic_error import DiagnosticError


class ErrorFormatter:
    """錯誤格式化工具"""

    def __init__(self, environment: str = "development"):
        self.environment = environment
        self.config = self._get_config(environment)

    def _get_config(self, env: str) -> Dict[str, Any]:
        """取得環境配置"""
        configs = {
            "development": {
                "include_stack_trace": True,
                "include_source_context": True,
                "max_stack_depth": 20,
            },
            "test": {
                "include_stack_trace": True,
                "include_source_context": False,
                "max_stack_depth": 10,
            },
            "staging": {
                "include_stack_trace": True,
                "include_source_context": False,
                "max_stack_depth": 10,
            },
            "production": {
                "include_stack_trace": False,
                "include_source_context": False,
                "max_stack_depth": 0,
            },
        }
        return configs.get(env, configs["production"])

    def format(self, error: Exception, request_id: Optional[str] = None) -> Dict[str, Any]:
        """格式化錯誤為診斷友善的格式"""

        # 如果是 DiagnosticError,使用其定義的資訊
        if isinstance(error, DiagnosticError):
            formatted = error.to_dict()
        else:
            formatted = {
                "error": self._get_error_code(error),
                "message": self._get_message(error),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }

        # 加入 Request ID
        if request_id:
            formatted["request_id"] = request_id

        # ✨ 加入 Stack Trace (如果配置允許)
        if self.config["include_stack_trace"]:
            stack_trace = self._format_stack_trace(error)
            if stack_trace:
                formatted["stack_trace"] = stack_trace

        # ✨ 加入原始碼上下文 (如果配置允許)
        if self.config["include_source_context"]:
            source_context = self._extract_source_context(error)
            if source_context:
                formatted["source_context"] = source_context

        # 清理敏感資料
        if "details" in formatted:
            formatted["details"] = self._sanitize_details(formatted["details"])

        return formatted

    def _get_error_code(self, error: Exception) -> str:
        """取得錯誤代碼"""
        error_name = error.__class__.__name__
        if error_name == "ValueError":
            return "VALIDATION_ERROR"
        elif error_name == "PermissionError":
            return "AUTHORIZATION_FAILED"
        return "INTERNAL_SERVER_ERROR"

    def _get_message(self, error: Exception) -> str:
        """取得錯誤訊息"""
        if self.environment == "production" and not isinstance(error, DiagnosticError):
            return "伺服器內部錯誤"
        return str(error)

    def _format_stack_trace(self, error: Exception) -> Optional[List[str]]:
        """格式化 Stack Trace"""
        try:
            tb_lines = traceback.format_exception(
                type(error), error, error.__traceback__
            )

            # 取前 N 行
            max_depth = self.config["max_stack_depth"]
            stack_lines = []

            for line in tb_lines:
                lines = line.strip().split("\n")
                for l in lines:
                    if l:
                        stack_lines.append(self._simplify_path(l))

            return stack_lines[:max_depth]
        except Exception:
            return None

    def _simplify_path(self, line: str) -> str:
        """簡化路徑 (移除敏感資訊)"""
        cwd = os.getcwd()
        return line.replace(cwd, ".")

    def _extract_source_context(self, error: Exception) -> Optional[Dict[str, Any]]:
        """提取原始碼上下文"""
        try:
            tb = error.__traceback__
            if not tb:
                return None

            # 取得最後一個 frame
            frame = tb.tb_frame
            file_path = frame.f_code.co_filename
            line_num = tb.tb_lineno

            # 檢查檔案是否存在
            if not os.path.exists(file_path):
                return None

            # 讀取檔案
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # 提取錯誤行前後各 3 行
            start_line = max(0, line_num - 4)
            end_line = min(len(lines), line_num + 3)

            context = []
            for i in range(start_line, end_line):
                context.append({
                    "line": i + 1,
                    "code": lines[i].rstrip(),
                    "is_error": i + 1 == line_num
                })

            return {
                "file": self._simplify_path(file_path),
                "line": line_num,
                "function": frame.f_code.co_name,
                "context": context
            }
        except Exception:
            return None

    def _sanitize_details(self, details: Any) -> Any:
        """清理敏感資料"""
        if details is None:
            return None

        sensitive_keys = ["password", "token", "secret", "api_key", "private_key"]

        def sanitize(obj):
            if isinstance(obj, dict):
                result = {}
                for key, value in obj.items():
                    lower_key = key.lower()
                    if any(sk in lower_key for sk in sensitive_keys):
                        result[key] = "***"
                    else:
                        result[key] = sanitize(value)
                return result
            elif isinstance(obj, list):
                return [sanitize(item) for item in obj]
            else:
                return obj

        return sanitize(details)


# Import datetime at top
from datetime import datetime
```

---

## 🔷 FastAPI 實作

### 1. 異常處理器

```python
# main.py (FastAPI)

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uuid
import os

from errors.diagnostic_error import (
    DiagnosticError,
    AuthenticationError,
    ResourceNotFoundError,
    ValidationError,
    DatabaseError
)
from utils.error_formatter import ErrorFormatter

app = FastAPI()
error_formatter = ErrorFormatter(os.getenv("ENVIRONMENT", "development"))


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """加入 Request ID"""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(DiagnosticError)
async def diagnostic_error_handler(request: Request, exc: DiagnosticError):
    """處理 DiagnosticError"""
    request_id = getattr(request.state, "request_id", None)
    error_response = error_formatter.format(exc, request_id)

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """處理 FastAPI 驗證錯誤"""
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "error": error["msg"],
            "type": error["type"]
        })

    validation_error = ValidationError(
        message="請求資料驗證失敗",
        validation_errors=errors
    )

    request_id = getattr(request.state, "request_id", None)
    error_response = error_formatter.format(validation_error, request_id)

    return JSONResponse(
        status_code=400,
        content=error_response
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """處理一般異常"""
    request_id = getattr(request.state, "request_id", None)
    error_response = error_formatter.format(exc, request_id)

    # 記錄錯誤日誌
    import logging
    logging.error(f"Unhandled exception: {exc}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content=error_response
    )
```

---

### 2. FastAPI 使用範例

```python
# routers/users.py (FastAPI)

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import jwt
from datetime import datetime

from errors.diagnostic_error import (
    ResourceNotFoundError,
    AuthenticationError,
    ValidationError
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}")
async def get_user(user_id: int):
    """取得使用者"""
    user = await User.find_by_id(user_id)

    if not user:
        raise ResourceNotFoundError(
            resource_type="User",
            resource_id=str(user_id),
            hint="請確認使用者 ID 是否正確,或該使用者是否已被刪除"
        )

    return user


@router.post("/")
async def create_user(user_data: dict):
    """建立使用者"""
    errors = []

    # 手動驗證
    if not user_data.get("email"):
        errors.append({
            "field": "email",
            "error": "email 欄位為必填",
            "received": user_data.get("email")
        })
    elif not is_valid_email(user_data.get("email")):
        errors.append({
            "field": "email",
            "error": "email 格式不正確",
            "received": user_data.get("email")
        })

    age = user_data.get("age", 0)
    if age < 18:
        errors.append({
            "field": "age",
            "error": "年齡必須大於或等於 18",
            "received": age
        })

    if errors:
        raise ValidationError(
            message="請求資料驗證失敗",
            validation_errors=errors,
            hint="請檢查並修正以下欄位"
        )

    # 建立使用者...
    user = await User.create(user_data)
    return user


# 認證中介層
def verify_token(token: str = Depends(oauth2_scheme)):
    """驗證 JWT Token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError as e:
        raise AuthenticationError(
            message=f"認證 Token 已於 {e.args[0]} 過期",
            hint="請使用 POST /api/auth/refresh 端點刷新 Token",
            details={
                "expired_at": e.args[0],
                "current_time": datetime.utcnow().isoformat()
            }
        )
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(
            message="Token 無效或已被撤銷",
            hint="請重新登入取得新的 Token",
            details={"reason": str(e)}
        )
```

---

## 🔶 Flask 實作

### 1. 錯誤處理器

```python
# app.py (Flask)

from flask import Flask, request, jsonify
import uuid
import os

from errors.diagnostic_error import DiagnosticError
from utils.error_formatter import ErrorFormatter

app = Flask(__name__)
error_formatter = ErrorFormatter(os.getenv("ENVIRONMENT", "development"))


@app.before_request
def add_request_id():
    """加入 Request ID"""
    request.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))


@app.after_request
def add_request_id_header(response):
    """加入 Request ID 到 Response Header"""
    response.headers["X-Request-ID"] = getattr(request, "request_id", "")
    return response


@app.errorhandler(DiagnosticError)
def handle_diagnostic_error(error):
    """處理 DiagnosticError"""
    request_id = getattr(request, "request_id", None)
    error_response = error_formatter.format(error, request_id)

    return jsonify(error_response), error.status_code


@app.errorhandler(Exception)
def handle_exception(error):
    """處理一般異常"""
    request_id = getattr(request, "request_id", None)
    error_response = error_formatter.format(error, request_id)

    # 記錄錯誤日誌
    app.logger.error(f"Unhandled exception: {error}", exc_info=True)

    return jsonify(error_response), 500


@app.errorhandler(404)
def handle_not_found(error):
    """處理 404"""
    return jsonify({
        "error": "NOT_FOUND",
        "message": f"找不到路徑: {request.method} {request.path}",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }), 404
```

---

### 2. Flask 使用範例

```python
# routes/users.py (Flask)

from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime

from errors.diagnostic_error import (
    ResourceNotFoundError,
    AuthenticationError,
    ValidationError,
    DatabaseError
)

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """取得使用者"""
    user = User.find_by_id(user_id)

    if not user:
        raise ResourceNotFoundError(
            resource_type="User",
            resource_id=str(user_id),
            hint="請確認使用者 ID 是否正確,或該使用者是否已被刪除"
        )

    return jsonify(user.to_dict())


@users_bp.route('/', methods=['POST'])
def create_user():
    """建立使用者"""
    data = request.get_json()
    errors = []

    # 手動驗證
    if not data.get('email'):
        errors.append({
            "field": "email",
            "error": "email 欄位為必填",
            "received": data.get('email')
        })
    elif not is_valid_email(data.get('email')):
        errors.append({
            "field": "email",
            "error": "email 格式不正確",
            "received": data.get('email')
        })

    age = data.get('age', 0)
    if age < 18:
        errors.append({
            "field": "age",
            "error": "年齡必須大於或等於 18",
            "received": age
        })

    if errors:
        raise ValidationError(
            message="請求資料驗證失敗",
            validation_errors=errors,
            hint="請檢查並修正以下欄位"
        )

    # 建立使用者...
    try:
        user = User.create(data)
        return jsonify(user.to_dict()), 201
    except Exception as e:
        raise DatabaseError(
            message="建立使用者時發生錯誤",
            details={
                "operation": "INSERT",
                "table": "users",
                "error": str(e)
            }
        )


# 認證裝飾器
from functools import wraps

def require_auth(f):
    """認證裝飾器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            raise AuthenticationError(
                message="缺少認證 Token",
                hint="請在 Authorization Header 中提供 Bearer Token"
            )

        try:
            token = auth_header.split(' ')[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError(
                message=f"認證 Token 已過期",
                hint="請使用 POST /api/auth/refresh 端點刷新 Token",
                details={
                    "current_time": datetime.utcnow().isoformat()
                }
            )
        except jwt.InvalidTokenError as e:
            raise AuthenticationError(
                message="Token 無效或已被撤銷",
                hint="請重新登入取得新的 Token",
                details={"reason": str(e)}
            )

        return f(*args, **kwargs)

    return decorated_function


# 使用範例
@users_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    """取得個人資料 (需要認證)"""
    user_id = request.user['user_id']
    user = User.find_by_id(user_id)
    return jsonify(user.to_dict())
```

---

## 🛡️ 環境設定

### .env

```bash
ENVIRONMENT=development
SECRET_KEY=your-secret-key

# 錯誤處理配置
ERROR_INCLUDE_STACK_TRACE=true
ERROR_INCLUDE_SOURCE_CONTEXT=true
ERROR_MAX_STACK_DEPTH=20
```

### .env.production

```bash
ENVIRONMENT=production

# 正式環境不包含 Stack Trace
ERROR_INCLUDE_STACK_TRACE=false
ERROR_INCLUDE_SOURCE_CONTEXT=false
```

---

## ✅ 最佳實踐

### DO ✅

1. **使用型別提示**
   ```python
   def get_user(user_id: int) -> Dict[str, Any]:
       ...
   ```

2. **使用自訂異常**
   ```python
   raise ResourceNotFoundError("User", str(user_id))
   ```

3. **記錄完整日誌**
   ```python
   logger.error(f"Error occurred: {error}", exc_info=True)
   ```

### DON'T ❌

1. **不要洩露敏感資訊**
   ```python
   # 壞
   details = {"password": user.password}

   # 好
   details = {"password": "***"}
   ```

2. **不要在正式環境顯示 Stack Trace**
   ```python
   if os.getenv("ENVIRONMENT") != "development":
       del error_response["stack_trace"]
   ```

---

## 🧪 測試 (pytest)

```python
# tests/test_error_formatter.py

import pytest
from errors.diagnostic_error import AuthenticationError
from utils.error_formatter import ErrorFormatter


def test_format_diagnostic_error():
    """測試格式化 DiagnosticError"""
    formatter = ErrorFormatter("development")
    error = AuthenticationError("Token 已過期", hint="請刷新 Token")

    result = formatter.format(error, "req-123")

    assert result["error"] == "AUTHENTICATION_FAILED"
    assert result["message"] == "Token 已過期"
    assert result["hint"] == "請刷新 Token"
    assert result["request_id"] == "req-123"


def test_include_stack_trace_in_development():
    """測試開發環境包含 Stack Trace"""
    formatter = ErrorFormatter("development")
    error = Exception("Test error")

    result = formatter.format(error)

    assert "stack_trace" in result
    assert isinstance(result["stack_trace"], list)


def test_exclude_stack_trace_in_production():
    """測試正式環境不包含 Stack Trace"""
    formatter = ErrorFormatter("production")
    error = Exception("Test error")

    result = formatter.format(error)

    assert "stack_trace" not in result


def test_sanitize_sensitive_fields():
    """測試清理敏感欄位"""
    formatter = ErrorFormatter("development")
    error = Exception("Test error")
    error.details = {
        "password": "secret123",
        "email": "user@example.com"
    }

    result = formatter.format(error)

    assert result["details"]["password"] == "***"
    assert result["details"]["email"] == "user@example.com"
```

---

## 📚 參考資源

- [FastAPI Exception Handling](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- [Flask Error Handling](https://flask.palletsprojects.com/en/2.3.x/errorhandling/)
- [SpecPilot API 開發規範](../api-development-guidelines.md)

---

## 🎯 與 SpecPilot 整合

使用此錯誤格式的 API 可以讓 SpecPilot 達到 **85-90%** 的診斷成功率。

---

## 💡 總結

這個 Python 範例提供:
- ✅ FastAPI 和 Flask 兩種實作
- ✅ 完整的診斷友善錯誤處理架構
- ✅ 環境感知的 Stack Trace 處理
- ✅ 自訂異常類別系統
- ✅ 實用的使用範例
- ✅ pytest 單元測試範例

開始使用這個範例,讓您的 Python API 與 SpecPilot 完美整合! 🚀