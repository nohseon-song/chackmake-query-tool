const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Make.com webhook URL from Supabase secrets
    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL')
    
    console.log('Attempting to get MAKE_WEBHOOK_URL from environment')
    
    if (!webhookUrl) {
      console.error('MAKE_WEBHOOK_URL not found in environment variables')
      return new Response(
        JSON.stringify({ 
          error: 'Make.com Webhook URL not configured in Supabase secrets'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Successfully retrieved MAKE_WEBHOOK_URL')
    return new Response(
      JSON.stringify({ 
        webhookUrl: webhookUrl,
        success: true 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error in get-webhook-url function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})