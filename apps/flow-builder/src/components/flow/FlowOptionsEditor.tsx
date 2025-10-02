import { useFormContext } from 'react-hook-form';
import { IFlowDefinition } from '@specpilot/schemas';

export default function FlowOptionsEditor() {
  const { register, formState: { errors } } = useFormContext<IFlowDefinition>();

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">執行選項 (Options)</h3>

      <div className="space-y-4">
        {/* Timeout */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            請求逾時時間 (timeout, 毫秒)
          </label>
          <input
            type="number"
            {...register('options.timeout', { valueAsNumber: true })}
            placeholder="30000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
          {errors.options?.timeout && (
            <p className="mt-1 text-sm text-red-600">{errors.options.timeout.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            預設 30000ms (30秒)，單次請求的最長等待時間
          </p>
        </div>

        {/* Retry Count */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            重試次數 (retryCount)
          </label>
          <input
            type="number"
            min="0"
            max="5"
            {...register('options.retryCount', { valueAsNumber: true })}
            placeholder="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
          {errors.options?.retryCount && (
            <p className="mt-1 text-sm text-red-600">{errors.options.retryCount.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            失敗時自動重試次數 (0-5)，預設 3 次
          </p>
        </div>

        {/* Fail Fast */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              {...register('options.failFast')}
              id="failFast"
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="ml-3">
            <label htmlFor="failFast" className="text-sm font-medium text-gray-700 cursor-pointer">
              遇到錯誤時立即停止 (failFast)
            </label>
            <p className="text-xs text-gray-500 mt-1">
              啟用後，任何步驟失敗將立即終止整個測試流程
            </p>
          </div>
        </div>
      </div>

      {/* 提示區塊 */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>提示:</strong> 這些選項會影響測試執行行為
        </p>
        <ul className="text-sm text-blue-700 mt-2 ml-4 space-y-1 list-disc">
          <li>timeout 過短可能導致請求超時失敗</li>
          <li>retryCount 設定為 0 可加快測試速度，但會降低容錯率</li>
          <li>failFast 適合快速偵錯，可節省執行時間</li>
        </ul>
      </div>
    </div>
  );
}
