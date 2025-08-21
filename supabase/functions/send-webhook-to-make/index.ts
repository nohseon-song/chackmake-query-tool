import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log("Function invoked at:", new Date().toISOString());

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientPayload = await req.json();
    console.log("Payload received from client.");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Error: Missing authorization header.");
      throw new Error('Missing authorization header');
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("Error: Invalid token, could not get user.");
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log("User authenticated successfully.");

    console.log("Attempting to get MAKE_WEBHOOK_URL secret.");
    const makeWebhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
    if (!makeWebhookUrl) {
      console.error("CRITICAL ERROR: MAKE_WEBHOOK_URL secret not found.");
      throw new Error('Webhook endpoint is not configured.');
    }
    console.log("Secret found:", makeWebhookUrl.substring(0, 50) + "...");
    console.log("Preparing to send data to Make.com.");

    // "await"을 제거해서 Make.com의 응답을 기다리지 않음
    fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientPayload),
    });
    
    // "Webhook received" 메시지를 즉시 클라이언트로 반환
    console.log("Webhook sent to Make.com, returning immediate success to client.");
    return new Response(JSON.stringify({ success: true, message: "Webhook received and processing started." }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error within the function execution:", (error as any).message);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
