import { SpecData, SpecRowData, MatrixConfig, CognitiveLevelQuestionCounts } from '../types';

// Chuyển đổi số nguyên sang số La Mã cho các Chủ đề
export const toRoman = (num: number): string => {
  const romanMap: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  for (const [val, sym] of romanMap) {
    while (num >= val) {
      result += sym;
      num -= val;
    }
  }
  return result || 'I';
};

// Định dạng nhãn ý Đúng-Sai: 2 (1a,1b)
export const formatDsYLabel = (dsQuestionNumber: number, yCount: number, startLetterIndex: number): string => {
  if (!yCount || yCount <= 0) return '';
  const labels: string[] = [];
  for (let i = 0; i < yCount; i++) {
    labels.push(`${dsQuestionNumber}${String.fromCharCode(97 + startLetterIndex + i)}`);
  }
  return `${yCount} (${labels.join(',')})`;
};

/**
 * Tự động kiểm tra và chuẩn hóa cấu trúc SpecData để tổng số câu/ý
 * khớp 100% với cấu hình người dùng thiết lập, khắc phục triệt để
 * hiện tượng AI (nhất là Gemini Flash-Lite) phân bổ lệch câu.
 */
export const validateAndNormalizeSpec = (
  spec: SpecData,
  config: MatrixConfig
): SpecData => {
  if (!Array.isArray(spec) || spec.length === 0) return spec;

  const allRows: SpecRowData[] = [];
  let totalTN = 0;
  let totalDS = 0;
  let totalTNgan = 0;
  let totalTL = 0;

  spec.forEach(topic => {
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
        (['nhanBiet', 'thongHieu', 'vanDung', 'vanDungCao'] as (keyof CognitiveLevelQuestionCounts)[]).forEach(level => {
          const l = row.soCau[level];
          if (l) {
            totalTN += (l.TN || 0);
            totalDS += (l.DS || 0);
            totalTNgan += (l.TNgan || 0);
            totalTL += (l.TL || 0);
          }
        });
      });
    }
  });

  if (allRows.length === 0) return spec;

  const targetTN = config.isTuLuan100 ? 0 : Number(config.soCauNhieuLuaChon) || 0;
  const targetDS = config.isTuLuan100 ? 0 : (Number(config.soCauDungSai) || 0) * (Number(config.soYTrongCauDungSai) || 4);
  const targetTNgan = config.isTuLuan100 ? 0 : Number(config.soCauTraLoiNgan) || 0;
  const targetTL = Number(config.soCauTuLuan) || 0;

  const balanceType = (
    type: 'TN' | 'DS' | 'TNgan' | 'TL',
    currentCount: number,
    targetCount: number
  ) => {
    let diff = targetCount - currentCount;
    if (diff === 0) return;

    if (diff > 0) {
      // Thiếu câu/ý -> tự động bổ sung vào bài phù hợp
      let i = 0;
      while (diff > 0 && i < allRows.length * 3) {
        const row = allRows[i % allRows.length];
        const level = (type === 'TL' ? 'thongHieu' : 'nhanBiet') as keyof CognitiveLevelQuestionCounts;
        if (!row.soCau[level]) {
          row.soCau[level] = { TN: 0, DS: 0, TNgan: 0, TL: 0 };
        }
        row.soCau[level][type] = (row.soCau[level][type] || 0) + 1;
        diff--;
        i++;
      }
    } else {
      // Thừa câu/ý -> tự động giảm bớt
      let toReduce = -diff;
      for (const level of ['vanDung', 'thongHieu', 'nhanBiet'] as (keyof CognitiveLevelQuestionCounts)[]) {
        for (const row of allRows) {
          if (toReduce <= 0) break;
          if (row.soCau[level] && (row.soCau[level][type] || 0) > 0) {
            const reduceAmount = Math.min(toReduce, row.soCau[level][type]);
            row.soCau[level][type] -= reduceAmount;
            toReduce -= reduceAmount;
          }
        }
        if (toReduce <= 0) break;
      }
    }
  };

  balanceType('TN', totalTN, targetTN);
  balanceType('DS', totalDS, targetDS);
  balanceType('TNgan', totalTNgan, targetTNgan);
  balanceType('TL', totalTL, targetTL);

  return spec;
};

/**
 * Sinh bảng HTML Ma trận chuẩn 100% theo Công văn 7991 của Bộ GD&ĐT
 * Tính toán hoàn toàn bằng JavaScript số học, đảm bảo không bao giờ
 * bị sai lệch số câu, số ý hoặc điểm số.
 */
export const generateHtmlFromSpec = (
  spec: SpecData,
  config: MatrixConfig,
  title: string,
  year?: string
): string => {
  // 1. Tính toán tổng toàn bộ các cột
  let sumTN = { nb: 0, th: 0, vd: 0 };
  let sumDS = { nb: 0, th: 0, vd: 0 };
  let sumTNgan = { nb: 0, th: 0, vd: 0 };
  let sumTL = { nb: 0, th: 0, vd: 0 };

  spec.forEach(topic => {
    if (!Array.isArray(topic.rows)) return;
    topic.rows.forEach(row => {
      const s = row.soCau;
      if (!s) return;
      sumTN.nb += (s.nhanBiet?.TN || 0);
      sumTN.th += (s.thongHieu?.TN || 0);
      sumTN.vd += (s.vanDung?.TN || 0) + (s.vanDungCao?.TN || 0);

      sumDS.nb += (s.nhanBiet?.DS || 0);
      sumDS.th += (s.thongHieu?.DS || 0);
      sumDS.vd += (s.vanDung?.DS || 0) + (s.vanDungCao?.DS || 0);

      sumTNgan.nb += (s.nhanBiet?.TNgan || 0);
      sumTNgan.th += (s.thongHieu?.TNgan || 0);
      sumTNgan.vd += (s.vanDung?.TNgan || 0) + (s.vanDungCao?.TNgan || 0);

      sumTL.nb += (s.nhanBiet?.TL || 0);
      sumTL.th += (s.thongHieu?.TL || 0);
      sumTL.vd += (s.vanDung?.TL || 0) + (s.vanDungCao?.TL || 0);
    });
  });

  const totalTNCount = sumTN.nb + sumTN.th + sumTN.vd;
  const totalDSCount = sumDS.nb + sumDS.th + sumDS.vd;
  const totalTNganCount = sumTNgan.nb + sumTNgan.th + sumTNgan.vd;
  const totalTLCount = sumTL.nb + sumTL.th + sumTL.vd;

  const pointsTN = totalTNCount * config.diemCauNhieuLuaChon;
  const pointsDS = totalDSCount * config.diemMoiYTrongCauDungSai;
  const pointsTNgan = totalTNganCount * config.diemCauTraLoiNgan;
  const pointsTL = totalTLCount * config.diemCauTuLuan;

  const titleParts = [title ? title.toUpperCase() : '', year ? `NĂM HỌC ${year}` : ''].filter(Boolean);
  const finalCaption = titleParts.length > 0 ? ` ${titleParts.join(' - ')}` : '';

  // 2. Tạo khung bảng HTML
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

  let dsQuestionCounter = 0;
  let tnQuestionCounter = 1;
  let tnganQuestionCounter = 1;
  let tlQuestionCounter = 1;

  spec.forEach((topic, topicIdx) => {
    const romanNumeral = toRoman(topicIdx + 1);
    html += `<tr style="font-weight: bold; background-color: #f2f2f2;"><td>${romanNumeral}</td><td colspan="17" style="text-align: left;">${topic.chuDe}</td></tr>`;

    if (!Array.isArray(topic.rows)) return;

    topic.rows.forEach(row => {
      const s = row.soCau || {
        nhanBiet: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
        thongHieu: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
        vanDung: { TN: 0, DS: 0, TNgan: 0, TL: 0 },
        vanDungCao: { TN: 0, DS: 0, TNgan: 0, TL: 0 }
      };

      const tn_nb = s.nhanBiet?.TN || 0;
      const tn_th = s.thongHieu?.TN || 0;
      const tn_vd = (s.vanDung?.TN || 0) + (s.vanDungCao?.TN || 0);

      const ds_nb = s.nhanBiet?.DS || 0;
      const ds_th = s.thongHieu?.DS || 0;
      const ds_vd = (s.vanDung?.DS || 0) + (s.vanDungCao?.DS || 0);

      const tngan_nb = s.nhanBiet?.TNgan || 0;
      const tngan_th = s.thongHieu?.TNgan || 0;
      const tngan_vd = (s.vanDung?.TNgan || 0) + (s.vanDungCao?.TNgan || 0);

      const tl_nb = s.nhanBiet?.TL || 0;
      const tl_th = s.thongHieu?.TL || 0;
      const tl_vd = (s.vanDung?.TL || 0) + (s.vanDungCao?.TL || 0);

      const tnCount = tn_nb + tn_th + tn_vd;
      const tnPoints = tnCount * config.diemCauNhieuLuaChon;

      const dsYCount = ds_nb + ds_th + ds_vd;
      const dsPoints = dsYCount * config.diemMoiYTrongCauDungSai;

      const tnganCount = tngan_nb + tngan_th + tngan_vd;
      const tnganPoints = tnganCount * config.diemCauTraLoiNgan;

      const tlCount = tl_nb + tl_th + tl_vd;
      const tlPoints = tlCount * config.diemCauTuLuan;

      const rowTotalPoints = tnPoints + dsPoints + tnganPoints + tlPoints;

      // Hàm định dạng ô câu hỏi chuẩn: số lượng (C...) <br/> (điểm)
      const fmtQ = (count: number, unitPoint: number, startQNum: number) => {
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
        return `${count}(${labelStr})<br/>(${parseFloat(p.toFixed(2))}đ)`;
      };

      // Xử lý câu Đúng - Sai
      const hasDsY = dsYCount > 0;
      if (hasDsY) dsQuestionCounter++;
      const currentDsQNum = dsQuestionCounter;

      const fmtDs = (yCount: number, startIdx: number) => {
        if (!yCount || yCount <= 0) return '';
        const yLabel = formatDsYLabel(currentDsQNum, yCount, startIdx);
        const p = yCount * config.diemMoiYTrongCauDungSai;
        return `${yLabel}<br/>(${parseFloat(p.toFixed(2))}đ)`;
      };

      // Hàm format ô tổng Biết / Hiểu / VD của hàng
      const formatTotalCell = (cauCount: number, yCount: number, points: number) => {
        if (cauCount === 0 && yCount === 0) return '';
        const ptsStr = parseFloat(points.toFixed(2));
        if (cauCount > 0 && yCount > 0) {
          return `(${cauCount} câu, ${yCount} ý - ${ptsStr})`;
        }
        if (cauCount > 0) {
          return `(${cauCount} câu - ${ptsStr})`;
        }
        return `(${yCount} ý - ${ptsStr})`;
      };

      const nb_cau = tn_nb + tngan_nb + tl_nb;
      const nb_y = ds_nb;
      const nb_points = tn_nb * config.diemCauNhieuLuaChon + tngan_nb * config.diemCauTraLoiNgan + tl_nb * config.diemCauTuLuan + nb_y * config.diemMoiYTrongCauDungSai;

      const th_cau = tn_th + tngan_th + tl_th;
      const th_y = ds_th;
      const th_points = tn_th * config.diemCauNhieuLuaChon + tngan_th * config.diemCauTraLoiNgan + tl_th * config.diemCauTuLuan + th_y * config.diemMoiYTrongCauDungSai;

      const vd_cau = tn_vd + tngan_vd + tl_vd;
      const vd_y = ds_vd;
      const vd_points = tn_vd * config.diemCauNhieuLuaChon + tngan_vd * config.diemCauTraLoiNgan + tl_vd * config.diemCauTuLuan + vd_y * config.diemMoiYTrongCauDungSai;

      const rowPercent = rowTotalPoints > 0 ? parseFloat(((rowTotalPoints / 10) * 100).toFixed(1)) : 0;

      html += `<tr>
        <td>${row.tt}</td>
        <td style="text-align: left;">${row.noiDung}</td>
        
        <td>${fmtQ(tn_nb, config.diemCauNhieuLuaChon, tnQuestionCounter)}</td>
        <td>${fmtQ(tn_th, config.diemCauNhieuLuaChon, tnQuestionCounter += tn_nb)}</td>
        <td>${fmtQ(tn_vd, config.diemCauNhieuLuaChon, tnQuestionCounter += tn_th)}</td>
        ${(() => { tnQuestionCounter += tn_vd; return ''; })()}

        <td>${hasDsY ? fmtDs(ds_nb, 0) : ''}</td>
        <td>${hasDsY ? fmtDs(ds_th, ds_nb) : ''}</td>
        <td>${hasDsY ? fmtDs(ds_vd, ds_nb + ds_th) : ''}</td>

        <td>${fmtQ(tngan_nb, config.diemCauTraLoiNgan, tnganQuestionCounter)}</td>
        <td>${fmtQ(tngan_th, config.diemCauTraLoiNgan, tnganQuestionCounter += tngan_nb)}</td>
        <td>${fmtQ(tngan_vd, config.diemCauTraLoiNgan, tnganQuestionCounter += tngan_th)}</td>
        ${(() => { tnganQuestionCounter += tngan_vd; return ''; })()}

        <td>${fmtQ(tl_nb, config.diemCauTuLuan, tlQuestionCounter)}</td>
        <td>${fmtQ(tl_th, config.diemCauTuLuan, tlQuestionCounter += tl_nb)}</td>
        <td>${fmtQ(tl_vd, config.diemCauTuLuan, tlQuestionCounter += tl_th)}</td>
        ${(() => { tlQuestionCounter += tl_vd; return ''; })()}
        
        <td>${formatTotalCell(nb_cau, nb_y, nb_points)}</td>
        <td>${formatTotalCell(th_cau, th_y, th_points)}</td>
        <td>${formatTotalCell(vd_cau, vd_y, vd_points)}</td> 
        <td>${rowPercent > 0 ? `${rowPercent}%` : '0%'}</td>
      </tr>`;
    });
  });

  // 3. Tính toán dòng Footer chuẩn tuyệt đối
  const footer_nb_cau = sumTN.nb + sumTNgan.nb + sumTL.nb;
  const footer_nb_y = sumDS.nb;
  const footer_nb_points = sumTN.nb * config.diemCauNhieuLuaChon + sumTNgan.nb * config.diemCauTraLoiNgan + sumTL.nb * config.diemCauTuLuan + sumDS.nb * config.diemMoiYTrongCauDungSai;

  const footer_th_cau = sumTN.th + sumTNgan.th + sumTL.th;
  const footer_th_y = sumDS.th;
  const footer_th_points = sumTN.th * config.diemCauNhieuLuaChon + sumTNgan.th * config.diemCauTraLoiNgan + sumTL.th * config.diemCauTuLuan + sumDS.th * config.diemMoiYTrongCauDungSai;

  const footer_vd_cau = sumTN.vd + sumTNgan.vd + sumTL.vd;
  const footer_vd_y = sumDS.vd;
  const footer_vd_points = sumTN.vd * config.diemCauNhieuLuaChon + sumTNgan.vd * config.diemCauTraLoiNgan + sumTL.vd * config.diemCauTuLuan + sumDS.vd * config.diemMoiYTrongCauDungSai;

  const formatFooterTotal = (cauCount: number, yCount: number, points: number) => {
    const ptsStr = parseFloat(points.toFixed(2));
    if (cauCount > 0 && yCount > 0) return `(${cauCount} câu, ${yCount} ý - ${ptsStr})`;
    if (cauCount > 0) return `(${cauCount} câu - ${ptsStr})`;
    if (yCount > 0) return `(${yCount} ý - ${ptsStr})`;
    return `(0 - 0)`;
  };

  // Tính tổng số câu lớn toàn bài thi:
  // Ví dụ: 12 câu TN + 2 câu ĐS + 8 câu TLN + 3 câu TL = 25 câu (kèm 8 ý Đúng-Sai)
  const tongSoCauLon = config.isTuLuan100
    ? config.soCauTuLuan
    : ((Number(config.soCauNhieuLuaChon) || 0) + (Number(config.soCauDungSai) || 0) + (Number(config.soCauTraLoiNgan) || 0) + (Number(config.soCauTuLuan) || 0));

  const grandTotalString = totalDSCount > 0
    ? `(${tongSoCauLon} câu, ${totalDSCount} ý - 10.0)`
    : `(${tongSoCauLon} câu - 10.0)`;

  html += `</tbody>
    <tfoot>
        <tr style="font-weight: bold;">
            <td colspan="2">Tổng (Số câu, ý - Điểm)</td>
            <td>(${sumTN.nb || 0} câu - ${(sumTN.nb * config.diemCauNhieuLuaChon).toFixed(1)})</td>
            <td>(${sumTN.th || 0} câu - ${(sumTN.th * config.diemCauNhieuLuaChon).toFixed(1)})</td>
            <td>(${sumTN.vd || 0} câu - ${(sumTN.vd * config.diemCauNhieuLuaChon).toFixed(1)})</td>
            
            <td>(${sumDS.nb > 0 ? `${sumDS.nb} ý` : '0'} - ${(sumDS.nb * config.diemMoiYTrongCauDungSai).toFixed(1)})</td>
            <td>(${sumDS.th > 0 ? `${sumDS.th} ý` : '0'} - ${(sumDS.th * config.diemMoiYTrongCauDungSai).toFixed(1)})</td>
            <td>(${sumDS.vd > 0 ? `${sumDS.vd} ý` : '0'} - ${(sumDS.vd * config.diemMoiYTrongCauDungSai).toFixed(1)})</td>
            
            <td>(${sumTNgan.nb || 0} câu - ${(sumTNgan.nb * config.diemCauTraLoiNgan).toFixed(2)})</td>
            <td>(${sumTNgan.th || 0} câu - ${(sumTNgan.th * config.diemCauTraLoiNgan).toFixed(2)})</td>
            <td>(${sumTNgan.vd || 0} câu - ${(sumTNgan.vd * config.diemCauTraLoiNgan).toFixed(2)})</td>
            
            <td>(${sumTL.nb || 0} câu - ${(sumTL.nb * config.diemCauTuLuan).toFixed(1)})</td>
            <td>(${sumTL.th || 0} câu - ${(sumTL.th * config.diemCauTuLuan).toFixed(1)})</td>
            <td>(${sumTL.vd || 0} câu - ${(sumTL.vd * config.diemCauTuLuan).toFixed(1)})</td>
            
            <td>${formatFooterTotal(footer_nb_cau, footer_nb_y, footer_nb_points)}</td>
            <td>${formatFooterTotal(footer_th_cau, footer_th_y, footer_th_points)}</td>
            <td>${formatFooterTotal(footer_vd_cau, footer_vd_y, footer_vd_points)}</td>
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
