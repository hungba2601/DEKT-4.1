import type { SpecData, MatrixConfig } from '../types';

// Helper: get letter label for DS ý (0 -> 'a', 1 -> 'b', ...)
const getLetterLabel = (index: number): string => String.fromCharCode(97 + index);

// Helper: format DS ý display, e.g. "2 (1a,1b)"
export const formatDsY = (dsQuestionNumber: number, yCount: number, startLetterIndex: number): string => {
  if (!yCount || yCount <= 0) return '';
  const labels: string[] = [];
  for (let i = 0; i < yCount; i++) {
    labels.push(`${dsQuestionNumber}${getLetterLabel(startLetterIndex + i)}`);
  }
  return `${yCount} (${labels.join(',')})`;
};

const toRoman = (num: number): string => {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
  return roman[num - 1] || `${num}`;
};

/**
 * Đảm bảo spec luôn khớp chính xác 100% với cấu hình matrixConfig
 * (Đúng-Sai, Nhiều lựa chọn, Trả lời ngắn, Tự luận, tổng điểm = 10.0đ).
 * Nếu AI tạo thiếu hoặc thừa câu hỏi ở bất kỳ hình thức nào (đặc biệt khi số bài học ít hơn số câu hỏi),
 * hàm này sẽ tự động phân bổ và bù đủ câu hỏi cho các bài học.
 */
export const ensureSpecMatchesConfig = (
  spec: SpecData,
  config: MatrixConfig
): SpecData => {
  if (!spec || spec.length === 0) return spec;

  const clonedSpec: SpecData = JSON.parse(JSON.stringify(spec));
  const allRows: any[] = [];
  clonedSpec.forEach(topic => {
    if (Array.isArray(topic.rows)) {
      topic.rows.forEach(row => {
        if (!row.soCau) {
          row.soCau = {
            nhanBiet: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
            thongHieu: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
            vanDung: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
            vanDungCao: { TN: 0, DS: 0, TNgan: 0, TL: 0 }
          };
        }
        allRows.push(row);
      });
    }
  });

  if (allRows.length === 0) return clonedSpec;

  const soY = config.soYTrongCauDungSai || 4;
  const dsBiet = Math.min(2, soY);
  const dsConLai = soY - dsBiet;
  const dsHieu = Math.ceil(dsConLai / 2);
  const dsVanDung = dsConLai - dsHieu;

  // 1. Cân đối câu Đúng - Sai (Target: config.soCauDungSai)
  const targetDsQuestions = config.isTuLuan100 ? 0 : (config.soCauDungSai || 0);
  let currentDsYTotal = 0;
  allRows.forEach(row => {
    currentDsYTotal += (row.soCau.nhanBiet.DS || 0) + (row.soCau.thongHieu.DS || 0) + (row.soCau.vanDung.DS || 0) + (row.soCau.vanDungCao?.DS || 0);
  });
  let currentDsQuestions = Math.round(currentDsYTotal / soY);

  if (currentDsQuestions < targetDsQuestions) {
    let missing = targetDsQuestions - currentDsQuestions;
    let rowIdx = 0;
    while (missing > 0) {
      const r = allRows[rowIdx % allRows.length];
      r.soCau.nhanBiet.DS = (r.soCau.nhanBiet.DS || 0) + dsBiet;
      r.soCau.thongHieu.DS = (r.soCau.thongHieu.DS || 0) + dsHieu;
      r.soCau.vanDung.DS = (r.soCau.vanDung.DS || 0) + dsVanDung;
      missing--;
      rowIdx++;
    }
  } else if (currentDsQuestions > targetDsQuestions) {
    let excess = currentDsQuestions - targetDsQuestions;
    let rowIdx = allRows.length - 1;
    while (excess > 0 && rowIdx >= 0) {
      const r = allRows[rowIdx];
      const rTotalY = (r.soCau.nhanBiet.DS || 0) + (r.soCau.thongHieu.DS || 0) + (r.soCau.vanDung.DS || 0);
      if (rTotalY >= soY) {
        r.soCau.nhanBiet.DS = Math.max(0, (r.soCau.nhanBiet.DS || 0) - dsBiet);
        r.soCau.thongHieu.DS = Math.max(0, (r.soCau.thongHieu.DS || 0) - dsHieu);
        r.soCau.vanDung.DS = Math.max(0, (r.soCau.vanDung.DS || 0) - dsVanDung);
        excess--;
      } else {
        rowIdx--;
      }
    }
  }

  // 2. Cân đối Nhiều lựa chọn (Target: config.soCauNhieuLuaChon)
  const targetTN = config.isTuLuan100 ? 0 : (config.soCauNhieuLuaChon || 0);
  let currentTN = 0;
  allRows.forEach(row => {
    currentTN += (row.soCau.nhanBiet.TN || 0) + (row.soCau.thongHieu.TN || 0) + (row.soCau.vanDung.TN || 0) + (row.soCau.vanDungCao?.TN || 0);
  });

  if (currentTN < targetTN) {
    let missing = targetTN - currentTN;
    let rowIdx = 0;
    while (missing > 0) {
      const r = allRows[rowIdx % allRows.length];
      if (missing % 3 === 0) {
        r.soCau.vanDung.TN = (r.soCau.vanDung.TN || 0) + 1;
      } else if (missing % 2 === 0) {
        r.soCau.thongHieu.TN = (r.soCau.thongHieu.TN || 0) + 1;
      } else {
        r.soCau.nhanBiet.TN = (r.soCau.nhanBiet.TN || 0) + 1;
      }
      missing--;
      rowIdx++;
    }
  } else if (currentTN > targetTN) {
    let excess = currentTN - targetTN;
    let rowIdx = allRows.length - 1;
    while (excess > 0 && rowIdx >= 0) {
      const r = allRows[rowIdx];
      if ((r.soCau.vanDung.TN || 0) > 0) {
        r.soCau.vanDung.TN--;
        excess--;
      } else if ((r.soCau.thongHieu.TN || 0) > 0) {
        r.soCau.thongHieu.TN--;
        excess--;
      } else if ((r.soCau.nhanBiet.TN || 0) > 0) {
        r.soCau.nhanBiet.TN--;
        excess--;
      } else {
        rowIdx--;
      }
    }
  }

  // 3. Cân đối Trả lời ngắn (Target: config.soCauTraLoiNgan)
  const targetTNgan = config.isTuLuan100 ? 0 : (config.soCauTraLoiNgan || 0);
  let currentTNgan = 0;
  allRows.forEach(row => {
    currentTNgan += (row.soCau.nhanBiet.TNgan || 0) + (row.soCau.thongHieu.TNgan || 0) + (row.soCau.vanDung.TNgan || 0) + (row.soCau.vanDungCao?.TNgan || 0);
  });

  if (currentTNgan < targetTNgan) {
    let missing = targetTNgan - currentTNgan;
    let rowIdx = 0;
    while (missing > 0) {
      const r = allRows[rowIdx % allRows.length];
      r.soCau.thongHieu.TNgan = (r.soCau.thongHieu.TNgan || 0) + 1;
      missing--;
      rowIdx++;
    }
  } else if (currentTNgan > targetTNgan) {
    let excess = currentTNgan - targetTNgan;
    let rowIdx = allRows.length - 1;
    while (excess > 0 && rowIdx >= 0) {
      const r = allRows[rowIdx];
      if ((r.soCau.thongHieu.TNgan || 0) > 0) {
        r.soCau.thongHieu.TNgan--;
        excess--;
      } else if ((r.soCau.nhanBiet.TNgan || 0) > 0) {
        r.soCau.nhanBiet.TNgan--;
        excess--;
      } else if ((r.soCau.vanDung.TNgan || 0) > 0) {
        r.soCau.vanDung.TNgan--;
        excess--;
      } else {
        rowIdx--;
      }
    }
  }

  // 4. Cân đối Tự luận (Target: config.soCauTuLuan)
  const targetTL = config.soCauTuLuan || 0;
  let currentTL = 0;
  allRows.forEach(row => {
    currentTL += (row.soCau.nhanBiet.TL || 0) + (row.soCau.thongHieu.TL || 0) + (row.soCau.vanDung.TL || 0) + (row.soCau.vanDungCao?.TL || 0);
  });

  if (currentTL < targetTL) {
    let missing = targetTL - currentTL;
    let rowIdx = 0;
    while (missing > 0) {
      const r = allRows[rowIdx % allRows.length];
      r.soCau.vanDung.TL = (r.soCau.vanDung.TL || 0) + 1;
      missing--;
      rowIdx++;
    }
  } else if (currentTL > targetTL) {
    let excess = currentTL - targetTL;
    let rowIdx = allRows.length - 1;
    while (excess > 0 && rowIdx >= 0) {
      const r = allRows[rowIdx];
      if ((r.soCau.vanDung.TL || 0) > 0) {
        r.soCau.vanDung.TL--;
        excess--;
      } else if ((r.soCau.thongHieu.TL || 0) > 0) {
        r.soCau.thongHieu.TL--;
        excess--;
      } else if ((r.soCau.nhanBiet.TL || 0) > 0) {
        r.soCau.nhanBiet.TL--;
        excess--;
      } else {
        rowIdx--;
      }
    }
  }

  return clonedSpec;
};

/**
 * Tạo bảng HTML Ma trận Đề kiểm tra chuẩn xác 100% bằng CODE toán học,
 * không phụ thuộc vào tính nhẩm của AI.
 */
export const generateMatrixHtml = (
  spec: SpecData,
  config: MatrixConfig,
  examTitle: string,
  schoolYear?: string
): string => {
  if (!spec || spec.length === 0) return '';

  // Đảm bảo spec luôn khớp 100% với config số lượng câu hỏi và điểm số
  const activeSpec = ensureSpecMatchesConfig(spec, config);

  const titleParts = [examTitle ? examTitle.toUpperCase() : '', schoolYear ? `NĂM HỌC ${schoolYear}` : ''].filter(Boolean);
  const finalCaption = titleParts.length > 0 ? ` ${titleParts.join(' - ')}` : '';

  // 1. Tính tổng toàn cục
  let sumTN = { nb: 0, th: 0, vd: 0 };
  let sumDS = { nb: 0, th: 0, vd: 0 };
  let sumTNgan = { nb: 0, th: 0, vd: 0 };
  let sumTL = { nb: 0, th: 0, vd: 0 };

  activeSpec.forEach(topic => {
    topic.rows.forEach(row => {
      const s = row.soCau;
      sumTN.nb += s.nhanBiet.TN || 0;
      sumTN.th += s.thongHieu.TN || 0;
      sumTN.vd += (s.vanDung.TN || 0) + (s.vanDungCao?.TN || 0);

      sumDS.nb += s.nhanBiet.DS || 0;
      sumDS.th += s.thongHieu.DS || 0;
      sumDS.vd += (s.vanDung.DS || 0) + (s.vanDungCao?.DS || 0);

      sumTNgan.nb += s.nhanBiet.TNgan || 0;
      sumTNgan.th += s.thongHieu.TNgan || 0;
      sumTNgan.vd += (s.vanDung.TNgan || 0) + (s.vanDungCao?.TNgan || 0);

      sumTL.nb += s.nhanBiet.TL || 0;
      sumTL.th += s.thongHieu.TL || 0;
      sumTL.vd += (s.vanDung.TL || 0) + (s.vanDungCao?.TL || 0);
    });
  });

  const totalTNCount = sumTN.nb + sumTN.th + sumTN.vd;
  const totalDSCount = sumDS.nb + sumDS.th + sumDS.vd;
  const totalTNganCount = sumTNgan.nb + sumTNgan.th + sumTNgan.vd;
  const totalTLCount = sumTL.nb + sumTL.th + sumTL.vd;

  let dsQuestionCounter = 0;
  let tnQuestionCounter = 1;
  let tnganQuestionCounter = 1;
  let tlQuestionCounter = 1;

  let html = `<table border="1" style="width:100%; border-collapse: collapse; font-family: 'Times New Roman', serif; font-size: 11pt; text-align: center;">
    <caption style="font-weight: bold; font-size: 1.2em; padding: 10px;">MA TRẬN ĐỀ KIỂM TRA${finalCaption}</caption>
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

  activeSpec.forEach((topic, topicIdx) => {
    const romanNumeral = toRoman(topicIdx + 1);
    html += `<tr style="font-weight: bold; background-color: #f2f2f2;"><td>${romanNumeral}</td><td colspan="17" style="text-align: left;">${topic.chuDe}</td></tr>`;

    topic.rows.forEach(row => {
      const s = row.soCau;

      const tnCount = (s.nhanBiet.TN || 0) + (s.thongHieu.TN || 0) + (s.vanDung.TN || 0) + (s.vanDungCao?.TN || 0);
      const tnPoints = tnCount * config.diemCauNhieuLuaChon;

      const dsYCount = (s.nhanBiet.DS || 0) + (s.thongHieu.DS || 0) + (s.vanDung.DS || 0) + (s.vanDungCao?.DS || 0);
      const dsPoints = dsYCount * config.diemMoiYTrongCauDungSai;

      const tnganCount = (s.nhanBiet.TNgan || 0) + (s.thongHieu.TNgan || 0) + (s.vanDung.TNgan || 0) + (s.vanDungCao?.TNgan || 0);
      const tnganPoints = tnganCount * config.diemCauTraLoiNgan;

      const tlCount = (s.nhanBiet.TL || 0) + (s.thongHieu.TL || 0) + (s.vanDung.TL || 0) + (s.vanDungCao?.TL || 0);
      const tlPoints = tlCount * config.diemCauTuLuan;

      const rowTotalPoints = tnPoints + dsPoints + tnganPoints + tlPoints;

      // Hàm format ô câu hỏi thông thường (TN, Trả lời ngắn, Tự luận)
      const fmt = (count: number, unitPoint: number, startQNum: number) => {
        if (!count || count <= 0) return '';
        let labelStr = `C${startQNum}`;
        if (count > 1) {
          const labels: string[] = [`C${startQNum}`];
          for (let i = 1; i < count; i++) {
            labels.push(`${startQNum + i}`);
          }
          labelStr = labels.join(',');
        }
        const p = count * unitPoint;
        return `${count} (${labelStr})<br/>(${parseFloat(p.toFixed(2))}đ)`;
      };

      // Format Đúng - Sai (hỗ trợ 1 hoặc nhiều câu Đúng - Sai trên cùng 1 hàng)
      const ds_nb = s.nhanBiet.DS || 0;
      const ds_th = s.thongHieu.DS || 0;
      const ds_vd = (s.vanDung.DS || 0) + (s.vanDungCao?.DS || 0);
      const rowDsY = ds_nb + ds_th + ds_vd;
      const soY = config.soYTrongCauDungSai || 4;
      const dsBiet = Math.min(2, soY);
      const dsConLai = soY - dsBiet;
      const dsHieu = Math.ceil(dsConLai / 2);
      const dsVanDung = dsConLai - dsHieu;

      let dsNbCell = '';
      let dsThCell = '';
      let dsVdCell = '';

      if (rowDsY > 0) {
        // Số câu Đúng-Sai của hàng này
        const qCount = Math.max(1, Math.round(rowDsY / soY));
        const startQ = dsQuestionCounter + 1;
        dsQuestionCounter += qCount;

        const fmtMultiDsY = (totalY: number, letterStart: number, letterCountPerQ: number) => {
          if (!totalY || totalY <= 0) return '';
          const labels: string[] = [];
          let added = 0;
          for (let q = startQ; q < startQ + qCount && added < totalY; q++) {
            for (let l = 0; l < letterCountPerQ && added < totalY; l++) {
              labels.push(`${q}${getLetterLabel(letterStart + l)}`);
              added++;
            }
          }
          while (added < totalY) {
            labels.push(`ý${added + 1}`);
            added++;
          }
          const p = totalY * config.diemMoiYTrongCauDungSai;
          return `${totalY} (${labels.join(',')})<br/>(${parseFloat(p.toFixed(2))}đ)`;
        };

        dsNbCell = fmtMultiDsY(ds_nb, 0, dsBiet);
        dsThCell = fmtMultiDsY(ds_th, dsBiet, dsHieu);
        dsVdCell = fmtMultiDsY(ds_vd, dsBiet + dsHieu, dsVanDung);
      }

      // Format cột Tổng (Số câu, số ý, TL, điểm) - BẮT BUỘC TÁCH BIỆT CÂU, Ý VÀ TL
      const formatTotalCell = (cauCount: number, yCount: number, points: number, tlCount: number = 0) => {
        if (cauCount === 0 && yCount === 0 && tlCount === 0) return '';
        const ptsStr = parseFloat(points.toFixed(2));
        const parts: string[] = [];
        if (cauCount > 0) parts.push(`${cauCount} câu`);
        if (yCount > 0) parts.push(`${yCount} ý`);
        if (tlCount > 0) parts.push(`${tlCount} TL`);
        return `(${parts.join(', ')} - ${ptsStr})`;
      };

      // Tính chính xác số câu (TN, Trả lời ngắn), số ý (ĐS) và số câu Tự luận (TL) cho từng mức độ
      const nb_cau = (s.nhanBiet.TN || 0) + (s.nhanBiet.TNgan || 0);
      const nb_y = s.nhanBiet.DS || 0;
      const nb_tl = s.nhanBiet.TL || 0;
      const nb_points = (s.nhanBiet.TN || 0) * config.diemCauNhieuLuaChon +
        (s.nhanBiet.TNgan || 0) * config.diemCauTraLoiNgan +
        nb_tl * config.diemCauTuLuan +
        nb_y * config.diemMoiYTrongCauDungSai;

      const th_cau = (s.thongHieu.TN || 0) + (s.thongHieu.TNgan || 0);
      const th_y = s.thongHieu.DS || 0;
      const th_tl = s.thongHieu.TL || 0;
      const th_points = (s.thongHieu.TN || 0) * config.diemCauNhieuLuaChon +
        (s.thongHieu.TNgan || 0) * config.diemCauTraLoiNgan +
        th_tl * config.diemCauTuLuan +
        th_y * config.diemMoiYTrongCauDungSai;

      const vd_cau = (s.vanDung.TN || 0) + (s.vanDungCao?.TN || 0) +
        (s.vanDung.TNgan || 0) + (s.vanDungCao?.TNgan || 0);
      const vd_y = (s.vanDung.DS || 0) + (s.vanDungCao?.DS || 0);
      const vd_tl = (s.vanDung.TL || 0) + (s.vanDungCao?.TL || 0);
      const vd_points = ((s.vanDung.TN || 0) + (s.vanDungCao?.TN || 0)) * config.diemCauNhieuLuaChon +
        ((s.vanDung.TNgan || 0) + (s.vanDungCao?.TNgan || 0)) * config.diemCauTraLoiNgan +
        vd_tl * config.diemCauTuLuan +
        vd_y * config.diemMoiYTrongCauDungSai;

      // Các ô Many-choice
      const tnNbCell = fmt(s.nhanBiet.TN, config.diemCauNhieuLuaChon, tnQuestionCounter);
      tnQuestionCounter += (s.nhanBiet.TN || 0);
      const tnThCell = fmt(s.thongHieu.TN, config.diemCauNhieuLuaChon, tnQuestionCounter);
      tnQuestionCounter += (s.thongHieu.TN || 0);
      const tnVdCell = fmt((s.vanDung.TN || 0) + (s.vanDungCao?.TN || 0), config.diemCauNhieuLuaChon, tnQuestionCounter);
      tnQuestionCounter += ((s.vanDung.TN || 0) + (s.vanDungCao?.TN || 0));


      // Các ô Trả lời ngắn
      const tnganNbCell = fmt(s.nhanBiet.TNgan, config.diemCauTraLoiNgan, tnganQuestionCounter);
      tnganQuestionCounter += (s.nhanBiet.TNgan || 0);
      const tnganThCell = fmt(s.thongHieu.TNgan, config.diemCauTraLoiNgan, tnganQuestionCounter);
      tnganQuestionCounter += (s.thongHieu.TNgan || 0);
      const tnganVdCell = fmt((s.vanDung.TNgan || 0) + (s.vanDungCao?.TNgan || 0), config.diemCauTraLoiNgan, tnganQuestionCounter);
      tnganQuestionCounter += ((s.vanDung.TNgan || 0) + (s.vanDungCao?.TNgan || 0));

      // Các ô Tự luận
      const tlNbCell = fmt(s.nhanBiet.TL, config.diemCauTuLuan, tlQuestionCounter);
      tlQuestionCounter += (s.nhanBiet.TL || 0);
      const tlThCell = fmt(s.thongHieu.TL, config.diemCauTuLuan, tlQuestionCounter);
      tlQuestionCounter += (s.thongHieu.TL || 0);
      const tlVdCell = fmt((s.vanDung.TL || 0) + (s.vanDungCao?.TL || 0), config.diemCauTuLuan, tlQuestionCounter);
      tlQuestionCounter += ((s.vanDung.TL || 0) + (s.vanDungCao?.TL || 0));

      const rowPercent = rowTotalPoints > 0 ? parseFloat(((rowTotalPoints / 10) * 100).toFixed(1)) : 0;

      html += `<tr>
          <td>${row.tt}</td>
          <td style="text-align: left;">${row.noiDung}</td>
          
          <td>${tnNbCell}</td>
          <td>${tnThCell}</td>
          <td>${tnVdCell}</td>

          <td>${dsNbCell}</td>
          <td>${dsThCell}</td>
          <td>${dsVdCell}</td>

          <td>${tnganNbCell}</td>
          <td>${tnganThCell}</td>
          <td>${tnganVdCell}</td>

          <td>${tlNbCell}</td>
          <td>${tlThCell}</td>
          <td>${tlVdCell}</td>
          
          <td>${formatTotalCell(nb_cau, nb_y, nb_points, nb_tl)}</td>
          <td>${formatTotalCell(th_cau, th_y, th_points, th_tl)}</td>
          <td>${formatTotalCell(vd_cau, vd_y, vd_points, vd_tl)}</td> 
          <td>${rowPercent}%</td>
      </tr>`;
    });
  });

  // Footer tính toán chính xác tuyệt đối bằng CODE
  const footer_nb_cau = sumTN.nb + sumTNgan.nb;
  const footer_nb_y = sumDS.nb;
  const footer_nb_tl = sumTL.nb;
  const footer_nb_points = sumTN.nb * config.diemCauNhieuLuaChon +
    sumTNgan.nb * config.diemCauTraLoiNgan +
    sumTL.nb * config.diemCauTuLuan +
    sumDS.nb * config.diemMoiYTrongCauDungSai;

  const footer_th_cau = sumTN.th + sumTNgan.th;
  const footer_th_y = sumDS.th;
  const footer_th_tl = sumTL.th;
  const footer_th_points = sumTN.th * config.diemCauNhieuLuaChon +
    sumTNgan.th * config.diemCauTraLoiNgan +
    sumTL.th * config.diemCauTuLuan +
    sumDS.th * config.diemMoiYTrongCauDungSai;

  const footer_vd_cau = sumTN.vd + sumTNgan.vd;
  const footer_vd_y = sumDS.vd;
  const footer_vd_tl = sumTL.vd;
  const footer_vd_points = sumTN.vd * config.diemCauNhieuLuaChon +
    sumTNgan.vd * config.diemCauTraLoiNgan +
    sumTL.vd * config.diemCauTuLuan +
    sumDS.vd * config.diemMoiYTrongCauDungSai;

  const formatFooterTotal = (cauCount: number, yCount: number, points: number, tlCount: number = 0) => {
    const ptsStr = parseFloat(points.toFixed(2));
    if (cauCount === 0 && yCount === 0 && tlCount === 0) return `(0 - 0)`;
    const parts: string[] = [];
    if (cauCount > 0) parts.push(`${cauCount} câu`);
    if (yCount > 0) parts.push(`${yCount} ý`);
    if (tlCount > 0) parts.push(`${tlCount} TL`);
    return `(${parts.join(', ')} - ${ptsStr})`;
  };

  const fmtColTotal = (cnt: number, pts: number) => {
    return cnt > 0 ? `(${cnt} - ${parseFloat(pts.toFixed(2))})` : `(0 - 0)`;
  };
  const fmtColTotalY = (yCnt: number, pts: number) => {
    return yCnt > 0 ? `(${yCnt} ý - ${parseFloat(pts.toFixed(2))})` : `(0 - 0)`;
  };

  const totalTnAndTngan = totalTNCount + totalTNganCount;
  const grandParts: string[] = [];
  if (totalTnAndTngan > 0) grandParts.push(`${totalTnAndTngan} câu`);
  if (totalDSCount > 0) grandParts.push(`${totalDSCount} ý`);
  if (totalTLCount > 0) grandParts.push(`${totalTLCount} TL`);

  const grandTotalString = grandParts.length > 0
    ? `(${grandParts.join(', ')} - 10.0)`
    : `(0 - 10.0)`;

  html += `</tbody>
  <tfoot>
      <tr style="font-weight: bold;">
          <td colspan="2">Tổng (Số câu, ý - Điểm)</td>
          <td>${fmtColTotal(sumTN.nb, sumTN.nb * config.diemCauNhieuLuaChon)}</td>
          <td>${fmtColTotal(sumTN.th, sumTN.th * config.diemCauNhieuLuaChon)}</td>
          <td>${fmtColTotal(sumTN.vd, sumTN.vd * config.diemCauNhieuLuaChon)}</td>
          <td>${fmtColTotalY(sumDS.nb, sumDS.nb * config.diemMoiYTrongCauDungSai)}</td>
          <td>${fmtColTotalY(sumDS.th, sumDS.th * config.diemMoiYTrongCauDungSai)}</td>
          <td>${fmtColTotalY(sumDS.vd, sumDS.vd * config.diemMoiYTrongCauDungSai)}</td>
          <td>${fmtColTotal(sumTNgan.nb, sumTNgan.nb * config.diemCauTraLoiNgan)}</td>
          <td>${fmtColTotal(sumTNgan.th, sumTNgan.th * config.diemCauTraLoiNgan)}</td>
          <td>${fmtColTotal(sumTNgan.vd, sumTNgan.vd * config.diemCauTraLoiNgan)}</td>
          <td>${fmtColTotal(sumTL.nb, sumTL.nb * config.diemCauTuLuan)}</td>
          <td>${fmtColTotal(sumTL.th, sumTL.th * config.diemCauTuLuan)}</td>
          <td>${fmtColTotal(sumTL.vd, sumTL.vd * config.diemCauTuLuan)}</td>
          <td>${formatFooterTotal(footer_nb_cau, footer_nb_y, footer_nb_points, footer_nb_tl)}</td>
          <td>${formatFooterTotal(footer_th_cau, footer_th_y, footer_th_points, footer_th_tl)}</td>
          <td>${formatFooterTotal(footer_vd_cau, footer_vd_y, footer_vd_points, footer_vd_tl)}</td>
          <td>${grandTotalString}</td>
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
  </table>`;

  return html;
};

/**
 * Tính toán số lượng câu hỏi ngân hàng mục tiêu (gấp 2.5 lần ma trận)
 * để cấp cho AI trong Tab 5 (Câu hỏi ôn tập).
 */
export const calculateReviewTargetCounts = (
  spec: SpecData,
  config: MatrixConfig
) => {
  let tnCount = 0;
  let dsYCount = 0;
  let tnganCount = 0;
  let tlCount = 0;

  spec.forEach(topic => {
    topic.rows.forEach(row => {
      const s = row.soCau;
      tnCount += (s.nhanBiet.TN || 0) + (s.thongHieu.TN || 0) + (s.vanDung.TN || 0) + (s.vanDungCao?.TN || 0);
      dsYCount += (s.nhanBiet.DS || 0) + (s.thongHieu.DS || 0) + (s.vanDung.DS || 0) + (s.vanDungCao?.DS || 0);
      tnganCount += (s.nhanBiet.TNgan || 0) + (s.thongHieu.TNgan || 0) + (s.vanDung.TNgan || 0) + (s.vanDungCao?.TNgan || 0);
      tlCount += (s.nhanBiet.TL || 0) + (s.thongHieu.TL || 0) + (s.vanDung.TL || 0) + (s.vanDungCao?.TL || 0);
    });
  });

  const soY = config.soYTrongCauDungSai || 4;
  const dsQuestions = dsYCount > 0 ? Math.ceil(dsYCount / soY) : (config.soCauDungSai || 0);
  const tnFinalCount = tnCount > 0 ? tnCount : (config.soCauNhieuLuaChon || 0);
  const tnganFinalCount = tnganCount > 0 ? tnganCount : (config.soCauTraLoiNgan || 0);
  const tlFinalCount = tlCount > 0 ? tlCount : (config.soCauTuLuan || 0);

  const targetTN = Math.max(1, Math.ceil(tnFinalCount * 2.5));
  const targetDS = dsQuestions > 0 ? Math.max(1, Math.ceil(dsQuestions * 2.5)) : 0;
  const targetTNgan = tnganFinalCount > 0 ? Math.max(1, Math.ceil(tnganFinalCount * 2.5)) : 0;
  const targetTL = tlFinalCount > 0 ? Math.max(1, Math.ceil(tlFinalCount * 2.5)) : 0;
  const totalTarget = targetTN + targetDS + targetTNgan + targetTL;

  let breakdownText = '';
  spec.forEach((topic, tIdx) => {
    breakdownText += `\n- Chủ đề ${toRoman(tIdx + 1)}: ${topic.chuDe}\n`;
    topic.rows.forEach(row => {
      const s = row.soCau;
      const rTn = (s.nhanBiet.TN || 0) + (s.thongHieu.TN || 0) + (s.vanDung.TN || 0);
      const rDsY = (s.nhanBiet.DS || 0) + (s.thongHieu.DS || 0) + (s.vanDung.DS || 0);
      const rDs = rDsY > 0 ? Math.ceil(rDsY / soY) : 0;
      const rTngan = (s.nhanBiet.TNgan || 0) + (s.thongHieu.TNgan || 0) + (s.vanDung.TNgan || 0);
      const rTl = (s.nhanBiet.TL || 0) + (s.thongHieu.TL || 0) + (s.vanDung.TL || 0);

      const tTargetTn = Math.ceil(rTn * 2.5);
      const tTargetDs = Math.ceil(rDs * 2.5);
      const tTargetTngan = Math.ceil(rTngan * 2.5);
      const tTargetTl = Math.ceil(rTl * 2.5);

      const items: string[] = [];
      if (tTargetTn > 0) items.push(`${tTargetTn} câu TN`);
      if (tTargetDs > 0) items.push(`${tTargetDs} câu Đúng-Sai (${soY} ý/câu)`);
      if (tTargetTngan > 0) items.push(`${tTargetTngan} câu Trả lời ngắn`);
      if (tTargetTl > 0) items.push(`${tTargetTl} câu Tự luận`);

      if (items.length > 0) {
        breakdownText += `  + [${row.tt}] ${row.noiDung}: Bắt buộc soạn tối thiểu: ${items.join(', ')}.\n`;
      }
    });
  });

  return {
    targetTN,
    targetDS,
    targetTNgan,
    targetTL,
    totalTarget,
    soY,
    breakdownText,
  };
};
