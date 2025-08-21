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

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const interval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode('{"type":"ping"}\n'))
          } catch (e) { /* Stream already closed */ }
        }, 30000)

        try {
          const makeResponse = await fetch(makeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientPayload),
          })

          if (!makeResponse.ok) {
            const errorText = await makeResponse.text()
            throw new Error(`Make.com error: ${makeResponse.status} ${errorText}`)
          }

          const responseText = await makeResponse.text()
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'final', data: responseText }) + '\n'))
        } catch (e) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: e.message }) + '\n'))
        } finally {
          clearInterval(interval)
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
