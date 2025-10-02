import { useFormContext } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';
import { useStepContext } from '../../contexts/StepContext';
import RequestEditor from './RequestEditor';
import ExpectEditor from './ExpectEditor';
import ValidationEditor from '../validation/ValidationEditor';
import CaptureEditor from '../capture/CaptureEditor';

export default function StepEditor() {
  const { register, formState: { errors } } = useFormContext<IFlowDefinition>();
  const { activeStepIndex } = useStepContext();

  if (activeStepIndex === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg">請從左側選擇或新增步驟</p>
          <p className="text-sm mt-2">點擊「+ 新增步驟」開始建立測試流程</p>
        </div>
      </div>
    );
  }

  const stepErrors = errors.steps?.[activeStepIndex];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          編輯步驟 #{activeStepIndex + 1}
        </h2>
      </div>

      {/* Step Name */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block mb-2 text-sm font-medium text-gray-700">
          步驟名稱 <span className="text-red-500">*</span>
        </label>
        <input
          {...register(`steps.${activeStepIndex}.name`)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          placeholder="例如: 登入測試"
        />
        {stepErrors?.name && (
          <p className="mt-1 text-sm text-red-600">{stepErrors.name.message}</p>
        )}
      </div>

      {/* Step Description */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block mb-2 text-sm font-medium text-gray-700">
          步驟說明
        </label>
        <textarea
          {...register(`steps.${activeStepIndex}.description`)}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
          placeholder="描述這個步驟的目的..."
        />
      </div>

      {/* Request Editor */}
      <RequestEditor stepIndex={activeStepIndex} />

      {/* Expect Editor */}
      <ExpectEditor stepIndex={activeStepIndex} />

      {/* Validation Editor */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <ValidationEditor stepIndex={activeStepIndex} />
      </div>

      {/* Capture Editor */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <CaptureEditor stepIndex={activeStepIndex} />
      </div>
    </div>
  );
}
