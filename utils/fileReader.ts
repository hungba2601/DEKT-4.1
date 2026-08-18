import { ocrImage } from '../services/geminiService';

// Khai báo biến toàn cục để TypeScript không báo lỗi
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
  }
}

// Lấy thư viện từ window (đã được load qua CDN ở index.html)
const pdfjsLib = typeof window !== 'undefined' ? window.pdfjsLib : null;
const mammoth = typeof window !== 'undefined' ? window.mammoth : null;

// Cấu hình worker cho thư viện pdf.js (sử dụng phiên bản tương thích với bản CDN 3.11.174)
if (typeof window !== 'undefined' && window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu file ảnh.'));
    reader.readAsDataURL(file);
  });
};

const readAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Không thể đọc file text.'));
    reader.readAsText(file);
  });
};

const readDocx = async (file: File): Promise<string> => {
  try {
    const lib = (typeof window !== 'undefined' && window.mammoth) ? window.mammoth : mammoth;
    if (!lib) throw new Error("Thư viện Mammoth chưa được tải.");
    const arrayBuffer = await file.arrayBuffer();
    const result = await lib.extractRawText({ arrayBuffer });
    return result.value || '';
  } catch (error) {
    console.error("Error reading docx/doc:", error);
    throw new Error("Không thể đọc file Word. File có thể bị lỗi hoặc là định dạng .doc cũ không được hỗ trợ. Vui lòng thử lưu lại file dưới dạng .docx và tải lên lại.");
  }
};

const readPdf = async (file: File): Promise<string> => {
  try {
    const lib = (typeof window !== 'undefined' && window.pdfjsLib) ? window.pdfjsLib : pdfjsLib;
    if (!lib) throw new Error("Thư viện PDF.js chưa được tải. Vui lòng kiểm tra kết nối mạng và tải lại trang.");
    if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
      fullText += `\n\n--- TRANG ${i} ---\n\n` + pageText;
    }
    return fullText;
  } catch (error: any) {
    console.error("Error reading pdf:", error);
    throw new Error(`Không thể đọc nội dung từ file PDF "${file.name}". Lỗi: ${error.message || error}`);
  }
};

const readImage = async (file: File): Promise<string> => {
  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';
    const text = await ocrImage(base64Data, mimeType, file.name);
    return text;
  } catch (error: any) {
    console.error("Error reading image:", error);
    throw new Error(`Không thể nhận diện nội dung từ ảnh "${file.name}": ${error.message || 'Lỗi xử lý ảnh.'}`);
  }
};

export const readFileContent = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
    case 'md':
      return readAsText(file);
    case 'doc':
    case 'docx':
      return readDocx(file);
    case 'pdf':
      return readPdf(file);
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'bmp':
      return readImage(file);
    default:
      throw new Error(`Định dạng file .${extension} không được hỗ trợ.`);
  }
};

export const convertFileToHtml = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'doc':
    case 'docx':
      try {
        const lib = (typeof window !== 'undefined' && window.mammoth) ? window.mammoth : mammoth;
        if (!lib) throw new Error("Thư viện Mammoth chưa được tải.");
        const arrayBuffer = await file.arrayBuffer();
        const result = await lib.convertToHtml({ arrayBuffer });
        return result.value;
      } catch (error) {
        console.error("Error converting docx to HTML:", error);
        throw new Error("Không thể chuyển đổi file Word sang HTML. File có thể bị lỗi hoặc là định dạng .doc cũ không được hỗ trợ. Vui lòng thử lưu lại file dưới dạng .docx và tải lên lại.");
      }
    case 'txt':
    case 'md': {
      const text = await readAsText(file);
      const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre>${escapedText}</pre>`;
    }
    case 'pdf': {
      const pdfText = await readPdf(file);
      const escapedPdfText = pdfText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre>${escapedPdfText}</pre>`;
    }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'bmp': {
      const imageText = await readImage(file);
      const escapedImageText = imageText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre>${escapedImageText}</pre>`;
    }
    default:
      throw new Error(`Định dạng file .${extension} không được hỗ trợ cho mẫu đề thi.`);
  }
};
