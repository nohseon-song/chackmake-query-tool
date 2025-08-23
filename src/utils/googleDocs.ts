import { safeOpenNewTab } from './safeOpen';

// Google Docs 내보내기 유틸리티
export async function exportToGoogleDocs(html: string, equipmentName?: string) {
  // 기존 Google Docs 유틸리티 재사용
  try {
    const { createGoogleDocWithAuth } = await import('@/utils/googleDocsUtils');
    const docUrl = await createGoogleDocWithAuth(html, equipmentName);
    if (docUrl) {
      safeOpenNewTab(docUrl);
    }
  } catch (error) {
    console.error('Google Docs 내보내기 오류:', error);
    throw error;
  }
}