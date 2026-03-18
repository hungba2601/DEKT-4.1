import React from 'react';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  isDisabled?: boolean;
}

export const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick, isDisabled }) => {
  const baseClasses = "whitespace-nowrap py-3 px-2 sm:px-4 text-sm sm:text-base font-medium transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-t-md flex items-center gap-1.5";
  const activeClasses = "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
  const inactiveClasses = "border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500";
  const disabledClasses = "cursor-not-allowed opacity-50 text-gray-400 dark:text-gray-500 border-b-2 border-transparent";
  
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${isDisabled ? disabledClasses : (isActive ? activeClasses : inactiveClasses)}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
      {isDisabled && (
         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};