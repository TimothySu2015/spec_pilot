import { useFormContext } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { exportFlowYaml, exportBoth } from '../../utils/export-handler';
import { useToast } from '../../contexts/ToastContext';
import { useState } from 'react';
import YAML from 'yaml';

export default function Header() {
  const { getValues, reset } = useFormContext<IFlowDefinition>();
  const { showToast } = useToast();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleSave = () => {
    const data = getValues();
    try {
      localStorage.setItem('specpilot_flow', JSON.stringify(data));
      showToast('success', '已儲存到瀏覽器 LocalStorage!');
    } catch (error) {
      showToast('error', '儲存失敗，請檢查瀏覽器設定');
    }
  };

  const handleExportYaml = () => {
    const data = getValues();
    try {
      exportFlowYaml(data);
      showToast('success', '已匯出 YAML 檔案');
      setShowExportMenu(false);
    } catch (error) {
      showToast('error', '匯出失敗');
    }
  };

  const handleExportBoth = () => {
    const data = getValues();
    try {
      exportBoth(data);
      showToast('success', '已匯出 YAML + JSON Schema');
      setShowExportMenu(false);
    } catch (error) {
      showToast('error', '匯出失敗');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const flowData = YAML.parse(text);

      // 驗證基本結構
      if (!flowData.name || !flowData.baseUrl) {
        throw new Error('無效的 Flow YAML 格式：缺少必要欄位');
      }

      // 使用 reset 更新整個表單
      reset(flowData);
      showToast('success', `已匯入 Flow: ${flowData.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'YAML 解析失敗';
      showToast('error', message);
    }

    // 重置 input 以允許重新匯入同一個檔案
    event.target.value = '';
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🚀</span>
        <h1 className="text-xl font-bold text-gray-900">SpecPilot Flow Builder</h1>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".yaml,.yml"
            onChange={handleImport}
            className="hidden"
          />
          <div className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
            📁 匯入
          </div>
        </label>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          💾 儲存
        </button>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            📤 匯出
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={handleExportYaml}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
              >
                📄 僅匯出 YAML
              </button>
              <button
                onClick={handleExportBoth}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
              >
                📦 匯出 YAML + Schema
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Close menu when clicking outside */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </header>
  );
}
