import { supabase } from '@/integrations/supabase/client';

// 스트리밍을 위한 새롭고 완전한 함수
export const sendWebhookDataStream = (payload: any): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        return reject(new Error("인증 토큰이 없습니다. 다시 로그인해주세요."));
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-webhook-to-make`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        return reject(new Error("스트리밍 응답을 사용할 수 없습니다."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resolved = false;

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (!resolved) {
               reject(new Error("스트림이 데이터를 반환하기 전에 종료되었습니다."));
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            try {
              const json = JSON.parse(line);
              if (json.type === 'final' && json.data) {
                resolved = true;
                resolve(json.data);
                reader.cancel();
                return; 
              } else if (json.type === 'error') {
                resolved = true;
                reject(new Error(json.message));
                reader.cancel();
                return;
              }
            } catch (e) {
              console.warn('스트림 데이터 파싱 실패:', line);
            }
          }
        }
      };
      await processStream();

    } catch (error) {
      reject(error);
    }
  });
};
