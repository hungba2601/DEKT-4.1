import React, { useState, useEffect } from 'react';
import { GEMINI_MODELS } from '../types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, model: string) => void;
  currentKey: string;
  currentModel: string;
  isQuotaExceeded?: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentKey, currentModel, isQuotaExceeded }) => {
  const [key, setKey] = useState(currentKey);
  const [model, setModel] = useState(currentModel);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    setKey(currentKey);
    setModel(currentModel);
    setTestStatus('idle');
    setTestMessage('');
  }, [currentKey, currentModel, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(key, model);
    onClose();
  };

  const handleClearKey = () => {
    setKey('');
  };

  const handleTestApiKey = async () => {
    if (!key.trim()) {
      setTestStatus('error');
      setTestMessage('Vui lòng nhập API Key trước khi kiểm tra.');
      return;
    }
    setTestStatus('testing');
    setTestMessage('Đang kiểm tra...');
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: model,
        contents: 'Trả lời đúng 1 từ: "OK"',
      });
      if (response && response.text) {
        setTestStatus('success');
        setTestMessage(`✅ API Key hoạt động tốt với ${GEMINI_MODELS.find(m => m.id === model)?.name?.split('(')[0]?.trim() || model}!`);
      } else {
        setTestStatus('error');
        setTestMessage('❌ API Key không trả về phản hồi hợp lệ.');
      }
    } catch (err: any) {
      setTestStatus('error');
      const msg = err?.message || '';
      if (msg.includes('401') || msg.includes('API_KEY_INVALID')) {
        setTestMessage('❌ API Key không hợp lệ. Vui lòng kiểm tra lại.');
      } else if (msg.includes('429')) {
        setTestMessage('❌ API Key đã hết hạn mức (Quota Exceeded).');
      } else if (msg.includes('404')) {
        setTestMessage(`❌ Model "${model}" không tồn tại hoặc không khả dụng.`);
      } else {
        setTestMessage(`❌ Lỗi: ${msg.substring(0, 150)}`);
      }
    }
  };

  const selectedModelInfo = GEMINI_MODELS.find(m => m.id === model);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Cấu hình Google Gemini API</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tùy chọn API Key và Mô hình AI xử lý kế hoạch giáo dục</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Quota Exceeded Warning */}
            {isQuotaExceeded && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-xl animate-pulse">
                <p className="text-sm text-red-600 dark:text-red-400 font-bold">
                  ⚠️ API Key hiện tại đã hết hạn mức (Quota Exceeded). Vui lòng nhập API Key mới để tiếp tục tiến trình mà không bị mất dữ liệu.
                </p>
              </div>
            )}

            {/* Model Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  MÔ HÌNH AI XỬ LÝ (AI MODEL)
                </label>
                <span className="text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-2.5 py-1 rounded-full">
                  MẶC ĐỊNH: GEMINI 3 FLASH PREVIEW
                </span>
              </div>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="block w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-orange-300 dark:border-orange-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 dark:text-gray-100 font-medium text-sm cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23f97316' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem 1.25rem', paddingRight: '2.5rem' }}
              >
                {GEMINI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {selectedModelInfo && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 ml-1 italic">
                  {selectedModelInfo.description}
                </p>
              )}
            </div>

            {/* API Key Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                GOOGLE GEMINI API KEY
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="api-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="block w-full px-4 py-3 pr-16 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  placeholder="Nhập API Key của bạn (AIza...)"
                />
                {key && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 font-semibold transition-colors"
                  >
                    Xóa
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-start gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 flex-shrink-0 mt-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>API Key được lưu trữ cục bộ (Local Storage) trên máy của bạn, không gửi qua máy chủ trung gian.</span>
              </p>
            </div>

            {/* Guide Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Chưa có API Key?</p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Lấy API Key miễn phí
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                </a>
              </div>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Truy cập Google AI Studio và tạo tài khoản Google.</li>
                <li>Nhấn "Create API key" và dán mã khóa vào ô trên.</li>
              </ol>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                * Lưu ý: Nếu không có API Key, hệ thống vẫn hoạt động hoàn hảo với bộ dữ liệu mẫu chuẩn Bộ GD&ĐT.
              </p>
            </div>

            {/* Test Result */}
            {testStatus !== 'idle' && (
              <div className={`p-3 rounded-xl text-sm font-medium ${
                testStatus === 'testing' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' :
                testStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800' :
                'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
                {testStatus === 'testing' && (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {testMessage}
                  </span>
                )}
                {testStatus !== 'testing' && testMessage}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex items-center justify-between rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleTestApiKey}
              className="px-5 py-2.5 rounded-xl bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 text-sm font-semibold border-2 border-gray-300 dark:border-gray-500 flex items-center gap-2"
            >
              <span>Kiểm tra {GEMINI_MODELS.find(m => m.id === model)?.name?.split('(')[0]?.trim() || 'Model'}</span>
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white transition-all duration-200 text-sm font-bold shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiKeyModal;