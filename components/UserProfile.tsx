
import React, { useState, useEffect, useRef } from 'react';

type User = { name: string; plan: 'free' | 'pro' };

interface UserProfileProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onUpgradeClick: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onLogin, onLogout, onUpgradeClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const planDisplay = user?.plan === 'pro' 
    ? <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full">PRO</span>
    : <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold px-2 py-0.5 rounded-full">Free</span>;


  if (!user) {
    return (
      <button
        onClick={onLogin}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Đăng nhập
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
          {user.name.charAt(0)}
        </div>
        <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
          {user.name}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
             <div className="px-4 py-2 border-b dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white" role="none">
                    {user.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1" role="none">
                    Gói dịch vụ: {planDisplay}
                </p>
            </div>
            <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Tài khoản của tôi</a>
            <button 
                onClick={() => { onUpgradeClick(); setIsOpen(false); }}
                className="w-full text-left block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={user.plan === 'pro'}
            >
                {user.plan === 'pro' ? 'Đã nâng cấp' : 'Nâng cấp lên PRO'}
            </button>
            <button
              onClick={() => { onLogout(); setIsOpen(false); }}
              className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-t dark:border-gray-700"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
