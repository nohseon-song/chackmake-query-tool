// src/components/LogDisplay.tsx

// 맨 위에 이 줄들을 추가하거나 수정합니다.
import React, { useRef } from 'react'; // React, useRef만 필요
import html2pdf from 'html2pdf.js'; // PDF 다운로드를 위해 필요
import { createGoogleDoc } from '@/utils/googleDocsUtils'; // Google Docs 내보내기를 위해 필요
// Note: useAuth hook is not available in this project

// LogDisplay 컴포넌트가 받을 props(데이터)의 종류를 정의합니다.
interface LogDisplayProps {
  logs: any[]; // 단계별 로그 데이터 배열
  reportContent: string; // 최종 보고서의 HTML 내용
  isDownloadReady: boolean; // 다운로드 버튼 활성화 여부
  processingMessage: string; // 사용자에게 보여줄 처리 중 메시지
  // isDark, equipment 등 기존 prop이 있다면 여기에 추가할 수 있지만,
  // 이 예시에서는 핵심 기능에만 집중합니다.
  isDark?: boolean; // 앱의 다크 모드 여부 (필요시)
  equipment?: string; // 장비명 (필요시)
}

const LogDisplay: React.FC<LogDisplayProps> = ({
  logs,
  reportContent,
  isDownloadReady,
  processingMessage,
  isDark, // isDark prop을 받습니다.
  equipment, // equipment prop을 받습니다.
}) => {
  // const { session } = useAuth(); // useAuth is not available
  const reportRef = useRef<HTMLDivElement>(null); // PDF 생성을 위한 숨겨진 내용을 참조할 변수

  // PDF 다운로드 버튼 클릭 시 실행될 함수
  const handlePdfDownload = async () => {
      if (!reportRef.current) {
          console.error('PDF로 변환할 보고서 내용을 찾을 수 없습니다.');
          return;
      }

      // 사용자에게 메시지 표시
      alert('PDF를 생성 중입니다. 잠시만 기다려 주세요...'); // toast 대신 alert 사용 (더 간단)

      // PDF 생성 옵션 설정
      const options = {
          margin: 10,
          filename: `기술검토진단결과_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      try {
          // reportRef에 있는 HTML 내용을 PDF로 변환하여 저장
          await html2pdf().from(reportRef.current).set(options).save();
          alert('PDF 다운로드 완료!');
      } catch (error) {
          console.error('PDF 다운로드 중 오류 발생:', error);
          alert(`PDF 다운로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
  };

  // Google Docs 내보내기 버튼 클릭 시 실행될 함수
  const handleGoogleDocsDownload = async () => {
      if (!reportContent) {
          console.error('Google Docs로 내보낼 내용이 없습니다.');
          return;
      }
      // Note: Authentication check disabled for now
      // if (!session?.access_token) {
      //     alert('Google 인증 토큰이 없습니다. 다시 로그인해주세요.');
      //     return;
      // }

      // 사용자에게 메시지 표시
      alert('Google Docs로 내보내는 중입니다. 잠시만 기다려 주세요...'); // toast 대신 alert 사용 (더 간단)

      try {
          // createGoogleDoc 함수를 호출하여 Google Docs 문서 생성
          // reportContent(최종 HTML)와 액세스 토큰, 그리고 장비명(equipment)을 전달합니다.
          const documentUrl = await createGoogleDoc(reportContent, 'dummy-token', equipment || undefined);

          alert(`Google 문서가 성공적으로 생성되었습니다! 새 탭에서 문서를 확인하세요.`);
          // 새 탭에서 생성된 문서 열기
          window.open(documentUrl, '_blank');
      } catch (error) {
          console.error('Google Docs 내보내기 중 오류 발생:', error);
          alert(`Google Docs 내보내기 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
  };

  return (
    <div className="mt-4 space-y-2"> {/* 기존 div 유지 */}
      {/* 처리 중 메시지 표시 */}
      {processingMessage && (
        <div className="processing-message" style={{ padding: '10px', backgroundColor: '#e0f7fa', borderLeft: '5px solid #00bcd4', marginBottom: '10px' }}>
          {processingMessage}
        </div>
      )}

      {/* 단계별 로그가 표시될 실제 영역 */}
      <div
        id="chat-log" // 기존 id 유지
        className={`p-4 rounded-lg border-l-4 border-blue-500 ${
          isDark ? 'bg-gray-800 text-white' : 'bg-white text-black' // isDark prop 사용
        } shadow-sm`}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: '1.6',
          margin: 0,
          padding: '16px',
          minHeight: '200px', // 최소 높이 설정 (내용이 없어도 보임)
          overflowY: 'auto' // 내용이 넘치면 스크롤
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: isDark ? '#aaa' : '#555' }}>여기에 Make.com의 단계별 결과가 실시간으로 표시됩니다.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-item log-type-${log.type}`} style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <div style={{ fontSize: '0.8em', color: isDark ? '#bbb' : '#888' }}>
                {new Date(log.timestamp).toLocaleString()} ({log.source})
              </div>
              {/* **** '이상한 기호' 문제 해결의 핵심! **** */}
              {/* HTML 콘텐츠를 HTML처럼 렌더링합니다. */}
              <div
                className="log-content"
                dangerouslySetInnerHTML={{ __html: log.content }}
                style={{ marginTop: '5px', color: isDark ? '#ddd' : '#333' }}
              ></div>
            </div>
          ))
        )}
      </div>

      {/* 최종 보고서가 준비되면 다운로드 버튼 표시 */}
      {isDownloadReady && reportContent && (
        <div className="final-report-section" style={{ marginTop: '20px', textAlign: 'center' }}>
          <h3 style={{ color: isDark ? '#fff' : '#333' }}>최종 보고서 준비 완료!</h3>
          {/* PDF 다운로드를 위한 숨겨진 내용 영역 */}
          {/* reportContent가 여기에 들어가서 PDF로 변환됩니다. */}
          <div ref={reportRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm', padding: '10mm', backgroundColor: 'white', color: 'black' }}>
            <div dangerouslySetInnerHTML={{ __html: reportContent }}></div>
          </div>
          
          <button 
            onClick={handlePdfDownload} 
            style={{ 
              backgroundColor: '#4CAF50', color: 'white', padding: '10px 20px', 
              border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' 
            }}
          >
            PDF 다운로드
          </button>
          <button 
            onClick={handleGoogleDocsDownload} 
            style={{ 
              backgroundColor: '#4285F4', color: 'white', padding: '10px 20px', 
              border: 'none', borderRadius: '5px', cursor: 'pointer' 
            }}
          >
            Google Docs 내보내기
          </button>
        </div>
      )}
      
      {/* 스타일을 위한 <style> 태그 (기존 코드와 유사하게 유지) */}
      {/* getReportStyles 함수는 이제 이 컴포넌트의 props를 직접 사용해야 합니다. */}
      {/* <style>{getReportStyles(isDark)}</style> */}
      {/* 만약 getReportStyles가 이 컴포넌트의 isDark prop을 사용한다면, ReportHeader를 통하지 않고 직접 사용합니다. */}
    </div>
  );
};

export default LogDisplay;
