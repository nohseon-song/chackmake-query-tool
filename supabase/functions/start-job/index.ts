import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const makeWebhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");
    if (!makeWebhookUrl) {
      console.error("Missing MAKE_WEBHOOK_URL secret");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const originalBody = await req.json().catch(() => ({}));

    // Generate a job id and construct callback URL (forced https base)
    const job_id = crypto.randomUUID();
    const base = 'https://rigbigjmszdlacjdkhep.supabase.co';
    const callback_url = `${base}/functions/v1/callback-job`;

    const payloadForMake = {
      job_id,
      callback_url,
      body: originalBody, // include original request body as-is
    };

    // Fire-and-forget: send to Make in the background
    // so the client gets an immediate response
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      fetch(makeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadForMake),
      })
        .then(async (res) => {
          const text = await res.text();
          console.log(
            "Make webhook response",
            JSON.stringify({ status: res.status, ok: res.ok, sample: text.slice(0, 500) })
          );
        })
        .catch((err) => console.error("Error sending payload to Make:", err))
    );

    console.log("start-job accepted", { job_id });

    return new Response(
      JSON.stringify({ job_id, status: "processing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("start-job error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
