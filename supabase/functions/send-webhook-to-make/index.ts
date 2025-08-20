// supabase/functions/send-webhook-to-make/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // 브라우저가 본 요청을 보내기 전에 보내는 OPTIONS 요청을 처리합니다.
  // "이런 요청을 보내도 괜찮니?" 라는 질문에 "응, 괜찮아" 라고 답해주는 과정입니다.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 앱에서 보낸 payload를 그대로 받습니다.
    const payload = await req.json();

    // 환경 변수에서 Make.com 웹훅 URL을 가져옵니다.
    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL이 설정되지 않았습니다.');
    }

    // 받은 payload를 그대로 Make.com으로 전달합니다.
    const makeResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!makeResponse.ok) {
      const errorBody = await makeResponse.text();
      throw new Error(`Make.com 웹훅 오류: ${errorBody}`);
    }

    const responseText = await makeResponse.text();
    const responseData = { status: responseText };
    
    // [가장 중요!] 성공 응답에 CORS 헤더를 포함하여 브라우저에 허가증을 보내줍니다.
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Edge Function Error:', error.message);
    // [가장 중요!] 에러 응답에도 CORS 헤더를 포함하여 브라우저가 에러 내용을 볼 수 있게 합니다.
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
