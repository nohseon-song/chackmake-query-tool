import { supabase } from '@/integrations/supabase/client';

// 스트리밍을 위한 최종 수정 함수!
// 이 함수는 타임아웃 문제를 해결하고, 정상 종료를 오류로 판단하던 버그를 완벽하게 수정했습니다.
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
        // 서버에서 오는 에러를 좀 더 자세히 보여주도록 수정
        const errorText = await response.text();
        throw new Error(`서버 응답 오류: ${response.status} ${response.statusText} - ${errorText}`);
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
               // 스트림이 최종 데이터를 보내주기 전에 끝나버린 진짜 비정상 상황일 때만 에러 발생
               reject(new Error("스트림이 데이터를 반환하기 전에 종료되었습니다. Make.com 시나리오 로그를 확인해주세요."));
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
                resolve(json.data); // 최종 데이터를 받으면 Promise 성공 처리
                if (reader) reader.cancel();    // 더 이상 읽을 필요 없으므로 스트림 닫기
                return; 
              } else if (json.type === 'error') {
                resolved = true;
                reject(new Error(json.message)); // 서버에서 보낸 에러 처리
                if (reader) reader.cancel();
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

// 혼동을 막기 위해 이 함수는 비워두거나 경고 메시지를 남기는 것이 안전합니다.
export const sendWebhookData = async (payload: any) => {
  console.error("sendWebhookData 함수는 더 이상 사용되지 않습니다. sendWebhookDataStream을 사용하세요.");
  throw new Error("잘못된 함수가 호출되었습니다. webhookService.ts 파일을 확인하세요.");
};
