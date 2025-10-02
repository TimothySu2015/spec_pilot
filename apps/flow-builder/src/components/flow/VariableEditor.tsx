import { useFormContext, useWatch } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';

export default function VariableEditor() {
  const { setValue } = useFormContext<IFlowDefinition>();
  const variables = useWatch<IFlowDefinition, 'variables'>({ name: 'variables' }) || {};
  const { showToast } = useToast();

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAddVariable = () => {
    if (!newKey.trim()) {
      showToast('warning', '變數名稱不可為空');
      return;
    }

    if (newKey in variables) {
      showToast('warning', `變數名稱 "${newKey}" 已存在`);
      return;
    }

    setValue('variables', {
      ...variables,
      [newKey]: newValue,
    });

    setNewKey('');
    setNewValue('');
    showToast('success', `已新增變數: ${newKey}`);
  };

  const handleUpdateVariable = (key: string, value: string) => {
    setValue('variables', {
      ...variables,
      [key]: value,
    });
  };

  const handleDeleteVariable = (key: string) => {
    const newVariables = { ...variables };
    delete newVariables[key];
    setValue('variables', newVariables);
    showToast('info', `已刪除變數: ${key}`);
  };

  const variableEntries = Object.entries(variables);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">變數定義 (Variables)</h3>

      {/* 現有變數列表 */}
      {variableEntries.length > 0 && (
        <div className="space-y-2 mb-4">
          {variableEntries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="text"
                value={key}
                disabled
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
              <input
                type="text"
                value={String(value)}
                onChange={(e) => handleUpdateVariable(key, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <button
                type="button"
                onClick={() => handleDeleteVariable(key)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="刪除變數"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 新增變數輸入 */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="變數名稱 (例如: api_token)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            onKeyPress={(e) => e.key === 'Enter' && handleAddVariable()}
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="變數值"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            onKeyPress={(e) => e.key === 'Enter' && handleAddVariable()}
          />
          <button
            type="button"
            onClick={handleAddVariable}
            className="px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            + 新增
          </button>
        </div>
      </div>

      {/* 使用提示 */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>提示:</strong> 變數可在 Flow 中使用 <code className="px-1 py-0.5 bg-blue-100 rounded">{'{{變數名稱}}'}</code> 語法引用
        </p>
        <p className="text-sm text-blue-700 mt-1">
          例如: <code className="px-1 py-0.5 bg-blue-100 rounded">{'{{api_token}}'}</code>
        </p>
      </div>
    </div>
  );
}
