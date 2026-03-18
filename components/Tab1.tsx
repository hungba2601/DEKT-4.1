
import React, { useMemo, useEffect } from 'react';
import type { MatrixConfig, SpecData, TabName } from '../types';
import { generateMatrixAndSpec } from '../services/geminiService';
import { readFileContent } from '../utils/fileReader';

interface FileInputProps {
  id: string;
  label: string;
  onFileProcessed: (content: string) => void;
}

const FileInput: React.FC<FileInputProps> = ({ id, label, onFileProcessed }) => {
  const [status, setStatus] = React.useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = React.useState<string>('');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Đặt lại giá trị input để cho phép tải lại cùng một file
    event.target.value = ''; 
    if (file) {
      setStatus('parsing');
      setFeedback('Đang xử lý file...');
      try {
        const text = await readFileContent(file);
        onFileProcessed(text);
        setFeedback(file.name);
        setStatus('success');
      } catch (err) {
        const message = err instanceof Error ? err.message : "Lỗi không xác định khi xử lý file.";
        console.error(`Failed to read file ${file.name}:`, err);
        onFileProcessed("");
        setFeedback(message);
        setStatus('error');
      }
    } else {
      onFileProcessed("");
      setFeedback('');
      setStatus('idle');
    }
  };
  
  const getFeedbackClasses = () => {
     switch (status) {
      case 'parsing': return 'text-blue-600 dark:text-blue-400';
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-base font-bold text-blue-600 dark:text-blue-400 mb-1">{label}</label>
      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex flex-col sm:flex-row items-center justify-center text-sm text-gray-600 dark:text-gray-400">
            <label htmlFor={id} className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
              <span>Tải file lên</span>
              <input id={id} name={id} type="file" className="sr-only" onChange={handleFileChange} accept=".txt,.md,.pdf,.docx,.doc" />
            </label>
            <p className="pl-0 sm:pl-1">hoặc kéo thả vào đây</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Hỗ trợ: TXT, MD, PDF, DOCX, DOC</p>
          {feedback && <p className="text-sm font-semibold mt-2 ${getFeedbackClasses()}">{feedback}</p>}
        </div>
      </div>
    </div>
  );
};


interface Tab1Props {
  examTitle: string;
  setExamTitle: (title: string) => void;
  matrixConfig: MatrixConfig;
  setMatrixConfig: React.Dispatch<React.SetStateAction<MatrixConfig>>;
  setIsLoading: (isLoading: boolean) => void;
  setLoadingProgress: (progress: number | ((prev: number) => number)) => void;
  setGeneratedMatrix: (matrix: string) => void;
  setGeneratedSpec: (spec: SpecData) => void;
  setActiveTab: (tab: TabName) => void;
  sgkFileContent: string;
  setSgkFileContent: (content: string) => void;
  curriculumFileContent: string;
  setCurriculumFileContent: (content: string) => void;
}

const PercentageInput: React.FC<{
    label: string;
    name: keyof MatrixConfig;
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, name, value, onChange }) => (
    <div className="flex items-center gap-2">
        <label htmlFor={name} className="w-28 text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
            {label}
        </label>
        <div className="relative w-20 shrink-0">
            <input
                type="number"
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-right pr-8 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                min="0"
                max="100"
            />
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 pointer-events-none">%</span>
        </div>
    </div>
);

const CountInput: React.FC<{
    label: string;
    name: keyof MatrixConfig;
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
}> = ({ label, name, value, onChange, disabled }) => (
    <div className="flex items-center gap-2">
        <label htmlFor={name} className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
            {label}
        </label>
        <input
            type="number"
            id={name}
            name={name}
            value={value || ''}
            onChange={onChange}
            disabled={disabled}
            className="w-24 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed text-center"
            min="0"
            step="1"
        />
    </div>
);

const PointInput: React.FC<{
    label: string;
    name: keyof MatrixConfig;
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
    disabled?: boolean;
}> = ({ label, name, value, onChange, onBlur, disabled }) => (
    <div className="flex items-center gap-2">
        <label htmlFor={name} className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
            {label}
        </label>
        <input
            type="text"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            className="w-24 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed text-center"
            min="0"
        />
    </div>
);


const Tab1: React.FC<Tab1Props> = ({ 
    examTitle,
    setExamTitle,
    setMatrixConfig, 
    matrixConfig, 
    setIsLoading,
    setLoadingProgress,
    setGeneratedMatrix,
    setGeneratedSpec,
    setActiveTab,
    sgkFileContent,
    setSgkFileContent,
    curriculumFileContent,
    setCurriculumFileContent,
}) => {

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        let finalValue: number | string;

        const isPointField = ['diemCauNhieuLuaChon', 'diemCauTuLuan', 'diemMoiYTrongCauDungSai', 'diemCauTraLoiNgan'].includes(name);
        
        if (e.target.type === 'text' && isPointField) {
             // Allow decimal input for text fields
            if (value === '' || value.endsWith('.') || !isNaN(parseFloat(value))) {
                finalValue = value;
            } else {
                return; // Do not update state if not a valid number start
            }
        } else {
             const numValue = parseInt(value, 10);
             finalValue = isNaN(numValue) ? 0 : numValue;
        }


        // For percentage fields
        if (['tracNghiem', 'tuLuan', 'biet', 'hieu', 'vanDung'].includes(name)) {
            const percentageValue = Math.max(0, Math.min(100, Math.round(Number(finalValue))));
            setMatrixConfig(prev => {
                const newConfig = { ...prev, [name]: percentageValue };
                if (name === 'tracNghiem') {
                    newConfig.tuLuan = 100 - percentageValue;
                } else if (name === 'tuLuan') {
                    newConfig.tracNghiem = 100 - percentageValue;
                }
                return newConfig;
            });
        } else {
             // For counts and points
             setMatrixConfig(prev => ({
                ...prev,
                [name]: finalValue,
            }));
        }
    };
    
    const handleAdditionalPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMatrixConfig(prev => ({
            ...prev,
            additionalPrompt: e.target.value
        }));
    };
    
    // Handle blur for point inputs to finalize the value
    const handlePointBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numValue = parseFloat(value);
        setMatrixConfig(prev => ({
            ...prev,
            [name]: isNaN(numValue) ? 0 : Math.max(0, numValue),
        }));
    };


    const handleTuLuan100Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            setMatrixConfig(prev => ({
                ...prev,
                isTuLuan100: true,
                tracNghiem: 0,
                tuLuan: 100,
                soCauNhieuLuaChon: 0,
                soCauDungSai: 0,
                soCauTraLoiNgan: 0,
                soYTrongCauDungSai: 0,
                diemCauNhieuLuaChon: 0,
                diemCauTuLuan: 0, // AI will set this
                diemMoiYTrongCauDungSai: 0,
                diemCauTraLoiNgan: 0,
            }));
        } else {
            // Restore to defaults
            setMatrixConfig(prev => ({
                ...prev,
                isTuLuan100: false,
                tracNghiem: 70,
                tuLuan: 30,
                soCauNhieuLuaChon: 12,
                soCauTuLuan: 2,
                soCauDungSai: 4,
                soCauTraLoiNgan: 4,
                soYTrongCauDungSai: 4,
                diemCauNhieuLuaChon: 0.25,
                diemCauTuLuan: 1.5,
                diemMoiYTrongCauDungSai: 0.25,
                diemCauTraLoiNgan: 0.25,
            }));
        }
    };
    
    const calculatedCounts = useMemo(() => {
        if (matrixConfig.isTuLuan100) {
            return { nlcCount: 0, tlCount: matrixConfig.soCauTuLuan, nlcWarning: false, tlWarning: false, dungSaiWarning: null };
        }

        const { 
            tracNghiem, tuLuan, 
            diemCauNhieuLuaChon, diemCauTuLuan,
            soCauDungSai, soYTrongCauDungSai, diemMoiYTrongCauDungSai,
            soCauTraLoiNgan, diemCauTraLoiNgan
        } = matrixConfig;
    
        const totalPoints = 10;
        const targetTracNghiemPoints = totalPoints * (tracNghiem / 100);
        const targetTuLuanPoints = totalPoints * (tuLuan / 100);
    
        const diemCauDungSaiFull = Number(soYTrongCauDungSai) * Number(diemMoiYTrongCauDungSai);
        const tongDiemDungSai = Number(soCauDungSai) * diemCauDungSaiFull;
        const tongDiemTraLoiNgan = Number(soCauTraLoiNgan) * Number(diemCauTraLoiNgan);
    
        let dungSaiWarningMessage = null;
        if (targetTracNghiemPoints > 0 && (tongDiemDungSai + tongDiemTraLoiNgan) > targetTracNghiemPoints) {
            dungSaiWarningMessage = `Cảnh báo: Tổng điểm câu Đúng-Sai & Trả lời ngắn (${(tongDiemDungSai + tongDiemTraLoiNgan).toFixed(2)}đ) đã vượt quá tổng điểm mục tiêu cho Trắc nghiệm (${targetTracNghiemPoints.toFixed(2)}đ).`;
        }

        const remainingNLCPoints = Math.max(0, targetTracNghiemPoints - tongDiemDungSai - tongDiemTraLoiNgan);
    
        let nlcCount = 0;
        if (Number(diemCauNhieuLuaChon) > 0) {
            nlcCount = remainingNLCPoints / Number(diemCauNhieuLuaChon);
        }
    
        let tlCount = 0;
        if (Number(diemCauTuLuan) > 0) {
            tlCount = targetTuLuanPoints / Number(diemCauTuLuan);
        }
        
        return {
            nlcCount,
            tlCount,
            nlcWarning: nlcCount > 0 && nlcCount % 1 !== 0,
            tlWarning: tlCount > 0 && tlCount % 1 !== 0,
            dungSaiWarning: dungSaiWarningMessage,
        };
    }, [matrixConfig]);

    useEffect(() => {
        if (matrixConfig.isTuLuan100) return;

        const roundedNlcCount = Math.round(calculatedCounts.nlcCount);
        const roundedTlCount = Math.round(calculatedCounts.tlCount);
    
        setMatrixConfig(prev => {
            const currentNLC = typeof prev.soCauNhieuLuaChon === 'string' ? parseInt(prev.soCauNhieuLuaChon, 10) : prev.soCauNhieuLuaChon;
            const currentTL = typeof prev.soCauTuLuan === 'string' ? parseInt(prev.soCauTuLuan, 10) : prev.soCauTuLuan;

            if (currentNLC !== roundedNlcCount || currentTL !== roundedTlCount) {
                return {
                    ...prev,
                    soCauNhieuLuaChon: roundedNlcCount,
                    soCauTuLuan: roundedTlCount,
                }
            }
            return prev;
        });
    }, [calculatedCounts, setMatrixConfig, matrixConfig.isTuLuan100]);


    const calculatedValues = useMemo(() => {
        if (matrixConfig.isTuLuan100) {
            return {
                diemCauDungSaiFull: 0,
                tongDiemTracNghiem: 0,
                tongDiemTuLuan: 10,
                tongDiem: 10,
                calculatedTracNghiemPercent: 0,
                calculatedTuLuanPercent: 100,
            };
        }
        const { 
            soCauNhieuLuaChon, diemCauNhieuLuaChon, 
            soCauDungSai, soYTrongCauDungSai, diemMoiYTrongCauDungSai,
            soCauTraLoiNgan, diemCauTraLoiNgan,
            soCauTuLuan, diemCauTuLuan
        } = matrixConfig;

        const diemCauDungSaiFull = Number(soYTrongCauDungSai) * Number(diemMoiYTrongCauDungSai);
        const tongDiemTracNghiem = (Number(soCauNhieuLuaChon) * Number(diemCauNhieuLuaChon)) + (Number(soCauDungSai) * diemCauDungSaiFull) + (Number(soCauTraLoiNgan) * Number(diemCauTraLoiNgan));
        const tongDiemTuLuan = Number(soCauTuLuan) * Number(diemCauTuLuan);
        const tongDiem = tongDiemTracNghiem + tongDiemTuLuan;

        const calculatedTracNghiemPercent = tongDiem > 0 ? (tongDiemTracNghiem / tongDiem) * 100 : 0;
        const calculatedTuLuanPercent = tongDiem > 0 ? (tongDiemTuLuan / tongDiem) * 100 : 0;
        
        return {
            diemCauDungSaiFull,
            tongDiemTracNghiem,
            tongDiemTuLuan,
            tongDiem,
            calculatedTracNghiemPercent,
            calculatedTuLuanPercent,
        };
    }, [matrixConfig]);

    const handleGenerate = async () => {
        if (!sgkFileContent) {
            alert('Vui lòng tải lên file nội dung sách giáo khoa.');
            return;
        }
        if (!curriculumFileContent) {
            alert('Vui lòng tải lên file phân phối chương trình.');
            return;
        }

        const cognitiveTotal = matrixConfig.biet + matrixConfig.hieu + matrixConfig.vanDung;
        if (cognitiveTotal !== 100) {
            alert(`Tổng tỷ lệ các mức độ (Nhận biết, Thông hiểu, Vận dụng) phải bằng 100%. Hiện tại là ${cognitiveTotal}%.`);
            return;
        }
        
        if (matrixConfig.isTuLuan100) {
            if (Number(matrixConfig.soCauTuLuan) < 1) {
                alert('Vui lòng nhập số câu tự luận lớn hơn 0.');
                return;
            }
        } else {
             if (Math.abs(calculatedValues.tongDiem - 10) > 0.01) {
                 if (!confirm(`Tổng điểm hiện tại là ${calculatedValues.tongDiem.toFixed(2)}, khác 10.0. AI sẽ cố gắng điều chỉnh để đạt 10.0 điểm. Bạn có muốn tiếp tục không?`)) {
                    return;
                 }
            }
        }


        setIsLoading(true);
        setLoadingProgress(0);

        // Hiệu ứng tăng phần trăm giả lập để người dùng biết đang xử lý
        const progressInterval = setInterval(() => {
            setLoadingProgress(prev => {
                if (prev >= 95) return prev; // Dừng ở 95% và chờ kết quả thực
                // Tăng chậm dần khi gần đến 95
                const remaining = 95 - prev;
                const step = Math.max(1, Math.floor(remaining * 0.1)); 
                return prev + (Math.random() < 0.5 ? step : 0);
            });
        }, 800);

        try {
            // Finalize any string inputs to numbers before sending to AI
            const finalConfig: MatrixConfig = {
                ...matrixConfig,
                soCauNhieuLuaChon: Number(matrixConfig.soCauNhieuLuaChon),
                soCauTuLuan: Number(matrixConfig.soCauTuLuan),
                soCauDungSai: Number(matrixConfig.soCauDungSai),
                soCauTraLoiNgan: Number(matrixConfig.soCauTraLoiNgan),
                soYTrongCauDungSai: Number(matrixConfig.soYTrongCauDungSai),
                diemCauNhieuLuaChon: Number(matrixConfig.diemCauNhieuLuaChon),
                diemCauTuLuan: Number(matrixConfig.diemCauTuLuan),
                diemMoiYTrongCauDungSai: Number(matrixConfig.diemMoiYTrongCauDungSai),
                diemCauTraLoiNgan: Number(matrixConfig.diemCauTraLoiNgan),
                // additionalPrompt is already in matrixConfig
            };

            const { matrix, spec } = await generateMatrixAndSpec(sgkFileContent, curriculumFileContent, finalConfig, examTitle);
            
            clearInterval(progressInterval);
            setLoadingProgress(100);
            
            // Chờ một chút để người dùng thấy 100%
            setTimeout(() => {
                setGeneratedMatrix(matrix);
                setGeneratedSpec(spec);
                setActiveTab('tab2');
                setIsLoading(false);
            }, 500);

        } catch (error) {
            clearInterval(progressInterval);
            console.error(error);
            alert(error instanceof Error ? error.message : "Có lỗi không xác định xảy ra. Vui lòng thử lại.");
            setIsLoading(false);
        }
    };
    
    const cognitiveTotal = matrixConfig.biet + matrixConfig.hieu + matrixConfig.vanDung;

    const isRatioMismatched = !matrixConfig.isTuLuan100 && (Math.abs(matrixConfig.tracNghiem - calculatedValues.calculatedTracNghiemPercent) > 1 || Math.abs(matrixConfig.tuLuan - calculatedValues.calculatedTuLuanPercent) > 1);


    return (
        <div className="space-y-8">
            <div className="p-6 bg-sky-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">1. Tải lên tài liệu & Nhập thông tin</h3>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <FileInput id="sgk-file" label="File nội dung sách giáo khoa" onFileProcessed={setSgkFileContent} />
                        <p className="text-red-600 dark:text-red-500 font-bold text-sm mt-2">
                            Tải file SGK Khối lớp, môn của mình dạng pdf
                        </p>
                    </div>
                    <div>
                        <FileInput id="curriculum-file" label="File phân phối chương trình môn học" onFileProcessed={setCurriculumFileContent} />
                        <p className="text-red-600 dark:text-red-500 font-bold text-sm mt-2">
                            Tải file PPCT LÊN file này là Phụ lục 1 có tên nội dung bài học , yêu cầu cần đạt. Thầy cô copy phần nội dung từ tuần nào đến tuần nào cho HS kiểm tra từ file PPCT cả năm , tạo thành file mới với tên tùy ý rồi up lên. KHÔNG lấy nguyên file PPCT cả năm up lên AI sẽ tạo ra ma trận cả năm không đúng vói yêu cầu minh
                        </p>
                    </div>
                </div>
                <div className="mt-6">
                    <label htmlFor="exam-title" className="block text-lg font-bold text-blue-600 dark:text-blue-400 mb-2">
                        Nhập Tiêu đề kỳ kiểm tra
                    </label>
                    <input
                        type="text"
                        id="exam-title"
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-lg bg-white dark:bg-gray-700"
                        placeholder="VD: Giữa Học Kỳ I - Môn Tin học 6"
                    />
                </div>
            </div>

            <div className="p-6 bg-sky-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">2. Cấu trúc ma trận</h3>

                <div className="grid grid-cols-1 md:grid-cols-[max-content_1fr] gap-x-8 gap-y-6 items-start">
                    
                    <h4 className="font-bold text-blue-600 dark:text-blue-400 md:text-right pt-2">Tỷ lệ điểm (Mục tiêu)</h4>
                    <div>
                        <fieldset disabled={!!matrixConfig.isTuLuan100} className="disabled:opacity-50">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                                <PercentageInput label="Trắc nghiệm" name="tracNghiem" value={matrixConfig.tracNghiem} onChange={handleConfigChange} />
                                <PercentageInput label="Tự luận" name="tuLuan" value={matrixConfig.tuLuan} onChange={handleConfigChange} />
                            </div>
                        </fieldset>
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isTuLuan100"
                                    name="isTuLuan100"
                                    checked={!!matrixConfig.isTuLuan100}
                                    onChange={handleTuLuan100Change}
                                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="isTuLuan100" className="font-bold text-red-600 dark:text-red-400">
                                    Nếu ma trận 100% tự luận
                                </label>
                            </div>
                        </div>
                    </div>


                    <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-700 !my-4"></div>

                    <h4 className="font-bold text-blue-600 dark:text-blue-400 md:text-right pt-2">Số lượng & Điểm số (Bắt buộc)</h4>
                    <div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-6">
                            {/* Col 1: Số lượng */}
                            <div className="space-y-4">
                                <h5 className="font-semibold text-gray-700 dark:text-gray-200">Số lượng trắc nghiệm</h5>
                                
                                <fieldset disabled={!!matrixConfig.isTuLuan100} className="space-y-4 disabled:opacity-50">
                                    <CountInput label="Số câu Nhiều lựa chọn" name="soCauNhieuLuaChon" value={matrixConfig.soCauNhieuLuaChon} onChange={handleConfigChange} disabled />
                                    <CountInput label="Số câu Đúng-Sai" name="soCauDungSai" value={matrixConfig.soCauDungSai} onChange={handleConfigChange} />
                                    <CountInput label="Số ý trong câu Đúng-Sai" name="soYTrongCauDungSai" value={matrixConfig.soYTrongCauDungSai} onChange={handleConfigChange} />
                                    <CountInput label="Số câu Trả lời ngắn" name="soCauTraLoiNgan" value={matrixConfig.soCauTraLoiNgan} onChange={handleConfigChange} />
                                </fieldset>
                            </div>
                            {/* Col 2: Điểm số */}
                            <div className="space-y-4">
                                <h5 className="font-semibold text-gray-700 dark:text-gray-200">Điểm số trắc nghiệm</h5>
                                <fieldset disabled={!!matrixConfig.isTuLuan100} className="space-y-4 disabled:opacity-50">
                                    <PointInput label="Điểm câu Nhiều lựa chọn" name="diemCauNhieuLuaChon" value={matrixConfig.diemCauNhieuLuaChon} onChange={handleConfigChange} onBlur={handlePointBlur} />
                                    <div>
                                        <PointInput label="Điểm MỖI Ý câu Đúng-Sai" name="diemMoiYTrongCauDungSai" value={matrixConfig.diemMoiYTrongCauDungSai} onChange={handleConfigChange} onBlur={handlePointBlur} />
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-44 pl-2 font-semibold">(1 câu Đ-S = {calculatedValues.diemCauDungSaiFull.toFixed(2)}đ)</p>
                                    </div>
                                    <PointInput label="Điểm câu Trả lời ngắn" name="diemCauTraLoiNgan" value={matrixConfig.diemCauTraLoiNgan} onChange={handleConfigChange} onBlur={handlePointBlur} />
                                </fieldset>
                            </div>
                            
                            {/* New combined row for Tu Luan */}
                            <div className="lg:col-span-2 space-y-4">
                                 <h5 className="font-semibold text-gray-700 dark:text-gray-200">Tự luận</h5>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md border dark:border-gray-700">
                                    <CountInput label="Số câu Tự luận" name="soCauTuLuan" value={matrixConfig.soCauTuLuan} onChange={handleConfigChange} disabled={!matrixConfig.isTuLuan100} />
                                    <PointInput label="Điểm câu Tự luận" name="diemCauTuLuan" value={matrixConfig.diemCauTuLuan} onChange={handleConfigChange} onBlur={handlePointBlur} disabled={!!matrixConfig.isTuLuan100} />
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-700 !my-4"></div>

                    <h4 className="font-bold text-blue-600 dark:text-blue-400 md:text-right pt-2">Tỷ lệ mức độ (Mục tiêu)</h4>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                        <PercentageInput label="Nhận biết" name="biet" value={matrixConfig.biet} onChange={handleConfigChange} />
                        <PercentageInput label="Thông hiểu" name="hieu" value={matrixConfig.hieu} onChange={handleConfigChange} />
                        <PercentageInput label="Vận dụng" name="vanDung" value={matrixConfig.vanDung} onChange={handleConfigChange} />
                    </div>
                    
                    <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-700 !my-4"></div>

                    <h4 className="font-bold text-blue-600 dark:text-blue-400 md:text-right pt-2">Ghi chú / Yêu cầu đặc biệt cho AI</h4>
                    <div className="w-full">
                        <textarea
                            id="additionalPrompt"
                            name="additionalPrompt"
                            value={matrixConfig.additionalPrompt || ''}
                            onChange={handleAdditionalPromptChange}
                            rows={3}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Ví dụ: Phân môn Sinh học 5 điểm, Vật lý 2.5 điểm, Hóa học 2.5 điểm. Hoặc yêu cầu tập trung vào bài X..."
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Nhập các yêu cầu cụ thể về phân phối điểm cho các phân môn hoặc các lưu ý khác tại đây.
                        </p>
                    </div>

                </div>

                {/* Calculation Summary */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100">Tổng quan tính toán</h4>
                    {!matrixConfig.isTuLuan100 && (
                        <>
                         <div className="p-4 bg-gray-100 dark:bg-gray-900/50 rounded-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="font-semibold text-gray-600 dark:text-gray-300">Điểm mỗi câu Đúng-Sai</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{calculatedValues.diemCauDungSaiFull.toFixed(2)}đ</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-600 dark:text-gray-300">Tổng điểm Trắc nghiệm</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{calculatedValues.tongDiemTracNghiem.toFixed(2)}đ</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-600 dark:text-gray-300">Tổng điểm Tự luận</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{calculatedValues.tongDiemTuLuan.toFixed(2)}đ</p>
                            </div>
                             <div className={`p-2 rounded-md ${Math.abs(calculatedValues.tongDiem - 10) > 0.01 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                <p className="font-semibold text-gray-600 dark:text-gray-300">Tổng điểm bài thi</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{calculatedValues.tongDiem.toFixed(2)} / 10.0</p>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-100 dark:bg-gray-900/50 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                             <div>
                                <p className="font-semibold text-gray-600 dark:text-gray-300">Tỷ lệ Trắc nghiệm / Tự luận (Thực tế)</p>
                                <p className={`text-lg font-bold ${isRatioMismatched ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                                    {calculatedValues.calculatedTracNghiemPercent.toFixed(1)}% / {calculatedValues.calculatedTuLuanPercent.toFixed(1)}%
                                </p>
                             </div>
                             <div>
                                <p className="font-semibold text-gray-600 dark:text-gray-300">Tỷ lệ mức độ (Tổng)</p>
                                 <p className={`text-lg font-bold ${cognitiveTotal !== 100 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{cognitiveTotal}%</p>
                             </div>
                        </div>
                         {calculatedCounts.dungSaiWarning && <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-md text-yellow-800 dark:text-yellow-200 text-sm font-medium">{calculatedCounts.dungSaiWarning}</div>}
                        </>
                    )}
                    {matrixConfig.isTuLuan100 && (
                        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-md">
                            <p className="font-bold text-green-800 dark:text-green-200">
                                Chế độ 100% Tự luận đang được bật. AI sẽ tự động phân bổ 10.0 điểm cho {matrixConfig.soCauTuLuan} câu hỏi.
                            </p>
                        </div>
                    )}

                </div>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={handleGenerate}
                    className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-lg"
                >
                    Tạo Ma Trận & Đặc Tả
                </button>
            </div>
        </div>
    );
};

export default Tab1;
