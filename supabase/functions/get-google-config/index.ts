import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const isLocal = supabaseUrl.includes('localhost');

    const redirectUri = isLocal
      ? Deno.env.get('GOOGLE_REDIRECT_URI_DEV')
      : Deno.env.get('GOOGLE_REDIRECT_URI_PROD');

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');

    if (!clientId || !redirectUri) {
      throw new Error('Google API credentials are not set in Supabase secrets.');
    }

    return new Response(JSON.stringify({ clientId, redirectUri }), {
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
