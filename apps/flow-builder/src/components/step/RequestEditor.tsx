import { useFormContext } from 'react-hook-form';
import { IFlowDefinition, HTTPMethod } from '@specpilot/schemas';
import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import HeadersEditor from './HeadersEditor';

interface RequestEditorProps {
  stepIndex: number;
}

const HTTP_METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function RequestEditor({ stepIndex }: RequestEditorProps) {
  const { register, watch, setValue } = useFormContext<IFlowDefinition>();
  const method = watch(`steps.${stepIndex}.request.method`);
  const bodyValue = watch(`steps.${stepIndex}.request.body`);

  const [bodyJsonText, setBodyJsonText] = useState<string>('');
  const [bodyJsonError, setBodyJsonError] = useState<string>('');

  // 初始化 body JSON 編輯器內容
  useEffect(() => {
    if (bodyValue && typeof bodyValue === 'object') {
      // 如果 bodyValue 是物件，轉換為格式化的 JSON 字串
      try {
        const jsonString = JSON.stringify(bodyValue, null, 2);
        // 只在內容真的改變時更新，避免無限迴圈
        if (bodyJsonText !== jsonString) {
          setBodyJsonText(jsonString);
          setBodyJsonError('');
        }
      } catch {
        setBodyJsonText('');
        setBodyJsonError('');
      }
    } else if (typeof bodyValue === 'string') {
      // 如果是字串，直接使用
      if (bodyJsonText !== bodyValue) {
        setBodyJsonText(bodyValue);
      }
    } else if (!bodyValue) {
      // 如果是 undefined 或 null，清空
      if (bodyJsonText !== '') {
        setBodyJsonText('');
        setBodyJsonError('');
      }
    }
  }, [bodyValue]); // 監聽 bodyValue 變化

  const handleBodyJsonChange = (value: string | undefined) => {
    if (!value) {
      setBodyJsonText('');
      setValue(`steps.${stepIndex}.request.body`, undefined);
      setBodyJsonError('');
      return;
    }

    setBodyJsonText(value);

    // 嘗試解析 JSON
    try {
      const parsed = JSON.parse(value);
      setValue(`steps.${stepIndex}.request.body`, parsed);
      setBodyJsonError('');
    } catch (error) {
      setBodyJsonError(error instanceof Error ? error.message : 'JSON 格式錯誤');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">HTTP 請求 (Request)</h3>

      <div className="space-y-4">
        {/* HTTP Method */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            HTTP 方法 <span className="text-red-500">*</span>
          </label>
          <select
            {...register(`steps.${stepIndex}.request.method`)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Path */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            路徑 (Path) <span className="text-red-500">*</span>
          </label>
          <input
            {...register(`steps.${stepIndex}.request.path`)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm"
            placeholder="/api/users 或 /api/users/{{user_id}}"
          />
          <p className="mt-1 text-xs text-gray-500">
            支援變數插值,例如: <code className="px-1 bg-gray-100 rounded">{'{{user_id}}'}</code>
          </p>
        </div>

        {/* Headers */}
        <HeadersEditor stepIndex={stepIndex} />

        {/* Request Body (for POST/PUT/PATCH) */}
        {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
          <div className="border border-gray-200 rounded-lg">
            <div className="p-4 border-b bg-gray-50">
              <h4 className="font-medium text-gray-900">Request Body (JSON)</h4>
              <p className="text-xs text-gray-600 mt-1">
                請輸入有效的 JSON 格式，支援變數插值 <code className="px-1 bg-gray-100 rounded">{'{{variable}}'}</code>
              </p>
            </div>
            <div className="p-4">
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <Editor
                  height="200px"
                  defaultLanguage="json"
                  value={bodyJsonText}
                  onChange={handleBodyJsonChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                  theme="vs-light"
                />
              </div>
              {bodyJsonError && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                  ❌ {bodyJsonError}
                </div>
              )}
              {!bodyJsonError && bodyJsonText && (
                <div className="mt-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
                  ✅ JSON 格式正確
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
