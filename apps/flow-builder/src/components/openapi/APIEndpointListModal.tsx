import { useState, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { IFlowDefinition, HTTPMethod } from '@specpilot/schemas';
import { useOpenAPI } from '../../contexts/OpenAPIContext';
import { useStepContext } from '../../contexts/StepContext';
import { useToast } from '../../contexts/ToastContext';
import { extractEndpoints, groupEndpointsByTag, APIEndpoint } from '../../services/openapi-parser';
import { generateValidationSuggestions, suggestionToValidationRule } from '../../services/validation-suggestion-engine';

interface APIEndpointListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function APIEndpointListModal({ isOpen, onClose }: APIEndpointListModalProps) {
  const { openApiSpec } = useOpenAPI();
  const { getValues } = useFormContext<IFlowDefinition>();
  const { append } = useStepContext();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());

  const endpoints = useMemo(() => {
    if (!openApiSpec) return [];
    return extractEndpoints(openApiSpec);
  }, [openApiSpec]);

  const groupedEndpoints = useMemo(() => {
    const filtered = endpoints.filter((ep) => {
      const matchesSearch =
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMethod = filterMethod === 'all' || ep.method === filterMethod;
      return matchesSearch && matchesMethod;
    });
    return groupEndpointsByTag(filtered);
  }, [endpoints, searchQuery, filterMethod]);

  if (!isOpen) return null;

  const handleToggleEndpoint = (endpoint: APIEndpoint) => {
    const key = `${endpoint.method}:${endpoint.path}`;
    const newSelected = new Set(selectedEndpoints);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedEndpoints(newSelected);
  };

  const handleBatchGenerate = () => {
    if (selectedEndpoints.size === 0) {
      showToast('warning', '請至少選擇一個端點');
      return;
    }

    const baseUrl = getValues('baseUrl') || 'http://localhost:3000';
    let generatedCount = 0;

    for (const key of selectedEndpoints) {
      const [method, path] = key.split(':');
      const endpoint = endpoints.find((ep) => ep.method === method && ep.path === path);
      if (!endpoint) continue;

      // 生成 Request Body 範例
      let requestBody: any = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method) && endpoint.requestBodySchema) {
        requestBody = generateBodyExample(endpoint.requestBodySchema, openApiSpec);
      }

      // 生成驗證建議
      const suggestions = generateValidationSuggestions(endpoint.responseSchema, openApiSpec);
      const validationRules = suggestions.map(suggestionToValidationRule);

      // 新增步驟
      append({
        name: endpoint.summary || `${method} ${path}`,
        description: endpoint.description || '',
        request: {
          method: method as HTTPMethod,
          path: path,
          headers: {},
          body: requestBody ? JSON.stringify(requestBody, null, 2) : undefined,
        },
        expect: {
          statusCode: method === 'POST' ? 201 : 200,
          bodyFields: [],
        },
        validation: validationRules,
        capture: [],
      });

      generatedCount++;
    }

    showToast('success', `成功生成 ${generatedCount} 個測試步驟!`);
    setSelectedEndpoints(new Set());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">API 端點清單</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="🔍 搜尋 API..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />

            <div className="flex gap-2">
              {['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMethod(m)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterMethod === m
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {m === 'all' ? '全部' : m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {Object.entries(groupedEndpoints).map(([tag, tagEndpoints]) => (
            <div key={tag} className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {tag} ({tagEndpoints.length})
              </h3>
              <div className="space-y-2">
                {tagEndpoints.map((endpoint) => {
                  const key = `${endpoint.method}:${endpoint.path}`;
                  const isSelected = selectedEndpoints.has(key);

                  return (
                    <div
                      key={key}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-primary'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleToggleEndpoint(endpoint)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4"
                            />
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                endpoint.method === 'GET'
                                  ? 'bg-blue-100 text-blue-700'
                                  : endpoint.method === 'POST'
                                  ? 'bg-green-100 text-green-700'
                                  : endpoint.method === 'PUT'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : endpoint.method === 'DELETE'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {endpoint.method}
                            </span>
                            <span className="font-mono text-sm text-gray-900">{endpoint.path}</span>
                          </div>
                          {endpoint.summary && (
                            <p className="text-sm text-gray-600 ml-7">{endpoint.summary}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedEndpoints).length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <p>找不到符合條件的 API 端點</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              已選擇 {selectedEndpoints.size} 個端點
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchGenerate}
                disabled={selectedEndpoints.size === 0}
                className="px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🚀 批次生成測試 ({selectedEndpoints.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 從 Schema 生成範例資料
 */
function generateBodyExample(schema: any, openApiSpec: any): any {
  if (!schema) return {};

  // 處理 $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved = openApiSpec;
    for (const part of refPath) {
      resolved = resolved?.[part];
    }
    return generateBodyExample(resolved, openApiSpec);
  }

  if (schema.type === 'object') {
    const example: any = {};
    const properties = schema.properties || {};
    for (const [key, value] of Object.entries<any>(properties)) {
      example[key] = generateFieldExample(value, openApiSpec);
    }
    return example;
  }

  return generateFieldExample(schema, openApiSpec);
}

function generateFieldExample(schema: any, openApiSpec: any): any {
  if (schema.example !== undefined) return schema.example;

  switch (schema.type) {
    case 'string':
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
      if (schema.enum) return schema.enum[0];
      return 'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return generateBodyExample(schema, openApiSpec);
    default:
      return null;
  }
}
