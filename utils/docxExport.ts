import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  PageOrientation,
  ShadingType,
  VerticalAlign,
} from 'docx';

export interface DocxExportOptions {
  orientation?: 'portrait' | 'landscape';
  title?: string;
  margins?: {
    top?: number;    // in dxa (1mm ~ 56.7 dxa)
    bottom?: number;
    left?: number;
    right?: number;
  };
  fontSize?: number;
  fontFamily?: string;
}

const DEFAULT_FONT = 'Times New Roman';

// Định nghĩa không viền tuyệt đối cho bảng và ô
const NO_BORDER_DEF = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'auto',
};

const NO_TABLE_BORDERS = {
  top: NO_BORDER_DEF,
  bottom: NO_BORDER_DEF,
  left: NO_BORDER_DEF,
  right: NO_BORDER_DEF,
  insideHorizontal: NO_BORDER_DEF,
  insideVertical: NO_BORDER_DEF,
};

const NO_CELL_BORDERS = {
  top: NO_BORDER_DEF,
  bottom: NO_BORDER_DEF,
  left: NO_BORDER_DEF,
  right: NO_BORDER_DEF,
};

// Định nghĩa viền đơn đen chuẩn cho bảng ma trận, đặc tả, đáp án
const SOLID_BORDER_DEF = {
  style: BorderStyle.SINGLE,
  size: 4, // 0.5 pt
  color: '000000',
};

const SOLID_TABLE_BORDERS = {
  top: SOLID_BORDER_DEF,
  bottom: SOLID_BORDER_DEF,
  left: SOLID_BORDER_DEF,
  right: SOLID_BORDER_DEF,
  insideHorizontal: SOLID_BORDER_DEF,
  insideVertical: SOLID_BORDER_DEF,
};

const SOLID_CELL_BORDERS = {
  top: SOLID_BORDER_DEF,
  bottom: SOLID_BORDER_DEF,
  left: SOLID_BORDER_DEF,
  right: SOLID_BORDER_DEF,
};

// Độ rộng cột chuẩn xác cho Bảng Ma trận (18 cột) trên khổ ngang A4 (~15250 dxa)
// Cột 1 (Nội dung/đơn vị kiến thức) rộng tới 3600 dxa (~6.35 cm) để tên bài học thoáng đẹp!
const MATRIX_18_COL_WIDTHS = [
  500,  // Cột 0: TT (0.88 cm)
  3600, // Cột 1: Nội dung / đơn vị kiến thức (6.35 cm) - RỘNG RÃI
  650,  // Cột 2: Nhiều lựa chọn - Biết (1.15 cm)
  650,  // Cột 3: Nhiều lựa chọn - Hiểu (1.15 cm)
  650,  // Cột 4: Nhiều lựa chọn - Vận dụng (1.15 cm)
  850,  // Cột 5: Đúng - Sai - Biết (1.50 cm)
  850,  // Cột 6: Đúng - Sai - Hiểu (1.50 cm)
  850,  // Cột 7: Đúng - Sai - Vận dụng (1.50 cm)
  650,  // Cột 8: Trả lời ngắn - Biết (1.15 cm)
  650,  // Cột 9: Trả lời ngắn - Hiểu (1.15 cm)
  650,  // Cột 10: Trả lời ngắn - Vận dụng (1.15 cm)
  650,  // Cột 11: Tự luận - Biết (1.15 cm)
  650,  // Cột 12: Tự luận - Hiểu (1.15 cm)
  650,  // Cột 13: Tự luận - Vận dụng (1.15 cm)
  800,  // Cột 14: Tổng Biết (1.41 cm)
  800,  // Cột 15: Tổng Hiểu (1.41 cm)
  800,  // Cột 16: Tổng Vận dụng (1.41 cm)
  750,  // Cột 17: Tỉ lệ % điểm (1.32 cm)
];

// Độ rộng cột chuẩn xác cho Bảng Bản đặc tả (16 cột) trên khổ ngang A4 (~15200 dxa)
const SPEC_16_COL_WIDTHS = [
  500,  // Cột 0: TT (0.88 cm)
  2200, // Cột 1: Chủ đề / Chương (3.88 cm)
  2800, // Cột 2: Nội dung / đơn vị kiến thức (4.94 cm)
  3700, // Cột 3: Yêu cầu cần đạt (6.53 cm) - RẤT RỘNG
  500,  // Cột 4..15: 12 cột mức độ đánh giá (mỗi cột 500 dxa)
  500,
  500,
  500,
  500,
  500,
  500,
  500,
  500,
  500,
  500,
  500,
];

/**
 * Trích xuất TextRun từ một phần tử DOM inline
 */
const extractRunsFromNode = (
  node: Node,
  defaultSize: number = 24,
  parentFormat: { bold?: boolean; italic?: boolean; underline?: boolean; color?: string } = {}
): TextRun[] => {
  const runs: TextRun[] = [];

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (text) {
      runs.push(
        new TextRun({
          text,
          font: DEFAULT_FONT,
          size: defaultSize,
          bold: parentFormat.bold,
          italics: parentFormat.italic,
          underline: parentFormat.underline ? {} : undefined,
          color: parentFormat.color,
        })
      );
    }
    return runs;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toUpperCase();

    if (tagName === 'BR') {
      runs.push(new TextRun({ text: '', break: 1 }));
      return runs;
    }

    const currentFormat = {
      bold: parentFormat.bold || tagName === 'STRONG' || tagName === 'B' || el.style.fontWeight === 'bold' || el.classList.contains('font-bold'),
      italic: parentFormat.italic || tagName === 'EM' || tagName === 'I' || el.style.fontStyle === 'italic' || el.classList.contains('font-italic'),
      underline: parentFormat.underline || tagName === 'U' || el.style.textDecoration === 'underline',
      color: parentFormat.color || (el.style.color ? el.style.color.replace('#', '') : undefined),
    };

    for (let i = 0; i < el.childNodes.length; i++) {
      runs.push(...extractRunsFromNode(el.childNodes[i], defaultSize, currentFormat));
    }
  }

  return runs;
};

/**
 * Xác định căn lề của element
 */
const getAlignment = (
  el: HTMLElement,
  defaultAlign: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
): (typeof AlignmentType)[keyof typeof AlignmentType] => {
  const textAlign = (el.style.textAlign || '').toLowerCase();
  const className = el.className || '';

  if (textAlign === 'left' || className.includes('text-left') || el.getAttribute('align') === 'left') {
    return AlignmentType.LEFT;
  }
  if (textAlign === 'center' || className.includes('text-center') || el.getAttribute('align') === 'center') {
    return AlignmentType.CENTER;
  }
  if (textAlign === 'right' || className.includes('text-right') || el.getAttribute('align') === 'right') {
    return AlignmentType.RIGHT;
  }
  if (textAlign === 'justify' || className.includes('text-justify')) {
    return AlignmentType.JUSTIFIED;
  }
  return defaultAlign;
};

/**
 * Chuyển đổi một thẻ <table> sang đối tượng Table native của docx.
 * - Bảng trắc nghiệm A, B, C, D TUYỆT ĐỐI KHÔNG CÓ VIỀN!
 * - Bảng Ma trận (18 cột) và Bản đặc tả (16 cột) được căn độ rộng từng cột chuẩn xác!
 * - Hàng Tổng và Tỉ lệ % của Ma trận được IN ĐẬM VÀ CĂN GIỮA ĐẸP MẮT!
 */
const parseHtmlTableToDocx = (
  tableEl: HTMLTableElement,
  isLandscape: boolean
): Table => {
  const allRowsEl = Array.from(tableEl.querySelectorAll('tr'));
  const cellElements = Array.from(tableEl.querySelectorAll('th, td'));
  const cellTexts = cellElements.map(td => (td.textContent || '').trim());

  // 1. Kiểm tra bảng phương án trắc nghiệm A, B, C, D
  const hasChoiceLetters = cellTexts.some(txt => /^[A-D][\.\)]\s*/i.test(txt));

  // 2. Kiểm tra bảng đáp án trắc nghiệm ở cuối đề thi
  const isAnswerKeyTable =
    tableEl.classList.contains('answer-key-table') ||
    tableEl.classList.contains('bordered') ||
    cellTexts.some(txt => /^(Câu|Đáp án|Phần)/i.test(txt) && cellTexts.length > 8);

  const hasTh = tableEl.querySelectorAll('th').length > 0;

  const isExplicitNoBorder =
    tableEl.getAttribute('border') === '0' ||
    tableEl.classList.contains('no-border') ||
    (tableEl.style.border || '').includes('none');

  const hasBorders = !hasChoiceLetters && !isExplicitNoBorder && (hasTh || isAnswerKeyTable || tableEl.getAttribute('border') === '1');

  const tableBorders = hasBorders ? SOLID_TABLE_BORDERS : NO_TABLE_BORDERS;
  const cellBorders = hasBorders ? SOLID_CELL_BORDERS : NO_CELL_BORDERS;

  // 3. Tính số cột tối đa của bảng
  let maxColsInRow = 0;
  allRowsEl.forEach(tr => {
    let colCount = 0;
    tr.querySelectorAll('th, td').forEach(c => {
      colCount += parseInt(c.getAttribute('colspan') || '1', 10);
    });
    if (colCount > maxColsInRow) maxColsInRow = colCount;
  });

  // 4. Xác định mảng độ rộng cột cơ sở (DXA)
  let baseColWidths: number[] | null = null;
  if (isLandscape) {
    if (maxColsInRow === 18) {
      baseColWidths = MATRIX_18_COL_WIDTHS;
    } else if (maxColsInRow === 16) {
      baseColWidths = SPEC_16_COL_WIDTHS;
    }
  }

  // Nếu là bảng trắc nghiệm A, B, C, D (2 cột)
  if (hasChoiceLetters && maxColsInRow === 2) {
    baseColWidths = [4500, 4500];
  }

  const rows: TableRow[] = [];

  // Mảng theo dõi các ô bị rowspan từ các hàng trên
  const pendingRowSpans: number[] = baseColWidths ? new Array(baseColWidths.length).fill(0) : [];

  allRowsEl.forEach((tr) => {
    const cells: TableCell[] = [];
    const rowCells = tr.querySelectorAll('th, td');
    const isInFooter = !!tr.closest('tfoot') || tr.classList.contains('font-bold') || tr.style.fontWeight === 'bold';

    let colCursor = 0;

    rowCells.forEach((cellNode) => {
      const cellEl = cellNode as HTMLElement;
      const isHeader = cellEl.tagName.toUpperCase() === 'TH' || cellEl.classList.contains('bg-header');
      const colSpan = parseInt(cellEl.getAttribute('colspan') || '1', 10);
      const rowSpan = parseInt(cellEl.getAttribute('rowspan') || '1', 10);

      // Nhảy qua các cột đang bị chiếm bởi rowspan từ hàng trên
      if (baseColWidths) {
        while (colCursor < pendingRowSpans.length && pendingRowSpans[colCursor] > 0) {
          pendingRowSpans[colCursor]--;
          colCursor++;
        }
      }

      // Tính độ rộng ô (DXA)
      let cellWidthDxa: number | undefined = undefined;
      const currentColIndex = colCursor;
      if (baseColWidths && colCursor < baseColWidths.length) {
        let spanWidth = 0;
        for (let i = 0; i < colSpan && (colCursor + i) < baseColWidths.length; i++) {
          spanWidth += baseColWidths[colCursor + i];
        }
        cellWidthDxa = spanWidth;

        // Nếu ô này có rowspan, đánh dấu các cột bị chiếm cho các hàng sau
        if (rowSpan > 1) {
          for (let i = 0; i < colSpan && (colCursor + i) < pendingRowSpans.length; i++) {
            pendingRowSpans[colCursor + i] = rowSpan - 1;
          }
        }
        colCursor += colSpan;
      }

      // Xác định hàng footer (khung đỏ) của Ma trận: Tổng và Tỉ lệ %
      const isMatrixFooterRow =
        isInFooter ||
        (cellTexts.some(t => t.includes('Tổng (Số câu') || t.includes('Tỉ lệ %')) && (cellNode.textContent?.includes('Tổng') || cellNode.textContent?.includes('Tỉ lệ')));

      // In đậm: Header HOẶC Hàng footer (khung đỏ) HOẶC thẻ có font-weight: bold
      const shouldBold = isHeader || isMatrixFooterRow || cellEl.style.fontWeight === 'bold' || cellEl.classList.contains('font-bold');

      // Căn lề:
      // - Ô header (TH): CĂN GIỮA
      // - Hàng footer (Tổng và Tỉ lệ %): CĂN GIỮA 100%!
      // - Ô phương án trắc nghiệm A B C D: CĂN TRÁI
      // - Ô Yêu cầu cần đạt, Nội dung, Chủ đề: CĂN TRÁI
      // - Các ô điểm số / số câu / TT: CĂN GIỮA
      const rawCellText = (cellEl.textContent || '').trim();
      const isDescriptionText =
        // Là cột Chủ đề (1), Nội dung (2), Yêu cầu cần đạt (3) của Bản đặc tả
        (baseColWidths === SPEC_16_COL_WIDTHS && currentColIndex >= 1 && currentColIndex <= 3) ||
        // Là cột Nội dung bài học (1) của Ma trận
        (baseColWidths === MATRIX_18_COL_WIDTHS && currentColIndex === 1) ||
        // Hoặc ô có class text-left / style text-align: left
        cellEl.classList.contains('text-left') ||
        (cellEl.style.textAlign || '').toLowerCase() === 'left' ||
        // Hoặc nội dung là YCCĐ (Nhận biết, Thông hiểu, Vận dụng, gạch đầu dòng, hoặc đoạn văn dài)
        rawCellText.includes('Nhận biết:') ||
        rawCellText.includes('Thông hiểu:') ||
        rawCellText.includes('Vận dụng:') ||
        rawCellText.startsWith('- ') ||
        rawCellText.length > 35;

      let align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
      if (isHeader) {
        align = AlignmentType.CENTER; // Tiêu đề các cột luôn căn giữa
      } else if (isMatrixFooterRow) {
        align = AlignmentType.CENTER; // Khung đỏ BẮT BUỘC căn giữa đẹp mắt!
      } else if (hasChoiceLetters || isDescriptionText) {
        align = AlignmentType.LEFT; // CĂN TRÁI cho YCCĐ, Nội dung, Chủ đề, và trắc nghiệm!
      } else {
        align = getAlignment(cellEl, AlignmentType.CENTER);
      }

      // Cỡ chữ: khổ ngang ma trận dùng 20 (10pt) để số liệu vừa khít, trắc nghiệm dùng 24 (12pt)
      const tableFontSize = isLandscape ? 20 : (hasChoiceLetters ? 24 : 22);

      // Trích xuất các đoạn văn trong ô
      const cellParagraphs: Paragraph[] = [];
      const pElements = cellEl.querySelectorAll('p');

      if (pElements.length > 0) {
        pElements.forEach((p) => {
          const pAlign = isHeader
            ? AlignmentType.CENTER
            : (isMatrixFooterRow
                ? AlignmentType.CENTER
                : ((hasChoiceLetters || isDescriptionText)
                    ? AlignmentType.LEFT
                    : getAlignment(p, align)));
          const runs = extractRunsFromNode(p, tableFontSize, { bold: shouldBold });
          cellParagraphs.push(
            new Paragraph({
              alignment: pAlign,
              spacing: { before: hasChoiceLetters ? 20 : 35, after: hasChoiceLetters ? 20 : 35, line: 260 },
              children: runs.length > 0 ? runs : [new TextRun({ text: '', font: DEFAULT_FONT, size: tableFontSize })],
            })
          );
        });
      } else {
        const runs = extractRunsFromNode(cellEl, tableFontSize, { bold: shouldBold });
        cellParagraphs.push(
          new Paragraph({
            alignment: align,
            spacing: { before: hasChoiceLetters ? 20 : 35, after: hasChoiceLetters ? 20 : 35, line: 260 },
            children: runs.length > 0 ? runs : [new TextRun({ text: '', font: DEFAULT_FONT, size: tableFontSize })],
          })
        );
      }

      // Màu nền
      let bgColor: string | undefined = undefined;
      if (isHeader && hasBorders) {
        bgColor = 'F2F2F2';
      } else if (isMatrixFooterRow && hasBorders) {
        bgColor = 'F8FAFC';
      }

      cells.push(
        new TableCell({
          width: cellWidthDxa ? { size: cellWidthDxa, type: WidthType.DXA } : undefined,
          columnSpan: colSpan > 1 ? colSpan : undefined,
          rowSpan: rowSpan > 1 ? rowSpan : undefined,
          verticalAlign: VerticalAlign.CENTER, // Căn giữa theo chiều dọc
          borders: cellBorders,
          shading: bgColor
            ? {
                fill: bgColor,
                type: ShadingType.CLEAR,
                color: 'auto',
              }
            : undefined,
          children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ children: [] })],
          margins: {
            top: hasChoiceLetters ? 30 : 60,
            bottom: hasChoiceLetters ? 30 : 60,
            left: hasChoiceLetters ? 60 : 80,
            right: hasChoiceLetters ? 60 : 80,
          },
        })
      );
    });

    if (cells.length > 0) {
      rows.push(
        new TableRow({
          children: cells,
          cantSplit: true,
        })
      );
    }
  });

  return new Table({
    borders: tableBorders,
    columnWidths: baseColWidths || undefined,
    width: baseColWidths
      ? { size: baseColWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA }
      : { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.length > 0 ? rows : [new TableRow({ children: [new TableCell({ children: [] })] })],
  });
};

/**
 * Chuyển đổi toàn bộ HTML sang danh sách các phần tử native docx.
 * Xử lý chính xác thẻ <caption> của Ma trận để không bị mất tiêu đề!
 */
const convertHtmlToDocxElements = (
  html: string,
  isLandscape: boolean
): (Paragraph | Table)[] => {
  if (typeof window === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements: (Paragraph | Table)[] = [];

  const processNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tagName = el.tagName.toUpperCase();

    // 1. Kiểm tra ngắt trang
    const styleAttr = (el.getAttribute('style') || '').toLowerCase();
    const isPageBreak =
      styleAttr.includes('page-break-before: always') ||
      styleAttr.includes('page-break-after: always') ||
      el.classList.contains('page-break');

    if (isPageBreak && el.children.length === 0) {
      elements.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
      return;
    }

    // 2. Xử lý bảng <table>: Bóc tách cả thẻ <caption> của Ma trận để không bị mất tiêu đề!
    if (tagName === 'TABLE') {
      const captionEl = el.querySelector('caption');
      if (captionEl) {
        const captionText = (captionEl.textContent || '').trim();
        if (captionText) {
          elements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 120, line: 280 },
              children: [
                new TextRun({
                  text: captionText,
                  bold: true,
                  size: 28, // 14pt
                  font: DEFAULT_FONT,
                }),
              ],
            })
          );
        }
      }

      elements.push(parseHtmlTableToDocx(el as HTMLTableElement, isLandscape));
      return;
    }

    // 3. Xử lý các tiêu đề H1 - H6
    if (/^H[1-6]$/.test(tagName)) {
      const level = parseInt(tagName[1], 10);
      const align = getAlignment(el, level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT);
      const sizeMap: Record<number, number> = {
        1: 30, // 15pt
        2: 28, // 14pt
        3: 26, // 13pt
        4: 24, // 12pt
        5: 22,
        6: 20,
      };
      const headingSize = sizeMap[level] || 24;
      const runs = extractRunsFromNode(el, headingSize, { bold: true });

      elements.push(
        new Paragraph({
          alignment: align,
          spacing: { before: 160, after: 80, line: 280 },
          children: runs.length > 0 ? runs : [new TextRun({ text: el.textContent || '', bold: true, size: headingSize, font: DEFAULT_FONT })],
        })
      );
      return;
    }

    // 4. Xử lý khối đáp án div.answer
    if (el.classList.contains('answer')) {
      const runs = extractRunsFromNode(el, 24, { italic: false });
      elements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 80, after: 120, line: 280 },
          indent: { left: 360 }, // Thụt lề 360 dxa (~0.6cm)
          children: runs,
        })
      );
      return;
    }

    // 5. Xử lý thẻ <p>
    if (tagName === 'P') {
      const align = getAlignment(el, AlignmentType.LEFT);
      const runs = extractRunsFromNode(el, 24);

      if (styleAttr.includes('page-break-before: always')) {
        elements.push(new Paragraph({ children: [new PageBreak()] }));
      }

      if (runs.length > 0) {
        elements.push(
          new Paragraph({
            alignment: align,
            spacing: { before: 50, after: 70, line: 280 },
            children: runs,
          })
        );
      }
      return;
    }

    // 6. Xử lý danh sách <ul> / <ol>
    if (tagName === 'UL' || tagName === 'OL') {
      const liElements = el.querySelectorAll('li');
      liElements.forEach((li, idx) => {
        const bulletPrefix = tagName === 'OL' ? `${idx + 1}. ` : '• ';
        const runs = [
          new TextRun({ text: bulletPrefix, bold: true, font: DEFAULT_FONT, size: 24 }),
          ...extractRunsFromNode(li, 24),
        ];
        elements.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { before: 40, after: 40, line: 280 },
            children: runs,
          })
        );
      });
      return;
    }

    // 7. Thẻ container chung (DIV, SECTION, ARTICLE...)
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        processNode(child);
      } else if (child.nodeType === Node.TEXT_NODE && (child.textContent || '').trim().length > 0) {
        elements.push(
          new Paragraph({
            spacing: { before: 40, after: 40, line: 280 },
            children: [
              new TextRun({
                text: child.textContent || '',
                font: DEFAULT_FONT,
                size: 24,
              }),
            ],
          })
        );
      }
    }
  };

  const bodyChildren = doc.body.childNodes;
  for (let i = 0; i < bodyChildren.length; i++) {
    processNode(bodyChildren[i]);
  }

  return elements;
};

/**
 * Sinh file Blob .docx NATIVE 100% chuẩn OpenXML
 * Tương thích 100% trên điện thoại (Zalo, Google Docs, iOS, Android, Microsoft Word...)
 */
export const generateDocxBlob = async (
  htmlContent: string,
  options: DocxExportOptions = {}
): Promise<Blob> => {
  const isLandscape = options.orientation === 'landscape';

  // Khổ giấy A4 cơ bản: chiều rộng 11906, chiều cao 16838.
  // ĐẶC BIỆT LƯU Ý: Thư viện `docx` tự động hoán đổi width và height khi orientation === PageOrientation.LANDSCAPE.
  // Vì vậy kích thước cơ bản PHẢI luôn là width: 11906, height: 16838 để docx swap thành w:w="16838" w:h="11906" chuẩn khổ ngang!
  const width = 11906;
  const height = 16838;

  // Căn lề chuẩn văn bản giáo dục VN (Nghị định 30/2020/NĐ-CP):
  // Khổ dọc: Trên 20mm (1134 dxa), Dưới 20mm (1134 dxa), Trái 30mm (1701 dxa), Phải 20mm (1134 dxa)
  // Khổ ngang: Lề đều 15mm (850 dxa) để bảng ma trận / đặc tả rộng rãi nhất
  const defaultMargins = isLandscape
    ? { top: 850, bottom: 850, left: 850, right: 850 }
    : { top: 1134, bottom: 1134, left: 1701, right: 1134 };

  const margins = {
    top: options.margins?.top ?? defaultMargins.top,
    bottom: options.margins?.bottom ?? defaultMargins.bottom,
    left: options.margins?.left ?? defaultMargins.left,
    right: options.margins?.right ?? defaultMargins.right,
  };

  // Chuyển đổi toàn bộ HTML sang native docx elements
  const children = convertHtmlToDocxElements(htmlContent, isLandscape);

  // Khởi tạo Document của docx
  const doc = new Document({
    title: options.title || 'Tai_lieu',
    styles: {
      default: {
        document: {
          run: {
            font: DEFAULT_FONT,
            size: options.fontSize || (isLandscape ? 20 : 24),
            color: '000000',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width,
              height,
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: margins,
          },
        },
        children: children.length > 0 ? children : [new Paragraph({ children: [] })],
      },
    ],
  });

  return await Packer.toBlob(doc);
};

/**
 * Tải trực tiếp file .docx NATIVE về máy người dùng
 */
export const exportHtmlToDocx = async (
  htmlContent: string,
  filename: string,
  options: DocxExportOptions = {}
): Promise<void> => {
  if (!htmlContent || typeof window === 'undefined') return;

  try {
    const cleanFilename = filename.toLowerCase().endsWith('.docx')
      ? filename
      : filename.replace(/\.doc$/i, '') + '.docx';

    const blob = await generateDocxBlob(htmlContent, {
      ...options,
      title: options.title || cleanFilename.replace('.docx', ''),
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Lỗi khi xuất file docx native:', error);
    alert('Không thể xuất file docx: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
  }
};
