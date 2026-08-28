
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

const QUICK_SUGGESTIONS = [
  {
    label: "Câu hỏi ngắn 4 ý nhỏ, đáp án là số",
    prompt: "Đối với câu hỏi trả lời ngắn: mỗi câu hãy thiết kế gồm 4 ý nhỏ (a, b, c, d) và đáp án là các con số cụ thể."
  },
  {
    label: "Tình huống thực tế",
    prompt: "Ưu tiên đưa các tình huống thực tế đời sống vào các câu hỏi mức độ thông hiểu và vận dụng."
  },
  {
    label: "Bài tập tính toán",
    prompt: "Tập trung các câu hỏi dạng bài tập tính toán định lượng cho các mức độ vận dụng."
  },
  {
    label: "Đáp án giải thích chi tiết",
    prompt: "Phần đáp án cần giải thích ngắn gọn, súc tích phương pháp giải hoặc căn cứ lý thuyết."
  }
];

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
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    return localStorage.getItem('review_questions_custom_prompt') || '';
  });

  const questionsContainerRef = useRef<HTMLDivElement>(null);

  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    localStorage.setItem('review_questions_custom_prompt', value);
  };

  const handleAddSuggestion = (suggestionText: string) => {
    const updated = customPrompt.trim() 
      ? `${customPrompt.trim()}\n- ${suggestionText}` 
      : suggestionText;
    handleCustomPromptChange(updated);
  };

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
      const result = await generateReviewQuestions(
        sgkFileContent, 
        generatedMatrix, 
        generatedSpec, 
        matrixConfig,
        customPrompt
      );
      
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Tạo câu hỏi ôn tập</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI sẽ tạo bộ câu hỏi ôn tập gấp 2.5 lần số lượng câu hỏi trong bản đặc tả.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerate}
            disabled={!generatedMatrix}
            className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Bắt đầu tạo
          </button>
          <button
            onClick={handleExportForTeachers}
            disabled={!reviewQuestions}
            className="bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Xuất file word cho GV
          </button>
          <button
            onClick={handleExportForStudents}
            disabled={!reviewQuestions}
            className="bg-teal-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Xuất file word cho HS
          </button>
        </div>
      </div>

      {/* Yêu cầu / Prompt tùy chọn cho AI */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-900/50 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </span>
            <label htmlFor="custom-question-prompt" className="text-base font-bold text-blue-700 dark:text-blue-300">
              Yêu cầu / Gợi ý bổ sung cho AI soạn câu hỏi (Tùy chọn)
            </label>
          </div>
          {customPrompt && (
            <button
              type="button"
              onClick={() => handleCustomPromptChange('')}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors"
            >
              Xóa yêu cầu
            </button>
          )}
        </div>

        <textarea
          id="custom-question-prompt"
          value={customPrompt}
          onChange={(e) => handleCustomPromptChange(e.target.value)}
          rows={3}
          className="w-full p-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          placeholder="Ví dụ: Đối với câu trả lời ngắn, hãy thiết kế mỗi câu gồm 4 ý nhỏ (a, b, c, d) và đáp án là các con số cụ thể. Hoặc: Ưu tiên các câu hỏi tình huống thực tiễn, mức độ vận dụng tập trung vào tính toán..."
        />

        {/* Gợi ý nhanh (Quick suggestion chips) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Gợi ý nhanh:</span>
          {QUICK_SUGGESTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAddSuggestion(item.prompt)}
              className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors"
              title={item.prompt}
            >
              + {item.label}
            </button>
          ))}
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
            Bạn có thể nhập yêu cầu riêng cho AI ở ô trên, sau đó nhấn nút "Bắt đầu tạo".
          </p>
        </div>
      )}
    </div>
  );
};

export default Tab4;
