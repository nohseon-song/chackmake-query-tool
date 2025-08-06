import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action } = await req.json()

    if (action === 'getClientId') {
      // Supabase Edge Functions에서는 VITE_ 접두사 없이 Vault secrets에 접근
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('VITE_GOOGLE_CLIENT_ID')
      
      console.log('Available env vars:', Object.keys(Deno.env.toObject()))
      console.log('GOOGLE_CLIENT_ID:', clientId ? 'found' : 'not found')
      
      if (!clientId) {
        return new Response(
          JSON.stringify({ 
            error: 'Google Client ID를 찾을 수 없습니다. Lovable AI의 Supabase 연동 설정을 확인해주세요.' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({ clientId }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: '지원하지 않는 액션입니다.' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Google Auth Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Google 인증 처리 중 오류가 발생했습니다.' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})