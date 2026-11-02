import JSZip from 'jszip';
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
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error('Không thể đọc file text.'));
    reader.readAsText(file, 'UTF-8');
  });
};

/**
 * Kiểm tra và trích xuất nội dung HTML từ file docx sử dụng altChunk (như file docx do hệ thống xuất ra).
 */
const extractHtmlFromDocxOrAltChunk = async (arrayBuffer: ArrayBuffer): Promise<string | null> => {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 1. Kiểm tra file word/afchunk.html hoặc bất kỳ biến thể afchunk nào
    const afchunkFile =
      zip.file('word/afchunk.html') ||
      zip.file(/^word\/afchunk\.(html?|htm)$/i)[0] ||
      zip.file(/afchunk\.(html?|htm)$/i)[0];

    if (afchunkFile) {
      const fullHtml = await afchunkFile.async('string');
      // Lấy nội dung bên trong thẻ body nếu có
      const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const content = bodyMatch ? bodyMatch[1].trim() : fullHtml.trim();
      if (content.length > 0) return content;
    }

    // 2. Kiểm tra nếu có afchunk.mht
    const mhtFile = zip.file('word/afchunk.mht') || zip.file(/afchunk\.mht$/i)[0];
    if (mhtFile) {
      const mhtContent = await mhtFile.async('string');
      const htmlMatch = mhtContent.match(/<html[\s\S]*?<\/html>/i);
      if (htmlMatch) {
        const fullHtml = htmlMatch[0].replace(/=3D/g, '=');
        const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const content = bodyMatch ? bodyMatch[1].trim() : fullHtml.trim();
        if (content.length > 0) return content;
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Fallback trích xuất văn bản từ word/document.xml nếu Mammoth không đọc được
 */
const extractTextFromDocXml = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return '';
    const xml = await docXmlFile.async('string');

    const pMatches = xml.match(/<w:p[\s\S]*?<\/w:p>/g);
    if (!pMatches) return '';

    const paragraphs: string[] = [];
    for (const pXml of pMatches) {
      const tMatches = pXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
      if (tMatches) {
        const text = tMatches.map((t) => t.replace(/<[^>]+>/g, '')).join('');
        if (text.trim()) paragraphs.push(text);
      }
    }
    return paragraphs.join('\n\n');
  } catch {
    return '';
  }
};

const readDocx = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // 1. Thử trích xuất từ altChunk nếu là file docx do app xuất
    const altChunkHtml = await extractHtmlFromDocxOrAltChunk(arrayBuffer);
    if (altChunkHtml) {
      if (typeof window !== 'undefined' && window.DOMParser) {
        const doc = new DOMParser().parseFromString(altChunkHtml, 'text/html');
        const text = doc.body.textContent || '';
        if (text.trim()) return text;
      }
      return altChunkHtml.replace(/<[^>]+>/g, ' ');
    }

    // 2. Thử dùng Mammoth
    const lib = typeof window !== 'undefined' && window.mammoth ? window.mammoth : mammoth;
    if (lib) {
      const result = await lib.extractRawText({ arrayBuffer });
      if (result && result.value && result.value.trim().length > 0) {
        return result.value;
      }
    }

    // 3. Fallback đọc document.xml bằng JSZip
    const fallbackText = await extractTextFromDocXml(arrayBuffer);
    if (fallbackText.trim()) return fallbackText;

    // 4. Nếu là file .doc (dạng HTML cũ)
    const asText = await readAsText(file);
    if (asText.includes('<html') || asText.includes('<table') || asText.includes('<p')) {
      const doc = new DOMParser().parseFromString(asText, 'text/html');
      return doc.body.textContent || asText.replace(/<[^>]+>/g, ' ');
    }

    return '';
  } catch (error) {
    console.error('Error reading docx/doc:', error);
    throw new Error(
      'Không thể đọc file Word. File có thể bị lỗi hoặc là định dạng không được hỗ trợ. Vui lòng thử lưu lại file dưới dạng .docx và tải lên lại.'
    );
  }
};

const readPdf = async (file: File): Promise<string> => {
  try {
    const lib = typeof window !== 'undefined' && window.pdfjsLib ? window.pdfjsLib : pdfjsLib;
    if (!lib) throw new Error('Thư viện PDF.js chưa được tải. Vui lòng kiểm tra kết nối mạng và tải lại trang.');
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
    console.error('Error reading pdf:', error);
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
    console.error('Error reading image:', error);
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
        const arrayBuffer = await file.arrayBuffer();

        // 1. Kiểm tra trước tiên: Nếu là file .docx do app xuất (có chứa altChunk HTML)
        const altChunkHtml = await extractHtmlFromDocxOrAltChunk(arrayBuffer);
        if (altChunkHtml && altChunkHtml.trim().length > 0) {
          console.log('Phát hiện và trích xuất thành công nội dung HTML từ file docx altChunk!');
          return altChunkHtml;
        }

        // 2. Thử kiểm tra nếu file .doc thực chất là file HTML (phiên bản trước của app xuất dạng HTML mang đuôi .doc)
        const rawText = await readAsText(file);
        if (rawText && (rawText.includes('<html') || rawText.includes('<table') || rawText.includes('<p') || rawText.includes('<div'))) {
          const bodyMatch = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          return bodyMatch ? bodyMatch[1].trim() : rawText.trim();
        }

        // 3. Sử dụng Mammoth để convert docx thông thường sang HTML
        const lib = typeof window !== 'undefined' && window.mammoth ? window.mammoth : mammoth;
        if (lib) {
          const result = await lib.convertToHtml({ arrayBuffer });
          if (result && result.value && result.value.trim().length > 0) {
            return result.value;
          }
        }

        // 4. Fallback: Nếu Mammoth không đọc được (hoặc trả về rỗng), trích xuất văn bản từ document.xml
        const fallbackText = await extractTextFromDocXml(arrayBuffer);
        if (fallbackText && fallbackText.trim().length > 0) {
          const paragraphs = fallbackText.split('\n\n');
          return paragraphs.map((p) => `<p>${p.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('\n');
        }

        throw new Error('File Word rỗng hoặc không có nội dung văn bản.');
      } catch (error) {
        console.error('Error converting docx to HTML:', error);
        throw new Error(
          'Không thể chuyển đổi file Word sang HTML. ' + (error instanceof Error ? error.message : 'Vui lòng kiểm tra lại file.')
        );
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
