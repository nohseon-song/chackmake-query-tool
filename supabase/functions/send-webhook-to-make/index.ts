// supabase/functions/send-webhook-to-make/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// 이 함수는 이제 '서비스 키'를 사용하여 관리자 권한으로 실행됩니다.
// 사용자의 권한이 아닌, 시스템의 권한으로 안전하게 조직 ID를 조회합니다.
const createAdminClient = (): SupabaseClient => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // 서비스 키 사용
    { auth: { persistSession: false } }
  );
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 요청 본문에서 user_id와 request_id를 포함한 모든 데이터를 받습니다.
    const payload = await req.json();
    const { user_id, request_id } = payload;

    if (!user_id) {
      return new Response(JSON.stringify({ error: '요청에 사용자 ID가 포함되지 않았습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 관리자 권한의 Supabase 클라이언트를 생성합니다.
    const supabaseAdmin = createAdminClient();

    // 관리자 권한으로 사용자의 프로필에서 organization_id를 조회합니다.
    // RLS 정책의 영향을 받지 않아 안정적으로 조회할 수 있습니다.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('organization_id')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Supabase profile error:', profileError);
      throw new Error(`사용자 프로필 조회 실패: ${profileError.message}`);
    }
    if (!profile || !profile.organization_id) {
      throw new Error(`프로필에서 조직 ID(organization_id)를 찾을 수 없습니다. 사용자 ID: ${user_id}`);
    }

    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL이 설정되지 않았습니다.');
    }
    
    // 조회한 organization_id를 최종 payload에 확실하게 추가합니다.
    const finalPayload = {
      ...payload,
      organization_id: profile.organization_id,
    };

    const urlWithRequestId = new URL(webhookUrl);
    urlWithRequestId.searchParams.append('request_id', request_id);

    const makeResponse = await fetch(urlWithRequestId.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
    });

    const responseText = await makeResponse.text();
    if (!makeResponse.ok) {
      throw new Error(`Make.com 웹훅 오류 (${makeResponse.status}): ${responseText}`);
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { status: responseText };
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Edge Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
