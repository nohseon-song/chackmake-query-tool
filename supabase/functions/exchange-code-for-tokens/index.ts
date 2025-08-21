import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

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

    const tokens = await response.json();
    if (!response.ok) {
      throw new Error(tokens.error_description || 'Failed to exchange code for tokens.');
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
