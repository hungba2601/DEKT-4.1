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

  useEffect(() => {
    setKey(currentKey);
    setModel(currentModel);
  }, [currentKey, currentModel, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(key, model);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cài đặt API Key</h3>
            
            {isQuotaExceeded && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-md mb-4 animate-pulse">
                <p className="text-sm text-red-600 dark:text-red-400 font-bold">
                  ⚠️ API Key hiện tại đã hết hạn mức (Quota Exceeded). Vui lòng nhập API Key mới để tiếp tục tiến trình mà không bị mất dữ liệu.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model xử lý</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
              >
                {GEMINI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="mb-2">
              <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Google Gemini API Key</label>
              <input
                type="password"
                id="api-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
                placeholder="Nhập API Key của bạn (AIza...)"
              />
              <p className="text-sm text-gray-500 mt-2">
                Bạn cần một API Key hợp lệ từ Google AI Studio để sử dụng chức năng tạo đề tự động. Lấy key tại: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">aistudio.google.com</a>
              </p>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex justify-end gap-4 rounded-b-lg">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Lưu Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiKeyModal;