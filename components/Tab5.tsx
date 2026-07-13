
import React, { useState, useEffect, useRef } from 'react';
import { generateExams } from '../services/geminiService';
import { convertFileToHtml } from '../utils/fileReader';

interface Tab5Props {
  setIsLoading: (isLoading: boolean) => void;
  setLoadingProgress: (progress: number | ((prev: number) => number)) => void;
  generatedMatrix: string;
  examPapers: string[];
  setExamPapers: (papers: string[]) => void;
  examTemplateContent: string;
  setExamTemplateContent: (content: string) => void;
  sgkFileContent: string;
  matrixConfig: any; // Add matrixConfig
}

// Make renderMathInElement globally available for TypeScript
declare global {
  interface Window {
    renderMathInElement?: (element: HTMLElement, options?: any) => void;
  }
}

const Tab5: React.FC<Tab5Props> = ({
  setIsLoading,
  setLoadingProgress,
  generatedMatrix,
  examPapers,
  setExamPapers,
  examTemplateContent,
  setExamTemplateContent,
  sgkFileContent,
  matrixConfig
}) => {
  const [reviewFileContent, setReviewFileContent] = useState<string>('');
  const [reviewFileStatus, setReviewFileStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [reviewFileFeedback, setReviewFileFeedback] = useState<string>('');

  const [templateFileStatus, setTemplateFileStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [templateFileFeedback, setTemplateFileFeedback] = useState<string>('');

  const [similarityPercentage, setSimilarityPercentage] = useState<number>(100);

  const paperRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    paperRefs.current.forEach(el => {
      if (el && window.renderMathInElement) {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false },
          ],
          throwOnError: false,
        });
      }
    });
  }, [examPapers]);

  const handleReviewFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // Đặt lại để cho phép tải lại
    if (file) {
      setReviewFileStatus('parsing');
      setReviewFileFeedback('Đang xử lý file...');
      setReviewFileContent('');
      try {
        // Fix: Use convertFileToHtml to preserve structure needed by the AI.
        const htmlContent = await convertFileToHtml(file);
        setReviewFileContent(htmlContent);
        setReviewFileFeedback(file.name);
        setReviewFileStatus('success');
      } catch (err) {
        const message = err instanceof Error ? err.message : "Lỗi không xác định khi xử lý file.";
        setReviewFileFeedback(message);
        setReviewFileStatus('error');
      }
    }
  };

  const getReviewFeedbackClasses = () => {
    switch (reviewFileStatus) {
      case 'parsing': return 'text-blue-600 dark:text-blue-400';
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const handleTemplateFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // Reset to allow re-upload
    if (file) {
      setTemplateFileStatus('parsing');
      setTemplateFileFeedback('Đang xử lý file...');
      setExamTemplateContent('');
      try {
        const htmlContent = await convertFileToHtml(file);
        setExamTemplateContent(htmlContent);
        setTemplateFileFeedback(file.name);
        setTemplateFileStatus('success');
      } catch (err) {
        const message = err instanceof Error ? err.message : "Lỗi không xác định khi xử lý file.";
        setTemplateFileFeedback(message);
        setTemplateFileStatus('error');
      }
    }
  };

  const getTemplateFeedbackClasses = () => {
    switch (templateFileStatus) {
      case 'parsing': return 'text-blue-600 dark:text-blue-400';
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const handleGenerate = async () => {
    if (!reviewFileContent) {
      alert("Vui lòng tải lên file câu hỏi ôn tập đã được xử lý thành công.");
      return;
    }
    if (!generatedMatrix) {
      alert("Không tìm thấy ma trận. Vui lòng quay lại Tab 2.");
      return;
    }
    if (similarityPercentage < 100 && !sgkFileContent) {
      alert("Để tạo câu hỏi mới, vui lòng tải lên file nội dung SGK ở Tab 1.");
      return;
    }
    setIsLoading(true);
    setLoadingProgress(0);

    // Hiệu ứng tăng phần trăm giả lập - chậm hơn vì tạo 3 đề lần lượt
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 97) return prev;
        const remaining = 97 - prev;
        // Tăng nhanh hơn một chút vì chỉ tạo 2 đề
        const step = Math.max(0.5, remaining * 0.05);
        return prev + (Math.random() < 0.6 ? step : 0);
      });
    }, 1200);

    try {
      const result = await generateExams(
        reviewFileContent,
        generatedMatrix,
        sgkFileContent,
        similarityPercentage,
        examTemplateContent,
        1,
        2,
        matrixConfig?.soYTrongCauDungSai || 4
      );

      clearInterval(progressInterval);
      setLoadingProgress(100);

      setTimeout(() => {
        setExamPapers(result);
        setIsLoading(false);
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      alert(error instanceof Error ? error.message : "Có lỗi không xác định xảy ra. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  const handleGenerateThirdExam = async () => {
    if (!reviewFileContent) {
      alert("Vui lòng tải lên file câu hỏi ôn tập trước khi tạo đề 3.");
      return;
    }
    if (!generatedMatrix) {
      alert("Không tìm thấy ma trận. Vui lòng quay lại tab Ma trận để tạo.");
      return;
    }
    
    setIsLoading(true);
    setLoadingProgress(0);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 97) return prev;
        const remaining = 97 - prev;
        const step = Math.max(0.5, remaining * 0.08); // Nhanh hơn vì chỉ tạo 1 đề
        return prev + (Math.random() < 0.6 ? step : 0);
      });
    }, 1200);

    try {
      const result = await generateExams(
        reviewFileContent,
        generatedMatrix,
        sgkFileContent,
        similarityPercentage,
        examTemplateContent,
        3,
        1,
        matrixConfig?.soYTrongCauDungSai || 4
      );

      clearInterval(progressInterval);
      setLoadingProgress(100);

      setTimeout(() => {
        setExamPapers([...examPapers, ...result]);
        setIsLoading(false);
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      alert(error instanceof Error ? error.message : "Có lỗi không xác định xảy ra. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  const exportToDoc = (content: string, filename: string) => {
    if (!content) return;
    // Thêm CSS chuyên biệt cho Word để xử lý table viền và không viền
    // Word rất nhạy cảm với CSS inline hoặc thẻ <style>
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>${filename}</title>
        <style>
            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.3; }
            
            /* CSS chung cho bảng */
            table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
            td { padding: 4px; vertical-align: top; }
            
            /* Class cho bảng đáp án trắc nghiệm (có viền) */
            table[border="1"], table.bordered { border: 1px solid black; }
            table[border="1"] td, table.bordered td { border: 1px solid black; text-align: center; }
            
            /* Class cho bảng layout câu hỏi (không viền) */
            table[border="0"], table.no-border { border: none; }
            table[border="0"] td, table.no-border td { border: none; text-align: left; }

            .answer-key-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .answer-key-table td { border: 1px solid black; text-align: center; font-weight: bold; padding: 5px; }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), fullHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isFirstGeneration = examPapers.length === 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mb-4">Tạo 3 đề kiểm tra</h2>
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-2 space-y-6">
          <div>
            <label htmlFor="review-file" className="block text-base font-bold text-blue-600 dark:text-blue-400 mb-1">1. Tải lên file câu hỏi ôn tập</label>
            <div className="flex items-center">
              <input id="review-file" type="file" className="sr-only" onChange={handleReviewFileChange} accept=".txt,.md,.pdf,.docx,.doc" />
              <label htmlFor="review-file" className="cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-4 py-2 inline-flex justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Chọn File Câu Hỏi
              </label>
              {reviewFileFeedback && <span className={`ml-4 text-sm font-medium ${getReviewFeedbackClasses()}`}>{reviewFileFeedback}</span>}
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 font-bold mt-1">Bạn có thể sử dụng file word cho GV đã xuất từ Tab 4 DẠNG DOCX. (BẠN CẦN CHUYỂN FILE WORD XUẤT RA TỪ TAB 4 DẠNG DOC THÀNH DOCX ĐỂ CHƯƠNG TRÌNH ĐỌC ĐƯỢC NHÉ).</p>
          </div>
          <div>
            <label htmlFor="template-file-upload" className="block text-base font-bold text-blue-600 dark:text-blue-400 mb-1">2. Tải file mẫu đề kiểm tra (Tùy chọn)</label>
            <div className="flex items-center">
              <input id="template-file-upload" type="file" className="sr-only" onChange={handleTemplateFileChange} accept=".txt,.md,.pdf,.docx,.doc" />
              <label htmlFor="template-file-upload" className="cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-4 py-2 inline-flex justify-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Chọn File Mẫu
              </label>
              {templateFileFeedback && <span className={`ml-4 text-sm font-medium ${getTemplateFeedbackClasses()}`}>{templateFileFeedback}</span>}
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 font-bold mt-1">Nếu không tải lên, AI sẽ sử dụng định dạng mặc định.</p>
          </div>
          <div>
            <label htmlFor="similarityPercentage" className="block text-base font-bold text-blue-600 dark:text-blue-400 mb-1">3. Nhập % nội dung đề kiểm tra giống file câu hỏi ôn tập</label>
            <input
              type="number"
              id="similarityPercentage"
              value={similarityPercentage}
              onChange={(e) => setSimilarityPercentage(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
              className="w-full max-w-xs p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="100"
            />
            <p className="text-sm text-red-600 dark:text-red-400 mt-1 font-bold">
              Nhập % câu hỏi sẽ được lấy từ file câu hỏi ôn tập đã tải lên. Phần còn lại AI sẽ tự tạo mới dựa trên nội dung SGK (Tab 1).
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center md:col-span-1 space-y-4">
          <button
            onClick={handleGenerate}
            disabled={!reviewFileContent || !generatedMatrix}
            className={`w-full text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ${isFirstGeneration
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
              }`}
          >
            {isFirstGeneration ? 'Tạo 2 Đề Thi Trước' : 'Tạo lại 2 đề khác'}
          </button>
          
          {examPapers.length === 2 && (
            <button
              onClick={handleGenerateThirdExam}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              Tạo đề 3 tiếp theo
            </button>
          )}
        </div>
      </div>

      {examPapers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {examPapers.map((paper, index) => (
            <div key={index} className="relative border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col min-w-0 overflow-hidden">
              <div className="p-4 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200">Đề số {index + 1}</h3>
                <button
                  onClick={() => exportToDoc(paper, `de_thi_so_${index + 1}.doc`)}
                  className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 text-sm"
                >
                  Xuất File Word
                </button>
              </div>
              <div
                // Fix: Changed ref callback to not return a value, which is required for ref callbacks.
                ref={el => { paperRefs.current[index] = el; }}
                className="p-4 prose dark:prose-invert max-w-none font-sans text-base bg-white dark:bg-gray-800 rounded-b-lg flex-grow overflow-x-auto break-words"
                dangerouslySetInnerHTML={{ __html: paper }}
              >
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-6 bg-sky-50 dark:bg-gray-800/50 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-200">Chưa có đề thi</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tải lên file câu hỏi và nhấn "Tạo 2 Đề Thi Trước", sau đó có thể tạo thêm đề 3.
          </p>
        </div>
      )}
    </div>
  );
};

export default Tab5;
