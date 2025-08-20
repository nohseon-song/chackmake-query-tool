// supabase/functions/send-webhook-to-make/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "send-webhook-to-make" up and running!`)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { request_id, ...payload } = await req.json()
    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL')

    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL is not set in environment variables.')
    }

    // Add request_id to the webhook URL as a query parameter
    const urlWithRequestId = new URL(webhookUrl)
    urlWithRequestId.searchParams.append('request_id', request_id)

    const makeResponse = await fetch(urlWithRequestId.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!makeResponse.ok) {
      const errorBody = await makeResponse.text()
      console.error('Error from Make.com:', errorBody)
      throw new Error(`Make.com webhook returned an error: ${makeResponse.statusText}`)
    }

    const responseData = await makeResponse.json()

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
