#!/bin/bash

# SpecPilot MCP 安裝腳本 (macOS/Linux)
# 使用方式: curl -fsSL <script-url> | bash

set -e

echo "🚀 開始安裝 SpecPilot MCP 伺服器..."

# 檢查系統需求
check_requirements() {
    echo "📋 檢查系統需求..."

    # 檢查 Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安裝。請先安裝 Node.js >= 20.11.1"
        echo "   安裝方式: https://nodejs.org"
        exit 1
    fi

    NODE_VERSION=$(node --version | sed 's/v//')
    REQUIRED_VERSION="20.11.1"

    if ! node -e "process.exit(process.version.split('.').map(Number).reduce((a,v,i)=>a+v*Math.pow(1000,2-i),0) >= '${REQUIRED_VERSION}'.split('.').map(Number).reduce((a,v,i)=>a+v*Math.pow(1000,2-i),0) ? 0 : 1)"; then
        echo "❌ Node.js 版本過舊 (目前: ${NODE_VERSION}, 需要: >= ${REQUIRED_VERSION})"
        exit 1
    fi

    echo "✅ Node.js ${NODE_VERSION}"

    # 檢查/安裝 pnpm
    if ! command -v pnpm &> /dev/null; then
        echo "📦 安裝 pnpm..."
        npm install -g pnpm
    fi

    PNPM_VERSION=$(pnpm --version)
    echo "✅ pnpm ${PNPM_VERSION}"

    # 檢查 Git
    if ! command -v git &> /dev/null; then
        echo "❌ Git 未安裝。請先安裝 Git"
        exit 1
    fi

    echo "✅ Git $(git --version | cut -d' ' -f3)"
}

# 安裝 SpecPilot
install_specpilot() {
    echo "📥 下載 SpecPilot..."

    INSTALL_DIR="${HOME}/specpilot"
    REPO_URL="${SPECPILOT_REPO_URL:-https://github.com/your-org/specpilot.git}"

    # 移除現有目錄
    if [ -d "${INSTALL_DIR}" ]; then
        echo "🗑️  移除現有安裝..."
        rm -rf "${INSTALL_DIR}"
    fi

    # 克隆專案
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"

    echo "📦 安裝依賴..."
    pnpm install

    echo "🔨 建置專案..."
    pnpm run build

    echo "✅ 安裝完成!"
}

# 設定環境
setup_environment() {
    echo "⚙️  設定環境..."

    cd "${INSTALL_DIR}"

    # 建立設定檔
    if [ ! -f ".env.local" ]; then
        echo "📝 建立設定檔..."
        cat > .env.local << 'EOF'
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
EOF
        echo "✅ 設定檔已建立: ${INSTALL_DIR}/.env.local"
        echo "📝 請編輯此檔案以配置您的環境"
    fi

    # 建立啟動腳本
    cat > "${HOME}/bin/specpilot-mcp" << EOF
#!/bin/bash
cd "${INSTALL_DIR}"
exec pnpm run start:mcp "\$@"
EOF
    chmod +x "${HOME}/bin/specpilot-mcp"

    # 確保 bin 目錄在 PATH 中
    mkdir -p "${HOME}/bin"
    if [[ ":$PATH:" != *":${HOME}/bin:"* ]]; then
        echo "export PATH=\"\${HOME}/bin:\${PATH}\"" >> "${HOME}/.bashrc"
        echo "export PATH=\"\${HOME}/bin:\${PATH}\"" >> "${HOME}/.zshrc" 2>/dev/null || true
        echo "📝 已將 ${HOME}/bin 加入 PATH"
    fi
}

# 測試安裝
test_installation() {
    echo "🧪 測試安裝..."

    cd "${INSTALL_DIR}"

    # 測試基本功能
    echo '{"jsonrpc": "2.0", "method": "listSpecs", "id": "install-test"}' | timeout 10s pnpm run start:mcp > /tmp/specpilot-test.out 2>&1 || true

    if grep -q "jsonrpc" /tmp/specpilot-test.out; then
        echo "✅ MCP 伺服器測試通過"
    else
        echo "⚠️  MCP 伺服器測試未完全通過，但安裝已完成"
        echo "   請檢查設定檔並手動測試"
    fi

    rm -f /tmp/specpilot-test.out
}

# 顯示完成訊息
show_completion() {
    echo ""
    echo "🎉 SpecPilot MCP 安裝完成!"
    echo ""
    echo "📁 安裝位置: ${INSTALL_DIR}"
    echo "⚙️  設定檔案: ${INSTALL_DIR}/.env.local"
    echo "🚀 啟動指令: specpilot-mcp"
    echo ""
    echo "📚 使用指南:"
    echo "   1. 編輯設定檔: nano ${INSTALL_DIR}/.env.local"
    echo "   2. 測試伺服器: echo '{\"jsonrpc\":\"2.0\",\"method\":\"listSpecs\",\"id\":\"1\"}' | specpilot-mcp"
    echo "   3. 查看文件: ${INSTALL_DIR}/docs/mcp-interface.md"
    echo ""
    echo "🔄 重新載入 shell 以使用 specpilot-mcp 指令:"
    echo "   source ~/.bashrc  # 或 source ~/.zshrc"
    echo ""
}

# 主程式
main() {
    check_requirements
    install_specpilot
    setup_environment
    test_installation
    show_completion
}

# 執行安裝
main "$@"