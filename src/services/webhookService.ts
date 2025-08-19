// src/services/webhookService.ts

// 맨 위에 이 줄을 추가합니다. 이미 있다면 건너뜁니다.
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

// 스트리밍을 위한 최종 수정 함수!
export const sendWebhookDataStream = (payload: any): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        return reject(new Error("인증 토큰이 없습니다. 다시 로그인해주세요."));
      }

      // --- 이 부분을 정확히 추가합니다. ---
      const requestId = uuidv4(); // 고유한 요청 ID (주문 번호) 생성
      payload.request_id = requestId; // Make.com으로 보낼 데이터에 request_id 추가
      // --- 여기까지 추가 ---

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-webhook-to-make`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload), // 이제 payload에 request_id가 포함되어 전송됩니다.
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`서버 응답 오류: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (response.status === 202) {
        resolve('전문 기술검토 요청이 성공적으로 접수되었습니다. 곧 결과가 도착할 것입니다.');
        return;
      }

      if (!response.body) {
        return reject(new Error("응답 본문을 사용할 수 없습니다."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = '';

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (!finalResult) {
                reject(new Error("스트림이 최종 데이터를 반환하기 전에 종료되었습니다. Make.com 시나리오 로그를 확인해주세요."));
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
                finalResult = json.data;
                resolve(json.data);
                reader.cancel();
                return;
              } else if (json.type === 'error') {
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

export const sendWebhookData = async (payload: any) => {
  console.error("sendWebhookData 함수는 더 이상 사용되지 않습니다. sendWebhookDataStream을 사용하세요.");
  throw new Error("잘못된 함수가 호출되었습니다. webhookService.ts 파일을 확인하세요.");
};
