import { useFormContext } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { exportFlowYaml, exportBoth } from '../../utils/export-handler';
import { useState } from 'react';

export default function Header() {
  const { getValues } = useFormContext<IFlowDefinition>();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleSave = () => {
    const data = getValues();
    // 儲存到 LocalStorage
    localStorage.setItem('specpilot_flow', JSON.stringify(data));
    alert('已儲存到瀏覽器 LocalStorage!');
  };

  const handleExportYaml = () => {
    const data = getValues();
    exportFlowYaml(data);
    setShowExportMenu(false);
  };

  const handleExportBoth = () => {
    const data = getValues();
    exportBoth(data);
    setShowExportMenu(false);
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
