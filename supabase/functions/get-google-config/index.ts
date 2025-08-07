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
    // Supabase secrets are available as environment variables in Edge Functions
    // but they are exposed differently than regular env vars
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')
    
    console.log('Attempting to get GOOGLE_CLIENT_ID from environment')
    console.log('Available env vars:', Object.keys(Deno.env.toObject()))
    
    if (!googleClientId) {
      console.error('GOOGLE_CLIENT_ID not found in environment variables')
      return new Response(
        JSON.stringify({ 
          error: 'Google Client ID not configured in Supabase secrets',
          availableVars: Object.keys(Deno.env.toObject())
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Successfully retrieved GOOGLE_CLIENT_ID')
    return new Response(
      JSON.stringify({ 
        clientId: googleClientId,
        success: true 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error in get-google-config function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})