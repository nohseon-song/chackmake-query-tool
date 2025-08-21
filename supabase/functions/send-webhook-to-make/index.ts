import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientPayload = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    // 인증 과정은 그대로 유지
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const makeWebhookUrl = Deno.env.get('MAKE_WEBHOOK_URL')
    if (!makeWebhookUrl) throw new Error('Webhook endpoint is not configured.')

    // [ ✨ 핵심 수정 ✨ ] 
    // Make.com을 호출하되, await로 응답을 기다리지 않습니다. (Fire and Forget)
    fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientPayload),
    })

    // 앱에는 "요청 접수 완료" 메시지를 즉시 보냅니다.
    return new Response(
      JSON.stringify({ success: true, message: 'Processing started' }),
      {
        status: 202, // 202 Accepted: 요청이 성공적으로 접수되었음을 의미
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
