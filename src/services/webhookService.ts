import { supabase } from '@/integrations/supabase/client';

// 기존의 sendWebhookData 함수는 이제 사용되지 않으므로 그대로 두거나 지워도 됩니다.
export const sendWebhookData = async (payload: any) => {
  console.warn("sendWebhookData is deprecated, use sendWebhookDataStream instead.");
  const { data, error } = await supabase.functions.invoke('send-webhook-to-make', {
    body: payload,
  });
  if (error) throw error;
  return data;
};

// [ ✨ 스트리밍을 위한 최종 수정 함수! ✨ ]
// 이 함수는 타임아웃 문제를 해결하기 위해 스트리밍 방식으로 통신합니다.
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
          
          // [ ✨ 여기가 핵심 수정 포인트! ✨ ]
          // 스트림이 끝나면 (done=true), 루프를 멈춘다.
          // 더 이상 이것을 에러로 취급하지 않는다.
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
                resolve(json.data); // 최종 데이터를 받으면 Promise를 성공으로 끝냄
                reader.cancel(); // 스트림 읽기 중단
                return; 
              } else if (json.type === 'error') {
                resolved = true;
                reject(new Error(json.message)); // 에러를 받으면 Promise를 실패로 끝냄
                reader.cancel(); // 스트림 읽기 중단
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
