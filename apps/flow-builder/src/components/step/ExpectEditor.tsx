import { useFormContext, useFieldArray } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';

interface ExpectEditorProps {
  stepIndex: number;
}

export default function ExpectEditor({ stepIndex }: ExpectEditorProps) {
  const { register, control } = useFormContext<IFlowDefinition>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.expect.bodyFields`,
  });

  const handleAddField = () => {
    append({
      fieldName: '',
      expectedValue: '',
      validationMode: 'any',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">預期回應 (Expect)</h3>

      <div className="space-y-4">
        {/* Status Code */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            預期狀態碼 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register(`steps.${stepIndex}.expect.statusCode`, { valueAsNumber: true })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="200"
            min="100"
            max="599"
          />
        </div>

        {/* Expect Body Table */}
        <div className="border border-gray-200 rounded-lg">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Response Body 欄位驗證</h4>
              <p className="text-xs text-gray-600 mt-1">定義預期的回應欄位與驗證模式</p>
            </div>
            <button
              type="button"
              onClick={handleAddField}
              className="px-3 py-1 text-sm bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              + 新增欄位
            </button>
          </div>

          {fields.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                    欄位名稱
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                    預期值
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                    驗證模式
                  </th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 w-20">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        {...register(`steps.${stepIndex}.expect.bodyFields.${index}.fieldName`)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="id"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        {...register(`steps.${stepIndex}.expect.bodyFields.${index}.expectedValue`)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="(任意值) 或具體值"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        {...register(`steps.${stepIndex}.expect.bodyFields.${index}.validationMode`)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="any">存在即可</option>
                        <option value="exact">精確匹配</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="刪除"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm">尚未新增欄位驗證</p>
              <p className="text-xs mt-1">點擊「+ 新增欄位」開始</p>
            </div>
          )}

          {/* Help Text */}
          <div className="p-4 bg-gray-50 border-t text-sm text-gray-600">
            <p className="font-medium mb-2">💡 驗證模式說明:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>存在即可</strong>: 只檢查欄位是否存在,不檢查值 (YAML 輸出為 null)</li>
              <li>• <strong>精確匹配</strong>: 必須完全相同 (YAML 輸出為具體值)</li>
              <li>• 支援變數插值: <code className="px-1 bg-gray-100 rounded">{'{{variable}}'}</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
