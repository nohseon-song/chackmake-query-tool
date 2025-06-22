
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
}
