
// Khai báo biến toàn cục để TypeScript không báo lỗi
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
  }
}

// Lấy thư viện từ window (đã được load qua CDN ở index.html)
const pdfjsLib = window.pdfjsLib;
const mammoth = window.mammoth;

// Cấu hình worker cho thư viện pdf.js (sử dụng phiên bản tương thích với bản CDN 3.11.174)
if (pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

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
        if (!mammoth) throw new Error("Thư viện Mammoth chưa được tải.");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error("Error reading docx/doc:", error);
        throw new Error("Không thể đọc file Word. File có thể bị lỗi hoặc là định dạng .doc cũ không được hỗ trợ. Vui lòng thử lưu lại file dưới dạng .docx và tải lên lại.");
    }
};

const readPdf = async (file: File): Promise<string> => {
    try {
        if (!pdfjsLib) throw new Error("Thư viện PDF.js chưa được tải.");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // textContent.items can contain objects with 'str' or other properties. We only care about 'str'.
            const pageText = textContent.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
            // Thêm dấu hiệu trang rõ ràng để AI có thể nhận biết và lọc nội dung
            fullText += `\n\n--- TRANG ${i} ---\n\n` + pageText;
        }
        return fullText;
    } catch (error) {
        console.error("Error reading pdf:", error);
        throw new Error("Không thể đọc nội dung từ file PDF.");
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
                if (!mammoth) throw new Error("Thư viện Mammoth chưa được tải.");
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                return result.value; // The result is the HTML
            } catch (error) {
                console.error("Error converting docx to HTML:", error);
                throw new Error("Không thể chuyển đổi file Word sang HTML. File có thể bị lỗi hoặc là định dạng .doc cũ không được hỗ trợ. Vui lòng thử lưu lại file dưới dạng .docx và tải lên lại.");
            }
        case 'txt':
        case 'md':
            const text = await readAsText(file);
             // Escape HTML characters to display them literally inside <pre>
            const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre>${escapedText}</pre>`;
        
        case 'pdf':
             const pdfText = await readPdf(file);
             const escapedPdfText = pdfText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
             return `<pre>${escapedPdfText}</pre>`;
        
        default:
             throw new Error(`Định dạng file .${extension} không được hỗ trợ cho mẫu đề thi.`);
    }
};
