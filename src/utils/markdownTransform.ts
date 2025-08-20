// src/utils/markdownUtils.ts

interface Reading {
  equipment: string;
  class1: string;
  class2: string;
  design: string;
  measure: string;
}

export const generateMarkdownReport = (readings: Reading[], messages: string[]): string => {
  if (readings.length === 0 && messages.length === 0) {
    return "제출된 데이터가 없습니다.";
  }

  // 1. equipment(대상설비) 기준으로 데이터 그룹화
  const groupedReadings = readings.reduce((acc, reading) => {
    const { equipment } = reading;
    if (!acc[equipment]) {
      acc[equipment] = [];
    }
    acc[equipment].push(reading);
    return acc;
  }, {} as Record<string, Reading[]>);

  let markdownString = '';

  // 2. 그룹화된 데이터를 바탕으로 설비별 마크다운 테이블 생성
  for (const equipment in groupedReadings) {
    markdownString += `## ${equipment}\n\n`;
    markdownString += `| 세부 점검 항목 | 설계값 | 측정값 |\n`;
    markdownString += `| :--- | :--- | :--- |\n`;
    groupedReadings[equipment].forEach(r => {
      markdownString += `| ${r.class2} | ${r.design} | ${r.measure} |\n`;
    });
    markdownString += `\n`;
  }

  // 3. Agent Team 메시지가 있으면 마크다운 목록으로 추가
  if (messages.length > 0) {
    markdownString += `## 📝 Agent Team 의견\n`;
    messages.forEach(msg => {
      markdownString += `- ${msg}\n`;
    });
  }

  return markdownString.trim();
};
