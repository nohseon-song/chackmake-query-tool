// =================================================================
// [최종 안정화 버전] HTML을 Google Docs 요청으로 변환하는 엔진
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    // 최종 결과물인 API 요청 객체를 담을 배열
    const requests: any[] = [];
    // Google Docs 문서 내 텍스트 위치를 추적하는 인덱스
    let currentIndex = 1;

    // Make.com 등에서 넘어온 원본 HTML을 바로 사용 (단순 공백, 줄바꿈 정규화)
    const normalizedHtml = htmlContent.replace(/>\s+</g, '><').trim();

    // HTML을 태그(<...>)와 텍스트로 분리하여 배열로 만듦
    const parts = normalizedHtml.split(/(<[^>]+>)/g).filter(Boolean);

    // 스타일 상태를 관리하는 변수 (ex: <strong> 태그가 열려있는가?)
    let isBold = false;

    for (const part of parts) {
        // 1. 태그(<...>) 처리 부분
        if (part.startsWith('<')) {
            // 굵은 글씨 태그를 만나면 isBold 상태를 변경
            if (part.startsWith('<strong>') || part.startsWith('<b>')) {
                isBold = true;
            } else if (part.startsWith('</strong>') || part.startsWith('</b>')) {
                isBold = false;
            }
            // 다른 태그(h1, p 등)는 텍스트 스타일링에서 처리하므로 여기서는 별도 작업 없음
            continue; // 태그 처리가 끝났으면 다음 부분으로 넘어감
        }

        // 2. 순수 텍스트 처리 부분
        // HTML 엔티티 코드(예: &nbsp;)를 실제 문자로 변환
        const text = part.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        // 내용이 없는 텍스트는 건너뜀
        if (!text.trim()) continue;

        // 문서에 삽입할 텍스트. 가독성을 위해 항상 줄바꿈(\n)을 추가.
        const textToInsert = text + '\n';
        const startIndex = currentIndex;

        // [API 요청 1] 텍스트 삽입
        requests.push({
            insertText: {
                location: { index: startIndex },
                text: textToInsert,
            },
        });
        
        const endIndex = startIndex + textToInsert.length;

        // [API 요청 2] 삽입된 텍스트에 서식 적용
        const textStyle: any = { fontSize: { magnitude: 11, unit: 'PT' } };
        let fields = 'fontSize';

        // 내용에 따라 동적으로 스타일 결정
        if (text.includes('기술검토 및 진단 종합 보고서')) {
            textStyle.fontSize = { magnitude: 20, unit: 'PT' };
            textStyle.bold = true;
            fields += ',bold';
        } else if (text.includes('전문가 (')) {
            textStyle.fontSize = { magnitude: 14, unit: 'PT' };
            textStyle.bold = true;
            fields += ',bold';
        } else if (text.match(/^(핵심 진단 요약|주요 조언|최종 종합 의견|추가 및 대안 권고)/)) {
            textStyle.fontSize = { magnitude: 12, unit: 'PT' };
            textStyle.bold = true;
            fields += ',bold';
        }
        
        // isBold 상태가 true이면, 무조건 굵게 처리
        if (isBold && !textStyle.bold) {
            textStyle.bold = true;
            fields += ',bold';
        }

        requests.push({
            updateTextStyle: {
                range: { startIndex, endIndex: endIndex - 1 }, // 마지막 줄바꿈 문자는 서식에서 제외
                textStyle,
                fields,
            },
        });

        // 글머리 기호(•)가 있으면, 해당 단락을 불렛 목록으로 만듦
        if (text.trim().startsWith('•')) {
            requests.push({
                createParagraphBullets: {
                    range: { startIndex, endIndex: endIndex - 1 },
                    bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                },
            });
        }
        
        // 다음 텍스트 위치를 위해 인덱스 업데이트
        currentIndex = endIndex;
    }
    return requests;
};