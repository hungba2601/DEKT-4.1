




export interface MatrixConfig {
  tracNghiem: number; // Tỷ lệ điểm
  tuLuan: number; // Tỷ lệ điểm
  biet: number; // Tỷ lệ điểm
  hieu: number; // Tỷ lệ điểm
  vanDung: number; // Tỷ lệ điểm
  soCauNhieuLuaChon: number;
  soCauTuLuan: number;
  soCauDungSai: number;
  soCauTraLoiNgan: number;
  soYTrongCauDungSai: number;
  diemCauNhieuLuaChon: number;
  diemCauTuLuan: number;
  diemMoiYTrongCauDungSai: number;
  diemCauTraLoiNgan: number;
  isTuLuan100?: boolean;
  additionalPrompt?: string; // Yêu cầu bổ sung (ví dụ: Phân môn Sinh 5đ, Lý 2.5đ...)
}

export interface QuestionCounts {
  TN: number; // Trắc nghiệm nhiều lựa chọn
  DS: number; // Đúng - Sai
  TNgan: number; // Trả lời ngắn
  TL: number; // Tự luận
}

export interface CognitiveLevelQuestionCounts {
  nhanBiet: QuestionCounts;
  thongHieu: QuestionCounts;
  vanDung: QuestionCounts;
  vanDungCao: QuestionCounts;
}

export interface SpecRowData {
  tt: string;
  noiDung: string;
  yeuCauCanDat: string;
  soCau: CognitiveLevelQuestionCounts;
}

export interface SpecTopicData {
  chuDe: string;
  rows: SpecRowData[];
}

export type SpecData = SpecTopicData[];

export interface User {
  email: string;
  plan: 'free' | 'full';
  role: 'admin' | 'user';
  password?: string;
}

export type TabName = 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5' | 'tab6' | 'tab7';

export const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (Siêu nhanh - Tiết kiệm hạn mức)', description: 'Tối ưu tốc độ phản hồi cực nhanh, nhẹ tải & tiết kiệm hạn mức API' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Thế hệ mới - Suy luận tốt & Ổn định)', description: 'Mô hình thế hệ mới cân bằng tốc độ, suy luận logic cao và ổn định' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Tốc độ cao & Phản hồi tức thì)', description: 'Tốc độ cao & Phản hồi tức thì' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Khuyên dùng - Chuẩn tối ưu & Ổn định)', description: 'Mặc định - Cân bằng hoàn hảo giữa tốc độ & chất lượng', isDefault: true },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Mới nhất - Suy luận nâng cao & Sáng tạo)', description: 'Mới nhất - Suy luận nâng cao & Sáng tạo' }
];

