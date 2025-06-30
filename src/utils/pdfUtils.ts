
// PDF 다운로드 유틸리티
const loadHtml2Pdf = () =>
  new Promise((resolve, reject) => {
    if ((window as any).html2pdf) {
      return resolve((window as any).html2pdf);
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      if ((window as any).html2pdf) {
        resolve((window as any).html2pdf);
      } else {
        reject(new Error('html2pdf 라이브러리 로드 실패'));
      }
    };
    script.onerror = () => reject(new Error('html2pdf 스크립트 로드 실패'));
    document.head.appendChild(script);
  });

export const downloadPdf = async (element: HTMLElement) => {
  if (!element) {
    console.error('PDF 변환할 요소가 없습니다.');
    return;
  }
  
  try {
    console.log('PDF 다운로드 시작...');
    const html2pdf = await loadHtml2Pdf();
    console.log('html2pdf 라이브러리 로드 완료');
    
    // 현재 시각을 파일명에 포함
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `기술검토진단결과_${timestamp}.pdf`;
    
    const options = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after'
      }
    };

    console.log('PDF 생성 옵션:', options);
    
    await (html2pdf as any)()
      .set(options)
      .from(element)
      .save();
      
    console.log('PDF 다운로드 완료');
      
  } catch (error) {
    console.error('PDF 다운로드 중 오류:', error);
    
    // 대체 다운로드 방법 - 텍스트 파일로 저장
    try {
      const textContent = element.innerText || element.textContent || '';
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `기술검토진단결과_${new Date().toLocaleDateString()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('텍스트 파일로 대체 다운로드 완료');
    } catch (fallbackError) {
      console.error('대체 다운로드도 실패:', fallbackError);
      alert('파일 다운로드에 실패했습니다. 브라우저 설정을 확인해주세요.');
    }
  }
};
