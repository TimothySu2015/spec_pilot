import { useFormContext, useFieldArray } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { useToast } from '../../contexts/ToastContext';
import { useOpenAPI } from '../../contexts/OpenAPIContext';
import { analyzeStep, ValidationSuggestion } from '../../services/openapi-analyzer';
import { useState, useEffect } from 'react';

interface CustomRulesEditorProps {
  stepIndex: number;
}

/**
 * CustomRulesEditor - 新格式驗證規則編輯器
 *
 * 使用 expect.body.customRules 欄位（Phase 12 新格式）
 * 支援所有 8 種驗證規則
 */
export default function CustomRulesEditor({ stepIndex }: CustomRulesEditorProps) {
  const { control, register, watch } = useFormContext<IFlowDefinition>();
  const { showToast } = useToast();
  const { openApiSpec } = useOpenAPI();

  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.expect.body.customRules` as const,
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
      field: '',
      rule: 'notNull',
    } as any);
  };

  const handleRemoveRule = (index: number) => {
    remove(index);
    showToast('info', '驗證規則已移除');
  };

  const handleApplySuggestion = (suggestion: ValidationSuggestion) => {
    const newRule: any = {
      field: suggestion.path, // 使用 field 而非 path（新格式）
      rule: suggestion.rule,
    };

    if (suggestion.value) {
      newRule.value = suggestion.value;
    }

    append(newRule);
    showToast('success', `已套用建議: ${suggestion.path}`);
  };

  const handleApplyAllSuggestions = () => {
    const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');

    highPrioritySuggestions.forEach(suggestion => {
      const newRule: any = {
        field: suggestion.path,
        rule: suggestion.rule,
      };

      if (suggestion.value) {
        newRule.value = suggestion.value;
      }

      append(newRule);
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
        <div className="border border-green-200 bg-green-50 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span className="font-semibold text-green-900">
                智能建議 ({suggestions.length} 個)
              </span>
              <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded">
                新格式
              </span>
            </div>
            <span className="text-green-600">
              {showSuggestions ? '▼' : '▶'}
            </span>
          </button>

          {showSuggestions && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-green-700">
                  根據 OpenAPI Schema 自動分析的驗證建議
                </p>
                <button
                  type="button"
                  onClick={handleApplyAllSuggestions}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                >
                  批次套用高優先級
                </button>
              </div>

              {suggestions.slice(0, 10).map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-white border border-green-200 rounded p-3 flex items-start justify-between gap-3"
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
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                  >
                    套用
                  </button>
                </div>
              ))}

              {suggestions.length > 10 && (
                <p className="text-xs text-green-600 text-center pt-2">
                  還有 {suggestions.length - 10} 個建議未顯示
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Custom Rules 驗證規則</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            ✅ 推薦格式 - 支援所有 8 種驗證規則
          </p>
        </div>
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
          <p className="text-xs text-gray-500 mt-1">支援 8 種驗證規則</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const ruleType = watch(`steps.${stepIndex}.expect.body.customRules.${index}.rule`);

            return (
              <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    {/* 規則類型選擇 - 支援所有 8 種規則 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        規則類型
                      </label>
                      <select
                        {...register(`steps.${stepIndex}.expect.body.customRules.${index}.rule` as const)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="notNull">notNull - 欄位不可為 null</option>
                        <option value="regex">regex - 正則表達式驗證</option>
                        <option value="contains">contains - 包含特定值</option>
                        <option value="equals">equals - 精確值比對</option>
                        <option value="notContains">notContains - 不包含特定值</option>
                        <option value="greaterThan">greaterThan - 數值大於</option>
                        <option value="lessThan">lessThan - 數值小於</option>
                        <option value="length">length - 長度驗證</option>
                      </select>
                    </div>

                    {/* Field 欄位 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        欄位名稱 (Field)
                      </label>
                      <input
                        {...register(`steps.${stepIndex}.expect.body.customRules.${index}.field` as const)}
                        type="text"
                        placeholder="例如: email, age, status"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        💡 提示：也支援巢狀欄位，例如 data.user.email
                      </p>
                    </div>

                    {/* Value 欄位 (需要 value 的規則) */}
                    {(ruleType === 'regex' ||
                      ruleType === 'contains' ||
                      ruleType === 'equals' ||
                      ruleType === 'notContains' ||
                      ruleType === 'greaterThan' ||
                      ruleType === 'lessThan' ||
                      ruleType === 'length') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {ruleType === 'regex' && '正則表達式'}
                          {ruleType === 'contains' && '包含的值'}
                          {ruleType === 'equals' && '預期的值'}
                          {ruleType === 'notContains' && '不應包含的值'}
                          {ruleType === 'greaterThan' && '最小值（不含）'}
                          {ruleType === 'lessThan' && '最大值（不含）'}
                          {ruleType === 'length' && '預期長度'}
                        </label>
                        <input
                          {...register(`steps.${stepIndex}.expect.body.customRules.${index}.value` as const)}
                          type={
                            ruleType === 'greaterThan' ||
                            ruleType === 'lessThan' ||
                            ruleType === 'length'
                              ? 'number'
                              : 'text'
                          }
                          placeholder={
                            ruleType === 'regex' ? '例如: ^.+@.+\\..+$' :
                            ruleType === 'contains' ? '例如: success' :
                            ruleType === 'equals' ? '例如: active' :
                            ruleType === 'notContains' ? '例如: error' :
                            ruleType === 'greaterThan' ? '例如: 0' :
                            ruleType === 'lessThan' ? '例如: 100' :
                            ruleType === 'length' ? '例如: 5' :
                            ''
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

      {/* 說明區塊 */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        <p className="font-medium mb-2">📚 8 種驗證規則說明:</p>
        <ul className="space-y-1 text-xs text-blue-700">
          <li>• <strong>notNull</strong>: 欄位必須存在且不為 null</li>
          <li>• <strong>regex</strong>: 使用正則表達式驗證欄位值</li>
          <li>• <strong>contains</strong>: 欄位值必須包含指定字串</li>
          <li>• <strong>equals</strong>: 欄位值必須完全等於指定值</li>
          <li>• <strong>notContains</strong>: 欄位值不可包含指定字串</li>
          <li>• <strong>greaterThan</strong>: 數值必須大於指定值</li>
          <li>• <strong>lessThan</strong>: 數值必須小於指定值</li>
          <li>• <strong>length</strong>: 字串/陣列長度必須等於指定值</li>
        </ul>
      </div>
    </div>
  );
}
