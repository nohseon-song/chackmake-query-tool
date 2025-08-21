import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    if (!code) {
      throw new Error('Authorization code not provided.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const isLocal = supabaseUrl.includes('localhost');

    const redirectUri = isLocal
      ? Deno.env.get('GOOGLE_REDIRECT_URI_DEV')
      : Deno.env.get('GOOGLE_REDIRECT_URI_PROD');

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google API credentials are not set in Supabase secrets.');
    }

    console.log('[exchange-code-for-tokens] exchanging code', { redirectUriUsed: redirectUri?.slice(0, 100) });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const raw = await response.text();
    let tokens: any = {};
    try {
      tokens = JSON.parse(raw);
    } catch (_) {
      tokens = { raw };
    }

    if (!response.ok) {
      console.error('[exchange-code-for-tokens] Google token endpoint error', { status: response.status, body: raw });
      return new Response(JSON.stringify({
        error: 'token_exchange_failed',
        details: tokens.error_description || tokens.error || raw
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify(tokens), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
