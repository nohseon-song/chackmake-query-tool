import { Reading } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// 기존 함수는 그대로 둡니다.
export const sendWebhookData = async (
  payload: { readings?: Reading[]; chat?: string; timestamp: number } & Record<string, any>
) => {
  const wrappedPayload = { ...payload } as any;
  if (wrappedPayload.readings) {
    wrappedPayload.readings = wrappedPayload.readings.map((r: any) => {
      const { id, ...rest } = r;
      return rest;
    });
  }

  const { data, error } = await supabase.functions.invoke('send-webhook-to-make', {
    body: wrappedPayload,
  });

  if (error) {
    throw error;
  }
  return data;
};


// [ ✨ 스트리밍을 위한 새 함수! ✨ ]
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

      if (!response.body) {
        return reject(new Error("스트리밍 응답을 사용할 수 없습니다."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // 스트림이 끝났는데 최종 데이터가 없으면 에러 처리
            reject(new Error("스트림이 비정상적으로 종료되었습니다."));
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
                resolve(json.data); // 최종 데이터를 받으면 Promise를 성공으로 끝냄
                return; // 루프 종료
              } else if (json.type === 'error') {
                reject(new Error(json.message)); // 에러를 받으면 Promise를 실패로 끝냄
                return; // 루프 종료
              }
              // 'ping' 타입은 무시하고 계속 진행
            } catch (e) {
              console.warn('스트림 데이터 파싱 실패:', line);
            }
          }
        }
      };
      processStream();

    } catch (error) {
      reject(error);
    }
  });
};
