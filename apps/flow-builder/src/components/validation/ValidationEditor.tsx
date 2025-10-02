import { useFormContext, useFieldArray } from 'react-hook-form';
import { IFlowDefinition, IValidationRule } from '@specpilot/schemas';
import { useToast } from '../../contexts/ToastContext';

interface ValidationEditorProps {
  stepIndex: number;
}

export default function ValidationEditor({ stepIndex }: ValidationEditorProps) {
  const { control, register, watch } = useFormContext<IFlowDefinition>();
  const { showToast } = useToast();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.validation` as const,
  });

  const handleAddRule = () => {
    append({
      rule: 'notNull',
      path: '',
    } as IValidationRule);
  };

  const handleRemoveRule = (index: number) => {
    remove(index);
    showToast('info', '驗證規則已移除');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Validation 驗證規則</h3>
        <button
          type="button"
          onClick={handleAddRule}
          className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-blue-600 transition-colors"
        >
          + 新增規則
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <p className="text-sm text-gray-600">尚未新增驗證規則</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const ruleType = watch(`steps.${stepIndex}.validation.${index}.rule`);

            return (
              <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    {/* 規則類型選擇 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        規則類型
                      </label>
                      <select
                        {...register(`steps.${stepIndex}.validation.${index}.rule` as const)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="notNull">notNull - 欄位不可為 null</option>
                        <option value="regex">regex - 正則表達式驗證</option>
                        <option value="contains">contains - 包含特定值</option>
                      </select>
                    </div>

                    {/* JSON Path */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        JSON Path
                      </label>
                      <input
                        {...register(`steps.${stepIndex}.validation.${index}.path` as const)}
                        type="text"
                        placeholder="例如: data.user.email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>

                    {/* Value 欄位 (僅 regex 和 contains 需要) */}
                    {(ruleType === 'regex' || ruleType === 'contains') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {ruleType === 'regex' ? '正則表達式' : '預期值'}
                        </label>
                        <input
                          {...register(`steps.${stepIndex}.validation.${index}.value` as const)}
                          type="text"
                          placeholder={
                            ruleType === 'regex'
                              ? '例如: ^.+@.+\\..+$'
                              : '例如: success'
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveRule(index)}
                    className="p-2 text-red-500 hover:text-red-700 transition-colors"
                    title="刪除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
