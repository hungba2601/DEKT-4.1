
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { SpecData, QuestionCounts, CognitiveLevelQuestionCounts, MatrixConfig } from '../types';

interface Tab3Props {
  generatedSpec: SpecData;
  setGeneratedSpec: React.Dispatch<React.SetStateAction<SpecData>>;
  examTitle: string;
  matrixConfig: MatrixConfig;
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
            <style>
                table { width: 100%; border-collapse: collapse; font-family: 'Times New Roman', serif; font-size: 11pt; }
                th, td { border: 1px solid black; padding: 5px; vertical-align: middle; text-align: center; }
                th { font-weight: bold; }
                .text-left { text-align: left; }
                .bg-header { background-color: #f0f0f0; }
                .font-bold { font-weight: bold; }
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


const EditModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (newText: string) => void;
  initialText: string;
}> = ({ isOpen, onClose, onSave, initialText }) => {
  const [text, setText] = useState(initialText);

  React.useEffect(() => {
    setText(initialText);
  }, [initialText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Chỉnh sửa Yêu cầu cần đạt</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-40 p-2 border rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          autoFocus
        />
        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500">Hủy</button>
          <button onClick={() => onSave(text)} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">Lưu thay đổi</button>
        </div>
      </div>
    </div>
  );
};

// Helper function to safely get count or return empty string if 0
const getCount = (count: number | undefined) => {
    return count && count > 0 ? count : '';
};

const Tab3: React.FC<Tab3Props> = ({ generatedSpec, setGeneratedSpec, examTitle, matrixConfig }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState({ text: '', topicIndex: -1, rowIndex: -1 });
  const specContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (specContainerRef.current && window.renderMathInElement) {
      window.renderMathInElement(specContainerRef.current, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    }
  }, [generatedSpec]);

  // Tính tổng để hiển thị ở footer bảng
  const totals = useMemo(() => {
    const t = {
        tn_biet: 0, tn_hieu: 0, tn_vd: 0,
        ds_biet: 0, ds_hieu: 0, ds_vd: 0,
        tngan_biet: 0, tngan_hieu: 0, tngan_vd: 0,
        tl_biet: 0, tl_hieu: 0, tl_vd: 0
    };

    if (!generatedSpec) return { counts: t, points: { tn: 0, ds: 0, tngan: 0, tl: 0 }, percentages: { tn: 0, ds: 0, tngan: 0, tl: 0 } };

    generatedSpec.forEach(topic => {
        topic.rows.forEach(row => {
            // TN Nhiều lựa chọn
            t.tn_biet += row.soCau.nhanBiet.TN || 0;
            t.tn_hieu += row.soCau.thongHieu.TN || 0;
            t.tn_vd += (row.soCau.vanDung.TN || 0) + (row.soCau.vanDungCao.TN || 0);

            // TN Đúng Sai
            t.ds_biet += row.soCau.nhanBiet.DS || 0;
            t.ds_hieu += row.soCau.thongHieu.DS || 0;
            t.ds_vd += (row.soCau.vanDung.DS || 0) + (row.soCau.vanDungCao.DS || 0);

            // TN Trả lời ngắn
            t.tngan_biet += row.soCau.nhanBiet.TNgan || 0;
            t.tngan_hieu += row.soCau.thongHieu.TNgan || 0;
            t.tngan_vd += (row.soCau.vanDung.TNgan || 0) + (row.soCau.vanDungCao.TNgan || 0);

            // Tự luận
            t.tl_biet += row.soCau.nhanBiet.TL || 0;
            t.tl_hieu += row.soCau.thongHieu.TL || 0;
            t.tl_vd += (row.soCau.vanDung.TL || 0) + (row.soCau.vanDungCao.TL || 0);
        });
    });

    const tn_total_count = t.tn_biet + t.tn_hieu + t.tn_vd;
    const ds_total_count = t.ds_biet + t.ds_hieu + t.ds_vd;
    const tngan_total_count = t.tngan_biet + t.tngan_hieu + t.tngan_vd;
    const tl_total_count = t.tl_biet + t.tl_hieu + t.tl_vd;

    const tn_points = tn_total_count * Number(matrixConfig.diemCauNhieuLuaChon);
    // Điểm câu đúng sai: Số câu hỏi * (Số ý * Điểm mỗi ý)
    const ds_point_per_q = Number(matrixConfig.soYTrongCauDungSai) * Number(matrixConfig.diemMoiYTrongCauDungSai);
    const ds_points = ds_total_count * ds_point_per_q;
    const tngan_points = tngan_total_count * Number(matrixConfig.diemCauTraLoiNgan);
    const tl_points = tl_total_count * Number(matrixConfig.diemCauTuLuan);

    const total_score = 10; // Giả định thang điểm 10
    
    return {
        counts: t,
        points: {
            tn: tn_points,
            ds: ds_points,
            tngan: tngan_points,
            tl: tl_points
        },
        percentages: {
            tn: (tn_points / total_score) * 100,
            ds: (ds_points / total_score) * 100,
            tngan: (tngan_points / total_score) * 100,
            tl: (tl_points / total_score) * 100
        }
    };
  }, [generatedSpec, matrixConfig]);

  const handleEditClick = (topicIndex: number, rowIndex: number, currentText: string) => {
    setEditingContent({ text: currentText, topicIndex, rowIndex });
    setIsModalOpen(true);
  };

  const handleSave = (newText: string) => {
    const { topicIndex, rowIndex } = editingContent;
    const newSpec = JSON.parse(JSON.stringify(generatedSpec)); // Deep copy
    newSpec[topicIndex].rows[rowIndex].yeuCauCanDat = newText;
    setGeneratedSpec(newSpec);
    setIsModalOpen(false);
  };

  const handleExportSpec = () => {
    if (!generatedSpec || generatedSpec.length === 0) return;

    const finalExamTitle = examTitle ? ` ${examTitle.toUpperCase()}` : '';

    let tableHtml = `
      <h2 style="text-align: center; font-weight: bold; font-size: 1.2em; margin-bottom: 20px;">2. BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KÌ${finalExamTitle}</h2>
      <table border="1" style="width:100%; border-collapse: collapse; text-align: center;">
        <thead>
          <tr class="bg-header">
            <th rowspan="4" style="width: 5%;">TT</th>
            <th rowspan="4" style="width: 15%;">Chủ đề/Chương</th>
            <th rowspan="4" style="width: 20%;">Nội dung/đơn vị kiến thức</th>
            <th rowspan="4" style="width: 25%;">Yêu cầu cần đạt</th>
            <th colspan="12">Số câu hỏi ở các mức độ đánh giá</th>
          </tr>
          <tr class="bg-header">
             <th colspan="9">TNKQ</th>
             <th colspan="3">Tự luận</th>
          </tr>
          <tr class="bg-header">
             <th colspan="3">Nhiều lựa chọn</th>
             <th colspan="3">“Đúng – Sai”</th>
             <th colspan="3">Trả lời ngắn</th>
             <th rowspan="2">Biết</th>
             <th rowspan="2">Hiểu</th>
             <th rowspan="2">Vận<br>dụng</th>
          </tr>
          <tr class="bg-header">
             <th>Biết</th><th>Hiểu</th><th>Vận<br>dụng</th>
             <th>Biết</th><th>Hiểu</th><th>Vận<br>dụng</th>
             <th>Biết</th><th>Hiểu</th><th>Vận<br>dụng</th>
          </tr>
        </thead>
        <tbody>
    `;

    generatedSpec.forEach((topic, topicIndex) => {
      const sanitizedChuDe = topic.chuDe.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      topic.rows.forEach((row, rowIndex) => {
        const sanitize = (str: string) => String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        tableHtml += `<tr>`;
        tableHtml += `<td>${sanitize(row.tt)}</td>`;
        
        // Chỉ hiện tên Chủ đề ở dòng đầu tiên của nhóm, dùng rowspan
        if (rowIndex === 0) {
            tableHtml += `<td rowspan="${topic.rows.length}" class="text-left font-bold" style="vertical-align: middle;">${sanitizedChuDe}</td>`;
        }
        
        tableHtml += `<td class="text-left">${sanitize(row.noiDung)}</td>`;
        tableHtml += `<td class="text-left">${sanitize(row.yeuCauCanDat)}</td>`;
        
        // TN Nhiều lựa chọn
        tableHtml += `<td>${getCount(row.soCau.nhanBiet.TN)}</td>`;
        tableHtml += `<td>${getCount(row.soCau.thongHieu.TN)}</td>`;
        tableHtml += `<td>${getCount((row.soCau.vanDung.TN || 0) + (row.soCau.vanDungCao.TN || 0))}</td>`;

        // TN Đúng Sai
        tableHtml += `<td>${getCount(row.soCau.nhanBiet.DS)}</td>`;
        tableHtml += `<td>${getCount(row.soCau.thongHieu.DS)}</td>`;
        tableHtml += `<td>${getCount((row.soCau.vanDung.DS || 0) + (row.soCau.vanDungCao.DS || 0))}</td>`;

        // TN Trả lời ngắn
        tableHtml += `<td>${getCount(row.soCau.nhanBiet.TNgan)}</td>`;
        tableHtml += `<td>${getCount(row.soCau.thongHieu.TNgan)}</td>`;
        tableHtml += `<td>${getCount((row.soCau.vanDung.TNgan || 0) + (row.soCau.vanDungCao.TNgan || 0))}</td>`;

        // Tự luận
        tableHtml += `<td>${getCount(row.soCau.nhanBiet.TL)}</td>`;
        tableHtml += `<td>${getCount(row.soCau.thongHieu.TL)}</td>`;
        tableHtml += `<td>${getCount((row.soCau.vanDung.TL || 0) + (row.soCau.vanDungCao.TL || 0))}</td>`;

        tableHtml += `</tr>`;
      });
    });
    
    // Tổng cộng Footer (Rows)
    // Row 1: Tổng số câu
    tableHtml += `
        <tr style="font-weight: bold; background-color: #f0f0f0;">
            <td colspan="4" style="text-align: center;">Tổng số câu</td>
            <td>${getCount(totals.counts.tn_biet)}</td>
            <td>${getCount(totals.counts.tn_hieu)}</td>
            <td>${getCount(totals.counts.tn_vd)}</td>
            
            <td>${getCount(totals.counts.ds_biet)}</td>
            <td>${getCount(totals.counts.ds_hieu)}</td>
            <td>${getCount(totals.counts.ds_vd)}</td>
            
            <td>${getCount(totals.counts.tngan_biet)}</td>
            <td>${getCount(totals.counts.tngan_hieu)}</td>
            <td>${getCount(totals.counts.tngan_vd)}</td>
            
            <td>${getCount(totals.counts.tl_biet)}</td>
            <td>${getCount(totals.counts.tl_hieu)}</td>
            <td>${getCount(totals.counts.tl_vd)}</td>
        </tr>
    `;

    // Row 2: Tổng số điểm (Merged columns by Type)
    tableHtml += `
        <tr style="font-weight: bold; background-color: #f0f0f0;">
            <td colspan="4" style="text-align: center;">Tổng số điểm</td>
            <td colspan="3">${totals.points.tn.toFixed(1).replace('.', ',')}</td>
            <td colspan="3">${totals.points.ds.toFixed(1).replace('.', ',')}</td>
            <td colspan="3">${totals.points.tngan.toFixed(1).replace('.', ',')}</td>
            <td colspan="3">${totals.points.tl.toFixed(1).replace('.', ',')}</td>
        </tr>
    `;

    // Row 3: Tỉ lệ % (Merged columns by Type)
    tableHtml += `
        <tr style="font-weight: bold; background-color: #f0f0f0;">
            <td colspan="4" style="text-align: center;">Tỉ lệ %</td>
            <td colspan="3">${Math.round(totals.percentages.tn)}</td>
            <td colspan="3">${Math.round(totals.percentages.ds)}</td>
            <td colspan="3">${Math.round(totals.percentages.tngan)}</td>
            <td colspan="3">${Math.round(totals.percentages.tl)}</td>
        </tr>
    `;
    
    tableHtml += `</tbody></table>`;

    exportHtmlToDoc(tableHtml, 'ban_dac_ta_de_kiem_tra');
  };

  return (
    <div ref={specContainerRef}>
      <EditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialText={editingContent.text}
      />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">2. BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KÌ</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Chỉnh sửa 'Yêu cầu cần đạt' trước khi xuất file.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExportSpec}
            disabled={!generatedSpec || generatedSpec.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            Xuất Word
          </button>
        </div>
      </div>

      {(generatedSpec && generatedSpec.length > 0) ? (
        <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm border-collapse border border-gray-300 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-bold">
              <tr>
                <th rowSpan={4} className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-10 text-center">TT</th>
                <th rowSpan={4} className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-48 text-center">Chủ đề/Chương</th>
                <th rowSpan={4} className="border border-gray-300 dark:border-gray-600 px-2 py-2 w-64 text-center">Nội dung/đơn vị kiến thức</th>
                <th rowSpan={4} className="border border-gray-300 dark:border-gray-600 px-2 py-2 min-w-[300px] text-center">Yêu cầu cần đạt</th>
                <th colSpan={12} className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center">Số câu hỏi ở các mức độ đánh giá</th>
              </tr>
              <tr>
                 <th colSpan={9} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center bg-blue-50 dark:bg-blue-900/30">TNKQ</th>
                 <th colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center bg-green-50 dark:bg-green-900/30">Tự luận</th>
              </tr>
              <tr>
                 {/* TNKQ Sub-headers */}
                 <th colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center font-medium">Nhiều lựa chọn</th>
                 <th colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center font-medium">“Đúng – Sai”</th>
                 <th colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center font-medium">Trả lời ngắn</th>
                 {/* TL Levels */}
                 <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal bg-green-50/50 dark:bg-green-900/20">Biết</th>
                 <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal bg-green-50/50 dark:bg-green-900/20">Hiểu</th>
                 <th rowSpan={2} className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal bg-green-50/50 dark:bg-green-900/20">Vận<br/>dụng</th>
              </tr>
              <tr>
                 {/* TNKQ Level headers */}
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Biết</th>
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Hiểu</th>
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Vận<br/>dụng</th>
                 
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Biết</th>
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Hiểu</th>
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Vận<br/>dụng</th>
                 
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Biết</th>
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Hiểu</th>
                 <th className="border border-gray-300 dark:border-gray-600 px-1 py-1 w-10 text-center font-normal text-xs">Vận<br/>dụng</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {generatedSpec.map((topic, topicIndex) => (
                <React.Fragment key={topicIndex}>
                    {topic.rows.map((row, rowIndex) => {
                        const vd_tn = (row.soCau.vanDung.TN || 0) + (row.soCau.vanDungCao.TN || 0);
                        const vd_ds = (row.soCau.vanDung.DS || 0) + (row.soCau.vanDungCao.DS || 0);
                        const vd_tngan = (row.soCau.vanDung.TNgan || 0) + (row.soCau.vanDungCao.TNgan || 0);
                        const vd_tl = (row.soCau.vanDung.TL || 0) + (row.soCau.vanDungCao.TL || 0);

                        return (
                            <tr key={`${topicIndex}-${rowIndex}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center">{row.tt}</td>
                                
                                {rowIndex === 0 && (
                                    <td 
                                        rowSpan={topic.rows.length} 
                                        className="border border-gray-300 dark:border-gray-600 px-2 py-2 font-bold align-middle bg-gray-50 dark:bg-gray-800"
                                    >
                                        {topic.chuDe}
                                    </td>
                                )}
                                
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">{row.noiDung}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 relative group">
                                    <span className="whitespace-pre-line">{row.yeuCauCanDat}</span>
                                    <button
                                        onClick={() => handleEditClick(topicIndex, rowIndex, row.yeuCauCanDat)}
                                        className="absolute top-1 right-1 p-1 bg-gray-200 dark:bg-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                        aria-label="Chỉnh sửa yêu cầu"
                                    >
                                        <svg className="h-3 w-3 text-gray-700 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                                        </svg>
                                    </button>
                                </td>

                                {/* TN Nhiều lựa chọn */}
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.nhanBiet.TN)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.thongHieu.TN)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(vd_tn)}</td>

                                {/* TN Đúng Sai */}
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.nhanBiet.DS)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.thongHieu.DS)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(vd_ds)}</td>

                                {/* TN Trả lời ngắn */}
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.nhanBiet.TNgan)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.thongHieu.TNgan)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(vd_tngan)}</td>

                                {/* Tự luận */}
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.nhanBiet.TL)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(row.soCau.thongHieu.TL)}</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(vd_tl)}</td>
                            </tr>
                        );
                    })}
                </React.Fragment>
              ))}
            </tbody>
             <tfoot className="bg-gray-200 dark:bg-gray-900 font-bold text-gray-800 dark:text-gray-200">
                {/* Row 1: Tổng số câu */}
                <tr>
                    <td colSpan={4} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Tổng số câu</td>
                    {/* Totals for NLC */}
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tn_biet)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tn_hieu)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tn_vd)}</td>
                    
                    {/* Totals for DS */}
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.ds_biet)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.ds_hieu)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.ds_vd)}</td>
                    
                    {/* Totals for TNgan */}
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tngan_biet)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tngan_hieu)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tngan_vd)}</td>
                    
                    {/* Totals for TL */}
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tl_biet)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tl_hieu)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{getCount(totals.counts.tl_vd)}</td>
                </tr>

                 {/* Row 2: Tổng số điểm (Merged) */}
                <tr>
                    <td colSpan={4} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Tổng số điểm</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{totals.points.tn.toFixed(1)}</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{totals.points.ds.toFixed(1)}</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{totals.points.tngan.toFixed(1)}</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{totals.points.tl.toFixed(1)}</td>
                </tr>

                {/* Row 3: Tỉ lệ % (Merged) */}
                <tr>
                    <td colSpan={4} className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">Tỉ lệ %</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{Math.round(totals.percentages.tn)}</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{Math.round(totals.percentages.ds)}</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{Math.round(totals.percentages.tngan)}</td>
                    <td colSpan={3} className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">{Math.round(totals.percentages.tl)}</td>
                </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 px-6 bg-sky-50 dark:bg-gray-800/50 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-200">Chưa có dữ liệu bản đặc tả</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vui lòng quay lại Tab 1 để nhập dữ liệu và tạo bản đặc tả.
          </p>
        </div>
      )}
    </div>
  );
};

export default Tab3;
