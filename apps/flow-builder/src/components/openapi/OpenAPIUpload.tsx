import { useRef, useState } from 'react';
import { useOpenAPI } from '../../contexts/OpenAPIContext';
import { useToast } from '../../contexts/ToastContext';
import APIEndpointListModal from './APIEndpointListModal';
import YAML from 'yaml';

export default function OpenAPIUpload() {
  const { openApiSpec, setOpenApiSpec, setIsLoading } = useOpenAPI();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      let spec: any;

      // 根據檔案類型解析
      if (file.name.endsWith('.json')) {
        spec = JSON.parse(text);
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        spec = YAML.parse(text);
      } else {
        throw new Error('不支援的檔案格式,請上傳 .json 或 .yaml 檔案');
      }

      // 基本驗證
      if (!spec.openapi && !spec.swagger) {
        throw new Error('這不是有效的 OpenAPI 規格檔案');
      }

      setOpenApiSpec(spec);
      showToast('success', 'OpenAPI 規格上傳成功!');
    } catch (err) {
      const message = err instanceof Error ? err.message : '檔案解析失敗';
      setError(message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
      // 重置 input 以允許重新上傳同一個檔案
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setOpenApiSpec(null);
    setError(null);
    showToast('info', 'OpenAPI 規格已移除');
  };

  return (
    <div className="p-4 border-b border-gray-200">
      {!openApiSpec ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">OpenAPI 規格</h3>
          <label className="block">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary hover:bg-blue-50 transition-colors">
              <div className="text-2xl mb-2">📄</div>
              <p className="text-sm text-gray-600">點擊上傳 OpenAPI</p>
              <p className="text-xs text-gray-500 mt-1">支援 .json / .yaml</p>
            </div>
          </label>
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>
      ) : (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-600">✅</span>
                  <span className="text-sm font-medium text-green-900">已載入 OpenAPI</span>
                </div>
                <p className="text-xs text-green-700">
                  {openApiSpec.info?.title || '未命名規格'}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  版本: {openApiSpec.info?.version || 'N/A'}
                </p>
                <p className="text-xs text-green-600">
                  端點數: {Object.keys(openApiSpec.paths || {}).length}
                </p>
              </div>
              <button
                onClick={handleRemove}
                className="text-red-600 hover:text-red-700 p-1"
                title="移除"
              >
                🗑️
              </button>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="w-full mt-3 px-3 py-2 bg-primary hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
            >
              📋 查看端點清單
            </button>
          </div>

          <APIEndpointListModal isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
      )}
    </div>
  );
}
