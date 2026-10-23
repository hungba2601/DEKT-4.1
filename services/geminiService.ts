
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { MatrixConfig, SpecData } from '../types';
import { generateMatrixHtml, calculateReviewTargetCounts, ensureSpecMatchesConfig } from '../utils/matrixCalculator';

let userApiKey: string | null = null;
let currentAiModel: string = 'gemini-3.1-flash-lite';

export const setGeminiConfig = (key: string, model: string = 'gemini-3.1-flash-lite') => {
  userApiKey = key;
  currentAiModel = model;
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
/**
 * Sanitize a JSON string to fix common issues from AI responses.
 * Fixes unescaped control characters (newlines, tabs, etc.) inside JSON string values.
 */
const sanitizeJsonString = (text: string): string => {
  // Fix unescaped control characters inside JSON string values
  // This replaces literal newlines/tabs/carriage returns inside strings with their escaped versions
  let result = '';
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      result += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      // Replace unescaped control characters inside strings
      if (char === '\n') { result += '\\n'; continue; }
      if (char === '\r') { result += '\\r'; continue; }
      if (char === '\t') { result += '\\t'; continue; }
      // Replace other control characters
      const code = char.charCodeAt(0);
      if (code < 32) { result += ' '; continue; }
    }
    
    result += char;
  }
  
  return result;
};

/**
 * Extracts and parses a JSON object from a string that might contain other text.
 * Tries multiple strategies for robustness.
 */
const extractJson = (text: string): string | null => {
  if (!text || text.trim().length === 0) return null;
  
  // Strategy 1: Try to parse the text directly (best case - AI returned clean JSON)
  try {
    JSON.parse(text);
    return text;
  } catch (e) { /* continue to next strategy */ }
  
  // Strategy 2: Try sanitizing the full text first
  try {
    const sanitized = sanitizeJsonString(text);
    JSON.parse(sanitized);
    return sanitized;
  } catch (e) { /* continue to next strategy */ }
  
  // Strategy 3: Extract JSON block between first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = text.substring(firstBrace, lastBrace + 1);
    
    // Try direct parse
    try {
      JSON.parse(extracted);
      return extracted;
    } catch (e) { /* try sanitized */ }
    
    // Try sanitized parse
    try {
      const sanitized = sanitizeJsonString(extracted);
      JSON.parse(sanitized);
      return sanitized;
    } catch (e) { /* continue to next strategy */ }
  }
  
  // Strategy 4: Try to extract from markdown code block ```json ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const codeMatch = text.match(codeBlockRegex);
  if (codeMatch && codeMatch[1]) {
    const codeContent = codeMatch[1].trim();
    try {
      const sanitized = sanitizeJsonString(codeContent);
      JSON.parse(sanitized);
      return sanitized;
    } catch (e) { /* all strategies failed */ }
  }
  
  // Fallback: return the extracted block even if we couldn't parse it
  // (let the caller handle the parse error with a better error message)
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return sanitizeJsonString(text.substring(firstBrace, lastBrace + 1));
  }
  
  return null;
};

/**
 * Tự động loại bỏ các mã năng lực (Mã NL, Mã NLS, Mã AI,...) khỏi văn bản Yêu cầu cần đạt
 */
export const removeCompetencyCodes = (text: string): string => {
  if (!text) return text;
  return text
    // 1. Dạng [Mã ...: ...] hoặc [Mã ...]
    .replace(/\[\s*Mã[^\]]*\]/gi, '')
    // 2. Dạng (Mã ...: ...) hoặc (Mã ...)
    .replace(/\(\s*Mã[^)]*\)/gi, '')
    // 3. Dạng [NLS: ...] hoặc [AI: ...] hoặc [NL: ...] hoặc [TC: ...]
    .replace(/\[\s*(?:NLS|AI|NLa|NLb|NLc|NLd|NLe|NL|NLC|PC|TC|YCCĐ)\b[^\]]*\]/gi, '')
    .replace(/\(\s*(?:NLS|AI|NLa|NLb|NLc|NLd|NLe|NL|NLC|PC|TC|YCCĐ)\b[^)]*\)/gi, '')
    // 4. Các ký hiệu [NL...] hoặc (NL...)
    .replace(/\[\s*NL\d+[^\]]*\]/gi, '')
    .replace(/\(\s*NL\d+[^)]*\)/gi, '')
    // Làm sạch khoảng trắng thừa
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/:\s+/g, ': ')
    .replace(/^\s+/gm, '')
    .trim();
};

const fileToText = (fileContent: string, fileName: string): string => {
  if (!fileContent) return `Nội dung file "${fileName}" chưa được cung cấp.`;
  return `--- BẮT ĐẦU NỘI DUNG FILE: ${fileName} ---\n\n${fileContent}\n\n--- KẾT THÚC NỘI DUNG FILE: ${fileName} ---`;
};

// ------------------------------
// CƠ CHẾ TẠM DỪNG VÀ CHỜ API KEY MỚI
// ------------------------------
type QuotaExceededHandler = () => Promise<string>;
let onQuotaExceededHandler: QuotaExceededHandler | null = null;

/**
 * Đăng ký hàm xử lý khi hết hạn mức API.
 * Hàm này sẽ được gọi và phải trả về API Key mới sau khi người dùng nhập.
 */
export const setOnQuotaExceeded = (handler: QuotaExceededHandler) => {
  onQuotaExceededHandler = handler;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const callWithRetry = async <T>(
  fn: () => Promise<T>,
  retries = 10,
  delay = 4000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    let errorMessage = error.message || JSON.stringify(error);

    const isOverloaded = errorMessage.includes('503') || errorMessage.includes('Overloaded') || errorMessage.includes('UNAVAILABLE');
    const isRateLimited = errorMessage.includes('429') || errorMessage.includes('Resource has been exhausted');

    if (isRateLimited && onQuotaExceededHandler) {
      console.warn("API Key hết hạn mức. Đang tạm dừng để chờ API Key mới từ người dùng...");
      try {
        // Gọi handler để mở modal và chờ người dùng nhập key mới
        const newKey = await onQuotaExceededHandler();
        if (newKey) {
          setGeminiConfig(newKey, currentAiModel);
          console.log("Đã nhận API Key mới. Đang thử lại tiến trình...");
          // Thử lại ngay lập tức với key mới
          return callWithRetry(fn, retries, delay);
        } else {
          // Người dùng đã ấn hủy (newKey là chuỗi rỗng)
          throw new Error("Người dùng đã hủy cập nhật API Key. Tiến trình tạo đề bị dừng.");
        }
      } catch (e) {
        console.error("Người dùng hủy việc đổi API Key hoặc có lỗi xảy ra:", e);
        throw e; // Ném lỗi ra ngoài để Tab5 catch và hiển thị thông báo, dừng vòng lặp
      }
    }

    if ((isOverloaded || isRateLimited) && retries > 0) {
      console.warn(`AI Model đang bận (Lỗi ${isOverloaded ? '503 - Quá tải' : '429 - Hết hạn mức'}). Đang thử lại sau ${delay / 1000}s... (Còn ${retries} lần thử)`);
      await wait(delay);
      const nextDelay = Math.min(delay * 1.5, 30000);
      return callWithRetry(fn, retries - 1, nextDelay);
    }

    if (isOverloaded) {
      throw new Error("Hệ thống Google AI đang quá tải (Lỗi 503). Đã thử lại nhiều lần nhưng không thành công.");
    }
    if (isRateLimited) {
      throw new Error("API Key đã hết hạn mức (Lỗi 429). Vui lòng đổi API Key khác để tiếp tục.");
    }

    try {
      if (errorMessage.startsWith('{') && errorMessage.includes('"message":')) {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error && parsed.error.message) {
          throw new Error(`Lỗi từ Google: ${parsed.error.message}`);
        }
      }
    } catch (e) { }

    throw error;
  }
};
// ------------------------------

/**
 * Nhận diện và trích xuất chữ từ file ảnh (OCR) sử dụng Gemini Multimodal
 */
export const ocrImage = async (base64Data: string, mimeType: string, fileName?: string): Promise<string> => {
  const model = currentAiModel;
  const prompt = `Bạn là chuyên gia số hóa tài liệu giáo dục. Hãy đọc và trích xuất TOÀN BỘ nội dung văn bản, bảng biểu, đề mục và nội dung bài học trong hình ảnh trang sách giáo khoa này một cách chi tiết, chính xác 100%.
- Giữ nguyên cấu trúc các mục, tiêu đề, đoạn văn.
- Đối với công thức toán/lý/hóa, sử dụng cú pháp LaTeX ($...$ cho nội dòng, $$...$$ cho công thức khối).
- Tuyệt đối không thêm lời bình luận, lời chào hay giải thích nào khác. Chỉ trả về nội dung đã trích xuất.`;

  const response = await callWithRetry<GenerateContentResponse>(() => 
    getAiClient().models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: base64Data,
          },
        },
        {
          text: prompt,
        },
      ],
    })
  );

  const text = response.text || "";
  return text.trim();
};

export const generateMatrixAndSpec = async (
  sgkFileContent: string,
  curriculumFileContent: string,
  config: MatrixConfig,
  examTitle: string,
  schoolYear?: string
): Promise<{ matrix: string; spec: SpecData }> => {
  const model = currentAiModel;
  const sgkText = fileToText(sgkFileContent, "Sách giáo khoa (Toàn bộ nội dung)");
  const curriculumText = fileToText(curriculumFileContent, "Phân phối chương trình");
  const titleParts = [examTitle ? examTitle.toUpperCase() : '', schoolYear ? `NĂM HỌC ${schoolYear}` : ''].filter(Boolean);
  const finalExamTitle = titleParts.length > 0 ? ` ${titleParts.join(' - ')}` : '';

  let configRules = '';

  // Tính phân bổ ý ĐS theo mức độ: Biết ưu tiên 2, phần còn lại san đều Hiểu và VD
  const soY = config.soYTrongCauDungSai;
  const dsBiet = Math.min(2, soY); // Biết ưu tiên 2 ý, hoặc tất cả nếu tổng < 2
  const dsConLai = soY - dsBiet;
  const dsHieu = Math.ceil(dsConLai / 2); // Hiểu lấy nửa trên
  const dsVanDung = dsConLai - dsHieu; // VD lấy phần còn lại

  if (config.isTuLuan100) {
    const totalQuestions = config.soCauTuLuan;
    configRules = `
    - **CHẾ ĐỘ ĐẶC BIỆT: 100% TỰ LUẬN (BẮT BUỘC TUYỆT ĐỐI):**
        - **Toàn bộ đề thi chỉ có câu hỏi Tự luận.**
        - **Tổng số câu hỏi:** Chính xác ${config.soCauTuLuan} câu Tự luận.
        - **Tổng điểm toàn bài thi PHẢI LÀ 10.0.**
        - **QUY TẮC PHÂN BỔ ĐIỂM (CỰC KỲ QUAN TRỌNG):** Bạn phải tự động phân bổ 10.0 điểm cho ${config.soCauTuLuan} câu hỏi. Điểm của mỗi câu có thể khác nhau, tùy thuộc vào độ phức tạp và lượng kiến thức. Điểm của mỗi câu Tự luận PHẢI được chọn từ danh sách sau: {1, 1.5, 2, 2.5, 3, 3.5}. Tổng điểm của tất cả các câu phải bằng 10.0.
        - **Số lượng câu trắc nghiệm (Nhiều lựa chọn, Đúng-Sai, Trả lời ngắn):** Bắt buộc là 0.
    - **PHÂN BỔ TỶ LỆ ĐIỂM THEO MỨC ĐỘ (BẮT BUỘC TUYỆT ĐỐI - KHÔNG ĐƯỢC SAI LỆCH):**
        - Nhận biết: Chính xác ${config.biet}% (tương đương ${(config.biet / 100 * 10).toFixed(2)} điểm).
        - Thông hiểu: Chính xác ${config.hieu}% (tương đương ${(config.hieu / 100 * 10).toFixed(2)} điểm).
        - Vận dụng: Chính xác ${config.vanDung}% (tương đương ${(config.vanDung / 100 * 10).toFixed(2)} điểm).
        - **LƯU Ý:** Bạn phải tự điều phối điểm của các câu tự luận vào 3 mức độ sao cho tổng điểm của từng mức độ phải ĐÚNG CHÍNH XÁC con số yêu cầu trên (tổng bằng 10.0).
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
    - **CẤU TRÚC VÀ PHÂN BỔ CÂU ĐÚNG-SAI (CỰC KỲ QUAN TRỌNG - BẮT BUỘC ĐỦ CÂU):**
        - Tổng số câu Đúng-Sai trên TOÀN BỘ bài thi PHẢI ĐỦ CHÍNH XÁC **${config.soCauDungSai} CÂU LỚN** (tương ứng **${config.soCauDungSai * config.soYTrongCauDungSai} Ý**).
        - Mỗi câu Đúng-Sai có ${soY} ý được chia theo mức độ: **Nhận biết = ${dsBiet} ý, Thông hiểu = ${dsHieu} ý, Vận dụng = ${dsVanDung} ý**.
        - **KHI SỐ BÀI HỌC ÍT HƠN SỐ CÂU ĐÚNG-SAI (ví dụ: chỉ có 2 bài học nhưng cấu hình yêu cầu 4 câu Đúng-Sai):** Bạn BẮT BUỘC PHẢI phân bổ nhiều hơn 1 câu Đúng-Sai vào một bài học (ví dụ: Bài 1 có 2 câu Đúng-Sai = 8 ý, Bài 2 có 2 câu Đúng-Sai = 8 ý). TUYỆT ĐỐI CẤM việc chỉ gán 1 câu mỗi bài rồi dừng lại dẫn đến thiếu câu hỏi!
        - Nếu bài học có k câu Đúng-Sai (k = 1, 2, 3...), thì số ý tương ứng ghi vào JSON:
            + nhanBiet.DS = k * ${dsBiet} ý
            + thongHieu.DS = k * ${dsHieu} ý
            + vanDung.DS = k * ${dsVanDung} ý
          (Ví dụ: nếu bài có 2 câu Đúng-Sai thì ghi: nhanBiet.DS = ${dsBiet * 2}, thongHieu.DS = ${dsHieu * 2}, vanDung.DS = ${dsVanDung * 2}).
    - **PHÂN BỔ TỶ LỆ ĐIỂM (BẮT BUỘC TUYỆT ĐỐI - KHÔNG ĐƯỢC SAI LỆCH):**
        - Tỷ lệ điểm Trắc nghiệm / Tự luận: Chính xác ${config.tracNghiem}% / ${config.tuLuan}% (Tương đương ${tongDiemTracNghiem.toFixed(2)}đ / ${tongDiemTuLuan.toFixed(2)}đ)
        - Tỷ lệ điểm theo mức độ nhận thức:
            + Nhận biết: Chính xác ${config.biet}% (tương đương ${(config.biet / 100 * 10).toFixed(2)} điểm).
            + Thông hiểu: Chính xác ${config.hieu}% (tương đương ${(config.hieu / 100 * 10).toFixed(2)} điểm).
            + Vận dụng: Chính xác ${config.vanDung}% (tương đương ${(config.vanDung / 100 * 10).toFixed(2)} điểm).
        - **KIỂM TOÁN TỔNG SỐ LƯỢNG CÂU HỎI TRONG BẢN ĐẶC TẢ SPEC (BẮT BUỘC ĐẠT ĐÚNG 100%):**
            + Tổng các trường "TN" trên TOÀN BỘ các bài học phải cộng lại BẰNG ĐÚNG ${config.soCauNhieuLuaChon} câu.
            + Tổng các trường "DS" (số ý) trên TOÀN BỘ các bài học phải cộng lại BẰNG ĐÚNG ${config.soCauDungSai * config.soYTrongCauDungSai} ý (tương đương ${config.soCauDungSai} câu Đúng-Sai lớn).
            + Tổng các trường "TNgan" trên TOÀN BỘ các bài học phải cộng lại BẰNG ĐÚNG ${config.soCauTraLoiNgan} câu.
            + Tổng các trường "TL" trên TOÀN BỘ các bài học phải cộng lại BẰNG ĐÚNG ${config.soCauTuLuan} câu.
            + TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ BỚT CÂU HỎI. Tổng điểm toàn bộ các câu hỏi trong đề phải đúng 10.0 điểm!
        - **LƯU Ý QUAN TRỌNG:** Bạn PHẢI sắp xếp số lượng câu hỏi và phân chia điểm số (0.25đ, 0.5đ, 1.0đ, 1.5đ...) vào 3 cột Nhận biết, Thông hiểu, Vận dụng sao cho tổng điểm cộng dồn ở mỗi cột đạt CHÍNH XÁC số điểm yêu cầu ở trên. Tuyệt đối không được tự ý làm tròn sai lệch (như 32.5%). Tổng % phải ĐÚNG 100% và tổng điểm phải ĐÚNG 10.0.
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

  const tongSoCauLon = config.isTuLuan100 ?
    config.soCauTuLuan :
    (config.soCauNhieuLuaChon + config.soCauDungSai + config.soCauTraLoiNgan + config.soCauTuLuan);

  const soCauTNKQ_va_TL = config.isTuLuan100 ?
    `${config.soCauTuLuan} câu` :
    `${tongSoCauLon} câu, ${config.soCauDungSai * config.soYTrongCauDungSai} ý`;

  const totalQuestionsString = `(${soCauTNKQ_va_TL} - 10.0)`;


  const prompt = `
    Bạn là một chuyên gia phân tích và cấu trúc thông tin giáo dục.

    --- NGUỒN DỮ LIỆU ---
    Bạn được cung cấp 2 nguồn dữ liệu:
    1.  **FILE PHÂN PHỐI CHƯƠNG TRÌNH (DANH SÁCH BÀI HỌC BẮT BUỘC - MASTER LIST):** ${curriculumText}
    2.  **FILE SÁCH GIÁO KHOA (NGUỒN THAM KHẢO NỘI DUNG CHI TIẾT):** ${sgkText}

    --- QUY TẮC KẾT HỢP VÀ XỬ LÝ DỮ LIỆU (CỰC KỲ QUAN TRỌNG) ---
    -   **NGUYÊN TẮC SỐ 1: "FILE PHÂN PHỐI CHƯƠNG TRÌNH" LÀ NGUỒN GỐC DUY NHẤT VỀ CẤU TRÚC VÀ YÊU CẦU CẦN ĐẠT.** Bạn phải liệt kê và sử dụng TẤT CẢ các bài học có trong file này.
    -   **BƯỚC 1:** Trích xuất toàn bộ danh sách bài học từ "FILE PHÂN PHỐI CHƯƠNG TRÌNH" (Tên chủ đề, tên bài học, số thứ tự).
    -   **BƯỚC 2:** Tạo khung ma trận bao gồm ĐẦY ĐỦ danh sách bài học vừa trích xuất. KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI NÀO.
    -   **BƯỚC 3 (ĐẶC BIỆT BẮT BUỘC - QUY TẮC VỀ YÊU CẦU CẦN ĐẠT - YCCĐ):**
        + Trong bảng đặc tả (trường "yeuCauCanDat"), bạn **BẮT BUỘC PHẢI LẤY NỘI DUNG YÊU CẦU CẦN ĐẠT (YCCĐ) TỪ FILE PHÂN PHỐI CHƯƠNG TRÌNH (PPCT)** mà người dùng đã tải lên.
        + **QUY TẮC CỰC KỲ QUAN TRỌNG: BỎ TOÀN BỘ PHẦN MÃ NĂNG LỰC (MÃ NL, MÃ NLS, MÃ AI, MÃ TIÊU CHÍ):**
          Trong file PPCT thường có các mã năng lực đi kèm câu chữ, ví dụ:
          "[Mã NLS: 1.1.TC2a]", "[Mã AI: 9.A2.2]", "[Mã NL: ...]", "[NLS: ...]", "(NLa)", "(NLb)", "[NL1]", "[TC...]", v.v.
          Bạn **BẮT BUỘC PHẢI LOẠI BỎ (XÓA HẲN) TẤT CẢ CÁC MÃ NĂNG LỰC NÀY** ra khỏi nội dung YCCĐ. TUYỆT ĐỐI KHÔNG để lại bất kỳ mã năng lực nào hay dấu ngoặc chứa mã năng lực trong kết quả! Chỉ giữ lại phần câu chữ nội dung yêu cầu kiến thức/kỹ năng thực tế.
          *Ví dụ chuyển đổi:*
          - Gốc trong PPCT: "[Mã NLS: 1.1.TC2a] Minh họa được nhu cầu thông tin trong các bài toán thực tiễn."
            -> Bạn chuyển thành: "Minh họa được nhu cầu thông tin trong các bài toán thực tiễn."
          - Gốc trong PPCT: "[Mã AI: 9.A2.2] Trình bày được ý kiến cá nhân về các thách thức an toàn số và quyền riêng tư trong kỷ nguyên AI."
            -> Bạn chuyển thành: "Trình bày được ý kiến cá nhân về các thách thức an toàn số và quyền riêng tư trong kỷ nguyên AI."
          - Gốc trong PPCT: "[Mã AI: 9.A2.2] Giải thích được nguyên nhân và hậu quả xã hội của hiện tượng thiên vị thuật toán."
            -> Bạn chuyển thành: "Giải thích được nguyên nhân và hậu quả xã hội của hiện tượng thiên vị thuật toán."
        + **TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT**, KHÔNG tự tóm tắt làm sai lệch hoặc làm mất câu từ gốc của file PPCT (ngoài việc xóa bỏ mã năng lực).
        + **THÊM CÁC TỪ MỨC ĐỘ NHẬN THỨC VÀO CÁC NỘI DUNG TỪ PPCT CHO PHÙ HỢP:**
          Bạn hãy phân loại toàn bộ nội dung YCCĐ lấy từ file PPCT của bài học đó và xếp vào 3 mức độ nhận thức tương ứng:
          * **Nhận biết:** (hoặc Biết)
          * **Thông hiểu:**
          * **Vận dụng:** (bao gồm cả vận dụng và vận dụng cao nếu có)
        + **CẤU TRÚC ĐỊNH DẠNG BẮT BUỘC CHO Ô "yeuCauCanDat" (Mỗi mức độ nhận thức trên một dòng riêng, ngăn cách nhau bởi \\n):**
          Nhận biết: [các nội dung yêu cầu thuộc mức nhận biết lấy từ PPCT, ĐÃ BỎ HẾT MÃ NL]
          Thông hiểu: [nội dung các yêu cầu thuộc mức thông hiểu lấy từ PPCT, ĐÃ BỎ HẾT MÃ NL]
          Vận dụng: [nội dung các yêu cầu thuộc mức vận dụng lấy từ PPCT, ĐÃ BỎ HẾT MÃ NL]
          
          *Ví dụ mẫu chuẩn bắt buộc:*
          "Nhận biết: Phân biệt được thông tin và dữ liệu qua các ví dụ thực tế; Nhận biết được các dạng thông tin cơ bản bao gồm văn bản, hình ảnh, âm thanh và con số trong cuộc sống hàng ngày.\\nThông hiểu: Giải thích được mối quan hệ mật thiết giữa dữ liệu và thông tin; Nêu được ví dụ cụ thể minh họa cho tầm quan trọng của thông tin đối với việc ra quyết định và hành động của con người.\\nVận dụng: Phân tích và chỉ ra được các loại dữ liệu cần thiết để giải quyết một tình huống đơn giản trong học tập hoặc đời sống."

        + *LƯU Ý KHI PHÂN LOẠI NỘI DUNG TỪ PPCT:*
          - Nếu file PPCT đã ghi sẵn các ý gạch đầu dòng nhưng chưa gắn nhãn mức độ, bạn hãy đọc hiểu câu chữ trong file PPCT đó để xếp từng ý vào đúng nhãn: "Nhận biết:", "Thông hiểu:", "Vận dụng:". Giữ nguyên vẹn câu chữ của từng ý từ file PPCT sau khi đã lọc bỏ mã năng lực.
          - Nếu file PPCT đã ghi sẵn các mức độ, hãy giữ nguyên và chuẩn hóa theo định dạng trên.
          - Nếu bài học trong PPCT không có yêu cầu ở mức độ nào thì chỉ cần liệt kê các mức độ có yêu cầu từ PPCT.
          - Chỉ trong trường hợp hy hữu nếu file PPCT hoàn toàn không có cột/mục YCCĐ, bạn mới dùng SGK để bổ sung YCCĐ nhưng vẫn PHẢI tuân thủ chuẩn 3 mức độ "Nhận biết:", "Thông hiểu:", "Vận dụng:".

    **CẢNH BÁO:** TUYỆT ĐỐI KHÔNG được tự "bịa" ra tên chủ đề/bài học hay viết sai lệch YCCĐ so với file PPCT. TUYỆT ĐỐI BỎ HẾT CÁC MÃ NĂNG LỰC (MÃ NL, MÃ NLS, MÃ AI). Mọi cấu trúc và nội dung YCCĐ phải bám sát vào file Phân phối chương trình.

    --- YÊU CẦU CÔNG VIỆC (TUYỆT ĐỐI KHÔNG BỎ SÓT) ---
    Dựa vào TOÀN BỘ nội dung của 2 file đã cho, hãy tạo ra một MA TRẬN ĐỀ KIỂM TRA và một BẢN ĐẶC TẢ chi tiết. 
    **YÊU CẦU BẮT BUỘC:**
    1.  Bạn PHẢI rà soát kỹ lưỡng and phân bổ câu hỏi cho **TẤT CẢ (100%) CÁC BÀI HỌC** có trong "FILE PHÂN PHỐI CHƯƠNG TRÌNH".
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
        -   Trong các ô có câu hỏi ở phần Body, bạn PHẢI điền số lượng câu hỏi, số thứ tự câu hỏi và tổng điểm. 
            + **QUY TẮC ĐÁNH SỐ THỨ TỰ (BẮT BUỘC):** 
              * **Nhiều lựa chọn:** Đánh số liên tục THEO TỪNG BÀI HỌC (từ trái qua phải: Biết -> Hiểu -> Vận dụng). Hết Bài 1 mới đánh số tiếp cho Bài 2. (VD: Bài 1 Biết C1,2, Hiểu C3. Bài 2 Biết C4,5...). Nếu ô có nhiều câu, chỉ ghi chữ 'C' ở đầu, sau đó phẩy số (VD: C1,2,3).
              * **Đúng - Sai:** Mỗi câu ĐS đánh số từ 1, 2... Các ý bên trong đánh a, b, c, d. VD: Câu 1 có 4 ý là 1a, 1b, 1c, 1d. Cũng đánh số liên tục theo từng bài.
              * **Trả lời ngắn:** Đánh số độc lập, bắt đầu lại từ đầu là C1, 2, 3... Đánh liên tục theo từng bài.
              * **Tự luận:** Đánh số độc lập, bắt đầu lại từ đầu là C1, 2, 3... Đánh liên tục theo từng bài.
            + **ĐỊNH DẠNG Ô CÂU HỎI (BẮT BUỘC):** \`Số lượng (Các số thứ tự câu) <br/> (Điểm)\`
              * Ví dụ Nhiều lựa chọn: \`2 (C1,2) <br/> (0.5đ)\`
              * Ví dụ Đúng - Sai: \`2 (1a,1b) <br/> (0.5đ)\`
              * Ví dụ Tự luận: \`1 (C1) <br/> (2.0đ)\`
            + Nếu ô không có câu hỏi, để trống hoàn toàn.

    --- QUY TẮC ĐỊNH DẠNG 3 CỘT "TỔNG" (Biết, Hiểu, Vận dụng) Ở CẢ BODY VÀ FOOTER (CỰC KỲ QUAN TRỌNG) ---
    - **TUYỆT ĐỐI CẤM:** Không được cộng gộp số câu với số ý thành một con số duy nhất (Ví dụ SAI: (5 - 1.25), (16 - 4.0), (7 - 3.0), (21 - 10.0)).
    - **BẮT BUỘC PHẢI GHI CỤ THỂ, TÁCH BIỆT SỐ CÂU VÀ SỐ Ý:**
      * Nếu trong mức độ đó CHỈ CÓ CÂU (TN, Trả lời ngắn, Tự luận): Ghi \`(X câu - Điểm)\` hoặc \`(X - Điểm)\` (Ví dụ: \`(3 câu - 0.75)\` hoặc \`(1 câu - 1.5)\`).
      * Nếu trong mức độ đó CHỈ CÓ Ý (Đúng - Sai): Ghi \`(Y ý - Điểm)\` (Ví dụ: \`(2 ý - 0.5)\` hoặc \`(1 ý - 0.25)\`).
      * **NẾU TRONG MỨC ĐỘ ĐÓ CÓ CẢ CÂU VÀ Ý: BẮT BUỘC GHI RÕ TÁCH BIỆT:** \`(X câu, Y ý - Điểm)\`
        - Ví dụ ở hàng 1 mức Biết: có 3 câu TN và 2 ý ĐS -> Ghi: \`(3 câu, 2 ý - 1.25)\`.
        - Ví dụ ở hàng 1 mức Hiểu: có 1 câu TN và 1 ý ĐS -> Ghi: \`(1 câu, 1 ý - 0.5)\`.
        - Ví dụ ở hàng 1 mức Vận dụng: có 1 ý ĐS -> Ghi: \`(1 ý - 0.25)\`.
        - Ví dụ ở Footer cột Tổng Biết: có 10 câu TN và 6 ý ĐS -> Ghi: \`(10 câu, 6 ý - 4.0)\`.
        - Ví dụ ở Footer cột Tổng Hiểu: có 3 câu TN, 1 câu TL và 3 ý ĐS (tổng 4 câu, 3 ý) -> Ghi: \`(4 câu, 3 ý - 3.0)\`.
        - Ví dụ ở Footer cột Tổng Vận dụng: có 3 câu TN, 1 câu TL và 3 ý ĐS (tổng 4 câu, 3 ý) -> Ghi: \`(4 câu, 3 ý - 3.0)\`.
        - Ô Tổng cuối cùng (góc phải dưới cùng của Footer): Ghi \`(${soCauTNKQ_va_TL} - 10.0)\`.

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
                <!-- Dữ liệu cho từng ô -->
                <td>3 (C1,2,3)<br/>(0.75đ)</td><td>1 (C4)<br/>(0.25đ)</td><td></td> <!-- NL -->
                <td>2 (1a,1b)<br/>(0.5đ)</td><td>1 (1c)<br/>(0.25đ)</td><td>1 (1d)<br/>(0.25đ)</td> <!-- ĐS -->
                <td></td><td></td><td></td> <!-- Trả lời ngắn -->
                <td></td><td></td><td></td> <!-- TL -->
                <!-- Tổng theo mức độ cho hàng này (GHI CỤ THỂ SỐ CÂU VÀ SỐ Ý, KHÔNG GỘP CHUNG) -->
                <td>(3 câu, 2 ý - 1.25)</td><td>(1 câu, 1 ý - 0.5)</td><td>(1 ý - 0.25)</td>
                <td>20</td> <!-- Tỉ lệ % -->
            </tr>
        </tbody>
        <tfoot>
            <tr style="font-weight: bold;">
                <td colspan="2">Tổng (Số câu, ý - Điểm)</td>
                <td>(10 - 2.5)</td><td>(3 - 0.75)</td><td>(3 - 0.75)</td>
                <td>(6 ý - 1.5)</td><td>(3 ý - 0.75)</td><td>(3 ý - 0.75)</td>
                <td>(0 - 0)</td><td>(0 - 0)</td><td>(0 - 0)</td>
                <td>(0 - 0)</td><td>(1 - 1.5)</td><td>(1 - 1.5)</td>
                <td>(10 câu, 6 ý - 4.0)</td>
                <td>(4 câu, 3 ý - 3.0)</td>
                <td>(4 câu, 3 ý - 3.0)</td>
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
              "yeuCauCanDat": "BẮT BUỘC lấy nội dung YCCĐ từ file PPCT tải lên, BỎ TOÀN BỘ MÃ NĂNG LỰC ([Mã NLS:...], [Mã AI:...]), phân bổ vào 3 mức độ nhận thức theo định dạng:\\nNhận biết: [nội dung từ PPCT, không chứa mã NL]\\nThông hiểu: [nội dung từ PPCT, không chứa mã NL]\\nVận dụng: [nội dung từ PPCT, không chứa mã NL]",
              "soCau": {
                "nhanBiet": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0},
                "thongHieu": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0},
                "vanDung": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0},
                "vanDungCao": {"TN": 0, "DS": 0, "TNgan": 0, "TL": 0}
              }
              // LƯU Ý QUAN TRỌNG VỀ TRƯỜNG DS:
              // DS = SỐ Ý (không phải số câu hỏi).
              // Ví dụ: Bài có 1 câu Đúng-Sai (${soY} ý) -> nhanBiet.DS=${dsBiet}, thongHieu.DS=${dsHieu}, vanDung.DS=${dsVanDung}
              // Nếu bài có 2 câu Đúng-Sai (${soY * 2} ý) -> nhanBiet.DS=${dsBiet * 2}, thongHieu.DS=${dsHieu * 2}, vanDung.DS=${dsVanDung * 2}
              // Tổng trường DS trên TOÀN BỘ các bài học bắt buộc phải bằng chính xác ${config.soCauDungSai * config.soYTrongCauDungSai} ý (${config.soCauDungSai} câu lớn)!
              // Các trường TN, TNgan, TL vẫn là số CÂU như bình thường.
            }
          ]
        }
      ]
    }
  `;

  // --- HÀM GỌI AI VÀ PARSE JSON (CÓ TỰ ĐỘNG THỬ LẠI KHI LỖI JSON) ---
  const maxJsonRetries = 2; // Thử tối đa 2 lần nếu lỗi JSON
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxJsonRetries; attempt++) {
    try {
      console.log(`Gọi AI tạo ma trận (lần ${attempt}/${maxJsonRetries})...`);
      
      const response = await callWithRetry<GenerateContentResponse>(() => 
        getAiClient().models.generateContent({
          model,
          contents: attempt === 1 ? prompt : prompt + '\n\n**LƯU Ý QUAN TRỌNG:** Phản hồi của bạn PHẢI là JSON thuần túy, hợp lệ. KHÔNG được có ký tự xuống dòng thực (literal newline) bên trong chuỗi JSON. Hãy sử dụng \\n thay cho xuống dòng trong các giá trị chuỗi. KHÔNG sử dụng markdown code block.',
          config: { responseMimeType: "application/json", maxOutputTokens: 65536 }
        })
      );

      const text = response.text || "";
      
      if (!text.trim()) {
        console.error(`Lần ${attempt}: AI trả về phản hồi rỗng.`);
        lastError = new Error("AI trả về phản hồi rỗng. Vui lòng thử lại.");
        if (attempt < maxJsonRetries) { await wait(2000); continue; }
        throw lastError;
      }

      const jsonString = extractJson(text);

      if (!jsonString) {
        console.error(`Lần ${attempt}: Không thể trích xuất JSON từ phản hồi:`, text.substring(0, 500));
        lastError = new Error("AI không trả về dữ liệu JSON hợp lệ. Vui lòng thử lại.");
        if (attempt < maxJsonRetries) { await wait(2000); continue; }
        throw lastError;
      }

      const parsed = JSON.parse(jsonString);
      
      if (!Array.isArray(parsed.spec)) {
        console.error(`Lần ${attempt}: JSON thiếu trường bắt buộc 'spec'. Keys:`, Object.keys(parsed));
        lastError = new Error("Dữ liệu JSON từ AI thiếu trường bắt buộc 'spec'.");
        if (attempt < maxJsonRetries) { await wait(2000); continue; }
        throw lastError;
      }

      // Tự động làm sạch triệt để mọi mã năng lực (Mã NL, Mã NLS, Mã AI,...) trên từng dòng YCCĐ của spec
      if (Array.isArray(parsed.spec)) {
        parsed.spec.forEach((topic: any) => {
          if (Array.isArray(topic.rows)) {
            topic.rows.forEach((row: any) => {
              if (row.yeuCauCanDat) {
                row.yeuCauCanDat = removeCompetencyCodes(row.yeuCauCanDat);
              }
            });
          }
        });
      }

      console.log('Đã parse JSON ma trận thành công.');
      // Đảm bảo spec khớp 100% với config và tự động bù đủ câu hỏi nếu AI phân bổ thiếu
      const balancedSpec = ensureSpecMatchesConfig(parsed.spec, config);
      // Sinh bảng Ma trận HTML bằng CODE toán học để đảm bảo tính toán số câu, số ý và số điểm chính xác 100%
      const computedMatrixHtml = generateMatrixHtml(balancedSpec, config, examTitle, schoolYear);

      return {
        matrix: computedMatrixHtml || parsed.matrix,
        spec: balancedSpec,
      };

    } catch (e: any) {
      const isJsonError = e instanceof SyntaxError || 
                          (e.message && e.message.includes('JSON'));
      
      if (isJsonError && attempt < maxJsonRetries) {
        console.warn(`Lần ${attempt}: Lỗi JSON, đang thử lại...`, e.message);
        lastError = e;
        await wait(2000);
        continue;
      }
      
      // Nếu không phải lỗi JSON hoặc đã hết lần thử -> throw
      console.error(`Lỗi khi tạo ma trận (lần ${attempt}):`, e.message);
      if (e instanceof SyntaxError) {
        throw new Error("AI trả về JSON không hợp lệ sau nhiều lần thử. Vui lòng thử lại hoặc đổi API Key.");
      }
      throw e;
    }
  }

  // Fallback (should not reach here)
  throw lastError || new Error("Lỗi không xác định khi tạo ma trận.");
};

export const generateReviewQuestions = async (
  sgkFileContent: string,
  matrix: string,
  spec: SpecData,
  config: MatrixConfig,
  customPrompt?: string
): Promise<string> => {
  const model = currentAiModel;
  const sgkText = fileToText(sgkFileContent, "Sách giáo khoa");
  const matrixText = `--- BẮT ĐẦU MA TRẬN ---\n${matrix}\n--- KẾT THÚC MA TRẬN ---`;
  const specText = `--- BẮT ĐẦU BẢN ĐẶC TẢ ---\n${JSON.stringify(spec, null, 2)}\n--- KẾT THÚC BẢN ĐẶC TẢ ---`;

  // Tính toán chính xác số lượng câu hỏi mục tiêu (gấp 2.5 lần ma trận) bằng code
  const targets = calculateReviewTargetCounts(spec, config);

  const soCauNho = targets.soY || 4;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let exampleStatements = '';
  let exampleAnswers = '';

  for (let i = 0; i < soCauNho && i < alphabet.length; i++) {
    exampleStatements += `<p>${alphabet[i]}. Phát biểu ${i + 1}.</p>`;
    const randomAnswer = Math.random() > 0.5 ? 'Đúng' : 'Sai';
    exampleAnswers += `<p>${alphabet[i]} - ${randomAnswer}</p>`;
  }

  // --- TÍNH TOÁN CHÍNH XÁC CHỈ TIÊU SỐ LƯỢNG CÂU HỎI (GẤP 2.5 LẦN) TRƯỚC KHI GỬI PROMPT ---
  let sumTN = 0;
  let sumDS_Y = 0;
  let sumTNgan = 0;
  let sumTL = 0;

  if (Array.isArray(spec) && spec.length > 0) {
    spec.forEach(topic => {
      topic.rows?.forEach(row => {
        const s = row.soCau;
        if (s) {
          sumTN += (s.nhanBiet?.TN || 0) + (s.thongHieu?.TN || 0) + (s.vanDung?.TN || 0) + (s.vanDungCao?.TN || 0);
          sumDS_Y += (s.nhanBiet?.DS || 0) + (s.thongHieu?.DS || 0) + (s.vanDung?.DS || 0) + (s.vanDungCao?.DS || 0);
          sumTNgan += (s.nhanBiet?.TNgan || 0) + (s.thongHieu?.TNgan || 0) + (s.vanDung?.TNgan || 0) + (s.vanDungCao?.TNgan || 0);
          sumTL += (s.nhanBiet?.TL || 0) + (s.thongHieu?.TL || 0) + (s.vanDung?.TL || 0) + (s.vanDungCao?.TL || 0);
        }
      });
    });
  }

  // Số lượng cơ sở trong 1 đề thi
  const htmlCounts = extractCountsFromMatrixHtml(matrix, soCauNho);

  const baseTN = sumTN > 0 
    ? sumTN 
    : (htmlCounts?.tn || config.soCauNhieuLuaChon || 12);

  const baseDS = sumDS_Y > 0 
    ? Math.max(1, Math.round(sumDS_Y / soCauNho)) 
    : (htmlCounts?.dsCau || config.soCauDungSai || 2);

  const baseTNgan = sumTNgan > 0 
    ? sumTNgan 
    : (htmlCounts?.tngan || config.soCauTraLoiNgan || 8);

  const baseTL = sumTL > 0 
    ? sumTL 
    : (htmlCounts?.tl || config.soCauTuLuan || (config.isTuLuan100 ? 10 : 0));

  // CHỈ TIÊU BẮT BUỘC BỘ ÔN TẬP: GẤP 2.5 LẦN (LÀM TRÒN LÊN)
  const targetTN = Math.ceil(baseTN * 2.5);
  const targetDS = Math.ceil(baseDS * 2.5);
  const targetTNgan = Math.ceil(baseTNgan * 2.5);
  const targetTL = Math.ceil(baseTL * 2.5);
  const targetTotal = targetTN + targetDS + targetTNgan + targetTL;

  // Lập bảng chi tiết phân bổ cho từng bài học theo spec
  let lessonBreakdownText = '';
  if (Array.isArray(spec) && spec.length > 0) {
    lessonBreakdownText = '\n--- PHÂN BỔ CHỈ TIÊU CÂU HỎI THEO TỪNG BÀI HỌC (BẮT BUỘC PHẢI TẠO ĐỦ) ---\n';
    spec.forEach((topic) => {
      lessonBreakdownText += `\n* CHỦ ĐỀ: ${topic.chuDe}\n`;
      topic.rows?.forEach((row) => {
        const s = row.soCau;
        if (!s) return;
        const rowTN = Math.ceil(((s.nhanBiet?.TN || 0) + (s.thongHieu?.TN || 0) + (s.vanDung?.TN || 0)) * 2.5);
        const rowDsY = (s.nhanBiet?.DS || 0) + (s.thongHieu?.DS || 0) + (s.vanDung?.DS || 0);
        const rowDS = rowDsY > 0 ? Math.ceil((rowDsY / soCauNho) * 2.5) : 0;
        const rowTNgan = Math.ceil(((s.nhanBiet?.TNgan || 0) + (s.thongHieu?.TNgan || 0) + (s.vanDung?.TNgan || 0)) * 2.5);
        const rowTL = Math.ceil(((s.nhanBiet?.TL || 0) + (s.thongHieu?.TL || 0) + (s.vanDung?.TL || 0)) * 2.5);

        const items: string[] = [];
        if (rowTN > 0) items.push(`${rowTN} câu Nhiều lựa chọn`);
        if (rowDS > 0) items.push(`${rowDS} câu Đúng-Sai (${soCauNho} ý/câu)`);
        if (rowTNgan > 0) items.push(`${rowTNgan} câu Trả lời ngắn`);
        if (rowTL > 0) items.push(`${rowTL} câu Tự luận`);

        if (items.length > 0) {
          lessonBreakdownText += `  - Bài "${row.noiDung}": Phải tạo ${items.join(', ')}.\n`;
        }
      });
    });
  }

  let customInstruction = '';
  if (customPrompt && customPrompt.trim()) {
    customInstruction = `
        --- YÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN / NGƯỜI DÙNG KHI SOẠN CÂU HỎI (BẮT BUỘC ƯU TIÊN CAO NHẤT) ---
        ${customPrompt.trim()}
        
        **HƯỚNG DẪN XỬ LÝ YÊU CẦU ĐẶC BIỆT:**
        - Bạn PHẢI tuân thủ nghiêm ngặt mọi chỉ dẫn về cấu trúc, kiểu câu hỏi, số lượng ý nhỏ trong mỗi câu, phong cách nội dung hoặc định dạng đáp án (ví dụ: câu hỏi ngắn gồm 4 ý nhỏ, đáp án là các con số, gắn liền tình huống thực tế,...) được giáo viên đưa ra ở trên.
        - Mọi quy tắc định dạng chung nếu có xung đột với yêu cầu đặc biệt này thì phải ưu tiên thực hiện đúng theo yêu cầu của giáo viên.
    `;
  }

  const prompt = `
        Bạn là một chuyên gia khảo thí và sư phạm chuyên tạo ngân hàng câu hỏi ôn tập cho giáo viên.
        
        --- NGUỒN DỮ LIỆU ---
        1.  **SÁCH GIÁO KHOA:** ${sgkText}
        2.  **MA TRẬN ĐỀ KIỂM TRA:** ${matrixText}
        3.  **BẢN ĐẶC TẢ CHI TIẾT (NGUỒN QUAN TRỌNG NHẤT):** ${specText}

        --- YÊU CẦU TỔNG QUAN ---
        Dựa vào TOÀN BỘ các nguồn dữ liệu, hãy tạo ra một bộ **CÂU HỎI ÔN TẬP** đầy đủ, phong phú và chi tiết. **ƯU TIÊN TUYỆT ĐỐI** thông tin từ **BẢN ĐẶC TẢ** để xác định số lượng, hình thức, và mức độ nhận thức cho từng nội dung.
        ${customInstruction}
        --- SỐ LƯỢNG CÂU HỎI MỤC TIÊU BẮT BUỘC (HỆ THỐNG ĐÃ TÍNH TOÁN BẰNG CODE GẤP 2.5 LẦN MA TRẬN) ---
        Để đảm bảo ngân hàng câu hỏi đủ lớn, tạo được nhiều đề thi hoàn toàn khác nhau mà không bị trùng lặp, bạn BẮT BUỘC PHẢI tạo ĐẦY ĐỦ số lượng câu hỏi sau:
        ${targets.targetTN > 0 ? `- **Trắc nghiệm Nhiều lựa chọn (TN): BẮT BUỘC TỐI THIỂU ${targets.targetTN} CÂU.** Đánh số liên tục từ Câu 1 đến Câu ${targets.targetTN}.` : ''}
        ${targets.targetDS > 0 ? `- **Trắc nghiệm Đúng - Sai (DS): BẮT BUỘC TỐI THIỂU ${targets.targetDS} CÂU.** Mỗi câu phải có đủ ${targets.soY} ý nhỏ (a, b, c, d).` : ''}
        ${targets.targetTNgan > 0 ? `- **Trắc nghiệm Trả lời ngắn: BẮT BUỘC TỐI THIỂU ${targets.targetTNgan} CÂU.**` : ''}
        ${targets.targetTL > 0 ? `- **Tự luận (TL): BẮT BUỘC TỐI THIỂU ${targets.targetTL} CÂU.**` : ''}
        - **TỔNG CỘNG TOÀN BỘ NGÂN HÀNG: BẮT BUỘC SOẠN ĐỦ TỐI THIỂU ${targets.totalTarget} CÂU HỎI.**
        
        --- CHI TIẾT SỐ LƯỢNG TỐI THIỂU CẦN SOẠN CHO TỪNG BÀI HỌC (BẮT BUỘC TUÂN THỦ) ---
        ${targets.breakdownText}

        --- CHỈ THỊ ĐẶC BIỆT DÀNH CHO MODEL AI (CỰC KỲ QUAN TRỌNG ĐỂ KHÔNG BỊ CẮT NGẮN CÂU HỎI) ---
        - **CẤM TUYỆT ĐỐI VIỆC DỪNG SỚM HOẶC RÚT GỌN:** Hạn mức xuất đã được mở rộng tối đa (65,536 tokens). Bạn CÓ THỪA BỘ NHỚ để xuất trọn vẹn toàn bộ ${targets.totalTarget} câu hỏi.
        - **BẮT BUỘC SOẠN TỪ ĐẦU ĐẾN CUỐI:** Soạn đầy đủ từng câu hỏi kèm 4 phương án (với trắc nghiệm) hoặc các phát biểu và đáp án chi tiết. Không được dừng nửa chừng, không được tóm tắt.
        - **TÍNH ĐỘC LẬP TỪNG CÂU:** Mỗi câu hỏi phải là một câu hoàn chỉnh, không được dùng các câu viết tắt như "Tương tự bài 1...", "Xem lại câu trước...", v.v.

        --- QUY TẮC CHUNG TẠO CÂU HỎI (RẤT QUAN TRỌNG) ---
        1.  **Bám sát Đặc tả và Ma trận:** Tạo câu hỏi cho TẤT CẢ các nội dung/chủ đề được liệt kê trong bản đặc tả và ma trận. "Yêu cầu cần đạt" trong bản đặc tả là kim chỉ nam cho nội dung câu hỏi.
        2.  **Hình thức câu hỏi:** Chỉ tạo các loại câu hỏi (Trắc nghiệm nhiều lựa chọn - TN, Đúng-Sai - DS, Trả lời ngắn - TNgan, Tự luận - TL) được chỉ định trong bản đặc tả. Nếu tổng số câu của một hình thức nào đó trong toàn bộ bản đặc tả là 0, thì TUYỆT ĐỐI KHÔNG được tạo ra bất kỳ câu hỏi nào thuộc hình thức đó.
        3.  **Bao phủ mức độ:** Câu hỏi phải bao quát đủ các mức độ (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao) như đã được phân bổ trong bản đặc tả.
        4.  **Nội dung từ SGK:** Tất cả nội dung câu hỏi và đáp án phải được lấy từ file SÁCH GIÁO KHOA đã cung cấp.
        5.  **Đáp án chi tiết:** Cung cấp đáp án CHI TIẾT và RÕ RÀNG cho TẤT CẢ các câu hỏi. Đối với câu tự luận, hãy cung cấp hướng dẫn chấm điểm cơ bản.
        
        --- QUY TẮC VỀ KÝ HIỆU TOÁN HỌC (CỰC KỲ QUAN TRỌNG) ---
        6. **TUYỆT ĐỐI KHÔNG** sử dụng ký hiệu $ cho văn bản thông thường. 
        7. **CHỈ SỬ DỤNG** cú pháp LaTeX ($...$ cho nội dòng, $$...$$ cho khối) cho các công thức toán học, vật lý, hóa học thực sự. Nếu nội dung là chữ viết bình thường, hãy để ở dạng văn bản thuần túy.
        
        --- QUY TẮC RIÊNG CHO CÂU TRẮC NGHIỆM TIẾT KIỆM GIẤY (ĐỊNH DẠNG XUẤT WORD) ---
        8. **Định dạng lựa chọn (A, B, C, D) - QUAN TRỌNG:** 
           - **TUYỆT ĐỐI KHÔNG** sử dụng CSS Flexbox (display: flex) vì Word không hỗ trợ.
           - **BẮT BUỘC** trình bày 4 phương án A, B, C, D theo cấu trúc **2 dòng 2 cột**. TUYỆT ĐỐI KHÔNG dàn hàng ngang 4 cột.
           - Cấu trúc HTML bắt buộc cho 2 dòng (2 cột):
             \`<table style="width:100%; border:none; table-layout:fixed;"><tr><td style="border:none; width:50%;">A. ...</td><td style="border:none; width:50%;">B. ...</td></tr><tr><td style="border:none; width:50%;">C. ...</td><td style="border:none; width:50%;">D. ...</td></tr></table>\`
           - Nếu đáp án rất dài, mỗi đáp án một dòng (không dùng table hoặc table 1 cột).

        9. **XÁO TRỘN ĐÁP ÁN ĐÚNG NGẪU NHIÊN (CỰC KỲ QUAN TRỌNG - KHÔNG ĐƯỢC LƯỜI):** 
           - Đối với các câu hỏi trắc nghiệm nhiều lựa chọn (TN), bạn PHẢI **xáo trộn vị trí đáp án đúng một cách ngẫu nhiên tuyệt đối** giữa các phương án A, B, C, D.
           - **TUYỆT ĐỐI CẤM:** Không được để đáp án đúng tập trung vào một chữ cái cụ thể (như B hoặc A) cho nhiều câu hỏi liên tiếp. Tránh các quy luật dễ đoán.
           - **YÊU CẦU PHÂN BỔ ĐỀU:** Bạn phải phân bổ đáp án đúng sao cho tỷ lệ các phương án A, B, C, D được chọn làm đáp án đúng là xấp xỉ ngang nhau (khoảng 25% cho mỗi chữ cái) xuyên suốt từ đầu đến cuối bộ câu hỏi.
           - **PHẢI KIỂM TRA LẠI TỔNG THỂ:** Trước khi hoàn tất, hãy đếm lại số lượng đáp án A, B, C, D. Nếu một chữ cái chiếm quá 35% tổng số câu hỏi trắc nghiệm, bạn PHẢI hoán vị lại vị trí đáp án của các câu hỏi để đưa tỷ lệ về mức cân bằng.

        --- QUY TẮC RIÊNG CHO CÂU HỎI ĐÚNG/SAI (CỰC KỲ QUAN TRỌNG) ---
        10.  Mỗi câu hỏi dạng Đúng/Sai PHẢI bao gồm một câu dẫn chung và chính xác **${soCauNho}** câu phát biểu nhỏ (đánh dấu a, b, c, d, ...). Người học sẽ đánh giá từng phát biểu là Đúng hay Sai.
        11. **CÂN BẰNG ĐÁP ÁN:** Trong một câu hỏi Đúng/Sai, các câu phát biểu nhỏ PHẢI có cả đáp án "Đúng" và "Sai". TUYỆT ĐỐI không được tạo ra một câu hỏi mà tất cả các phát biểu nhỏ đều là "Đúng" hoặc tất cả đều là "Sai".
        12. **Ví dụ về định dạng HTML bắt buộc cho câu Đúng/Sai (với ${soCauNho} câu nhỏ):**
            \`\`\`html
            <p><strong>Câu 2 (NB):</strong> Dựa vào kiến thức đã học, hãy cho biết các phát biểu sau đây đúng hay sai:</p>
            ${exampleStatements}
            <div class="answer">
                <strong>Đáp án:</strong>
                ${exampleAnswers}
            </div>
            \`\`\`
        
        --- QUY TẮC RIÊNG CHO CÂU HỎI TRẢ LỜI NGẮN ---
        13. Mỗi câu hỏi Trả lời ngắn yêu cầu người học điền một từ, cụm từ, hoặc số vào chỗ trống.
        14. **Ví dụ về định dạng HTML bắt buộc cho câu Trả lời ngắn:**
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
        -   Các lựa chọn trắc nghiệm PHẢI sử dụng thẻ TABLE như hướng dẫn ở mục 9.
        -   **QUAN TRỌNG:** Đáp án phải được đặt ngay sau câu hỏi và nằm trong một thẻ '<div>' với class là '"answer"'. Ví dụ: '<div class="answer"><strong>Đáp án:</strong> A. Lựa chọn A.</div>'.

        --- CẤM TUYỆT ĐỐI ---
        - TUYỆT ĐỐI KHÔNG ghi các lời chào, giới thiệu, dẫn dắt, giải thích hoặc kết luận ở đầu và cuối phản hồi (ví dụ: "Dưới đây là...", "Bộ câu hỏi này...", "Hy vọng nó hữu ích..."). 
        - Phản hồi CHỈ được phép chứa duy nhất nội dung HTML của các câu hỏi và đáp án theo đúng định dạng đã yêu cầu.
        - TUYỆT ĐỐI KHÔNG DỪNG LẠI KHI CHƯA VIẾT ĐỦ ${targetTotal} CÂU HỎI.
    `;

  // --- SỬ DỤNG callWithRetry VỚI MAXOUTPUTTOKENS LỚN ĐẢM BẢO KHÔNG BỊ CẮT XÉN ---
  const response = await callWithRetry<GenerateContentResponse>(() => 
    getAiClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 65536,
        temperature: 0.7,
      }
    })
  );
  return response.text || "";
};

/**
 * Phân tích bảng ma trận HTML để lấy chính xác số lượng câu hỏi từng phần
 */
export const extractCountsFromMatrixHtml = (matrixHtml: string, soY: number = 4) => {
  if (!matrixHtml) return null;
  try {
    const rowMatch = matrixHtml.match(/<tr[^>]*>[\s\S]*?Tổng\s*\(Số câu[\s\S]*?<\/tr>/i);
    if (!rowMatch) return null;

    const tdMatches = [...rowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].trim());
    if (tdMatches.length >= 13) {
      const parseCount = (str: string) => {
        const match = str.match(/\((\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const tn = parseCount(tdMatches[1]) + parseCount(tdMatches[2]) + parseCount(tdMatches[3]);
      const dsY = parseCount(tdMatches[4]) + parseCount(tdMatches[5]) + parseCount(tdMatches[6]);
      const tngan = parseCount(tdMatches[7]) + parseCount(tdMatches[8]) + parseCount(tdMatches[9]);
      const tl = parseCount(tdMatches[10]) + parseCount(tdMatches[11]) + parseCount(tdMatches[12]);

      const dsCau = soY > 0 ? Math.round(dsY / soY) : 0;
      return { tn, dsCau, dsY, tngan, tl };
    }
  } catch (e) {
    console.warn("Lỗi khi trích xuất số lượng câu hỏi từ HTML ma trận:", e);
  }
  return null;
};

/**
 * Tạo một đề thi đơn lẻ.
 */
const generateSingleExam = async (
  index: number,
  reviewText: string,
  matrixText: string,
  sgkText: string,
  similarityPercentage: number,
  examTemplateContent?: string,
  matrixConfigOrSoY?: MatrixConfig | number,
  examTitle?: string,
  schoolYear?: string,
  previousExams: string[] = []
): Promise<string> => {
  const model = currentAiModel;

  const isConfigObj = typeof matrixConfigOrSoY === 'object' && matrixConfigOrSoY !== null;
  const config = isConfigObj ? (matrixConfigOrSoY as MatrixConfig) : null;
  const soY = config?.soYTrongCauDungSai || (typeof matrixConfigOrSoY === 'number' ? matrixConfigOrSoY : 4);
  const isTuLuan100 = !!config?.isTuLuan100;

  const htmlCounts = extractCountsFromMatrixHtml(matrixText, soY);

  // Ưu tiên 100% config do người dùng cấu hình (từ Tab 1 hoặc Tab 3). Chỉ dùng htmlCounts nếu config không tồn tại.
  const soCauNhieuLuaChon = (config && Number(config.soCauNhieuLuaChon) > 0)
    ? Number(config.soCauNhieuLuaChon)
    : (htmlCounts && htmlCounts.tn > 0 ? htmlCounts.tn : 12);

  const soCauDungSai = (config && config.soCauDungSai !== undefined && config.soCauDungSai !== null && Number(config.soCauDungSai) >= 0)
    ? Number(config.soCauDungSai)
    : (htmlCounts && htmlCounts.dsCau > 0 ? htmlCounts.dsCau : 2);

  const soCauTraLoiNgan = (config && config.soCauTraLoiNgan !== undefined && config.soCauTraLoiNgan !== null && Number(config.soCauTraLoiNgan) >= 0)
    ? Number(config.soCauTraLoiNgan)
    : (htmlCounts && htmlCounts.tngan > 0 ? htmlCounts.tngan : 0);

  const soCauTuLuan = (config && config.soCauTuLuan !== undefined && config.soCauTuLuan !== null && Number(config.soCauTuLuan) >= 0)
    ? Number(config.soCauTuLuan)
    : (htmlCounts && htmlCounts.tl > 0 ? htmlCounts.tl : (isTuLuan100 ? 10 : 0));

  const diemCauNhieuLuaChon = config?.diemCauNhieuLuaChon ?? 0.25;
  const diemMoiY = config?.diemMoiYTrongCauDungSai ?? 0.25;
  const diem1CauDS = soY * diemMoiY;
  const diemCauTraLoiNgan = config?.diemCauTraLoiNgan ?? 0.25;
  const diemCauTuLuan = config?.diemCauTuLuan ?? 1.0;

  const tongDiemNLC = soCauNhieuLuaChon * diemCauNhieuLuaChon;
  const tongDiemDS = soCauDungSai * diem1CauDS;
  const tongDiemTNgan = soCauTraLoiNgan * diemCauTraLoiNgan;
  const tongDiemTL = soCauTuLuan * diemCauTuLuan;

  const sgkSection = sgkText ? fileToText(sgkText, "Sách giáo khoa (Bổ trợ nếu ngân hàng câu hỏi thiếu)") : "";

  let distinctExamInstruction = '';
  if (index === 1) {
    distinctExamInstruction = `
        --- MỤC TIÊU CỦA ĐỀ SỐ 1: ---
        - Đây là ĐỀ SỐ 1. Hãy lựa chọn các câu hỏi phù hợp nhất từ "NGÂN HÀNG CÂU HỎI" theo đúng ma trận.
        - Hãy ưu tiên chọn các câu hỏi ở nửa đầu của từng bài/chủ đề trong ngân hàng để dành nửa sau cho Đề số 2.
    `;
  } else if (index === 2) {
    const prevExamSnippet = previousExams[0] ? previousExams[0].substring(0, 10000) : '';
    distinctExamInstruction = `
        --- NGUYÊN TẮC BẮT BUỘC CHO ĐỀ SỐ 2 (KHÁC BIỆT HOÀN TOÀN VỚI ĐỀ 1): ---
        - DƯỚI ĐÂY LÀ ĐỀ SỐ 1 ĐÃ ĐƯỢC TẠO:
        [BẮT ĐẦU ĐỀ SỐ 1]
        ${prevExamSnippet}
        [KẾT THÚC ĐỀ SỐ 1]
        
        - **BẮT BUỘC KHÁC NHAU 100%:** Bạn PHẢI chọn các câu hỏi trong "NGÂN HÀNG CÂU HỎI" mà CHƯA TỪNG ĐƯỢC DÙNG trong Đề số 1 ở trên.
        - **TUYỆT ĐỐI KHÔNG ĐƯỢC TRÙNG LẶP:** Không được chọn lại bất kỳ câu hỏi nào (cả câu trắc nghiệm nhiều lựa chọn, câu đúng sai, câu trả lời ngắn, tự luận) đã xuất hiện trong Đề số 1.
        - Vì số lượng câu hỏi trong Ngân hàng câu hỏi gấp tới 2.5 lần ma trận, nên ngân hàng luôn có đủ 100% câu hỏi mới chưa dùng để Đề 2 KHÁC BIỆT HOÀN TOÀN so với Đề 1!
    `;
  } else if (index >= 3) {
    const prevSnippets = previousExams.map((ex, idx) => `=== ĐỀ SỐ ${idx + 1} ===\n${ex.substring(0, 5000)}`).join('\n\n');
    distinctExamInstruction = `
        --- NGUYÊN TẮC BẮT BUỘC CHO ĐỀ SỐ ${index}: ---
        - CÁC ĐỀ ĐÃ TẠO TRƯỚC ĐÓ:
        ${prevSnippets}

        - **NGUYÊN TẮC CHỌN CÂU HỎI CHO ĐỀ SỐ ${index}:**
          1. Trước tiên, hãy ưu tiên chọn tất cả các câu hỏi CÒN LẠI trong "NGÂN HÀNG CÂU HỎI" mà chưa được sử dụng trong Đề 1 và Đề 2.
          2. Số lượng câu hỏi còn thiếu để đủ ma trận, bạn ĐƯỢC PHÉP lấy một số câu hỏi từ Đề 1 và Đề 2 để trộn lại.
          3. BẮT BUỘC: Đối với tất cả câu hỏi được chọn vào Đề số ${index}, bạn PHẢI xáo trộn vị trí thứ tự câu hỏi và hoán vị ngẫu nhiên thứ tự các phương án A, B, C, D để tạo thành một đề thi mới độc lập.
    `;
  }

  const similarityInstruction = `
        --- QUY TẮC VỀ NGUỒN CÂU HỎI (CỰC KỲ QUAN TRỌNG) ---
        -   TOÀN BỘ câu hỏi PHẢI được lấy từ "NGÂN HÀNG CÂU HỎI" đã cung cấp.
        ${distinctExamInstruction}
        -   Tuyệt đối không sử dụng các nguồn kiến thức bên ngoài nếu không có trong ngân hàng câu hỏi.
    `;

  let formatInstruction = '';
  const titleHeader = [
    examTitle ? `ĐỀ KIỂM TRA ${examTitle.toUpperCase()}` : 'ĐỀ KIỂM TRA',
    schoolYear ? `NĂM HỌC ${schoolYear}` : ''
  ].filter(Boolean).join(' - ');

  if (examTemplateContent) {
    formatInstruction = `
            --- QUY TẮC ĐỊNH DẠNG (CỰC KỲ QUAN TRỌNG) ---
            1.  **SỬ DỤNG MẪU HTML:** Bạn PHẢI sử dụng đoạn mã HTML trong "FILE MẪU (HTML)" dưới đây làm khuôn mẫu TUYỆT ĐỐI cho đề thi này.
            2.  **BẢO TOÀN CẤU TRÚC:** Đầu ra của bạn phải là một chuỗi HTML hoàn chỉnh. TUYỆT ĐỐI không được thay đổi cấu trúc, các thẻ HTML (<table>, <div>, <p>, <span>), các class, hoặc style inline của file mẫu. Hãy giữ nguyên định dạng y hệt.
            3.  **THAY THẾ NỘI DUNG:** Tìm các vị trí giữ chỗ (placeholders) trong file mẫu và thay thế chúng bằng câu hỏi và đáp án tương ứng. Cập nhật đúng Tiêu đề kỳ kiểm tra (${examTitle || ''}), Năm học (${schoolYear || ''}) và Đề số (${index}) vào phần thông tin đầu trang.
            4.  **SỐ LƯỢNG CÂU HỎI:** Bắt buộc tuân thủ đúng ${soCauNhieuLuaChon} câu Nhiều lựa chọn, ${soCauDungSai} câu Đúng-Sai, ${soCauTraLoiNgan} câu Trả lời ngắn, ${soCauTuLuan} câu Tự luận.
            
            --- FILE MẪU (HTML) ---
            ${examTemplateContent}
        `;
  } else {
    formatInstruction = `
            --- QUY TẮC ĐỊNH DẠNG ---
            Định dạng đầu ra phải là HTML.
            -   Đề thi phải có tiêu đề rõ ràng ở đầu trang (ví dụ: "${titleHeader} - ĐỀ SỐ ${index}").
            ${isTuLuan100 ? `
            -   Đề thi 100% tự luận: Ghi rõ tiêu đề "PHẦN TỰ LUẬN (${soCauTuLuan} câu - 10.0 điểm)".
            ` : `
            -   Chia rõ các phần chi tiết và BẮT BUỘC ghi rõ tiêu đề mỗi phần kèm theo "(Số câu hỏi - Tổng điểm)" CHÍNH XÁC như sau:
                ${soCauNhieuLuaChon > 0 ? `+ "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (${soCauNhieuLuaChon} câu - ${tongDiemNLC.toFixed(2)} điểm)"` : ''}
                ${soCauDungSai > 0 ? `+ "PHẦN II. Câu trắc nghiệm đúng sai (${soCauDungSai} câu - ${tongDiemDS.toFixed(2)} điểm)"` : ''}
                ${soCauTraLoiNgan > 0 ? `+ "PHẦN III. Câu trắc nghiệm trả lời ngắn (${soCauTraLoiNgan} câu - ${tongDiemTNgan.toFixed(2)} điểm)"` : ''}
                ${soCauTuLuan > 0 ? `+ "PHẦN IV. Tự luận (${soCauTuLuan} câu - ${tongDiemTL.toFixed(2)} điểm)"` : ''}
            `}
            -   Sau khi viết xong TOÀN BỘ các phần của đề thi, chèn ngắt trang \`<div style="page-break-before: always;"></div>\`, sau đó mới đến phần "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM" chi tiết gồm:
                ${soCauNhieuLuaChon > 0 ? `+ Bảng đáp án Phần I (gồm ${soCauNhieuLuaChon} câu).` : ''}
                ${soCauDungSai > 0 ? `+ Bảng đáp án Phần II (gồm ${soCauDungSai} câu lớn, mỗi câu có ${soY} ý a, b, c, d rõ Đúng/Sai).` : ''}
                ${soCauTraLoiNgan > 0 ? `+ Bảng đáp án Phần III (gồm ${soCauTraLoiNgan} câu ngắn).` : ''}
                ${soCauTuLuan > 0 ? `+ Đáp án và hướng dẫn chấm Phần IV (gồm ${soCauTuLuan} câu tự luận).` : ''}
        `;
  }

  const prompt = `
        Bạn là một AI chuyên tạo đề kiểm tra chất lượng cao. 
        Đây là đề thi số **${index}** trong bộ đề thi.
        ${distinctExamInstruction}

        --- NGUỒN DỮ LIỆU ---
        1.  **NGÂN HÀNG CÂU HỎI (NGUỒN CHÍNH):** ${reviewText}
        2.  **MA TRẬN ĐỀ KIỂM TRA (BẮT BUỘC TUÂN THỦ):** ${matrixText}
        ${sgkSection}
        
        ${similarityInstruction}

        ======================================================================
        CẤU TRÚC ĐỀ THI VÀ SỐ LƯỢNG CÂU HỎI BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ 100%)
        ======================================================================
        Đề thi BẮT BUỘC phải tạo ĐỦ và ĐÚNG TẤT CẢ các phần sau đây, TUYỆT ĐỐI KHÔNG ĐƯỢC THIẾU BẤT KỲ PHẦN NÀO:

        ${isTuLuan100 ? `
        - PHẦN TỰ LUẬN: CHÍNH XÁC ${soCauTuLuan} CÂU (Đánh số từ Câu 1 đến Câu ${soCauTuLuan}). Tổng điểm: 10.0 điểm.
        ` : `
        ${soCauNhieuLuaChon > 0 ? `
        PHẦN I: TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN
        - Tiêu đề bắt buộc: "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (${soCauNhieuLuaChon} câu - ${tongDiemNLC.toFixed(2)} điểm)"
        - Số lượng câu hỏi: CHÍNH XÁC ${soCauNhieuLuaChon} CÂU (Đánh số liên tục từ Câu 1 đến Câu ${soCauNhieuLuaChon}).
        - Mỗi câu có 4 phương án A, B, C, D (dạng table 2 dòng 2 cột) và chỉ 1 đáp án đúng.
        - Điểm: ${diemCauNhieuLuaChon} điểm/câu (Tổng: ${tongDiemNLC.toFixed(2)} điểm).
        ` : ''}

        ${soCauDungSai > 0 ? `
        PHẦN II: TRẮC NGHIỆM ĐÚNG SAI (BẮT BUỘC PHẢI CÓ TRONG ĐỀ THI)
        - Tiêu đề bắt buộc: "PHẦN II. Câu trắc nghiệm đúng sai (${soCauDungSai} câu - ${tongDiemDS.toFixed(2)} điểm)"
        - Số lượng câu hỏi: CHÍNH XÁC ${soCauDungSai} CÂU HỎI LỚN (Đánh số độc lập: từ Câu 1 đến Câu ${soCauDungSai}).
        - CẢNH BÁO CỰC KỲ QUAN TRỌNG: BẮT BUỘC TẠO ĐỦ ${soCauDungSai} CÂU HỎI LỚN! TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ QUA PHẦN NÀY!
        - Cấu trúc mỗi câu hỏi lớn: Gồm một câu dẫn và chính xác ${soY} ý nhỏ (đánh dấu a, b, c, d). Tổng cộng phần này có ${soCauDungSai * soY} ý nhỏ.
        - Điểm: Mỗi ý đúng ${diemMoiY} điểm (1 câu lớn = ${diem1CauDS.toFixed(2)} điểm; Tổng: ${tongDiemDS.toFixed(2)} điểm).
        ` : ''}

        ${soCauTraLoiNgan > 0 ? `
        PHẦN III: TRẮC NGHIỆM TRẢ LỜI NGẮN (BẮT BUỘC PHẢI CÓ TRONG ĐỀ THI)
        - Tiêu đề bắt buộc: "PHẦN III. Câu trắc nghiệm trả lời ngắn (${soCauTraLoiNgan} câu - ${tongDiemTNgan.toFixed(2)} điểm)"
        - Số lượng câu hỏi: CHÍNH XÁC ${soCauTraLoiNgan} CÂU (Đánh số độc lập: từ Câu 1 đến Câu ${soCauTraLoiNgan}).
        - CẢNH BÁO CỰC KỲ QUAN TRỌNG: BẮT BUỘC TẠO ĐỦ ${soCauTraLoiNgan} CÂU! TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ QUA PHẦN NÀY!
        - Điểm: ${diemCauTraLoiNgan} điểm/câu (Tổng: ${tongDiemTNgan.toFixed(2)} điểm).
        ` : ''}

        ${soCauTuLuan > 0 ? `
        PHẦN IV: TỰ LUẬN (BẮT BUỘC PHẢI CÓ TRONG ĐỀ THI)
        - Tiêu đề bắt buộc: "PHẦN IV. Tự luận (${soCauTuLuan} câu - ${tongDiemTL.toFixed(2)} điểm)"
        - Số lượng câu hỏi: CHÍNH XÁC ${soCauTuLuan} CÂU (Đánh số độc lập: từ Câu 1 đến Câu ${soCauTuLuan}).
        - CẢNH BÁO CỰC KỲ QUAN TRỌNG: BẮT BUỘC TẠO ĐỦ ${soCauTuLuan} CÂU TỰ LUẬN! TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ QUA PHẦN NÀY!
        - Điểm: ${diemCauTuLuan} điểm/câu (Tổng: ${tongDiemTL.toFixed(2)} điểm).
        ` : ''}
        `}

        --- THỨ TỰ TRÌNH BÀY NỘI DUNG ĐỀ THI (BẮT BUỘC TUÂN THỦ TỪNG BƯỚC) ---
        1. Tiêu đề: "${titleHeader} - ĐỀ SỐ ${index}".
        ${soCauNhieuLuaChon > 0 ? `2. Viết toàn bộ PHẦN I (${soCauNhieuLuaChon} câu trắc nghiệm nhiều lựa chọn).` : ''}
        ${soCauDungSai > 0 ? `3. Viết toàn bộ PHẦN II (${soCauDungSai} câu trắc nghiệm Đúng-Sai, mỗi câu có ${soY} ý a, b, c, d).` : ''}
        ${soCauTraLoiNgan > 0 ? `4. Viết toàn bộ PHẦN III (${soCauTraLoiNgan} câu trắc nghiệm Trả lời ngắn).` : ''}
        ${soCauTuLuan > 0 ? `5. Viết toàn bộ PHẦN IV (${soCauTuLuan} câu Tự luận).` : ''}
        6. KẾT THÚC CÂU HỎI ĐỀ THI -> Chèn ngắt trang: \`<div style="page-break-before: always;"></div>\`
        7. Sau đó mới viết tiêu đề: "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM":
           - Bảng đáp án trắc nghiệm Phần I (${soCauNhieuLuaChon} câu).
           ${soCauDungSai > 0 ? `- Bảng đáp án Đúng/Sai Phần II (${soCauDungSai} câu, các ý a, b, c, d).` : ''}
           ${soCauTraLoiNgan > 0 ? `- Bảng đáp án Trả lời ngắn Phần III (${soCauTraLoiNgan} câu).` : ''}
           ${soCauTuLuan > 0 ? `- Đáp án và hướng dẫn chấm Phần IV (${soCauTuLuan} câu tự luận).` : ''}
        
        CẢNH BÁO CỰC KỲ QUAN TRỌNG: TUYỆT ĐỐI KHÔNG ĐƯỢC chèn phần ĐÁP ÁN ngay sau Phần I! Phải viết tuần tự hết tất cả các phần câu hỏi (I, II, III, IV), rồi mới được viết phần ĐÁP ÁN ở cuối cùng!

        --- QUY TẮC ĐỊNH DẠNG (BẮT BUỘC) ---
        - BẮT BUỘC dùng HTML TABLE không viền (border="0") để trình bày 4 phương án A, B, C, D theo cấu trúc 2 dòng 2 cột.
        - ĐÁNH SỐ THỨ TỰ CÂU HỎI:
          ${soCauNhieuLuaChon > 0 ? `+ Phần I: Đánh số từ Câu 1 đến Câu ${soCauNhieuLuaChon}.` : ''}
          ${soCauDungSai > 0 ? `+ Phần II: Đánh số độc lập từ Câu 1 đến Câu ${soCauDungSai}.` : ''}
          ${soCauTraLoiNgan > 0 ? `+ Phần III: Đánh số độc lập từ Câu 1 đến Câu ${soCauTraLoiNgan}.` : ''}
          ${soCauTuLuan > 0 ? `+ Phần IV: Đánh số độc lập từ Câu 1 đến Câu ${soCauTuLuan}.` : ''}

        ${formatInstruction}

        --- ĐỊNH DẠNG ĐẦU RA (HTML THUẦN TÚY) ---
        TRẢ VỀ TRỰC TIẾP ĐOẠN MÃ HTML CỦA ĐỀ THI. KHÔNG BAO BỌC TRONG BẤT KỲ JSON NÀO, VÀ KHÔNG KÈM THEO LỜI GIẢI THÍCH.
    `;

  const response = await callWithRetry<GenerateContentResponse>(() => 
    getAiClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 65536,
      }
      // KHÔNG sử dụng responseMimeType: "application/json" ở đây để tránh lỗi escape HTML quá dài gây đứng chương trình
    })
  );

  let text = response.text || "";
  
  // Xóa các block markdown ```html ... ``` nếu có
  const htmlMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (htmlMatch && htmlMatch[1]) {
    text = htmlMatch[1].trim();
  } else {
    text = text.trim();
  }
  
  if (!text) {
    throw new Error(`Lỗi: AI trả về phản hồi rỗng cho đề số ${index}.`);
  }
  
  return text;
};

export const generateExams = async (
  reviewFileContent: string,
  matrix: string,
  sgkFileContent: string,
  similarityPercentage: number,
  examTemplateContent?: string,
  startIndex: number = 1,
  count: number = 3,
  matrixConfigOrSoY?: MatrixConfig | number,
  examTitle?: string,
  schoolYear?: string,
  existingExams: string[] = []
): Promise<string[]> => {
  const reviewText = fileToText(reviewFileContent, "Ngân hàng câu hỏi ôn tập");
  const matrixText = `--- BẮT ĐẦU MA TRẬN ---\n${matrix}\n--- KẾT THÚC MA TRẬN ---`;

  console.log(`Bắt đầu tạo ${count} đề thi tuần tự từ đề ${startIndex}...`);

  const exams: string[] = [];
  const allKnownExams: string[] = [...existingExams];
  const indices = Array.from({length: count}, (_, i) => startIndex + i);

  try {
    for (const i of indices) {
      console.log(`Đang tạo đề thi số ${i}...`);
      const exam = await generateSingleExam(
        i, 
        reviewText, 
        matrixText, 
        sgkFileContent, 
        similarityPercentage, 
        examTemplateContent, 
        matrixConfigOrSoY, 
        examTitle, 
        schoolYear,
        allKnownExams
      );
      exams.push(exam);
      allKnownExams.push(exam);
      console.log(`Đã hoàn thành đề thi số ${i}.`);
      // Delay 2 giây giữa các lần gọi để tránh rate limit (429)
      if (i < indices[indices.length - 1]) await wait(2000); 
    }
    return exams;
  } catch (error) {
    console.error("Lỗi khi tạo các đề thi:", error);
    throw error;
  }
};
