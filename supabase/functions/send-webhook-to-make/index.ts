// supabase/functions/send-webhook-to-make/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// 사용자의 인증 토큰을 사용하여 Supabase 클라이언트를 생성하는 함수
// 이 함수는 관리자 권한이 아닌, 해당 사용자의 권한으로 Supabase와 상호작용합니다.
const createSupabaseClient = (authHeader: string): SupabaseClient => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      // 401 Unauthorized: 인증 정보가 없음을 명확히 함
      return new Response(JSON.stringify({ error: '인증 헤더가 없습니다.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 요청 본문에서 user_id를 제외한 나머지 payload를 받습니다.
    const { user_id, ...payload } = await req.json();
    if (!user_id) {
      // 400 Bad Request: 요청이 잘못되었음을 명확히 함
      return new Response(JSON.stringify({ error: '요청에 사용자 ID가 포함되지 않았습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 사용자의 권한으로 Supabase 클라이언트 생성
    const supabase = createSupabaseClient(authHeader);

    // RLS 정책에 따라, 이 조회는 성공해야 함
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Supabase profile error:', profileError);
      throw new Error(`사용자 프로필 조회 실패: ${profileError.message}`);
    }
    if (!profile || !profile.organization_id) {
      throw new Error('프로필에서 조직 ID(organization_id)를 찾을 수 없습니다.');
    }

    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL이 설정되지 않았습니다.');
    }

    const requestId = payload.request_id || crypto.randomUUID();

    // 최종 payload에 조회한 조직 ID를 추가
    const finalPayload = {
      ...payload,
      organization_id: profile.organization_id,
      request_id: requestId,
    };

    const urlWithRequestId = new URL(webhookUrl);
    urlWithRequestId.searchParams.append('request_id', requestId);

    const makeResponse = await fetch(urlWithRequestId.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
    });

    if (!makeResponse.ok) {
      const errorBody = await makeResponse.text();
      throw new Error(`Make.com 웹훅 오류 (${makeResponse.status}): ${errorBody}`);
    }

    const responseData = await makeResponse.json();

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Edge Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // 내부 서버 오류
    });
  }
})
