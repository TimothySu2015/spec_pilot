import { useFormContext } from 'react-hook-form';
import { IFlowDefinition, FlowDefinitionSchema } from '@specpilot/schemas';
import { useEffect, useState } from 'react';

export default function ValidationPanel() {
  const { watch } = useFormContext<IFlowDefinition>();
  const formData = watch();
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    try {
      FlowDefinitionSchema.parse(formData);
      setIsValid(true);
      setValidationErrors([]);
    } catch (error: any) {
      setIsValid(false);
      if (error.errors) {
        setValidationErrors(error.errors);
      }
    }
  }, [formData]);

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">即時驗證</h3>

      {/* 驗證狀態 */}
      <div className={`p-3 rounded-lg mb-4 ${
        isValid
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{isValid ? '✅' : '❌'}</span>
          <span className={`text-sm font-medium ${
            isValid ? 'text-green-800' : 'text-red-800'
          }`}>
            {isValid ? 'Schema 驗證通過' : `發現 ${validationErrors.length} 個錯誤`}
          </span>
        </div>
      </div>

      {/* 錯誤列表 */}
      {!isValid && validationErrors.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-700">錯誤詳情</h4>
          {validationErrors.map((error, index) => (
            <div key={index} className="p-3 bg-red-50 border-l-3 border-red-400 rounded">
              <div className="text-sm font-medium text-red-800 mb-1">
                {error.path?.join('.') || '根層級'}
              </div>
              <div className="text-xs text-red-700">
                {error.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 統計資訊 */}
      {isValid && (
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>測試步驟數:</span>
            <span className="font-medium">{formData.steps?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>變數數量:</span>
            <span className="font-medium">
              {formData.variables ? Object.keys(formData.variables).length : 0}
            </span>
          </div>
          {formData.steps && formData.steps.length > 0 && (
            <>
              <div className="flex justify-between">
                <span>驗證規則總數:</span>
                <span className="font-medium">
                  {formData.steps.reduce((sum, step) => sum + (step.validation?.length || 0), 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>變數擷取總數:</span>
                <span className="font-medium">
                  {formData.steps.reduce((sum, step) => sum + (step.capture?.length || 0), 0)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 提示 */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        💡 此面板會即時顯示 Zod Schema 驗證結果
      </div>
    </div>
  );
}
