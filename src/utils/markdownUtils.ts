// src/utils/markdownUtils.ts

interface Reading {
  equipment: string;
  class1: string;
  class2: string;
  design: string;
  measure: string;
}

export const generateMarkdownReport = (readings: Reading[], messages: string[]): string => {
  // 1. Group readings by equipment
  const groupedReadings = readings.reduce((acc, reading) => {
    const { equipment } = reading;
    if (!acc[equipment]) {
      acc[equipment] = [];
    }
    acc[equipment].push(reading);
    return acc;
  }, {} as Record<string, Reading[]>);

  let markdownString = '';

  // 2. Create Markdown tables for each equipment
  for (const equipment in groupedReadings) {
    markdownString += `## ${equipment}\n\n`;
    markdownString += `| 세부 점검 항목 | 설계값 | 측정값 |\n`;
    markdownString += `| :--- | :--- | :--- |\n`;
    groupedReadings[equipment].forEach(r => {
      markdownString += `| ${r.class2} | ${r.design} | ${r.measure} |\n`;
    });
    markdownString += `\n`;
  }

  // 3. Add Agent Team messages
  if (messages.length > 0) {
    markdownString += `## 📝 Agent Team 의견\n`;
    messages.forEach(msg => {
      markdownString += `- ${msg}\n`;
    });
  }

  return markdownString.trim();
};