import { useStepContext } from '../../contexts/StepContext';

export default function StepList() {
  const { fields, append, remove, move, activeStepIndex, setActiveStepIndex } = useStepContext();

  const handleAddStep = () => {
    append({
      name: `步驟 ${fields.length + 1}`,
      description: '',
      request: {
        method: 'GET',
        path: '/api/endpoint',
        headers: {},
        body: undefined,
      },
      expect: {
        statusCode: 200,
        bodyFields: [],
      },
      validation: [],
      capture: [],
    });
    setActiveStepIndex(fields.length);
  };

  const handleDeleteStep = (index: number) => {
    if (confirm('確定要刪除這個步驟嗎?')) {
      remove(index);
      if (activeStepIndex === index) {
        setActiveStepIndex(null);
      } else if (activeStepIndex !== null && activeStepIndex > index) {
        setActiveStepIndex(activeStepIndex - 1);
      }
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
      if (activeStepIndex === index) {
        setActiveStepIndex(index - 1);
      } else if (activeStepIndex === index - 1) {
        setActiveStepIndex(index);
      }
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
      if (activeStepIndex === index) {
        setActiveStepIndex(index + 1);
      } else if (activeStepIndex === index + 1) {
        setActiveStepIndex(index);
      }
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        步驟列表 ({fields.length})
      </h2>

      {/* Flow 基本資訊按鈕 */}
      <button
        type="button"
        onClick={() => setActiveStepIndex(null)}
        className={`w-full mb-3 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
          activeStepIndex === null
            ? 'bg-blue-50 border-primary text-primary'
            : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        }`}
      >
        📋 Flow 基本資訊
      </button>

      {fields.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <p className="text-sm text-gray-600">尚未新增步驟</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const step = field as any;
            const isActive = activeStepIndex === index;

            return (
              <div
                key={field.id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-50 border-primary'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setActiveStepIndex(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {step.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        step.request.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                        step.request.method === 'POST' ? 'bg-green-100 text-green-700' :
                        step.request.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        step.request.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {step.request.method}
                      </span>
                      <span className="text-xs text-gray-600 truncate">{step.request.path}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="上移"
                    >
                      ⬆️
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                      disabled={index === fields.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="下移"
                    >
                      ⬇️
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteStep(index); }}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="刪除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={handleAddStep}
        className="w-full mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        + 新增步驟
      </button>
    </div>
  );
}
