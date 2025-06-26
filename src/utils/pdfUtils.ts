
// PDF 다운로드 유틸리티
const loadHtml2Pdf = () =>
  new Promise((resolve) => {
    if ((window as any).html2pdf) return resolve((window as any).html2pdf);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve((window as any).html2pdf);
    document.body.appendChild(script);
  });

export const downloadPdf = async (element: HTMLElement) => {
  if (!element) return;
  
  try {
    const html2pdf = await loadHtml2Pdf();
    
    await (html2pdf as any)()
      .set({
        filename: 'report.pdf',
        html2canvas: { 
          scale: 2,
          useCORS: true,
          allowTaint: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        },
        margin: {
          top: 5,
          right: 10,
          bottom: 10,
          left: 10
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(element)
      .save();
      
  } catch (error) {
    console.error('PDF 다운로드 중 오류:', error);
  }
};
