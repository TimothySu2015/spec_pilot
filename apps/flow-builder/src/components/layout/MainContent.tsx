import { useFormContext } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { useStepContext } from '../../contexts/StepContext';
import VariableEditor from '../flow/VariableEditor';
import StepEditor from '../step/StepEditor';

export default function MainContent() {
  const { register, formState: { errors } } = useFormContext<IFlowDefinition>();
  const { activeStepIndex } = useStepContext();

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-6 w-full">
      {activeStepIndex === null ? (
        // Flow 基本資訊編輯器
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Flow 基本資訊</h2>

          {/* Flow Name */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Flow 名稱 <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="例如: 使用者管理測試流程"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Base URL */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Base URL <span className="text-red-500">*</span>
            </label>
            <input
              {...register('baseUrl')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="http://localhost:3000 或 {{api_url}}"
            />
            {errors.baseUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.baseUrl.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              說明
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
              placeholder="描述這個測試流程的目的..."
            />
          </div>

          {/* Version */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              版本號
            </label>
            <input
              {...register('version')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="1.0.0"
            />
            {errors.version && (
              <p className="mt-1 text-sm text-red-600">{errors.version.message}</p>
            )}
          </div>

          {/* Variable Editor */}
          <VariableEditor />
        </div>
      ) : (
        // Step 編輯器
        <StepEditor />
      )}
    </main>
  );
}
