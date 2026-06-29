
import React, { useEffect, useRef, useState } from 'react';
import { generateReviewQuestions } from '../services/geminiService';
import { readFileContent } from '../utils/fileReader';
import type { MatrixConfig, SpecData, TabName } from '../types';

interface Tab4Props {
  setIsLoading: (isLoading: boolean) => void;
  setLoadingProgress: (progress: number | ((prev: number) => number)) => void;
  generatedMatrix: string;
  sgkFileContent: string;
  reviewQuestions: string;
  setReviewQuestions: (questions: string) => void;
  setActiveTab: (tab: TabName) => void;
  generatedSpec: SpecData;
  matrixConfig: MatrixConfig;
}

// Make renderMathInElement globally available for TypeScript
declare global {
  interface Window {
    renderMathInElement?: (element: HTMLElement, options?: any) => void;
  }
}

const Tab4: React.FC<Tab4Props> = ({ 
    setIsLoading, 
    setLoadingProgress,
    generatedMatrix, 
    sgkFileContent, 
    reviewQuestions, 
    setReviewQuestions, 
    setActiveTab,
    generatedSpec,
    matrixConfig,
}) => {
  const questionsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (questionsContainerRef.current && window.renderMathInElement) {
      window.renderMathInElement(questionsContainerRef.current, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    }
  }, [reviewQuestions]);

  const handleGenerate = async () => {
    if (!generatedMatrix) {
      alert("Chưa có ma trận. Vui lòng tạo ma trận ở Tab 2 trước.");
      setActiveTab('tab2');
      return;
    }
    if (!sgkFileContent) {
        alert("Chưa có nội dung SGK. Vui lòng tải file ở Tab 1 trước.");
        setActiveTab('tab1');
        return;
    }
    setIsLoading(true);
    setLoadingProgress(0);
    
    // Hiệu ứng tăng phần trăm giả lập
    const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
            if (prev >= 95) return prev;
            // Câu hỏi nhiều nên có thể lâu hơn chút
            const remaining = 95 - prev;
            const step = Math.max(1, Math.floor(remaining * 0.05)); 
            return prev + (Math.random() < 0.6 ? step : 0);
        });
    }, 1000);

    try {
      const result = await generateReviewQuestions(sgkFileContent, generatedMatrix, generatedSpec, matrixConfig);
      
      clearInterval(progressInterval);
      setLoadingProgress(100);

      setTimeout(() => {
          setReviewQuestions(result);
          setIsLoading(false);
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      alert(error instanceof Error ? error.message : "Có lỗi không xác định xảy ra. Vui lòng thử lại.");
      setIsLoading(false);
    } 
  };

  const exportContentToDoc = (content: string, filename: string) => {
    if (!content) return;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>${filename}</title>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportForTeachers = () => {
    exportContentToDoc(reviewQuestions, 'cau_hoi_on_tap_giao_vien.doc');
  };

  const handleExportForStudents = () => {
    if (!reviewQuestions) return;

    // 1. Create a temporary DOM element to parse the HTML string
    const container = document.createElement('div');
    container.innerHTML = reviewQuestions;

    // 2. Remove all answer elements
    const answerElements = container.querySelectorAll('.answer');
    answerElements.forEach(el => el.remove());

    // 3. Remove cognitive level indicators from any <strong> tag, case-insensitively
    const strongElements = container.querySelectorAll('strong');
    strongElements.forEach(strongTag => {
        if (strongTag.textContent) {
            // Regex to find and remove patterns like (NB), (th), (VDC), etc., ignoring case.
            strongTag.textContent = strongTag.textContent.replace(/\s*\((NB|TH|VD|VDC)\)/gi, '').trim();
        }
    });
    
    // 4. Get the modified HTML
    const studentVersion = container.innerHTML;

    // 5. Export the cleaned HTML
    exportContentToDoc(studentVersion, 'cau_hoi_on_tap_hoc_sinh.doc');
  };


  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Tạo câu hỏi ôn tập</h2>
            <div className="flex flex-wrap gap-3">
            <button
                onClick={handleGenerate}
                disabled={!generatedMatrix}
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Bắt đầu tạo
            </button>
            <button
                onClick={handleExportForTeachers}
                disabled={!reviewQuestions}
                className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Xuất file word cho GV
            </button>
            <button
                onClick={handleExportForStudents}
                disabled={!reviewQuestions}
                className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Xuất file word cho HS
            </button>
            </div>
        </div>
      
        {reviewQuestions ? (
            <div 
            ref={questionsContainerRef} 
            className="prose dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-6 rounded-md border border-gray-200 dark:border-gray-700 font-sans text-base"
            dangerouslySetInnerHTML={{ __html: reviewQuestions }}
            />
        ) : (
            <div className="text-center py-12 px-6 bg-sky-50 dark:bg-gray-800/50 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-200">Chưa có câu hỏi ôn tập</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Nhấn nút "Bắt đầu tạo" để AI tạo câu hỏi dựa trên ma trận.
            </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Tab4;
