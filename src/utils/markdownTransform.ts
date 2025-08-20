// src/utils/markdownTransform.ts
import { Reading } from '@/types';

export const buildMarkdownFromData = (readings: Reading[], messages: string[]): string => {
  const groups = new Map<string, { class2: string; design: string; measure: string }[]>();

  for (const r of readings || []) {
    const key = r.equipment || '기타';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      class2: r.class2 ?? '',
      design: r.design ?? '',
      measure: r.measure ?? '',
    });
  }

  const sections: string[] = [];

  for (const [equipment, rows] of groups.entries()) {
    const tableRows = rows
      .map(row => `| ${row.class2} | ${row.design} | ${row.measure} |`)
      .join('\n');

    const section = [
      `## ${equipment}`,
      '',
      '| 세부 점검 항목 | 설계값 | 측정값 |',
      '| :--- | :--- | :--- |',
      tableRows,
      '',
    ].join('\n');

    sections.push(section);
  }

  const messagesBlock = [
    '## 📝 Agent Team 의견',
    ...(messages || []).map(m => `- ${m}`),
  ].join('\n');

  return [sections.join('\n'), messagesBlock].join('\n');
};
