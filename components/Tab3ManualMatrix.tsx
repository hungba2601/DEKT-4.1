
import React, { useState, useEffect, useMemo } from 'react';
import type { SpecData, MatrixConfig } from '../types';

interface Tab3ManualMatrixProps {
  generatedSpec: SpecData;
  matrixConfig: MatrixConfig;
  onConfirm: (spec: SpecData, html: string) => void;
  examTitle: string;
  savedSpec: SpecData | null;
  onSaveSpec: (spec: SpecData) => void;
}

// Helper to deep clone the spec data and zero out counts for initialization
const createEmptySpec = (sourceSpec: SpecData): SpecData => {
  return sourceSpec.map(topic => ({
    ...topic,
    rows: topic.rows.map(row => ({
      ...row,
      soCau: {
        nhanBiet: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
        thongHieu: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
        vanDung: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
        vanDungCao: { TN: 0, DS: 0, TNgan: 0, TL: 0 }
      }
    }))
  }));
};

const exportHtmlToDoc = (htmlContent: string, filename: string) => {
    if (!htmlContent) return;
    
    const fullHtml = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>${filename}</title>
            <style>
                table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', serif; font-size: 11pt; }
                th, td { border: 1px solid black; padding: 5px; text-align: center; }
                th { font-weight: bold; background-color: #f2f2f2; }
                .text-left { text-align: left; }
            </style>
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

const Tab3ManualMatrix: React.FC<Tab3ManualMatrixProps> = ({ 
  generatedSpec, 
  matrixConfig, 
  onConfirm,
  examTitle,
  savedSpec,
  onSaveSpec
}) => {
  // Local state for the editable matrix structure
  const [manualSpec, setManualSpec] = useState<SpecData>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  // Local state for previewing the HTML before confirming
  const [previewHtml, setPreviewHtml] = useState<string>('');
  // Track confirmation state
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Initialize manualSpec from savedSpec OR generatedSpec when it becomes available
  useEffect(() => {
    if (!isInitialized) {
        if (savedSpec && savedSpec.length > 0) {
             setManualSpec(savedSpec);
             setIsInitialized(true);
        } else if (generatedSpec && generatedSpec.length > 0) {
             // If no saved data, create empty spec from generated spec
             setManualSpec(createEmptySpec(generatedSpec));
             setIsInitialized(true);
        }
    }
  }, [generatedSpec, savedSpec, isInitialized]);

  // --- AUTO SAVE MECHANISM ---
  // Tự động lưu lên App state mỗi khi manualSpec thay đổi (sau 500ms debounce)
  // Giúp dữ liệu không bị mất khi chuyển tab mà không cần bấm nút Lưu
  useEffect(() => {
    if (manualSpec.length > 0 && isInitialized) {
        const timer = setTimeout(() => {
            onSaveSpec(manualSpec);
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [manualSpec, isInitialized, onSaveSpec]);


  // Handle input changes
  const handleCountChange = (
    topicIndex: number, 
    rowIndex: number, 
    level: 'nhanBiet' | 'thongHieu' | 'vanDung', // Simplified levels for UI mapping
    type: 'TN' | 'DS' | 'TNgan' | 'TL',
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    
    // Reset confirmed state when user modifies data so they know to save again
    if (isConfirmed) setIsConfirmed(false);

    // Update state immutably (Deep update)
    setManualSpec(prev => {
        return prev.map((topic, tIdx) => {
            if (tIdx !== topicIndex) return topic;
            return {
                ...topic,
                rows: topic.rows.map((row, rIdx) => {
                    if (rIdx !== rowIndex) return row;
                    return {
                        ...row,
                        soCau: {
                            ...row.soCau,
                            [level]: {
                                ...row.soCau[level],
                                [type]: numValue
                            }
                        }
                    };
                })
            };
        });
    });
  };

  // Calculate totals and generate HTML string locally
  useEffect(() => {
    if (manualSpec.length === 0) {
        setPreviewHtml('');
        return;
    }

    const html = generateHtmlFromSpec(manualSpec, matrixConfig, examTitle);
    setPreviewHtml(html);
  }, [manualSpec, matrixConfig, examTitle]);

  const handleSaveTemp = () => {
     if (manualSpec.length === 0) return;
     // Force save immediately
     onSaveSpec(manualSpec);
     alert('Đã lưu dữ liệu ma trận thủ công. Bạn có thể yên tâm chuyển tab.');
  };

  const handleConfirm = () => {
      if (manualSpec.length === 0 || !previewHtml) return;
      // Send both the data structure and the HTML back to App.tsx
      onConfirm(manualSpec, previewHtml);
      setIsConfirmed(true);
  };

  const handleExport = () => {
      if (!previewHtml) return;
      exportHtmlToDoc(previewHtml, `Ma_Tran_Tu_Nhap_${examTitle.replace(/\s+/g, '_')}`);
  };

  const generateHtmlFromSpec = (spec: SpecData, config: MatrixConfig, title: string) => {
        // 1. Calculate Summary Data first to put in Footer
        let sumTN = { nb: 0, th: 0, vd: 0 };
        let sumDS = { nb: 0, th: 0, vd: 0 };
        let sumTNgan = { nb: 0, th: 0, vd: 0 };
        let sumTL = { nb: 0, th: 0, vd: 0 };
        let grandTotalPoints = 0;

        spec.forEach(topic => {
            topic.rows.forEach(row => {
                const s = row.soCau;
                sumTN.nb += s.nhanBiet.TN; sumTN.th += s.thongHieu.TN; sumTN.vd += s.vanDung.TN;
                sumDS.nb += s.nhanBiet.DS; sumDS.th += s.thongHieu.DS; sumDS.vd += s.vanDung.DS;
                sumTNgan.nb += s.nhanBiet.TNgan; sumTNgan.th += s.thongHieu.TNgan; sumTNgan.vd += s.vanDung.TNgan;
                sumTL.nb += s.nhanBiet.TL; sumTL.th += s.thongHieu.TL; sumTL.vd += s.vanDung.TL;
            });
        });

        const totalTNCount = sumTN.nb + sumTN.th + sumTN.vd;
        const totalDSCount = sumDS.nb + sumDS.th + sumDS.vd;
        const totalTNganCount = sumTNgan.nb + sumTNgan.th + sumTNgan.vd;
        const totalTLCount = sumTL.nb + sumTL.th + sumTL.vd;

        const pointsTN = totalTNCount * config.diemCauNhieuLuaChon;
        const pointsDS = totalDSCount * (config.soYTrongCauDungSai * config.diemMoiYTrongCauDungSai);
        const pointsTNgan = totalTNganCount * config.diemCauTraLoiNgan;
        const pointsTL = totalTLCount * config.diemCauTuLuan;
        
        const finalTotalPoints = pointsTN + pointsDS + pointsTNgan + pointsTL;

        const percentTN = (pointsTN / 10) * 100;
        const percentDS = (pointsDS / 10) * 100;
        const percentTNgan = (pointsTNgan / 10) * 100;
        const percentTL = (pointsTL / 10) * 100;

        // 2. Generate HTML
      let html = `<table border="1" style="width:100%; border-collapse: collapse; font-family: 'Times New Roman', serif; font-size: 11pt; text-align: center;">
        <caption style="font-weight: bold; font-size: 1.2em; padding: 10px;">MA TRẬN ĐỀ KIỂM TRA ${title.toUpperCase()}</caption>
        <thead>
            <tr>
                <th rowspan="2" style="width: 3%;">TT</th>
                <th rowspan="2" style="width: 25%;">Nội dung/đơn vị kiến thức</th>
                <th colspan="12">Mức độ đánh giá</th>
                <th colspan="3">Tổng</th>
                <th rowspan="2" style="width: 5%;">Tỉ lệ % điểm</th>
            </tr>
            <tr>
                <th colspan="3">Nhiều lựa chọn</th>
                <th colspan="3">"Đúng - Sai"</th>
                <th colspan="3">Trả lời ngắn</th>
                <th colspan="3">Tự luận</th>
                <th>Biết</th>
                <th>Hiểu</th>
                <th>Vận dụng</th>
            </tr>
        </thead>
        <tbody>
            <tr style="font-weight:bold;">
                <td></td><td></td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 4.8%;"></td><td style="width: 4.8%;"></td><td style="width: 4.8%;"></td>
                <td></td>
            </tr>`;
        
        spec.forEach((topic) => {
            html += `<tr style="font-weight: bold; background-color: #f2f2f2;"><td>I</td><td colspan="17" style="text-align: left;">${topic.chuDe}</td></tr>`;

            topic.rows.forEach(row => {
                const s = row.soCau;
                
                const tnCount = s.nhanBiet.TN + s.thongHieu.TN + s.vanDung.TN;
                const tnPoints = tnCount * config.diemCauNhieuLuaChon;

                const dsCount = s.nhanBiet.DS + s.thongHieu.DS + s.vanDung.DS;
                const dsPoints = dsCount * (config.soYTrongCauDungSai * config.diemMoiYTrongCauDungSai);

                const tnganCount = s.nhanBiet.TNgan + s.thongHieu.TNgan + s.vanDung.TNgan;
                const tnganPoints = tnganCount * config.diemCauTraLoiNgan;

                const tlCount = s.nhanBiet.TL + s.thongHieu.TL + s.vanDung.TL;
                const tlPoints = tlCount * config.diemCauTuLuan;

                const rowTotalPoints = tnPoints + dsPoints + tnganPoints + tlPoints;

                const fmt = (count: number, unitPoint: number) => {
                    if (!count) return "";
                    const p = count * unitPoint;
                    return `(${count} - ${parseFloat(p.toFixed(2))})`;
                };
                
                const fmtDS = (count: number) => {
                     if (!count) return "";
                     const p = count * (config.soYTrongCauDungSai * config.diemMoiYTrongCauDungSai);
                     return `(${count} - ${parseFloat(p.toFixed(2))})`;
                }

                html += `<tr>
                    <td>${row.tt}</td>
                    <td style="text-align: left;">${row.noiDung}</td>
                    
                    <td>${fmt(s.nhanBiet.TN, config.diemCauNhieuLuaChon)}</td>
                    <td>${fmt(s.thongHieu.TN, config.diemCauNhieuLuaChon)}</td>
                    <td>${fmt(s.vanDung.TN, config.diemCauNhieuLuaChon)}</td>

                    <td>${fmtDS(s.nhanBiet.DS)}</td>
                    <td>${fmtDS(s.thongHieu.DS)}</td>
                    <td>${fmtDS(s.vanDung.DS)}</td>

                    <td>${fmt(s.nhanBiet.TNgan, config.diemCauTraLoiNgan)}</td>
                    <td>${fmt(s.thongHieu.TNgan, config.diemCauTraLoiNgan)}</td>
                    <td>${fmt(s.vanDung.TNgan, config.diemCauTraLoiNgan)}</td>

                    <td>${fmt(s.nhanBiet.TL, config.diemCauTuLuan)}</td>
                    <td>${fmt(s.thongHieu.TL, config.diemCauTuLuan)}</td>
                    <td>${fmt(s.vanDung.TL, config.diemCauTuLuan)}</td>
                    
                    <td></td><td></td><td></td> 
                    <td>${rowTotalPoints > 0 ? ((rowTotalPoints/10)*100).toFixed(0) : 0}</td>
                </tr>`;
            });
        });

        // Add Footer
        html += `</tbody>
        <tfoot>
            <tr style="font-weight: bold;">
                <td colspan="2">Tổng số câu</td>
                <td>${sumTN.nb || ''}</td><td>${sumTN.th || ''}</td><td>${sumTN.vd || ''}</td>
                <td>${sumDS.nb || ''}</td><td>${sumDS.th || ''}</td><td>${sumDS.vd || ''}</td>
                <td>${sumTNgan.nb || ''}</td><td>${sumTNgan.th || ''}</td><td>${sumTNgan.vd || ''}</td>
                <td>${sumTL.nb || ''}</td><td>${sumTL.th || ''}</td><td>${sumTL.vd || ''}</td>
                <td></td><td></td><td></td>
                <td>${totalTNCount + totalDSCount + totalTNganCount + totalTLCount}</td>
            </tr>
            <tr style="font-weight: bold;">
                <td colspan="2">Tổng điểm</td>
                <td colspan="3">${pointsTN.toFixed(2)}</td>
                <td colspan="3">${pointsDS.toFixed(2)}</td>
                <td colspan="3">${pointsTNgan.toFixed(2)}</td>
                <td colspan="3">${pointsTL.toFixed(2)}</td>
                <td colspan="3"></td>
                <td>${finalTotalPoints.toFixed(2)}</td>
            </tr>
             <tr style="font-weight: bold;">
                <td colspan="2">Tỉ lệ %</td>
                <td colspan="3">${percentTN.toFixed(0)}%</td>
                <td colspan="3">${percentDS.toFixed(0)}%</td>
                <td colspan="3">${percentTNgan.toFixed(0)}%</td>
                <td colspan="3">${percentTL.toFixed(0)}%</td>
                <td colspan="3"></td>
                <td>100%</td>
            </tr>
        </tfoot>
        </table>`;
        return html;
  };
  
  // Calculate Totals for display in React UI (Top banner)
  const totals = useMemo(() => {
      let t = { tn: 0, ds: 0, tngan: 0, tl: 0, points: 0 };
      manualSpec.forEach(topic => {
          topic.rows.forEach(row => {
              const s = row.soCau;
              t.tn += s.nhanBiet.TN + s.thongHieu.TN + s.vanDung.TN;
              t.ds += s.nhanBiet.DS + s.thongHieu.DS + s.vanDung.DS;
              t.tngan += s.nhanBiet.TNgan + s.thongHieu.TNgan + s.vanDung.TNgan;
              t.tl += s.nhanBiet.TL + s.thongHieu.TL + s.vanDung.TL;
          });
      });
      
      const pTn = t.tn * matrixConfig.diemCauNhieuLuaChon;
      const pDs = t.ds * (matrixConfig.soYTrongCauDungSai * matrixConfig.diemMoiYTrongCauDungSai);
      const pTngan = t.tngan * matrixConfig.diemCauTraLoiNgan;
      const pTl = t.tl * matrixConfig.diemCauTuLuan;
      
      t.points = pTn + pDs + pTngan + pTl;
      return t;
  }, [manualSpec, matrixConfig]);

  if (!generatedSpec || generatedSpec.length === 0) {
      return (
        <div className="text-center py-12 px-6 bg-sky-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            Vui lòng tạo ma trận ở Tab 1 trước, sau đó bạn có thể chỉnh sửa số lượng câu hỏi tại đây.
          </p>
        </div>
      );
  }

  // Common Input Styles
  const baseInputClass = "w-10 py-1.5 text-center font-bold border-2 rounded shadow-sm outline-none transition-all focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 text-base";
  
  const tnInputClass = `${baseInputClass} border-blue-300 bg-blue-100 text-blue-900 focus:border-blue-600 focus:ring-blue-400 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-100 placeholder-blue-300`;
  const dsInputClass = `${baseInputClass} border-orange-300 bg-orange-100 text-orange-900 focus:border-orange-600 focus:ring-orange-400 dark:bg-orange-900/50 dark:border-orange-700 dark:text-orange-100 placeholder-orange-300`;
  const tnganInputClass = `${baseInputClass} border-purple-300 bg-purple-100 text-purple-900 focus:border-purple-600 focus:ring-purple-400 dark:bg-purple-900/50 dark:border-purple-700 dark:text-purple-100 placeholder-purple-300`;
  const tlInputClass = `${baseInputClass} border-green-300 bg-green-100 text-green-900 focus:border-green-600 focus:ring-green-400 dark:bg-green-900/50 dark:border-green-700 dark:text-green-100 placeholder-green-300`;

  return (
    <div className="space-y-6 pb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-700 flex-grow">
                <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Chế độ Ma trận Mẫu (Tự nhập)
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Tại đây bạn có thể tự nhập số lượng câu hỏi cho từng bài học. 
                    <strong> Dữ liệu sẽ được tự động lưu. Hãy nhấn "XÁC NHẬN" khi bạn hoàn tất để áp dụng ma trận này cho các bước sau.</strong>
                </p>
                <div className="mt-2 flex gap-4 text-sm font-medium">
                    <span>Tổng số câu: TN({totals.tn}) - ĐS({totals.ds}) - Ngắn({totals.tngan}) - TL({totals.tl})</span>
                    <span className={Math.abs(totals.points - 10) > 0.1 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                        Tổng điểm: {totals.points.toFixed(2)} / 10
                    </span>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <button
                    onClick={handleSaveTemp}
                    className="flex items-center gap-2 bg-blue-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md"
                    title="Dữ liệu cũng được tự động lưu khi bạn nhập"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 010-2z" />
                    </svg>
                    Lưu thủ công
                </button>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors shadow-md"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    Xuất Word
                </button>
            </div>
        </div>

        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                        <th className="border p-2 min-w-[200px] text-left">Nội dung / Bài học</th>
                        <th className="border p-2 text-center bg-blue-50 dark:bg-blue-900/20" colSpan={3}>Trắc nghiệm (Nhiều lựa chọn)</th>
                        <th className="border p-2 text-center bg-orange-50 dark:bg-orange-900/20" colSpan={3}>Đúng - Sai</th>
                        <th className="border p-2 text-center bg-purple-50 dark:bg-purple-900/20" colSpan={3}>Trả lời ngắn</th>
                        <th className="border p-2 text-center bg-green-50 dark:bg-green-900/20" colSpan={3}>Tự luận</th>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-xs">
                         <th className="border p-1"></th>
                         <th className="border p-1 w-12 text-center">NB</th><th className="border p-1 w-12 text-center">TH</th><th className="border p-1 w-12 text-center">VD</th>
                         <th className="border p-1 w-12 text-center">NB</th><th className="border p-1 w-12 text-center">TH</th><th className="border p-1 w-12 text-center">VD</th>
                         <th className="border p-1 w-12 text-center">NB</th><th className="border p-1 w-12 text-center">TH</th><th className="border p-1 w-12 text-center">VD</th>
                         <th className="border p-1 w-12 text-center">NB</th><th className="border p-1 w-12 text-center">TH</th><th className="border p-1 w-12 text-center">VD</th>
                    </tr>
                </thead>
                <tbody>
                    {manualSpec.map((topic, tIdx) => (
                        <React.Fragment key={tIdx}>
                            <tr className="bg-gray-200 dark:bg-gray-700 font-bold text-xs uppercase">
                                <td colSpan={13} className="p-2 border">{topic.chuDe}</td>
                            </tr>
                            {topic.rows.map((row, rIdx) => (
                                <tr key={`${tIdx}-${rIdx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-2 border text-gray-700 dark:text-gray-300">
                                        <span className="font-semibold mr-2">{row.tt}.</span>{row.noiDung}
                                    </td>
                                    
                                    {/* TN Inputs */}
                                    {['nhanBiet', 'thongHieu', 'vanDung'].map((level) => (
                                        <td key={`TN-${level}`} className="p-1 border text-center">
                                            <input 
                                                type="text" 
                                                className={tnInputClass}
                                                value={row.soCau[level as 'nhanBiet'|'thongHieu'|'vanDung'].TN || ''}
                                                onChange={(e) => handleCountChange(tIdx, rIdx, level as any, 'TN', e.target.value)}
                                            />
                                        </td>
                                    ))}

                                    {/* DS Inputs */}
                                    {['nhanBiet', 'thongHieu', 'vanDung'].map((level) => (
                                        <td key={`DS-${level}`} className="p-1 border text-center">
                                            <input 
                                                type="text" 
                                                className={dsInputClass}
                                                value={row.soCau[level as 'nhanBiet'|'thongHieu'|'vanDung'].DS || ''}
                                                onChange={(e) => handleCountChange(tIdx, rIdx, level as any, 'DS', e.target.value)}
                                            />
                                        </td>
                                    ))}

                                    {/* TNgan Inputs */}
                                    {['nhanBiet', 'thongHieu', 'vanDung'].map((level) => (
                                        <td key={`TNgan-${level}`} className="p-1 border text-center">
                                            <input 
                                                type="text" 
                                                className={tnganInputClass}
                                                value={row.soCau[level as 'nhanBiet'|'thongHieu'|'vanDung'].TNgan || ''}
                                                onChange={(e) => handleCountChange(tIdx, rIdx, level as any, 'TNgan', e.target.value)}
                                            />
                                        </td>
                                    ))}

                                    {/* TL Inputs */}
                                    {['nhanBiet', 'thongHieu', 'vanDung'].map((level) => (
                                        <td key={`TL-${level}`} className="p-1 border text-center">
                                            <input 
                                                type="text" 
                                                className={tlInputClass}
                                                value={row.soCau[level as 'nhanBiet'|'thongHieu'|'vanDung'].TL || ''}
                                                onChange={(e) => handleCountChange(tIdx, rIdx, level as any, 'TL', e.target.value)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="flex justify-center pt-4 sticky bottom-4">
            <button
                onClick={handleConfirm}
                className={`text-white font-bold py-3 px-10 rounded-lg focus:outline-none focus:ring-4 transition-all shadow-xl transform hover:scale-105 ${
                    isConfirmed 
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:focus:ring-red-900 border-2 border-red-500' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:focus:ring-blue-900 border-2 border-blue-500'
                }`}
            >
                {isConfirmed ? 'ĐÃ XÁC NHẬN (BẤM ĐỂ CẬP NHẬT LẠI)' : 'XÁC NHẬN VÀ ÁP DỤNG MA TRẬN NÀY'}
            </button>
        </div>
    </div>
  );
};

export default Tab3ManualMatrix;
