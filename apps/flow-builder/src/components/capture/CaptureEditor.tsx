import { useFormContext, useFieldArray } from 'react-hook-form';
import { IFlowDefinition, ICaptureVariable } from '@specpilot/schemas';
import { useToast } from '../../contexts/ToastContext';

interface CaptureEditorProps {
  stepIndex: number;
}

export default function CaptureEditor({ stepIndex }: CaptureEditorProps) {
  const { control, register } = useFormContext<IFlowDefinition>();
  const { showToast } = useToast();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.capture` as const,
  });

  const handleAddCapture = () => {
    append({
      variableName: '',
      path: '',
    } as ICaptureVariable);
  };

  const handleRemoveCapture = (index: number) => {
    remove(index);
    showToast('info', '變數擷取項目已刪除');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Capture 變數擷取</h3>
          <p className="text-xs text-gray-500 mt-1">自回應資料中擷取欄位，保存為後續步驟可用的變數</p>
        </div>
        <button
          type="button"
          onClick={handleAddCapture}
          className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-blue-600 transition-colors"
        >
          + 新增擷取
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <p className="text-sm text-gray-600">目前尚未設定擷取項目</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  {/* JSON Path */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      JSON Path <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register(`steps.${stepIndex}.capture.${index}.path` as const)}
                      type="text"
                      placeholder="例如: data.token 或 users[0].id"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>

                  {/* 變數名稱 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      儲存成變數 <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register(`steps.${stepIndex}.capture.${index}.variableName` as const)}
                      type="text"
                      placeholder="例如: authToken"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveCapture(index)}
                  className="p-2 text-red-500 hover:text-red-700 transition-colors"
                  title="移除"
                >
                  ✕
                </button>
              </div>

              <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                可於後續步驟使用 <code className="bg-blue-100 px-1 rounded">{'{{variableName}}'}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
