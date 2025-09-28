# SpecPilot MCP 伺服器安裝指南

## 系統需求

- **Node.js**: >= 20.11.1 LTS
- **pnpm**: >= 9.1.0
- **作業系統**: Windows 10/11, macOS, Linux

## 安裝方式

### 方式 1：從原始碼安裝（推薦）

```bash
# 1. 克隆專案
git clone <repository-url> specpilot
cd specpilot

# 2. 安裝 pnpm（如果尚未安裝）
npm install -g pnpm

# 3. 安裝專案依賴
pnpm install

# 4. 建置專案
pnpm run build

# 5. 驗證安裝
pnpm run start:mcp --help
```

### 方式 2：使用安裝腳本

#### Windows (PowerShell)

```powershell
# 下載並執行安裝腳本
iwr -useb https://raw.githubusercontent.com/<your-repo>/main/scripts/install.ps1 | iex
```

#### macOS/Linux (Bash)

```bash
# 下載並執行安裝腳本
curl -fsSL https://raw.githubusercontent.com/<your-repo>/main/scripts/install.sh | bash
```

### 方式 3：使用 Docker

```bash
# 拉取 Docker 映像
docker pull <your-registry>/specpilot:latest

# 執行 MCP 伺服器
docker run -it --rm \
  -v $(pwd)/specs:/app/specs \
  -v $(pwd)/flows:/app/flows \
  -v $(pwd)/reports:/app/reports \
  <your-registry>/specpilot:latest mcp
```

## 環境設定

### 1. 建立設定檔

```bash
# 複製範例設定檔
cp .env.example .env.local

# 編輯設定
nano .env.local
```

### 2. 設定檔內容

```bash
# API 基礎 URL
SPEC_PILOT_BASE_URL=https://your-api.example.com

# API 埠號（選用）
SPEC_PILOT_PORT=3000

# API 認證 Token（選用）
SPEC_PILOT_TOKEN=your-api-token

# 執行環境
NODE_ENV=production

# 日誌層級
LOG_LEVEL=info
```

## 快速測試

### 測試 MCP 伺服器

```bash
# 測試基本功能
echo '{"jsonrpc": "2.0", "method": "listSpecs", "id": "test-1"}' | pnpm run start:mcp

# 使用範例檔案測試
cat docs/examples/listSpecs-example.json | pnpm run start:mcp
```

### 預期輸出

```json
{
  "jsonrpc": "2.0",
  "id": "test-1",
  "result": [
    {
      "name": "petstore.json",
      "path": "specs/petstore.json",
      "size": 4632,
      "extension": "json"
    }
  ]
}
```

## 故障排除

### 常見問題

#### 1. Node.js 版本過舊

```bash
# 檢查版本
node --version

# 升級 Node.js
# 請到 https://nodejs.org 下載最新 LTS 版本
```

#### 2. pnpm 未安裝

```bash
# 安裝 pnpm
npm install -g pnpm

# 或使用 Corepack
corepack enable
corepack prepare pnpm@9.1.0 --activate
```

#### 3. 依賴安裝失敗

```bash
# 清理並重新安裝
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

#### 4. 建置失敗

```bash
# 檢查 TypeScript 版本
pnpm exec tsc --version

# 重新建置
pnpm run build
```

#### 5. MCP 伺服器無回應

```bash
# 檢查日誌
tail -f logs/specpilot.log

# 驗證設定檔
cat .env.local
```

## 生產環境部署

### 使用 PM2

```bash
# 安裝 PM2
npm install -g pm2

# 建立 PM2 設定檔
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'specpilot-mcp',
    script: 'apps/mcp-server/src/index.ts',
    interpreter: 'pnpm',
    interpreter_args: 'exec tsx',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# 啟動服務
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 使用 systemd (Linux)

```bash
# 建立服務檔案
sudo cat > /etc/systemd/system/specpilot-mcp.service << 'EOF'
[Unit]
Description=SpecPilot MCP Server
After=network.target

[Service]
Type=simple
User=specpilot
WorkingDirectory=/opt/specpilot
ExecStart=/usr/bin/pnpm run start:mcp
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 啟用服務
sudo systemctl enable specpilot-mcp
sudo systemctl start specpilot-mcp
sudo systemctl status specpilot-mcp
```

## MCP 客戶端整合

### Claude Desktop

在 Claude Desktop 的設定中新增：

```json
{
  "mcpServers": {
    "specpilot": {
      "command": "pnpm",
      "args": ["run", "start:mcp"],
      "cwd": "/path/to/specpilot"
    }
  }
}
```

### 自訂客戶端

```javascript
// 範例 Node.js 客戶端
import { spawn } from 'child_process';

const mcpClient = spawn('pnpm', ['run', 'start:mcp'], {
  cwd: '/path/to/specpilot',
  stdio: ['pipe', 'pipe', 'pipe']
});

// 發送請求
const request = {
  jsonrpc: '2.0',
  method: 'listSpecs',
  id: 'client-001'
};

mcpClient.stdin.write(JSON.stringify(request) + '\n');

// 處理回應
mcpClient.stdout.on('data', (data) => {
  const response = JSON.parse(data.toString());
  console.log('收到回應:', response);
});
```

## 更新與維護

### 更新到最新版本

```bash
# 拉取最新程式碼
git pull origin main

# 更新依賴
pnpm install

# 重新建置
pnpm run build

# 重啟服務
pm2 restart specpilot-mcp
```

### 備份與恢復

```bash
# 備份設定與資料
tar -czf specpilot-backup-$(date +%Y%m%d).tar.gz \
  .env.local specs/ flows/ reports/ logs/

# 恢復備份
tar -xzf specpilot-backup-20250928.tar.gz
```

## 支援與社群

- **文件**: [docs/mcp-interface.md](mcp-interface.md)
- **範例**: [docs/examples/](examples/)
- **問題回報**: GitHub Issues
- **討論區**: GitHub Discussions

## 授權

MIT License - 詳見 [LICENSE](../LICENSE) 檔案。