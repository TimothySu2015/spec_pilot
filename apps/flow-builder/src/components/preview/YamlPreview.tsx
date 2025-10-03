import { useWatch } from 'react-hook-form';
import { exportToYaml } from '@specpilot/schemas';
import Editor from '@monaco-editor/react';
import { useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';

export default function YamlPreview() {
  const flowData = useWatch();
  const { showToast } = useToast();

  const yamlContent = useMemo(() => {
    try {
      // 移除空的 steps 陣列以避免驗證錯誤
      const cleanedData = { ...flowData };
      if (Array.isArray(cleanedData.steps) && cleanedData.steps.length === 0) {
        delete cleanedData.steps;
      }
      return exportToYaml(cleanedData as any);
    } catch (error) {
      return `# YAML 產生錯誤\n# ${error instanceof Error ? error.message : '請填寫必填欄位'}`;
    }
  }, [flowData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      showToast('success', '已複製到剪貼簿!');
    } catch (error) {
      console.error('複製失敗:', error);
      showToast('error', '複製失敗，請手動複製');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">YAML 預覽</h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
        >
          📋 複製
        </button>
      </div>

      <div className="flex-1">
        <Editor
          height="100%"
          language="yaml"
          value={yamlContent}
          theme="vs-light"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            fontSize: 13,
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
