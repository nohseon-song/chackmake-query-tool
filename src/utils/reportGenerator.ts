// 기계설비 성능진단 보고서 자동 생성 유틸리티

export const generateProfessionalReport = (rawContent: string, customTitle?: string): string => {
  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\. /g, '.').replace('.', '');

  // 기본 제목 설정
  const defaultTitle = `기계설비 성능진단 보고서 - ${currentDate}`;
  const reportTitle = customTitle?.trim() || defaultTitle;

  // 원문 내용을 문단으로 분리
  const paragraphs = rawContent
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // 보고서 구조 생성
  let reportHtml = `<h1>${reportTitle}</h1>\n\n`;

  // 기본 정보 섹션
  reportHtml += `<h2>1. 진단 개요</h2>\n`;
  reportHtml += `<p><strong>진단 일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>\n`;
  reportHtml += `<p><strong>보고서 생성:</strong> 자동 생성 시스템</p>\n\n`;

  // 내용 분석 및 구조화
  const structuredContent = analyzeAndStructureContent(paragraphs);
  
  // 각 섹션별로 HTML 생성
  structuredContent.forEach((section, index) => {
    reportHtml += `<h2>${index + 2}. ${section.title}</h2>\n`;
    
    section.content.forEach(paragraph => {
      const formattedParagraph = formatParagraph(paragraph);
      reportHtml += `<p>${formattedParagraph}</p>\n`;
    });
    
    reportHtml += `\n`;
  });

  // 결론 섹션 추가
  const conclusionIndex = structuredContent.length + 2;
  reportHtml += `<h2>${conclusionIndex}. 종합 결론</h2>\n`;
  reportHtml += `<p><strong>상기 진단 결과를 종합하면 다음과 같습니다.</strong></p>\n`;
  reportHtml += `<p>본 보고서는 기계설비의 현재 상태를 객관적으로 평가하여 작성되었으며, 향후 유지보수 및 성능 개선을 위한 기초 자료로 활용될 수 있습니다.</p>\n\n`;

  // 작성자 정보
  reportHtml += `<h3>작성자 정보</h3>\n`;
  reportHtml += `<p><strong>시스템:</strong> 기계설비 성능진단 자동화 시스템</p>\n`;
  reportHtml += `<p><strong>생성일:</strong> ${new Date().toLocaleString('ko-KR')}</p>\n`;

  return reportHtml;
};

interface ReportSection {
  title: string;
  content: string[];
}

const analyzeAndStructureContent = (paragraphs: string[]): ReportSection[] => {
  const sections: ReportSection[] = [];
  
  // 키워드 기반 섹션 분류
  const sectionKeywords = {
    '측정 결과': ['측정', '수치', '값', 'kgf', 'cm²', 'rpm', '온도', '압력', '유량'],
    '진단 결과': ['진단', '판정', '상태', '정상', '이상', '불량', '양호'],
    '분석 내용': ['분석', '검토', '평가', '비교', '기준', '규격'],
    '개선 사항': ['개선', '보수', '교체', '조치', '권고', '제안'],
    '기술적 검토': ['기술', '전문', '공학', '설계', '기준값', '표준']
  };

  let currentSection: ReportSection | null = null;
  let unclassifiedContent: string[] = [];

  paragraphs.forEach(paragraph => {
    let classified = false;
    
    // 각 섹션 키워드와 매칭
    for (const [sectionTitle, keywords] of Object.entries(sectionKeywords)) {
      if (keywords.some(keyword => paragraph.includes(keyword))) {
        // 새 섹션 시작
        if (currentSection && currentSection.title !== sectionTitle) {
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
        }
        
        if (!currentSection || currentSection.title !== sectionTitle) {
          currentSection = { title: sectionTitle, content: [] };
        }
        
        currentSection.content.push(paragraph);
        classified = true;
        break;
      }
    }
    
    if (!classified) {
      if (currentSection) {
        currentSection.content.push(paragraph);
      } else {
        unclassifiedContent.push(paragraph);
      }
    }
  });

  // 마지막 섹션 추가
  if (currentSection && currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  // 분류되지 않은 내용이 있으면 '기타 내용' 섹션으로 추가
  if (unclassifiedContent.length > 0) {
    sections.unshift({
      title: '진단 내용',
      content: unclassifiedContent
    });
  }

  // 섹션이 없으면 기본 구조 생성
  if (sections.length === 0) {
    sections.push({
      title: '진단 내용',
      content: paragraphs
    });
  }

  return sections;
};

const formatParagraph = (paragraph: string): string => {
  let formatted = paragraph;

  // 수치 강조 (숫자 + 단위)
  formatted = formatted.replace(
    /(\d+(?:\.\d+)?)\s*(kgf\/cm²|rpm|℃|°C|bar|psi|mm|cm|m|kg|톤|%)/g,
    '<strong>$1 $2</strong>'
  );

  // 중요 키워드 강조
  const importantKeywords = [
    '정상', '이상', '불량', '양호', '주의', '위험', '긴급',
    '교체 필요', '점검 필요', '정비 필요', '즉시', '권고'
  ];
  
  importantKeywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword})`, 'gi');
    formatted = formatted.replace(regex, '<strong>$1</strong>');
  });

  // 특수문자 제거
  formatted = formatted.replace(/[#*\[\]{}]/g, '');
  
  // 번호 형식 변경 (#1 → 제1, *1 → 첫째)
  formatted = formatted.replace(/#(\d+)/g, '제$1');
  formatted = formatted.replace(/\*(\d+)/g, '제$1');

  // 문장이 너무 길면 적절한 지점에서 줄바꿈
  if (formatted.length > 100) {
    formatted = formatted.replace(/([.。]) (?=[가-힣])/g, '$1<br>');
  }

  return formatted;
};

// Google Docs용 파일명 생성
export const generateReportFileName = (): string => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  
  return `기술진단내역작성_ultra_${year}.${month}.${day}`;
};