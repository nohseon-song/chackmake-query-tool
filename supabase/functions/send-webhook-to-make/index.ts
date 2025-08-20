import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // OPTIONS 요청은 CORS 사전 요청(preflight)을 처리하기 위한 것으로, 바로 'ok'로 응답합니다.
  // 이를 통해 브라우저가 다음 POST 요청을 안전하게 보낼 수 있도록 허용합니다.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 앱(lovable.dev)에서 보낸 JSON 데이터를 파싱합니다.
    const payload = await req.json();

    // 환경 변수에서 Make.com 웹훅 URL을 가져옵니다.
    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL이 설정되지 않았습니다.');
    }

    // 받은 데이터를 그대로 Make.com 웹훅으로 전달합니다.
    const makeResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Make.com으로부터의 응답이 성공적이지 않으면 에러를 발생시킵니다.
    if (!makeResponse.ok) {
      const errorBody = await makeResponse.text();
      throw new Error(`Make.com 웹훅 오류: ${errorBody}`);
    }

    // Make.com의 응답(예: "Accepted")을 앱으로 다시 전달합니다.
    const responseText = await makeResponse.text();
    const responseData = { status: responseText };
    
    // 최종적으로 앱에 성공 응답을 보냅니다.
    // 이때, corsHeaders를 포함하여 lovable.dev에서의 요청을 허용하도록 설정합니다.
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    // 에러 발생 시, 에러 메시지를 앱에 전달합니다.
    // 마찬가지로 corsHeaders를 포함하여 에러 응답도 정상적으로 받을 수 있도록 합니다.
    console.error('Edge Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
