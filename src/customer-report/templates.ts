export type CustomerLang = 'vi' | 'ja';

export interface CustomerLabels {
  readonly title: string;
  readonly empty: string;
  readonly summary: string;
  readonly totalFailures: string;
  readonly unclassified: string;
  readonly dismissedNotCounted: string;
  readonly changedRate: string;
  readonly changedRateDetail: string;
  readonly noRateData: string;
  readonly byCategory: string;
  readonly byAgent: string;
  readonly byModule: string;
  readonly byWeek: string;
  readonly weekNote: string;
  readonly headToHead: string;
  readonly checked: string;
  readonly generatedAt: string;
  readonly since: string;
  readonly privacyNote: string;
}

export const LABELS: Readonly<Record<CustomerLang, CustomerLabels>> = Object.freeze({
  vi: Object.freeze({
    title: 'Báo cáo chất lượng AI (NightOwl)',
    empty: 'Chưa có đủ dữ liệu để báo cáo chất lượng. Hãy commit code do AI viết rồi chạy lại.',
    summary: 'Tóm tắt',
    totalFailures: 'Tổng lỗi (không tính dismissed)',
    unclassified: 'Chưa phân loại',
    dismissedNotCounted: 'Dismissed (không tính)',
    changedRate: 'Tỷ lệ chỉnh sửa code AI',
    changedRateDetail: 'lần lỗi / lần kiểm tra lúc commit',
    noRateData: 'không có dữ liệu',
    byCategory: 'Theo loại lỗi',
    byAgent: 'Theo agent',
    byModule: 'Theo module',
    byWeek: 'Xu hướng theo tuần',
    weekNote: 'UTC; % = tỷ lệ chỉnh sửa code AI',
    headToHead: 'So sánh agent (sửa / kiểm tra)',
    checked: 'đã kiểm tra',
    generatedAt: 'Tạo lúc',
    since: 'Từ ngày',
    privacyNote: 'Báo cáo chỉ đánh giá chất lượng AI; không chứa tên hay email developer.',
  }),
  ja: Object.freeze({
    title: 'AI品質レポート（NightOwl）',
    empty: '品質レポートに必要なデータがまだありません。AIが書いたコードをコミットしてから再実行してください。',
    summary: '概要',
    totalFailures: '失敗件数（dismissed除外）',
    unclassified: '未分類',
    dismissedNotCounted: 'Dismissed（集計外）',
    changedRate: 'AI編集の修正率',
    changedRateDetail: '失敗 / コミット時チェック',
    noRateData: 'データなし',
    byCategory: 'カテゴリ別',
    byAgent: 'エージェント別',
    byModule: 'モジュール別',
    byWeek: '週次トレンド',
    weekNote: 'UTC；% = AI編集の修正率',
    headToHead: 'エージェント比較（修正 / チェック）',
    checked: 'チェック済み',
    generatedAt: '生成日時',
    since: '開始日',
    privacyNote: '本レポートはAI品質のみを評価し、開発者の氏名やメールは含みません。',
  }),
});
