
import React from 'react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
        onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl transform transition-all duration-300 ease-out scale-95 animate-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Nâng cấp để Mở khóa Toàn bộ Tiềm năng
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Chọn gói phù hợp với nhu cầu của bạn và tiết kiệm thời gian soạn giáo án.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700 p-4 sm:p-8 pt-0">
          {/* Free Plan */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-l-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Miễn phí</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Dành cho việc dùng thử và các nhu cầu cơ bản.</p>
            <p className="mt-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">0đ</span>
              <span className="text-base font-medium text-gray-500 dark:text-gray-400">/tháng</span>
            </p>
            <button className="mt-6 w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700">
              Gói hiện tại của bạn
            </button>
            <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-300 text-left">
              <li className="flex items-center"><CheckIcon /> 5 lượt tạo đề / tháng</li>
              <li className="flex items-center"><CheckIcon /> Tạo ma trận & đặc tả</li>
              <li className="flex items-center"><CheckIcon /> Tạo câu hỏi ôn tập</li>
              <li className="flex items-center"><CrossIcon /> Có Watermark trên file xuất</li>
              <li className="flex items-center"><CrossIcon /> Hỗ trợ cơ bản</li>
            </ul>
          </div>
          {/* Pro Plan */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-r-lg border-2 border-blue-500 relative">
            <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-blue-500 text-white text-sm font-semibold rounded-full">Phổ biến nhất</span>
            </div>
            <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400">Chuyên nghiệp</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Dành cho giáo viên muốn tối ưu hóa công việc.</p>
            <p className="mt-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">99.000đ</span>
              <span className="text-base font-medium text-gray-500 dark:text-gray-400">/tháng</span>
            </p>
            <button 
                onClick={onUpgrade}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Nâng cấp ngay
            </button>
            <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-300 text-left">
              <li className="flex items-center font-semibold"><CheckIcon color="text-blue-500"/> Không giới hạn lượt tạo</li>
              <li className="flex items-center"><CheckIcon color="text-blue-500"/> Tạo ma trận & đặc tả</li>
              <li className="flex items-center"><CheckIcon color="text-blue-500"/> Tạo câu hỏi ôn tập</li>
              <li className="flex items-center"><CheckIcon color="text-blue-500"/> Không Watermark trên file xuất</li>
              <li className="flex items-center"><CheckIcon color="text-blue-500"/> Hỗ trợ ưu tiên</li>
            </ul>
          </div>
        </div>
        {/* Fix: Removed the `jsx` prop which is not a valid attribute for the style tag in standard React. */}
        <style>{`
            .animate-in-up {
                animation: slide-up 0.3s ease-out forwards;
            }
            @keyframes slide-up {
                from {
                    transform: translateY(20px) scale(0.95);
                    opacity: 0;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }
        `}</style>
      </div>
    </div>
  );
};

const CheckIcon = ({ color = 'text-green-500' }: { color?: string }) => (
    <svg className={`flex-shrink-0 w-5 h-5 ${color} mr-2`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);

const CrossIcon = () => (
     <svg className="flex-shrink-0 w-5 h-5 text-red-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
);
