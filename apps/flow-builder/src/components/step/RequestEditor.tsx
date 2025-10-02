import { useFormContext } from 'react-hook-form';
import { IFlowDefinition, HTTPMethod } from '@specpilot/schemas';

interface RequestEditorProps {
  stepIndex: number;
}

const HTTP_METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function RequestEditor({ stepIndex }: RequestEditorProps) {
  const { register, watch } = useFormContext<IFlowDefinition>();
  const method = watch(`steps.${stepIndex}.request.method`);

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

        {/* Request Body (for POST/PUT/PATCH) */}
        {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Request Body (JSON)
            </label>
            <textarea
              {...register(`steps.${stepIndex}.request.body`)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-sm resize-none"
              placeholder={`{\n  "username": "{{username}}",\n  "password": "{{password}}"\n}`}
            />
            <p className="mt-1 text-xs text-gray-500">
              請輸入有效的 JSON 格式,支援變數插值
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
