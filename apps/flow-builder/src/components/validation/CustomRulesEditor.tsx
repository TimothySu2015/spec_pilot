import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
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
  const { control, register, watch, setValue } = useFormContext<IFlowDefinition>();
  const { showToast } = useToast();
  const { openApiSpec } = useOpenAPI();

  const { fields, append, remove } = useFieldArray({
    control,
    name: `steps.${stepIndex}.expect.body.customRules` as const,
  });

  const [suggestions, setSuggestions] = useState<ValidationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // 為每個規則的 expected 欄位追蹤 JSON 錯誤
  const [expectedErrors, setExpectedErrors] = useState<Record<number, string>>({});

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

  /**
   * 取得規則的參數名稱（供 UI 顯示）
   */
  const getParameterName = (ruleType: string): string => {
    switch (ruleType) {
      case 'regex':
      case 'contains':
      case 'greaterThan':
      case 'lessThan':
        return 'value';
      case 'equals':
      case 'notContains':
        return 'expected';
      case 'length':
        return 'min/max';
      default:
        return '';
    }
  };

  /**
   * 取得規則的提示文字
   */
  const getHintText = (ruleType: string): string => {
    switch (ruleType) {
      case 'regex':
        return '💡 範例: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
      case 'contains':
        return '💡 範例: active (檢查字串是否包含此值)';
      case 'equals':
        return '💡 範例: 數字 2 或物件 {"id": 2, "name": "John"}';
      case 'notContains':
        return '💡 範例: {"id": 2} (驗證陣列不包含此物件)';
      case 'greaterThan':
        return '💡 範例: 18 (驗證值必須大於 18)';
      case 'lessThan':
        return '💡 範例: 100 (驗證值必須小於 100)';
      case 'length':
        return '💡 範例: 最小 1 字元，最大 100 字元';
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
                    {/* 規則類型選擇 - 使用分組讓使用者更容易理解 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        規則類型
                      </label>
                      <select
                        {...register(`steps.${stepIndex}.expect.body.customRules.${index}.rule` as const)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <optgroup label="🔹 基礎驗證">
                          <option value="notNull">notNull - 欄位不可為 null</option>
                        </optgroup>

                        <optgroup label="🔹 模式驗證 (使用 value 參數)">
                          <option value="regex">regex - 正則表達式</option>
                          <option value="contains">contains - 包含特定值</option>
                        </optgroup>

                        <optgroup label="🔹 精確比對 (使用 expected 參數)">
                          <option value="equals">equals - 精確值比對</option>
                          <option value="notContains">notContains - 不包含特定值</option>
                        </optgroup>

                        <optgroup label="🔹 數值驗證 (使用 value 參數)">
                          <option value="greaterThan">greaterThan - 數值大於</option>
                          <option value="lessThan">lessThan - 數值小於</option>
                        </optgroup>

                        <optgroup label="🔹 長度驗證 (使用 min/max 參數)">
                          <option value="length">length - 長度驗證</option>
                        </optgroup>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        💡 提示：不同規則使用不同的參數名稱 (value / expected / min,max)
                      </p>
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

                    {/* Value 欄位 (regex, contains, greaterThan, lessThan) */}
                    {(ruleType === 'regex' ||
                      ruleType === 'contains' ||
                      ruleType === 'greaterThan' ||
                      ruleType === 'lessThan') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          驗證值
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            (參數名稱: value)
                          </span>
                        </label>
                        <input
                          {...register(`steps.${stepIndex}.expect.body.customRules.${index}.value` as const)}
                          type={
                            ruleType === 'greaterThan' || ruleType === 'lessThan'
                              ? 'number'
                              : 'text'
                          }
                          placeholder={
                            ruleType === 'regex' ? '^.+@.+\\..+$' :
                            ruleType === 'contains' ? 'success' :
                            ruleType === 'greaterThan' ? '0' :
                            ruleType === 'lessThan' ? '100' :
                            ''
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {getHintText(ruleType)}
                        </p>
                      </div>
                    )}

                    {/* Expected 欄位 (equals, notContains - 支援簡單值或 JSON) */}
                    {(ruleType === 'equals' || ruleType === 'notContains') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          驗證值
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            (參數名稱: expected)
                          </span>
                        </label>
                        <textarea
                          value={(() => {
                            const currentValue = watch(`steps.${stepIndex}.expect.body.customRules.${index}.expected`);
                            if (currentValue === undefined || currentValue === null) return '';
                            if (typeof currentValue === 'object') {
                              return JSON.stringify(currentValue, null, 2);
                            }
                            return String(currentValue);
                          })()}
                          rows={3}
                          placeholder={
                            ruleType === 'equals'
                              ? '2 或 {"id": 2, "name": "John"}'
                              : '{"id": 2}'
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
                          onChange={(e) => {
                            const value = e.target.value;
                            if (!value || value.trim() === '') {
                              setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, undefined);
                              setExpectedErrors(prev => ({ ...prev, [index]: '' }));
                              return;
                            }

                            const trimmed = value.trim();

                            // 如果看起來像 JSON (以 { 或 [ 開頭)
                            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                              try {
                                const parsed = JSON.parse(trimmed);
                                setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, parsed);
                                setExpectedErrors(prev => ({ ...prev, [index]: '' }));
                              } catch (error) {
                                setExpectedErrors(prev => ({ ...prev, [index]: 'JSON 格式錯誤' }));
                                setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, value);
                              }
                              return;
                            }

                            // 嘗試解析為數字
                            const num = Number(trimmed);
                            if (!isNaN(num) && trimmed === num.toString()) {
                              setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, num);
                              setExpectedErrors(prev => ({ ...prev, [index]: '' }));
                              return;
                            }

                            // 布林值
                            if (trimmed === 'true') {
                              setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, true);
                              setExpectedErrors(prev => ({ ...prev, [index]: '' }));
                              return;
                            }
                            if (trimmed === 'false') {
                              setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, false);
                              setExpectedErrors(prev => ({ ...prev, [index]: '' }));
                              return;
                            }
                            if (trimmed === 'null') {
                              setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, null);
                              setExpectedErrors(prev => ({ ...prev, [index]: '' }));
                              return;
                            }

                            // 否則當作字串
                            setValue(`steps.${stepIndex}.expect.body.customRules.${index}.expected`, trimmed);
                            setExpectedErrors(prev => ({ ...prev, [index]: '' }));
                          }}
                        />
                        {expectedErrors[index] && (
                          <p className="text-xs text-red-600 mt-1">
                            ❌ {expectedErrors[index]}
                          </p>
                        )}
                        {!expectedErrors[index] && (
                          <p className="text-xs text-gray-500 mt-1">
                            {getHintText(ruleType)}
                          </p>
                        )}
                        <p className="text-xs text-blue-600 mt-1">
                          ℹ️ 支援格式：數字、字串、布林值、null、JSON 物件
                        </p>
                      </div>
                    )}

                    {/* Length 規則 - min 和 max */}
                    {ruleType === 'length' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          長度範圍
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            (參數名稱: min, max)
                          </span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              最小長度 (min)
                            </label>
                            <input
                              {...register(`steps.${stepIndex}.expect.body.customRules.${index}.min` as const, {
                                valueAsNumber: true,
                              })}
                              type="number"
                              min="0"
                              placeholder="1"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              最大長度 (max)
                            </label>
                            <input
                              {...register(`steps.${stepIndex}.expect.body.customRules.${index}.max` as const, {
                                valueAsNumber: true,
                              })}
                              type="number"
                              min="0"
                              placeholder="100"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {getHintText(ruleType)}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          ℹ️ 至少需要填寫 min 或 max 其中一個
                        </p>
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
          <li>• <strong>regex</strong>: 使用正則表達式驗證欄位值（參數: value）</li>
          <li>• <strong>contains</strong>: 字串/陣列必須包含指定值（參數: value）</li>
          <li>• <strong>equals</strong>: 欄位值必須完全等於指定值（參數: expected，支援 JSON 物件）</li>
          <li>• <strong>notContains</strong>: 陣列不可包含指定物件（參數: expected，支援 JSON 物件）</li>
          <li>• <strong>greaterThan</strong>: 數值必須大於指定值（參數: value）</li>
          <li>• <strong>lessThan</strong>: 數值必須小於指定值（參數: value）</li>
          <li>• <strong>length</strong>: 字串/陣列長度驗證（參數: min 和/或 max）</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="font-medium mb-1">💡 進階功能:</p>
          <ul className="space-y-1 text-xs text-blue-700">
            <li>• <strong>JSON 物件支援</strong>: equals 和 notContains 可輸入 JSON 物件</li>
            <li>• <strong>自動型別轉換</strong>: 數字、布林、null 會自動轉換</li>
            <li>• <strong>物件比對</strong>: notContains 支援物件屬性比對（用於驗證刪除操作）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
