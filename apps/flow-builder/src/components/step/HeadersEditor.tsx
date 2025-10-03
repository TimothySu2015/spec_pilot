import { useFormContext } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { useToast } from '../../contexts/ToastContext';

interface HeadersEditorProps {
  stepIndex: number;
}

export default function HeadersEditor({ stepIndex }: HeadersEditorProps) {
  const { register, watch, setValue, getValues } = useFormContext<IFlowDefinition>();
  const { showToast } = useToast();

  // Headers 是一個 object，我們需要將它轉換為 array 來使用 useFieldArray
  // 使用 watch 來監聽 headers 變化
  const headers = watch(`steps.${stepIndex}.request.headers`) || {};
  const headerEntries = Object.entries(headers);

  const handleAddHeader = () => {
    const currentHeaders = getValues(`steps.${stepIndex}.request.headers`) || {};
    // 找一個未使用的預設 key
    let keyIndex = 1;
    let newKey = 'Header-Name';
    while (currentHeaders[newKey] || currentHeaders[`Header-Name-${keyIndex}`]) {
      newKey = `Header-Name-${keyIndex}`;
      keyIndex++;
    }

    // 使用 setValue 更新 headers
    setValue(`steps.${stepIndex}.request.headers.${newKey}`, '');
  };

  const handleRemoveHeader = (key: string) => {
    const currentHeaders = getValues(`steps.${stepIndex}.request.headers`) || {};
    const newHeaders = { ...currentHeaders };
    delete newHeaders[key];
    setValue(`steps.${stepIndex}.request.headers`, newHeaders);
    showToast('info', '已移除 Header');
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (!newKey || oldKey === newKey) return;

    const currentHeaders = getValues(`steps.${stepIndex}.request.headers`) || {};

    // 檢查新 key 是否已存在
    if (currentHeaders[newKey] && oldKey !== newKey) {
      showToast('warning', `Header "${newKey}" 已存在`);
      return;
    }

    const value = currentHeaders[oldKey];
    const newHeaders = { ...currentHeaders };
    delete newHeaders[oldKey];
    newHeaders[newKey] = value;
    setValue(`steps.${stepIndex}.request.headers`, newHeaders);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Request Headers (可選)
        </label>
        <button
          type="button"
          onClick={handleAddHeader}
          className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-blue-600 transition-colors"
        >
          + 新增 Header
        </button>
      </div>

      {headerEntries.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <p className="text-sm text-gray-600">尚未新增 Headers</p>
        </div>
      ) : (
        <div className="space-y-2">
          {headerEntries.map(([key]) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="text"
                defaultValue={key}
                onBlur={(e) => handleKeyChange(key, e.target.value)}
                placeholder="Header 名稱"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
              <span className="text-gray-400">:</span>
              <input
                type="text"
                {...register(`steps.${stepIndex}.request.headers.${key}` as const)}
                placeholder="Header 值"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
              />
              <button
                type="button"
                onClick={() => handleRemoveHeader(key)}
                className="p-2 text-red-500 hover:text-red-700 transition-colors"
                title="刪除"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs text-gray-500">
          💡 常用 Headers: <code className="px-1 bg-gray-100 rounded">Authorization</code>,{' '}
          <code className="px-1 bg-gray-100 rounded">Content-Type</code>,{' '}
          <code className="px-1 bg-gray-100 rounded">Accept</code>
        </p>
        <p className="text-xs text-gray-500">
          🔧 支援變數插值: <code className="px-1 bg-gray-100 rounded">Bearer {'{{token}}'}</code>
        </p>
      </div>
    </div>
  );
}
