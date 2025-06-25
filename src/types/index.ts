
export interface Reading {
  equipment: string;
  class1: string;
  class2: string;
  design: string;
  measure: string;
}

export interface LogEntry {
  id: string;
  tag: string;
  content: string;
  isResponse?: boolean;
  timestamp: number;
  // HTML 필드들
  diagnosis_summary_html?: string;
  complementary_summary_html?: string;
  precision_verification_html?: string;
  final_summary_html?: string;
}
