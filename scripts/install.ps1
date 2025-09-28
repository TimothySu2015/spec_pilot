# SpecPilot MCP 安裝腳本 (Windows PowerShell)
# 使用方式: iwr -useb <script-url> | iex

param(
    [string]$InstallDir = "$env:USERPROFILE\specpilot",
    [string]$RepoUrl = "https://github.com/your-org/specpilot.git"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 開始安裝 SpecPilot MCP 伺服器..." -ForegroundColor Green

# 檢查系統需求
function Test-Requirements {
    Write-Host "📋 檢查系統需求..." -ForegroundColor Yellow

    # 檢查 Node.js
    try {
        $nodeVersion = (node --version).Substring(1)
        $requiredVersion = [Version]"20.11.1"
        $currentVersion = [Version]$nodeVersion

        if ($currentVersion -lt $requiredVersion) {
            throw "Node.js 版本過舊"
        }

        Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Node.js 未安裝或版本過舊 (需要 >= 20.11.1)" -ForegroundColor Red
        Write-Host "   請到 https://nodejs.org 下載安裝" -ForegroundColor Yellow
        exit 1
    }

    # 檢查/安裝 pnpm
    try {
        $pnpmVersion = pnpm --version
        Write-Host "✅ pnpm $pnpmVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "📦 安裝 pnpm..." -ForegroundColor Yellow
        npm install -g pnpm
        $pnpmVersion = pnpm --version
        Write-Host "✅ pnpm $pnpmVersion" -ForegroundColor Green
    }

    # 檢查 Git
    try {
        $gitVersion = (git --version).Split(' ')[2]
        Write-Host "✅ Git $gitVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Git 未安裝。請先安裝 Git" -ForegroundColor Red
        Write-Host "   下載位置: https://git-scm.com" -ForegroundColor Yellow
        exit 1
    }
}

# 安裝 SpecPilot
function Install-SpecPilot {
    Write-Host "📥 下載 SpecPilot..." -ForegroundColor Yellow

    # 移除現有目錄
    if (Test-Path $InstallDir) {
        Write-Host "🗑️  移除現有安裝..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $InstallDir
    }

    # 克隆專案
    git clone $RepoUrl $InstallDir
    Set-Location $InstallDir

    Write-Host "📦 安裝依賴..." -ForegroundColor Yellow
    pnpm install

    Write-Host "🔨 建置專案..." -ForegroundColor Yellow
    pnpm run build

    Write-Host "✅ 安裝完成!" -ForegroundColor Green
}

# 設定環境
function Set-Environment {
    Write-Host "⚙️  設定環境..." -ForegroundColor Yellow

    Set-Location $InstallDir

    # 建立設定檔
    $envFile = Join-Path $InstallDir ".env.local"
    if (-not (Test-Path $envFile)) {
        Write-Host "📝 建立設定檔..." -ForegroundColor Yellow

        $envContent = @"
# SpecPilot MCP 設定檔
# 請根據您的環境調整以下設定

# API 基礎 URL（必要）
SPEC_PILOT_BASE_URL=https://api.example.com

# API 埠號（選用）
# SPEC_PILOT_PORT=3000

# API 認證 Token（選用）
# SPEC_PILOT_TOKEN=your-api-token

# 執行環境
NODE_ENV=production

# 日誌層級
LOG_LEVEL=info
"@

        $envContent | Out-File -FilePath $envFile -Encoding utf8
        Write-Host "✅ 設定檔已建立: $envFile" -ForegroundColor Green
        Write-Host "📝 請編輯此檔案以配置您的環境" -ForegroundColor Yellow
    }

    # 建立啟動腳本
    $scriptDir = Join-Path $env:USERPROFILE "bin"
    if (-not (Test-Path $scriptDir)) {
        New-Item -ItemType Directory -Path $scriptDir | Out-Null
    }

    $scriptPath = Join-Path $scriptDir "specpilot-mcp.ps1"
    $scriptContent = @"
# SpecPilot MCP 啟動腳本
Set-Location "$InstallDir"
& pnpm run start:mcp @args
"@

    $scriptContent | Out-File -FilePath $scriptPath -Encoding utf8

    # 建立批次檔案
    $batPath = Join-Path $scriptDir "specpilot-mcp.bat"
    $batContent = @"
@echo off
cd /d "$InstallDir"
pnpm run start:mcp %*
"@

    $batContent | Out-File -FilePath $batPath -Encoding ascii

    # 加入 PATH
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
    if ($currentPath -notlike "*$scriptDir*") {
        $newPath = "$currentPath;$scriptDir"
        [Environment]::SetEnvironmentVariable("PATH", $newPath, [EnvironmentVariableTarget]::User)
        Write-Host "📝 已將 $scriptDir 加入 PATH" -ForegroundColor Green
    }
}

# 測試安裝
function Test-Installation {
    Write-Host "🧪 測試安裝..." -ForegroundColor Yellow

    Set-Location $InstallDir

    try {
        # 測試基本功能
        $testRequest = '{"jsonrpc": "2.0", "method": "listSpecs", "id": "install-test"}'
        $testOutput = $testRequest | pnpm run start:mcp 2>&1

        if ($testOutput -match "jsonrpc") {
            Write-Host "✅ MCP 伺服器測試通過" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️  MCP 伺服器測試未完全通過，但安裝已完成" -ForegroundColor Yellow
            Write-Host "   請檢查設定檔並手動測試" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "⚠️  測試過程中遇到問題，但安裝已完成" -ForegroundColor Yellow
    }
}

# 顯示完成訊息
function Show-Completion {
    Write-Host ""
    Write-Host "🎉 SpecPilot MCP 安裝完成!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 安裝位置: $InstallDir" -ForegroundColor Cyan
    Write-Host "⚙️  設定檔案: $InstallDir\.env.local" -ForegroundColor Cyan
    Write-Host "🚀 啟動指令: specpilot-mcp" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📚 使用指南:" -ForegroundColor Yellow
    Write-Host "   1. 編輯設定檔: notepad $InstallDir\.env.local" -ForegroundColor White
    Write-Host "   2. 測試伺服器: echo '{\"jsonrpc\":\"2.0\",\"method\":\"listSpecs\",\"id\":\"1\"}' | specpilot-mcp" -ForegroundColor White
    Write-Host "   3. 查看文件: $InstallDir\docs\mcp-interface.md" -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 重新開啟 PowerShell 以使用 specpilot-mcp 指令" -ForegroundColor Yellow
    Write-Host ""
}

# 主程式
function Main {
    Test-Requirements
    Install-SpecPilot
    Set-Environment
    Test-Installation
    Show-Completion
}

# 執行安裝
Main