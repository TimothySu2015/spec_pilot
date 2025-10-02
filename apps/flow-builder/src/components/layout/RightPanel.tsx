import { useState } from 'react';
import YamlPreview from '../preview/YamlPreview';
import ValidationPanel from '../validation/ValidationPanel';

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<'yaml' | 'validation'>('yaml');

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('yaml')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'yaml'
              ? 'text-primary border-b-2 border-primary bg-blue-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          YAML 預覽
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'validation'
              ? 'text-primary border-b-2 border-primary bg-blue-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          即時驗證
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'yaml' ? <YamlPreview /> : <ValidationPanel />}
      </div>
    </div>
  );
}
