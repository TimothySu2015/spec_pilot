import { useFormContext, useFieldArray } from 'react-hook-form';
import { IFlowDefinition, IValidationRule } from '@specpilot/schemas';
import { useToast } from '../../contexts/ToastContext';
import { useOpenAPI } from '../../contexts/OpenAPIContext';
import { analyzeStep, ValidationSuggestion } from '../../services/openapi-analyzer';
import { useState, useEffect } from 'react';

interface ValidationEditorProps {
  stepIndex: number;
}

export default function ValidationEditor({ stepIndex }: ValidationEditorProps) {
  const { control, register, watch } = useFormContext<IFlowDefinition>();
  const { showToast } = useToast();
  const { openApiSpec } = useOpenAPI();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.validation` as const,
  });

  const [suggestions, setSuggestions] = useState<ValidationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // 監聽當前步驟的 request 資訊
  const method = watch(`steps.${stepIndex}.request.method`);
  const path = watch(`steps.${stepIndex}.request.path`);

  // 當 method 或 path 變化時，重新分析
  useEffect(() => {
    if (openApiSpec && method && path) {
      const newSuggestions = analyzeStep(method, path, openApiSpec);
      setSuggestions(newSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [openApiSpec, method, path]);

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

  const handleApplySuggestion = (suggestion: ValidationSuggestion) => {
    const newRule: any = {
      rule: suggestion.rule,
      path: suggestion.path,
    };

    if (suggestion.value) {
      newRule.value = suggestion.value;
    }

    append(newRule as IValidationRule);
    showToast('success', `已套用建議: ${suggestion.path}`);
  };

  const handleApplyAllSuggestions = () => {
    const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');

    highPrioritySuggestions.forEach(suggestion => {
      const newRule: any = {
        rule: suggestion.rule,
        path: suggestion.path,
      };

      if (suggestion.value) {
        newRule.value = suggestion.value;
      }

      append(newRule as IValidationRule);
    });

    showToast('success', `已批次套用 ${highPrioritySuggestions.length} 個高優先級建議`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* 智能建議折疊面板 */}
      {openApiSpec && suggestions.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span className="font-semibold text-blue-900">
                智能建議 ({suggestions.length} 個)
              </span>
            </div>
            <span className="text-blue-600">
              {showSuggestions ? '▼' : '▶'}
            </span>
          </button>

          {showSuggestions && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-blue-700">
                  根據 OpenAPI Schema 自動分析的驗證建議
                </p>
                <button
                  type="button"
                  onClick={handleApplyAllSuggestions}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                >
                  批次套用高優先級
                </button>
              </div>

              {suggestions.slice(0, 10).map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-white border border-blue-200 rounded p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                        {getPriorityLabel(suggestion.priority)}
                      </span>
                      <span className="text-xs font-medium text-gray-700">
                        {suggestion.rule}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-gray-900 mb-1 truncate">
                      {suggestion.path}
                    </p>
                    {suggestion.value && (
                      <p className="text-xs text-gray-600 font-mono truncate">
                        value: {suggestion.value}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {suggestion.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplySuggestion(suggestion)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                  >
                    套用
                  </button>
                </div>
              ))}

              {suggestions.length > 10 && (
                <p className="text-xs text-blue-600 text-center pt-2">
                  還有 {suggestions.length - 10} 個建議未顯示
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
