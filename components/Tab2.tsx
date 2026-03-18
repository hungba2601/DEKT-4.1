
import React, { useEffect, useRef } from 'react';

interface Tab2Props {
  generatedMatrix: string;
}

// Make renderMathInElement globally available for TypeScript
declare global {
  interface Window {
    renderMathInElement?: (element: HTMLElement, options?: any) => void;
  }
}

const exportHtmlToDoc = (htmlContent: string, filename: string) => {
    if (!htmlContent) return;
    
    const fullHtml = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>${filename}</title>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `;

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), fullHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


const Tab2: React.FC<Tab2Props> = ({ generatedMatrix }) => {
  const matrixContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matrixContainerRef.current && window.renderMathInElement) {
      window.renderMathInElement(matrixContainerRef.current, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    }
  }, [generatedMatrix]);
  
  return (
    <div>
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Ma trận đề kiểm tra</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => exportHtmlToDoc(generatedMatrix, 'ma_tran_de_kiem_tra')}
            disabled={!generatedMatrix}
            className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            Xuất Word
          </button>
          <button 
            disabled 
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            title="Tính năng đang phát triển"
          >
            Lưu
          </button>
           <button 
            disabled 
            className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            title="Tính năng đang phát triển"
          >
            Reset
          </button>
        </div>
      </div>

      {generatedMatrix ? (
        <div 
          ref={matrixContainerRef}
          className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-md border border-gray-200 dark:border-gray-700 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: generatedMatrix }}
        />
      ) : (
        <div className="text-center py-12 px-6 bg-sky-50 dark:bg-gray-800/50 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-200">Chưa có dữ liệu ma trận</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vui lòng quay lại Tab 1 để nhập dữ liệu và tạo ma trận.
          </p>
        </div>
      )}
    </div>
  );
};

export default Tab2;