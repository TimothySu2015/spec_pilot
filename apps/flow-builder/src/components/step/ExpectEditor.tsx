import { useFormContext, useFieldArray } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { useOpenAPI } from '../../contexts/OpenAPIContext';
import { extractResponseSchema, extractFields, findEndpointInSpec, ResponseField } from '../../services/openapi-analyzer';
import { useState, useEffect } from 'react';

interface ExpectEditorProps {
  stepIndex: number;
}

export default function ExpectEditor({ stepIndex }: ExpectEditorProps) {
  const { register, control, watch } = useFormContext<IFlowDefinition>();
  const { openApiSpec } = useOpenAPI();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.expect.bodyFields`,
  });

  const [availableFields, setAvailableFields] = useState<ResponseField[]>([]);
  const [showFieldSuggestions, setShowFieldSuggestions] = useState(false);

  // 監聽當前步驟的 request 資訊
  const method = watch(`steps.${stepIndex}.request.method`);
  const path = watch(`steps.${stepIndex}.request.path`);

  // 分析可用欄位
  useEffect(() => {
    if (openApiSpec && method && path) {
      const endpoint = findEndpointInSpec(openApiSpec, method, path);
      if (endpoint) {
        const responseSchema = extractResponseSchema(endpoint, openApiSpec);
        if (responseSchema) {
          const fields = extractFields(responseSchema, openApiSpec);
          setAvailableFields(fields);
        } else {
          setAvailableFields([]);
        }
      } else {
        setAvailableFields([]);
      }
    } else {
      setAvailableFields([]);
    }
  }, [openApiSpec, method, path]);

  const handleAddField = () => {
    append({
      fieldName: '',
      expectedValue: '',
      validationMode: 'any',
    });
  };

  const handleAddFieldFromSuggestion = (field: ResponseField) => {
    append({
      fieldName: field.path,
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

        {/* 可用欄位建議 */}
        {openApiSpec && availableFields.length > 0 && (
          <div className="border border-green-200 bg-green-50 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFieldSuggestions(!showFieldSuggestions)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <span className="font-semibold text-green-900">
                  可用欄位 ({availableFields.length} 個)
                </span>
              </div>
              <span className="text-green-600">
                {showFieldSuggestions ? '▼' : '▶'}
              </span>
            </button>

            {showFieldSuggestions && (
              <div className="px-4 pb-4">
                <p className="text-xs text-green-700 mb-3">
                  根據 OpenAPI Response Schema 解析的可用欄位
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {availableFields.map((field, index) => (
                    <div
                      key={index}
                      className="bg-white border border-green-200 rounded p-2 hover:border-green-400 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-gray-900 truncate font-medium">
                            {field.path}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
                              {field.type}
                            </span>
                            {field.required && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                                必填
                              </span>
                            )}
                            {field.format && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {field.format}
                              </span>
                            )}
                          </div>
                          {field.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {field.description}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddFieldFromSuggestion(field)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                        >
                          新增
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
              + 手動新增
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
