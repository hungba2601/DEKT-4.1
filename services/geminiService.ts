
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { MatrixConfig, SpecData } from '../types';

let userApiKey: string | null = null;

export const setGeminiApiKey = (key: string) => {
  userApiKey = key;
};

const getAiClient = () => {
  // Ưu tiên key người dùng nhập (userApiKey).
  // Nếu không có, thử lấy từ biến môi trường.
  // Lưu ý: Trong Vite, cần cấu hình define process.env hoặc dùng import.meta.env.
  // Ở đây chúng ta fallback an toàn.
  const envKey = process.env.GEMINI_API_KEY || '';
  
  // Lấy key cuối cùng: ưu tiên key nhập tay -> key môi trường
  const key = userApiKey || envKey;

  if (!key) {
    throw new Error("Vui lòng nhập API Key bằng cách nhấn vào biểu tượng chìa khóa ở góc trên bên phải màn hình.");
  }
  return new GoogleGenAI({ apiKey: key });
};

/**
 * Extracts a JSON object from a string that might contain other text (like markdown code blocks).
 * This makes parsing more robust against conversational AI responses.
 * @param text The raw string response from the AI.
 * @returns The extracted JSON string, or null if no valid JSON object is found.
 */
const extractJson = (text: string): string | null => {
    // This regex finds the first '{' and the last '}' in the string, capturing everything in between.
    // It's greedy and designed to handle nested objects/arrays within the main JSON structure.
    const jsonRegex = /\{[\s\S]*\}/;
    const match = text.match(jsonRegex);
    if (match) {
        return match[0];
    }
    return null;
};

const fileToText = (fileContent: string, fileName: string): string => {
  if (!fileContent) return `Nội dung file "${fileName}" chưa được cung cấp.`;
  return `--- BẮT ĐẦU NỘI DUNG FILE: ${fileName} ---\n\n${fileContent}\n\n--- KẾT THÚC NỘI DUNG FILE: ${fileName} ---`;
};

// Sử dụng model Flash để đảm bảo tốc độ và hạn mức miễn phí cao, tránh lỗi 429
const AI_MODEL = 'gemini-3-flash-preview';

// --- CƠ CHẾ RETRY (THỬ LẠI) ---
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const callWithRetry = async <T>(
    fn: () => Promise<T>,
    retries = 10, // Tăng lên 10 lần thử để "lì" hơn với server Google
    delay = 4000 // Bắt đầu chờ 4 giây (tăng lên từ 3s)
): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        let errorMessage = error.message || JSON.stringify(error);
        
        // Kiểm tra mã lỗi phổ biến: 503 (Overloaded), 429 (Rate Limit)
        const isOverloaded = errorMessage.includes('503') || errorMessage.includes('Overloaded') || errorMessage.includes('UNAVAILABLE');
        const isRateLimited = errorMessage.includes('429') || errorMessage.includes('Resource has been exhausted');
        
        if ((isOverloaded || isRateLimited) && retries > 0) {
            console.warn(`AI Model đang bận (Lỗi ${isOverloaded ? '503 - Quá tải' : '429 - Hết hạn mức'}). Đang thử lại sau ${delay/1000}s... (Còn ${retries} lần thử)`);
            await wait(delay);
            // Thử lại với thời gian chờ tăng gấp đôi (Exponential Backoff), nhưng giới hạn max 30s
            const nextDelay = Math.min(delay * 1.5, 30000); 
            return callWithRetry(fn, retries - 1, nextDelay);
        }

        // Nếu hết lần thử hoặc lỗi khác, ném ra lỗi đẹp hơn
        if (isOverloaded) {
             throw new Error("Hệ thống Google AI đang quá tải (Lỗi 503). Chúng tôi đã thử lại 10 lần nhưng không thành công. Vui lòng thử lại sau ít phút.");
        }
        if (isRateLimited) {
             throw new Error("API Key của bạn đã hết hạn mức sử dụng trong ngày/phút (Lỗi 429). Vui lòng chờ hoặc đổi API Key khác.");
        }

        // Clean up JSON error message if possible for better UX
        try {
            if (errorMessage.startsWith('{') && errorMessage.includes('"message":')) {
                const parsed = JSON.parse(errorMessage);
                if (parsed.error && parsed.error.message) {
                    throw new Error(`Lỗi từ Google: ${parsed.error.message}`);
                }
            }
        } catch (e) {
            // Ignore parsing error, throw original
        }

        throw error;
    }
};
// ------------------------------

export const generateMatrixAndSpec = async (
  sgkFileContent: string, 
  curriculumFileContent: string,
  config: MatrixConfig,
  examTitle: string
): Promise<{ matrix: string; spec: SpecData }> => {
  const ai = getAiClient();
  const model = AI_MODEL;
  const sgkText = fileToText(sgkFileContent, "Sách giáo khoa (Toàn bộ nội dung)");
  const curriculumText = fileToText(curriculumFileContent, "Phân phối chương trình");
  const finalExamTitle = examTitle ? ` ${examTitle.toUpperCase()}` : '';

  let configRules = '';

  if (config.isTuLuan100) {
    const totalQuestions = config.soCauTuLuan;
    configRules = `
    - **CHẾ ĐỘ ĐẶC BIỆT: 100% TỰ LUẬN (BẮT BUỘC TUYỆT ĐỐI):**
        - **Toàn bộ đề thi chỉ có câu hỏi Tự luận.**
        - **Tổng số câu hỏi:** Chính xác ${config.soCauTuLuan} câu Tự luận.
        - **Tổng điểm toàn bài thi PHẢI LÀ 10.0.**
        - **QUY TẮC PHÂN BỔ ĐIỂM (CỰC KỲ QUAN TRỌNG):** Bạn phải tự động phân bổ 10.0 điểm cho ${config.soCauTuLuan} câu hỏi. Điểm của mỗi câu có thể khác nhau, tùy thuộc vào độ phức tạp và lượng kiến thức. Điểm của mỗi câu Tự luận PHẢI được chọn từ danh sách sau: {1, 1.5, 2, 2.5, 3, 3.5}. Tổng điểm của tất cả các câu phải bằng 10.0.
        - **Số lượng câu trắc nghiệm (Nhiều lựa chọn, Đúng-Sai, Trả lời ngắn):** Bắt buộc là 0.
    - **PHÂN BỔ TỶ LỆ ĐIỂM THEO MỨC ĐỘ (HƯỚNG DẪN THAM KHẢO):**
        - Cố gắng phân bổ điểm số của các câu hỏi sao cho gần đúng nhất với các tỷ lệ sau:
            - Tỷ lệ điểm theo mức độ: Nhận biết ${config.biet}%, Thông hiểu ${config.hieu}%, Vận dụng ${config.vanDung}%
    `;
  } else {
    const totalQuestions = config.soCauNhieuLuaChon + config.soCauDungSai + config.soCauTraLoiNgan + config.soCauTuLuan;
    const diemCauDungSai = config.soYTrongCauDungSai * config.diemMoiYTrongCauDungSai;
    const tongDiemTracNghiem = (config.soCauNhieuLuaChon * config.diemCauNhieuLuaChon) + (config.soCauDungSai * diemCauDungSai) + (config.soCauTraLoiNgan * config.diemCauTraLoiNgan);
    const tongDiemTuLuan = config.soCauTuLuan * config.diemCauTuLuan;

    configRules = `
    - **QUY TẮC ĐIỂM SỐ (BẮT BUỘC TUYỆT ĐỐI):**
        - **Điểm mỗi câu Nhiều lựa chọn:** Chính xác ${config.diemCauNhieuLuaChon} điểm.
        - **Điểm mỗi câu Đúng-Sai (lớn):** Chính xác ${diemCauDungSai.toFixed(2)} điểm (vì có ${config.soYTrongCauDungSai} ý, mỗi ý ${config.diemMoiYTrongCauDungSai} điểm).
        - **Điểm mỗi câu Trả lời ngắn:** Chính xác ${config.diemCauTraLoiNgan} điểm.
        - **Điểm mỗi câu Tự luận:** Chính xác ${config.diemCauTuLuan} điểm.
        - **Tổng điểm toàn bài thi PHẢI LÀ 10.0.** Bạn phải phân bổ số câu vào các nội dung kiến thức sao cho tổng điểm đạt được là 10.0 dựa trên các quy tắc điểm trên.
    - **QUY TẮC SỐ LƯỢNG CÂU HỎI (BẮT BUỘC TUYỆT ĐỐI):** Đề thi phải có chính xác:
        - **${config.soCauNhieuLuaChon} câu trắc nghiệm Nhiều lựa chọn.**
        - **${config.soCauDungSai} câu trắc nghiệm Đúng-Sai.**
        - **${config.soCauTraLoiNgan} câu trắc nghiệm Trả lời ngắn.**
        - **${config.soCauTuLuan} câu Tự luận.**
    - **CẤU TRÚC CÂU ĐÚNG-SAI:** Mỗi câu hỏi Đúng-Sai lớn phải bao gồm chính xác **${config.soYTrongCauDungSai} câu phát biểu nhỏ**.
    - **PHÂN BỔ TỶ LỆ ĐIỂM (HƯỚNG DẪN THAM KHẢO):**
        - Cố gắng phân bổ điểm số của các câu hỏi sao cho gần đúng nhất với các tỷ lệ sau:
            - Tỷ lệ điểm Trắc nghiệm / Tự luận: ${config.tracNghiem}% / ${config.tuLuan}% (Tương đương ${tongDiemTracNghiem.toFixed(2)}đ / ${tongDiemTuLuan.toFixed(2)}đ)
            - Tỷ lệ điểm theo mức độ: Nhận biết ${config.biet}%, Thông hiểu ${config.hieu}%, Vận dụng ${config.vanDung}%
    `;
  }
  
  // Thêm phần xử lý Additional Prompt nếu có
  if (config.additionalPrompt) {
      configRules += `
      - **YÊU CẦU ĐẶC BIỆT TỪ NGƯỜI DÙNG (BẮT BUỘC ƯU TIÊN CAO NHẤT):**
          ${config.additionalPrompt}
          **HƯỚNG DẪN XỬ LÝ YÊU CẦU ĐẶC BIỆT:**
          - Nếu người dùng yêu cầu phân chia điểm cho các phân môn (Ví dụ: "Phân môn Sinh 5đ, Lý 2.5đ, Hóa 2.5đ" hoặc tương tự):
            1. Bạn PHẢI xác định chính xác các bài học thuộc từng phân môn (Sinh, Lý, Hóa,...) dựa trên tên bài hoặc cấu trúc trong file Phân phối chương trình.
            2. Bạn PHẢI phân bổ số lượng câu hỏi và điểm số cho các bài học đó sao cho TỔNG ĐIỂM của tất cả các bài thuộc một phân môn bằng đúng số điểm người dùng yêu cầu.
            3. Việc khớp đúng tổng điểm phân môn quan trọng hơn việc khớp chính xác tỷ lệ % mức độ nhận biết/thông hiểu chung.
      `;
  }
  
  const totalQuestionsString = config.isTuLuan100 ? 
    `(${config.soCauTuLuan} - 10.0)` : 
    `(${config.soCauNhieuLuaChon + config.soCauDungSai + config.soCauTraLoiNgan + config.soCauTuLuan} - 10.0)`;


  const prompt = `
    Bạn là một chuyên gia phân tích và cấu trúc thông tin giáo dục.

    --- NGUỒN DỮ LIỆU ---
    Bạn được cung cấp 2 nguồn dữ liệu:
    1.  **FILE PHÂN PHỐI CHƯƠNG TRÌNH (DANH SÁCH BÀI HỌC BẮT BUỘC - MASTER LIST):** ${curriculumText}
    2.  **FILE SÁCH GIÁO KHOA (NGUỒN THAM KHẢO NỘI DUNG CHI TIẾT):** ${sgkText}

    --- QUY TẮC KẾT HỢP (RẤT QUAN TRỌNG) ---
    -   **NGUYÊN TẮC SỐ 1: "FILE PHÂN PHỐI CHƯƠNG TRÌNH" LÀ DANH SÁCH GỐC.** Bạn phải liệt kê và sử dụng TẤT CẢ các bài học có trong file này.
    -   **BƯỚC 1:** Trích xuất toàn bộ danh sách bài học từ "FILE PHÂN PHỐI CHƯƠNG TRÌNH".
    -   **BƯỚC 2:** Tạo khung ma trận bao gồm ĐẦY ĐỦ danh sách bài học vừa trích xuất. KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI NÀO.
    -   **BƯỚC 3:** Tra cứu nội dung từng bài trong "FILE SÁCH GIÁO KHOA" để điền nội dung và yêu cầu cần đạt.

    **CẢNH BÁO:** TUYỆT ĐỐI KHÔNG được tự "bịa" ra tên chủ đề/bài học. Mọi cấu trúc phải bám sát 100% vào file Phân phối chương trình.

    --- YÊU CẦU CÔNG VIỆC (TUYỆT ĐỐI KHÔNG BỎ SÓT) ---
    Dựa vào TOÀN BỘ nội dung của 2 file đã cho, hãy tạo ra một MA TRẬN ĐỀ KIỂM TRA và một BẢN ĐẶC TẢ chi tiết. 
    **YÊU CẦU BẮT BUỘC:**
    1.  Bạn PHẢI rà soát kỹ lưỡng và phân bổ câu hỏi cho **TẤT CẢ (100%) CÁC BÀI HỌC** có trong "FILE PHÂN PHỐI CHƯƠNG TRÌNH".
    2.  **CHIẾN LƯỢC PHÂN BỔ:** Nếu số lượng câu hỏi có hạn, bạn hãy chia nhỏ hoặc giảm bớt câu hỏi ở các bài trọng tâm để san sẻ cho các bài khác. **MỤC TIÊU LÀ: MỖI BÀI HỌC PHẢI CÓ ÍT NHẤT MỘT HÌNH THỨC ĐÁNH GIÁ (có thể là 1 câu TN, hoặc 1 ý Đ/S, hoặc 1 câu TL).** Đừng để bài nào bị trắng (0 câu hỏi) trừ khi file phân phối ghi rõ là "Không dạy" hoặc "Tự học".
    3.  **TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI HỌC NÀO**.
    4.  Bạn PHẢI phân bổ câu hỏi vào cả 4 hình thức: Nhiều lựa chọn, Đúng - Sai, Trả lời ngắn và Tự luận, dựa trên yêu cầu và nội dung.
    
    --- QUY TẮC VỀ KÝ HIỆU TOÁN HỌC (CỰC KỲ QUAN TRỌNG) ---
    5. **TUYỆT ĐỐI KHÔNG** sử dụng ký hiệu $ cho văn bản thông thường. 
    6. **CHỈ SỬ DỤNG** cú pháp LaTeX ($...$ cho nội dòng, $$...$$ cho khối) cho các công thức toán học, vật lý, hóa học thực sự. Nếu nội dung là chữ viết bình thường, hãy để ở dạng văn bản thuần túy.

    --- YÊU CẦU CẤU HÌNH (QUAN TRỌNG NHẤT) ---
    ${configRules}

    --- QUY TẮC CẤU TRÚC MA TRẬN (TUYỆT ĐỐI BẮT BUỘC) ---
    Bạn PHẢI tạo ra một bảng HTML hoàn chỉnh cho ma trận. Cấu trúc của bảng PHẢI tuân thủ nghiêm ngặt theo mẫu dưới đây.
    -   **Header (thead) và Footer (tfoot):** Phải giống hệt mẫu. Sử dụng 'rowspan' và 'colspan' chính xác như ví dụ.
    -   **Body (tbody):**
        -   Mỗi **Chủ đề** xác định từ "File Phân phối chương trình" PHẢI bắt đầu bằng một hàng tiêu đề riêng, trong đó cột TT chứa số thứ tự La Mã, và một ô duy nhất sẽ gộp 17 cột còn lại để hiển thị tên chủ đề (ví dụ: <tr style="font-weight: bold; background-color: #f2f2f2;"><td>I</td><td colspan="17" style="text-align: left;">Tên Chủ đề 1...</td></tr>).
        -   Mỗi **Nội dung/đơn vị kiến thức** (tức là MỖI BÀI HỌC) PHẢI nằm trên một hàng '<tr>' riêng biệt và KHÔNG có cột "Chủ đề".
        -   Trong các ô có câu hỏi, bạn PHẢI điền cả **số lượng câu hỏi và tổng điểm tương ứng** theo định dạng '(Số câu - Tổng điểm)'. Ví dụ: '(1 - 0.25)', '(2 - 1.0)'. Điểm phải có một hoặc hai chữ số thập phân nếu cần. Nếu không có câu hỏi, để trống ô.

    --- MẪU HTML MA TRẬN BẮT BUỘC ---
    \`\`\`html
    <table border="1" style="width:100%; border-collapse: collapse; font-family: 'Times New Roman', serif; font-size: 11pt; text-align: center;">
        <caption style="font-weight: bold; font-size: 1.2em; padding: 10px;">MA TRẬN ĐỀ KIỂM TRA${finalExamTitle}</caption>
        <thead>
            <tr>
                <th rowspan="2" style="width: 3%;">TT</th>
                <th rowspan="2" style="width: 25%;">Nội dung/đơn vị kiến thức</th>
                <th colspan="12">Mức độ đánh giá</th>
                <th colspan="3">Tổng</th>
                <th rowspan="2" style="width: 5%;">Tỉ lệ % điểm</th>
            </tr>
            <tr>
                <!-- Mức độ đánh giá -->
                <th colspan="3">Nhiều lựa chọn</th>
                <th colspan="3">"Đúng - Sai"</th>
                <th colspan="3">Trả lời ngắn</th>
                <th colspan="3">Tự luận</th>
                <!-- Tổng -->
                <th>Biết</th>
                <th>Hiểu</th>
                <th>Vận dụng</th>
            </tr>
        </thead>
        <tbody>
            <!-- Dòng tiêu đề cho các mức độ nhận thức con. Bạn PHẢI tạo dòng này để làm rõ các cột. -->
            <tr style="font-weight:bold;">
                <td></td><td></td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 3.8%;">Biết</td><td style="width: 3.8%;">Hiểu</td><td style="width: 3.8%;">Vận dụng</td>
                <td style="width: 4.8%;"></td><td style="width: 4.8%;"></td><td style="width: 4.8%;"></td>
                <td></td>
            </tr>
            <!-- VÍ DỤ VỀ CẤU TRÚC BODY: -->
            <!-- Bắt đầu một chủ đề mới -->
            <tr style="font-weight: bold; background-color: #f2f2f2;">
                <td>I</td>
                <td colspan="17" style="text-align: left;">Tên Chủ đề 1...</td>
            </tr>
            <!-- Các bài học trong chủ đề -->
            <tr>
                <td>1</td>
                <td style="text-align: left;">Tên bài học 1.1...</td>
                <!-- Dữ liệu (Số câu - Tổng điểm) cho từng ô -->
                <td>(1 - 0.25)</td><td></td><td></td> <!-- NL -->
                <td></td><td>(1 - 1.0)</td><td></td> <!-- ĐS -->
                <td>(1 - 0.25)</td><td></td><td></td> <!-- Trả lời ngắn -->
                <td></td><td></td><td>(1 - 2.0)</td> <!-- TL -->
                <!-- Tổng theo mức độ cho hàng này -->
                <td>(2 - 0.5)</td><td>(1 - 1.0)</td><td>(1 - 2.0)</td>
                <td>35</td> <!-- Tỉ lệ % -->
            </tr>
        </tbody>
        <tfoot>
            <tr style="font-weight: bold;">
                <td colspan="2">Tổng (Số câu - Điểm)</td>
                <td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td>
                <td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td>
                <td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td>
                <td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td><td>(Tổng - Điểm)</td>
                <td>(Tổng Biết - Điểm)</td>
                <td>(Tổng Hiểu - Điểm)</td>
                <td>(Tổng Vận dụng - Điểm)</td>
                <td>${totalQuestionsString}</td>
            </tr>
            <tr style="font-weight: bold;">
                <td colspan="2">Tỉ lệ %</td>
                <td colspan="9">${config.tracNghiem}% (TNKQ)</td>
                <td colspan="3">${config.tuLuan}% (Tự luận)</td>
                <td>${config.biet}%</td>
                <td>${config.hieu}%</td>
                <td>${config.vanDung}%</td>
                <td>100%</td>
            </tr>
        </tfoot>
    </table>
    \`\`\`

    --- ĐỊNH DẠNG ĐẦU RA ---
    Bạn PHẢI trả lời dưới dạng một đối tượng JSON duy nhất, không có văn bản giải thích nào khác. Cấu trúc JSON phải như sau:
    {
      "matrix": "Nội dung ma trận ở đây, định dạng HTML. Cấu trúc HTML của bảng ma trận phải tuân thủ nghiêm ngặt MẪU HTML MA TRẬN BẮT BUỘC đã nêu ở trên.",
      "spec": [
        {
          "chuDe": "Tên chủ đề 1 (Lấy 100% từ Phân phối chương trình)",
          "rows": [
            {
              "tt": "1.1",
              "noiDung": "Tên bài học (Lấy 100% từ Phân phối chương trình)",
              "yeuCauCanDat": "AI tự tạo dựa trên nội dung SGK.",
              "soCau": {
                "nhanBiet": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0},
                "thongHieu": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0},
                "vanDung": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0},
                "vanDungCao": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0}
              }
            }
          ]
        }
      ]
    }
  `;

  // --- SỬ DỤNG callWithRetry ---
  const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json" }
  }));
  
  const text = response.text || "";
  const jsonString = extractJson(text);

  if (!jsonString) {
    console.error("Failed to extract JSON from response:", text);
    throw new Error("AI không trả về dữ liệu JSON hợp lệ. Vui lòng thử lại.");
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.matrix || !Array.isArray(parsed.spec)) {
      throw new Error("Dữ liệu JSON từ AI thiếu các trường bắt buộc 'matrix' hoặc 'spec'.");
    }
    return {
      matrix: parsed.matrix,
      spec: parsed.spec,
    };
  } catch (e) {
    console.error("Failed to parse JSON response:", jsonString);
    throw new Error("Lỗi khi phân tích dữ liệu JSON từ AI.");
  }
};

export const generateReviewQuestions = async (
    sgkFileContent: string, 
    matrix: string,
    spec: SpecData,
    config: MatrixConfig
): Promise<string> => {
    const ai = getAiClient();
    const model = AI_MODEL;
    const sgkText = fileToText(sgkFileContent, "Sách giáo khoa");
    const matrixText = `--- BẮT ĐẦU MA TRẬN ---\n${matrix}\n--- KẾT THÚC MA TRẬN ---`;
    const specText = `--- BẮT ĐẦU BẢN ĐẶC TẢ ---\n${JSON.stringify(spec, null, 2)}\n--- KẾT THÚC BẢN ĐẶC TẢ ---`;

    const soCauNho = config.soYTrongCauDungSai || 4;
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let exampleStatements = '';
    let exampleAnswers = '';

    for (let i = 0; i < soCauNho && i < alphabet.length; i++) {
        exampleStatements += `<p>${alphabet[i]}. Phát biểu ${i + 1}.</p>`;
        const randomAnswer = Math.random() > 0.5 ? 'Đúng' : 'Sai';
        exampleAnswers += `<p>${alphabet[i]} - ${randomAnswer}</p>`;
    }

    const prompt = `
        Bạn là một AI chuyên tạo câu hỏi ôn tập cho giáo viên.
        
        --- NGUỒN DỮ LIỆU ---
        1.  **SÁCH GIÁO KHOA:** ${sgkText}
        2.  **MA TRẬN ĐỀ KIỂM TRA:** ${matrixText}
        3.  **BẢN ĐẶC TẢ CHI TIẾT (NGUỒN QUAN TRỌNG NHẤT):** ${specText}

        --- YÊU CẦU ---
        Dựa vào TOÀN BỘ các nguồn dữ liệu, hãy tạo ra một bộ **CÂU HỎI ÔN TẬP** đầy đủ và chi tiết. **ƯU TIÊN TUYỆT ĐỐI** thông tin từ **BẢN ĐẶC TẢ** để xác định số lượng, hình thức, và mức độ nhận thức cho từng nội dung.
        
        --- QUY TẮC CHUNG TẠO CÂU HỎI (RẤT QUAN TRỌNG) ---
        1.  **Bám sát Đặc tả và Ma trận:** Tạo câu hỏi cho TẤT CẢ các nội dung/chủ đề được liệt kê trong bản đặc tả và ma trận. "Yêu cầu cần đạt" trong bản đặc tả là kim chỉ nam cho nội dung câu hỏi.
        2.  **Số lượng (CỰC KỲ QUAN TRỌNG):** Tạo ra số lượng câu hỏi CHÍNH XÁC GẤP 2.5 LẦN so với yêu cầu trong cột "soCau" của bản đặc tả cho mỗi loại. Ví dụ: nếu bản đặc tả yêu cầu 4 câu trắc nghiệm mức độ Nhận biết, bạn phải tạo ra chính xác 4 * 2.5 = 10 câu. Nếu kết quả phép nhân không phải là số nguyên (ví dụ: 1 * 2.5 = 2.5), hãy làm tròn lên thành số nguyên tiếp theo (tức là 3 câu). Đây là yêu cầu bắt buộc và phải được tuân thủ nghiêm ngặt.
        3.  **Hình thức câu hỏi (CỰC KỲ QUAN TRỌNG):** Chỉ tạo các loại câu hỏi (Trắc nghiệm nhiều lựa chọn - TN, Đúng-Sai - DS, Trả lời ngắn - TNgan, Tự luận - TL) được chỉ định trong bản đặc tả. Nếu tổng số câu của một hình thức nào đó trong toàn bộ bản đặc tả là 0, thì TUYỆT ĐỐI KHÔNG được tạo ra bất kỳ câu hỏi nào thuộc hình thức đó.
        4.  **Bao phủ mức độ:** Câu hỏi phải bao quát đủ các mức độ (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao) như đã được phân bổ trong bản đặc tả.
        5.  **Nội dung từ SGK:** Tất cả nội dung câu hỏi và đáp án phải được lấy từ file SÁCH GIÁO KHOA đã cung cấp.
        6.  **Đáp án chi tiết:** Cung cấp đáp án CHI TIẾT và RÕ RÀNG cho TẤT CẢ các câu hỏi. Đối với câu tự luận, hãy cung cấp hướng dẫn chấm điểm cơ bản.
        
        --- QUY TẮC VỀ KÝ HIỆU TOÁN HỌC (CỰC KỲ QUAN TRỌNG) ---
        7. **TUYỆT ĐỐI KHÔNG** sử dụng ký hiệu $ cho văn bản thông thường. 
        8. **CHỈ SỬ DỤNG** cú pháp LaTeX ($...$ cho nội dòng, $$...$$ cho khối) cho các công thức toán học, vật lý, hóa học thực sự. Nếu nội dung là chữ viết bình thường, hãy để ở dạng văn bản thuần túy.
        
        --- QUY TẮC RIÊNG CHO CÂU TRẮC NGHIỆM TIẾT KIỆM GIẤY (ĐỊNH DẠNG XUẤT WORD) ---
        9. **Định dạng lựa chọn (A, B, C, D) - QUAN TRỌNG:** 
           - **TUYỆT ĐỐI KHÔNG** sử dụng CSS Flexbox (display: flex) vì Word không hỗ trợ.
           - Để trình bày các lựa chọn trên cùng một hàng hoặc chia cột, hãy sử dụng **HTML TABLE không viền (border="0")**.
           - Ví dụ cấu trúc HTML bắt buộc cho 4 đáp án trên 1 dòng:
             \`<table style="width:100%; border:none;"><tr><td style="border:none;">A. ...</td><td style="border:none;">B. ...</td><td style="border:none;">C. ...</td><td style="border:none;">D. ...</td></tr></table>\`
           - Ví dụ cấu trúc HTML cho 2 dòng (2 cột):
             \`<table style="width:100%; border:none;"><tr><td style="border:none;">A. ...</td><td style="border:none;">B. ...</td></tr><tr><td style="border:none;">C. ...</td><td style="border:none;">D. ...</td></tr></table>\`
           - Nếu đáp án rất dài, mỗi đáp án một dòng (không dùng table hoặc table 1 cột).

        10. **XÁO TRỘN ĐÁP ÁN ĐÚNG NGẪU NHIÊN (CỰC KỲ QUAN TRỌNG - KHÔNG ĐƯỢC LƯỜI):** 
           - Đối với các câu hỏi trắc nghiệm nhiều lựa chọn (TN), bạn PHẢI **xáo trộn vị trí đáp án đúng một cách ngẫu nhiên tuyệt đối** giữa các phương án A, B, C, D.
           - **TUYỆT ĐỐI CẤM:** Không được để đáp án đúng tập trung vào một chữ cái cụ thể (như B hoặc A) cho nhiều câu hỏi liên tiếp, đặc biệt là ở các bài học phía sau trong danh sách.
           - **YÊU CẦU PHÂN BỔ ĐỀU:** Bạn phải phân bổ đáp án đúng sao cho tỷ lệ các phương án A, B, C, D được chọn làm đáp án đúng là xấp xỉ ngang nhau (khoảng 25% cho mỗi chữ cái) xuyên suốt từ đầu đến cuối bộ câu hỏi. 
           - **KIỂM TRA LẠI:** Sau khi tạo xong mỗi câu hỏi, hãy kiểm tra xem chữ cái đáp án đúng có đang bị lặp lại quá 3 lần liên tiếp không. Nếu có, hãy thay đổi vị trí đáp án đúng ngay lập tức.
           - **LƯU Ý:** Đừng để tình trạng các bài học đầu tiên thì xáo trộn tốt, nhưng các bài học phía sau thì đáp án đúng toàn là B hoặc toàn là A. Mọi câu hỏi phải được đối xử công bằng và ngẫu nhiên.

        --- QUY TẮC RIÊNG CHO CÂU HỎI ĐÚNG/SAI (CỰC KỲ QUAN TRỌNG) ---
        11.  Mỗi câu hỏi dạng Đúng/Sai PHẢI bao gồm một câu dẫn chung và chính xác **${soCauNho}** câu phát biểu nhỏ (đánh dấu a, b, c, d, ...). Người học sẽ đánh giá từng phát biểu là Đúng hay Sai.
        12. **CÂN BẰNG ĐÁP ÁN:** Trong một câu hỏi Đúng/Sai, các câu phát biểu nhỏ PHẢI có cả đáp án "Đúng" và "Sai". TUYỆT ĐỐI không được tạo ra một câu hỏi mà tất cả các phát biểu nhỏ đều là "Đúng" hoặc tất cả đều là "Sai".
        13. **Ví dụ về định dạng HTML bắt buộc cho câu Đúng/Sai (với ${soCauNho} câu nhỏ):**
            \`\`\`html
            <p><strong>Câu 2 (NB):</strong> Dựa vào kiến thức đã học, hãy cho biết các phát biểu sau đây đúng hay sai:</p>
            ${exampleStatements}
            <div class="answer">
                <strong>Đáp án:</strong>
                ${exampleAnswers}
            </div>
            \`\`\`
        
        --- QUY TẮC RIÊNG CHO CÂU HỎI TRẢ LỜI NGẮN ---
        14. Mỗi câu hỏi Trả lời ngắn yêu cầu người học điền một từ, cụm từ, hoặc số vào chỗ trống.
        15. **Ví dụ về định dạng HTML bắt buộc cho câu Trả lời ngắn:**
            \`\`\`html
            <p><strong>Câu 3 (TH):</strong> Điền vào chỗ trống: Trái Đất quay quanh ____.</p>
            <div class="answer">
                <strong>Đáp án:</strong> Mặt Trời.
            </div>
            \`\`\`

        --- ĐỊNH DẠNG ĐẦU RA (HTML - BẮT BUỘC) ---
        -   Sử dụng thẻ '<h3>' cho tên mỗi CHỦ ĐỀ/NỘI DUNG.
        -   Sử dụng thẻ '<h4>' cho các mục nhỏ hơn như "I. TRẮC NGHIỆM", "II. TỰ LUẬN", "Mức độ Nhận biết", v.v.
        -   Mỗi câu hỏi phải được đặt trong một thẻ '<p>'. Ví dụ: '<p><strong>Câu 1 (NB):</strong> Nội dung câu hỏi...</p>'.
        -   Các lựa chọn trắc nghiệm PHẢI sử dụng thẻ TABLE như hướng dẫn ở mục 8.
        -   **QUAN TRỌNG:** Đáp án phải được đặt ngay sau câu hỏi và nằm trong một thẻ '<div>' với class là '"answer"'. Ví dụ: '<div class="answer"><strong>Đáp án:</strong> A. Lựa chọn A.</div>'.

        --- CẤM TUYỆT ĐỐI ---
        - TUYỆT ĐỐI KHÔNG ghi các lời chào, giới thiệu, dẫn dắt, giải thích hoặc kết luận ở đầu và cuối phản hồi (ví dụ: "Dưới đây là...", "Bộ câu hỏi này...", "Hy vọng nó hữu ích..."). 
        - Phản hồi CHỈ được phép chứa duy nhất nội dung HTML của các câu hỏi và đáp án theo đúng định dạng đã yêu cầu.
    `;

    // --- SỬ DỤNG callWithRetry ---
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({ model, contents: prompt }));
    return response.text || "";
};

export const generateExams = async (
    reviewFileContent: string, 
    matrix: string, 
    sgkFileContent: string,
    similarityPercentage: number,
    examTemplateContent?: string
): Promise<string[]> => {
    const ai = getAiClient();
    const model = AI_MODEL;
    const reviewText = fileToText(reviewFileContent, "Ngân hàng câu hỏi ôn tập");
    const matrixText = `--- BẮT ĐẦU MA TRẬN ---\n${matrix}\n--- KẾT THÚC MA TRẬN ---`;
    const sgkText = fileToText(sgkFileContent, "Sách giáo khoa (Nguồn bổ sung khi cần tạo câu hỏi mới):");

    const similarityInstruction = `
        --- QUY TẮC VỀ NGUỒN CÂU HỎI (CỰC KỲ QUAN TRỌNG) ---
        -   Bạn phải tạo đề thi sao cho ${similarityPercentage}% số câu hỏi được lấy trực tiếp từ "NGÂN HÀNG CÂU HỎI".
        -   ${100 - similarityPercentage}% số câu hỏi còn lại PHẢI được bạn tự tạo mới. Các câu hỏi mới này phải dựa trên nội dung từ "SÁCH GIÁO KHOA (Nguồn bổ sung)" và phải tuân thủ nghiêm ngặt MA TRẬN về nội dung, mức độ và hình thức.
        -   Nếu ${similarityPercentage} là 100, TOÀN BỘ câu hỏi phải được lấy từ "NGÂN HÀNG CÂU HỎI".
        -   Nếu ${similarityPercentage} là 0, TOÀN BỘ câu hỏi phải được tạo mới dựa trên "SÁCH GIÁO KHOA (Nguồn bổ sung)".
    `;


    let formatInstruction = '';
    if (examTemplateContent) {
        formatInstruction = `
            --- QUY TẮC ĐỊNH DẠNG (CỰC KỲ QUAN TRỌNG) ---
            1.  **SỬ DỤNG MẪU HTML:** Bạn PHẢI sử dụng đoạn mã HTML trong "FILE MẪU (HTML)" dưới đây làm khuôn mẫu TUYỆT ĐỐI cho cả 2 đề thi.
            2.  **BẢO TOÀN CẤU TRÚC:** Đầu ra của bạn phải là một chuỗi HTML hoàn chỉnh. TUYỆT ĐỐI không được thay đổi cấu trúc, các thẻ HTML (<table>, <div>, <p>, <span>), các class, hoặc style inline của file mẫu. Hãy giữ nguyên định dạng y hệt.
            3.  **THAY THẾ NỘI DUNG:** Nhiệm vụ chính của bạn là tìm các vị trí giữ chỗ (placeholders) trong file mẫu (ví dụ: "Câu 1:", "PHẦN I. TRẮC NGHIỆM", "[NỘI DUNG CÂU HỎI]", v.v.) và thay thế chúng bằng các câu hỏi và đáp án tương ứng bạn đã chọn từ NGÂN HÀNG CÂU HỎI. Bạn phải điền đầy đủ các câu hỏi vào đúng các phần Trắc nghiệm và Tự luận như ma trận yêu cầu.
            4.  **KẾT QUẢ:** Kết quả cuối cùng phải là 2 chuỗi HTML hoàn chỉnh, sẵn sàng để hiển thị trên trình duyệt.

            --- FILE MẪU (HTML) ---
            ${examTemplateContent}
        `;
    } else {
        formatInstruction = `
            --- QUY TẮC ĐỊNH DẠNG ---
            Định dạng đầu ra phải là HTML.
            -   Mỗi đề thi phải có tiêu đề rõ ràng (ví dụ: "ĐỀ SỐ 1").
            -   Chia rõ 2 phần: "PHẦN I: TRẮC NGHIỆM" và "PHẦN II: TỰ LUẬN".
            -   Liệt kê các câu hỏi một cách tuần tự.
            -   Sau phần đề thi, phải có phần "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM" chi tiết.
        `;
    }

    const prompt = `
        Bạn là một AI chuyên tạo đề kiểm tra từ ngân hàng câu hỏi có sẵn và có thể tự tạo câu hỏi mới.

        --- NGUỒN DỮ LIỆU ---
        1.  **NGÂN HÀNG CÂU HỎI (NGUỒN CHÍNH):** ${reviewText}
        2.  **MA TRẬN ĐỀ KIỂM TRA (BẮT BUỘC TUÂN THỦ):** ${matrixText}
        3.  **SÁCH GIÁO KHOA (Nguồn bổ sung khi cần tạo câu hỏi mới):** ${sgkText}
        
        --- YÊU CẦU ---
        Dựa vào các nguồn dữ liệu trên, hãy tạo ra **2 ĐỀ KIỂM TRA HOÀN CHỈNH**.
        
        ${similarityInstruction}

        --- QUY TẠO ĐỀ (TUYỆT ĐỐI TUÂN THỦ) ---
        1.  **TUÂN THỦ MA TRẬN:** Mỗi đề thi phải tuân thủ CHÍNH XÁC 100% về số lượng câu hỏi, điểm số, mức độ nhận thức (NB, TH, VD, VDC), và nội dung kiến thức cho từng phần trắc nghiệm và tự luận như ma trận đã quy định.
        2.  **CHỌN & TẠO CÂU HỎI:** Tuân thủ quy tắc về nguồn câu hỏi đã nêu ở trên. Không được tự ý thay đổi nội dung câu hỏi lấy từ ngân hàng.
        3.  **TẠO 2 ĐỀ KHÁC NHAU:** Hai đề phải có các câu hỏi khác nhau nhưng vẫn đảm bảo cùng ma trận và có độ khó tương đương.
        
        --- QUY TẮC VỀ KÝ HIỆU TOÁN HỌC (CỰC KỲ QUAN TRỌNG) ---
        4. **TUYỆT ĐỐI KHÔNG** sử dụng ký hiệu $ cho văn bản thông thường. 
        5. **CHỈ SỬ DỤNG** cú pháp LaTeX ($...$ cho nội dòng, $$...$$ cho khối) cho các công thức toán học, vật lý, hóa học thực sự. Nếu nội dung là chữ viết bình thường, hãy để ở dạng văn bản thuần túy.

        6.  **THANG ĐIỂM:** Phân bổ điểm số cho từng câu hỏi một cách hợp lý và chính xác để tổng điểm của toàn bộ bài thi là 10.0.
        7.  **TÁCH TRANG ĐÁP ÁN (CỰC KỲ QUAN TRỌNG):** Phần đáp án và hướng dẫn chấm PHẢI LUÔN nằm trên một trang riêng biệt so với phần câu hỏi. Để thực hiện điều này, hãy chèn thẻ \`<div style="page-break-before: always;"></div>\` ngay trước tiêu đề của phần đáp án (ví dụ: trước "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM"). Quy tắc này áp dụng ngay cả khi sử dụng file mẫu.
        8.  **TIÊU ĐỀ NĂM HỌC (BẮT BUỘC):** Trong tiêu đề của mỗi đề thi, bạn PHẢI luôn bao gồm dòng chữ "NĂM HỌC 2025-2026".
        
        9.  **ĐỊNH DẠNG XUẤT WORD CHUẨN (BẮT BUỘC TUÂN THỦ):**
           - **Mục tiêu:** Giữ cho đề thi (phần câu hỏi) KHÔNG VƯỢT QUÁ 4 TRANG nhưng vẫn đảm bảo thẩm mỹ khi xuất ra Word.
           - **TRẮC NGHIỆM:** Với các câu hỏi có 4 lựa chọn (A, B, C, D):
             + **TUYỆT ĐỐI KHÔNG dùng CSS Flexbox** (display: flex) vì Word không hiểu.
             + **BẮT BUỘC dùng HTML TABLE** không viền (border="0") để chia cột các đáp án.
             + Nếu các đáp án ngắn: Dùng table 1 dòng 4 cột.
             + Nếu đáp án trung bình: Dùng table 2 dòng 2 cột.
             + Cấu trúc ví dụ: \`<table style="width:100%; border:none;"><tr><td style="border:none;">A...</td><td style="border:none;">B...</td>...</tr></table>\`
             + Việc dùng Table sẽ đảm bảo khi xuất ra Word, các đáp án vẫn nằm đúng vị trí (không bị dồn dòng hay nhảy lung tung như dùng CSS).
           - **KHOẢNG CÁCH:** Giảm tối đa khoảng cách (margin/padding) giữa các câu hỏi.
        
        10. **ĐỊNH DẠNG BẢNG ĐÁP ÁN TRẮC NGHIỆM (QUAN TRỌNG):**
           - Tại phần "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM", đối với Phần I (Trắc nghiệm nhiều lựa chọn):
           - **BẮT BUỘC KẺ BẢNG NGANG (Horizontal Table) gồm 2 dòng.**
           - **Dòng 1:** Ghi số thứ tự câu (Câu 1, Câu 2, ...).
           - **Dòng 2:** Ghi đáp án tương ứng (A, B, ...).
           - Nếu số lượng câu nhiều (ví dụ > 10 câu), hãy chia thành nhiều bảng nhỏ nối tiếp nhau (mỗi bảng khoảng 10-15 cột).
           - KHÔNG được liệt kê đáp án theo chiều dọc.

        11. **CẤU TRÚC & THỨ TỰ PHẦN THI (BẮT BUỘC):**
           - Đề thi PHẢI chia thành các phần rõ ràng, KHÔNG trộn lẫn, theo đúng thứ tự sau:
           - **PHẦN I: Câu trắc nghiệm nhiều phương án lựa chọn.** (Chứa các câu hỏi chọn A, B, C, D).
           - **PHẦN II: Câu trắc nghiệm đúng sai.** (Chứa các câu hỏi có 4 ý a, b, c, d để xác định Đ/S).
           - **PHẦN III: Câu trắc nghiệm trả lời ngắn.** (Chứa các câu hỏi điền đáp án/số).
           - **PHẦN IV: Tự luận.** (Chứa các câu hỏi tự luận).
           - Nếu phần nào KHÔNG có câu hỏi trong ma trận (số lượng = 0), hãy bỏ qua tiêu đề phần đó, but các phần còn lại vẫn phải giữ đúng thứ tự trên. TUYỆT ĐỐI KHÔNG đảo lộn thứ tự này.

        12. **ĐỊNH DẠNG TIÊU ĐỀ CÂU HỎI (TUYỆT ĐỐI BẮT BUỘC):**
           - **CHỈ GHI:** "Câu 1:", "Câu 2:", "Câu 3:", ...
           - **TUYỆT ĐỐI KHÔNG GHI:** Mức độ nhận thức (NB, TH, VD, VDC) vào tiêu đề câu hỏi.
           - **TUYỆT ĐỐI KHÔNG GHI:** Điểm số (0.25đ, 1.0đ) vào tiêu đề câu hỏi.
           - Ví dụ **SAI**: "Câu 1 (NB):", "Câu 1 (0.25đ):", "Câu 1 (NB - 0.25đ):".
           - Ví dụ **ĐÚNG**: "**Câu 1:**".

        13. **XÁO TRỘN ĐÁP ÁN ĐÚNG CHO CÂU HỎI MỚI (QUAN TRỌNG):**
           - Với ${100 - similarityPercentage}% câu hỏi tự tạo mới, bạn PHẢI xáo trộn vị trí đáp án đúng (A, B, C, D) một cách ngẫu nhiên và phân bổ đều, không để một đáp án nào chiếm tỷ lệ quá cao.

        ${formatInstruction}

        --- ĐỊNH DẠNG ĐẦU RA (JSON) ---
        Bạn PHẢI trả lời dưới dạng một đối tượng JSON duy nhất, không có văn bản giải thích nào khác. Cấu trúc JSON phải là:
        {
          "exams": [
            "Nội dung HTML của đề thi số 1 ở đây",
            "Nội dung HTML của đề thi số 2 ở đây"
          ]
        }
    `;

    // --- SỬ DỤNG callWithRetry ---
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({ 
        model, 
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    const text = response.text || "";
    const jsonString = extractJson(text);

    if (!jsonString) {
        console.error("Failed to extract JSON from exam generation response:", text);
        throw new Error("AI không trả về dữ liệu JSON hợp lệ cho đề thi.");
    }

    try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.exams || !Array.isArray(parsed.exams) || parsed.exams.length < 1) {
            throw new Error("Dữ liệu JSON từ AI cho đề thi không đúng định dạng hoặc không có nội dung.");
        }
        return parsed.exams;
    } catch (e) {
        console.error("Failed to parse JSON response for exams:", jsonString);
        throw new Error("Lỗi khi phân tích dữ liệu JSON đề thi từ AI.");
    }
};
