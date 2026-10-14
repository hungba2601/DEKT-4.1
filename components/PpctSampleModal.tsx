import React, { useState } from 'react';

interface PpctSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PpctSampleModal: React.FC<PpctSampleModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyText = () => {
    const sampleText = `Chủ đề / Bài học\tSố tiết\tYêu cầu cần đạt
Chủ đề 1 : Bài 1. Thế giới kỹ thuật số\t2\t- Nhận biết được sự có mặt của các thiết bị có gắn bộ xử lý thông tin ở khắp nơi và nêu được ví dụ minh họa.\n- Hiểu được khả năng của máy tính và chỉ ra được một số ứng dụng thực tế của nó trong khoa học kỹ thuật và đời sống.\n- Giải thích được tác động của công nghệ thông tin lên giáo dục và xã hội thông qua các vấn đề cụ thể.
Bài 2. Thông tin trong giải quyết vấn đề.\t2\t- Giải thích được sự cần thiết phải quan tâm đến chất lượng thông tin khi tìm kiếm, tiếp nhận và trao đổi thông tin. Nêu được ví dụ minh hoạ.\n- Giải thích được tính mới, tính chính xác, tính đầy đủ, tính sử dụng được của thông tin. Nêu được ví dụ minh hoạ.
Chủ đề 2: Bài 3. Thực hành: Đánh giá chất lượng thông tin\t1\t- Biết cách tìm kiếm được thông tin để giải quyết vấn đề\n- Đánh giá được chất lượng thông tin trong giải quyết vấn đề
Chủ đề 3: Bài 4. Một số vấn đề pháp lý về sử dụng dịch vụ Internet\t2\t- Trình bày được một số tác động tiêu cực của công nghệ kỹ thuật số đối với đời sống con người và xã hội, nêu được ví dụ minh họa.\n- Nêu được một số nội dung liên quan đến luật công nghệ thông tin, nghị định về sử dụng dịch vụ internet, các khía cạnh pháp lý của việc sở hữu, sử dụng và trao đổi thông tin.\n- Nêu được một số hành vi vi phạm pháp luật, trái đạo đức, thiếu văn hóa khi hoạt động trong môi trường số thông qua một vài ví dụ.`;

    navigator.clipboard.writeText(sampleText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadWord = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <title>Mau_PPCT_Upload_App</title>
          <style>
              body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; margin: 20px; color: #000; }
              .title { text-align: center; font-weight: bold; color: #cc0000; font-size: 14pt; margin-bottom: 20px; line-height: 1.4; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid black; padding: 8px 10px; vertical-align: top; }
              th { text-align: center; font-weight: bold; background-color: #f2f2f2; }
              .text-center { text-align: center; }
              .topic-title { font-weight: bold; }
              ul { margin: 0; padding-left: 20px; }
              li { margin-bottom: 4px; }
          </style>
      </head>
      <body>
          <div class="title">
              FILE MẪU PPCT ĐỂ UP LÊN APP. THẦY CÔ TẠO PPCT CÓ CẤU TRÚC GIỐNG VẬY. HOẶC GẦN GIỐNG ĐẢM BẢO CÓ CỘT CHỦ ĐỀ/ TÊN BÀI HỌC VÀ YCCĐ
          </div>
          <table>
              <thead>
                  <tr>
                      <th style="width: 25%;">Bài học</th>
                      <th style="width: 12%;">Số tiết</th>
                      <th style="width: 63%;">Yêu cầu cần đạt</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td>
                          <div class="topic-title">Chủ đề 1 :</div>
                          <div>Bài 1. Thế giới kỹ thuật số</div>
                      </td>
                      <td class="text-center">2</td>
                      <td>
                          - Nhận biết được sự có mặt của các thiết bị có gắn bộ xử lý thông tin ở khắp nơi và nêu được ví dụ minh họa.<br/>
                          - Hiểu được khả năng của máy tính và chỉ ra được một số ứng dụng thực tế của nó trong khoa học kỹ thuật và đời sống.<br/>
                          - Giải thích được tác động của công nghệ thông tin lên giáo dục và xã hội thông qua các vấn đề cụ thể.
                      </td>
                  </tr>
                  <tr>
                      <td>
                          <div>Bài 2. Thông tin trong giải quyết vấn đề.</div>
                      </td>
                      <td class="text-center">2</td>
                      <td>
                          - Giải thích được sự cần thiết phải quan tâm đến chất lượng thông tin khi tìm kiếm, tiếp nhận và trao đổi thông tin. Nêu được ví dụ minh hoạ.<br/>
                          - Giải thích được tính mới, tính chính xác, tính đầy đủ, tính sử dụng được của thông tin. Nêu được ví dụ minh hoạ.
                      </td>
                  </tr>
                  <tr>
                      <td>
                          <div class="topic-title">Chủ đề 2:</div>
                          <div>Bài 3. Thực hành: Đánh giá chất lượng thông tin</div>
                      </td>
                      <td class="text-center">1</td>
                      <td>
                          - Biết cách tìm kiếm được thông tin để giải quyết vấn đề<br/>
                          - Đánh giá được chất lượng thông tin trong giải quyết vấn đề
                      </td>
                  </tr>
                  <tr>
                      <td>
                          <div class="topic-title">Chủ đề 3:</div>
                          <div>Bài 4. Một số vấn đề pháp lý về sử dụng dịch vụ Internet</div>
                      </td>
                      <td class="text-center">2</td>
                      <td>
                          - Trình bày được một số tác động tiêu cực của công nghệ kỹ thuật số đối với đời sống con người và xã hội, nêu được ví dụ minh họa.<br/>
                          - Nêu được một số nội dung liên quan đến luật công nghệ thông tin, nghị định về sử dụng dịch vụ internet, các khía cạnh pháp lý của việc sở hữu, sử dụng và trao đổi thông tin.<br/>
                          - Nêu được một số hành vi vi phạm pháp luật, trái đạo đức, thiếu văn hóa khi hoạt động trong môi trường số thông qua một vài ví dụ.
                      </td>
                  </tr>
              </tbody>
          </table>
      </body>
      </html>
    `;

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), htmlContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Mau_PPCT_PhuLuc1.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-sky-50 dark:bg-gray-800/80 rounded-t-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              📄
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                File mẫu Phân phối chương trình (PPCT)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cấu trúc mẫu Phụ lục 1 chuẩn để nạp vào hệ thống
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition"
            title="Đóng hộp thoại"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Hiển thị y hệt ảnh H1 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900/40">
          <div className="bg-white dark:bg-gray-800 p-5 sm:p-8 rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm">
            {/* Tiêu đề màu đỏ in hoa nổi bật như hình H1 */}
            <div className="text-center mb-6 px-2">
              <h2 className="text-red-600 dark:text-red-500 font-bold text-sm sm:text-base md:text-lg leading-relaxed uppercase tracking-wide">
                FILE MẪU PPCT ĐỂ UP LÊN APP. THẦY CÔ TẠO PPCT CÓ CẤU TRÚC GIỐNG VẬY. HOẶC GẦN GIỐNG ĐẢM BẢO CÓ CỘT CHỦ ĐỀ/ TÊN BÀI HỌC VÀ YCCĐ
              </h2>
            </div>

            {/* Bảng cấu trúc mẫu chuẩn theo H1 */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-black dark:border-gray-400 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="border border-black dark:border-gray-400 p-2.5 sm:p-3 text-center font-bold w-1/4">
                      Bài học
                    </th>
                    <th className="border border-black dark:border-gray-400 p-2.5 sm:p-3 text-center font-bold w-16 sm:w-20">
                      Số tiết
                    </th>
                    <th className="border border-black dark:border-gray-400 p-2.5 sm:p-3 text-center font-bold">
                      Yêu cầu cần đạt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black dark:divide-gray-400">
                  {/* Hàng 1 */}
                  <tr>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top">
                      <p className="font-bold text-gray-950 dark:text-white">Chủ đề 1 :</p>
                      <p>Bài 1. Thế giới kỹ thuật số</p>
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 text-center align-top font-medium">
                      2
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top leading-relaxed space-y-1.5">
                      <p>- Nhận biết được sự có mặt của các thiết bị có gắn bộ xử lý thông tin ở khắp nơi và nêu được ví dụ minh họa.</p>
                      <p>- Hiểu được khả năng của máy tính và chỉ ra được một số ứng dụng thực tế của nó trong khoa học kỹ thuật và đời sống.</p>
                      <p>- Giải thích được tác động của công nghệ thông tin lên giáo dục và xã hội thông qua các vấn đề cụ thể.</p>
                    </td>
                  </tr>

                  {/* Hàng 2 */}
                  <tr>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top">
                      <p>Bài 2. Thông tin trong giải quyết vấn đề.</p>
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 text-center align-top font-medium">
                      2
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top leading-relaxed space-y-1.5">
                      <p>- Giải thích được sự cần thiết phải quan tâm đến chất lượng thông tin khi tìm kiếm, tiếp nhận và trao đổi thông tin. Nêu được ví dụ minh hoạ.</p>
                      <p>- Giải thích được tính mới, tính chính xác, tính đầy đủ, tính sử dụng được của thông tin. Nêu được ví dụ minh hoạ.</p>
                    </td>
                  </tr>

                  {/* Hàng 3 */}
                  <tr>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top">
                      <p className="font-bold text-gray-950 dark:text-white">Chủ đề 2:</p>
                      <p>Bài 3. Thực hành: Đánh giá chất lượng thông tin</p>
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 text-center align-top font-medium">
                      1
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top leading-relaxed space-y-1.5">
                      <p>- Biết cách tìm kiếm được thông tin để giải quyết vấn đề</p>
                      <p>- Đánh giá được chất lượng thông tin trong giải quyết vấn đề</p>
                    </td>
                  </tr>

                  {/* Hàng 4 */}
                  <tr>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top">
                      <p className="font-bold text-gray-950 dark:text-white">Chủ đề 3:</p>
                      <p>Bài 4. Một số vấn đề pháp lý về sử dụng dịch vụ Internet</p>
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 text-center align-top font-medium">
                      2
                    </td>
                    <td className="border border-black dark:border-gray-400 p-2.5 sm:p-3 align-top leading-relaxed space-y-1.5">
                      <p>- Trình bày được một số tác động tiêu cực của công nghệ kỹ thuật số đối với đời sống con người và xã hội, nêu được ví dụ minh họa.</p>
                      <p>- Nêu được một số nội dung liên quan đến luật công nghệ thông tin, nghị định về sử dụng dịch vụ internet, các khía cạnh pháp lý của việc sở hữu, sử dụng và trao đổi thông tin.</p>
                      <p>- Nêu được một số hành vi vi phạm pháp luật, trái đạo đức, thiếu văn hóa khi hoạt động trong môi trường số thông qua một vài ví dụ.</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Hộp gợi ý & quy tắc */}
            <div className="mt-5 p-3.5 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 rounded-lg text-xs sm:text-sm text-sky-900 dark:text-sky-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                <span>💡</span> Hướng dẫn chuẩn bị file PPCT:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-gray-700 dark:text-gray-300">
                <li>Thầy cô có thể dùng file Word (<strong>.docx, .doc</strong>), file <strong>PDF</strong> hoặc <strong>Text (.txt)</strong>.</li>
                <li>Bắt buộc cần có cột <strong>Chủ đề / Tên bài học</strong> và cột <strong>Yêu cầu cần đạt (YCCĐ)</strong>.</li>
                <li>Chỉ cần cắt và lưu riêng các bài trong tuần kiểm tra (Ví dụ: Giữa HK1 chỉ lấy từ Tuần 1 đến Tuần 8 hoặc 9) để nạp vào hệ thống.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/90 rounded-b-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadWord}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition"
            >
              📥 Tải file mẫu Word (.doc)
            </button>
            <button
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs sm:text-sm font-semibold rounded-lg transition"
            >
              {copied ? '✅ Đã sao chép!' : '📋 Sao chép nội dung mẫu'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
