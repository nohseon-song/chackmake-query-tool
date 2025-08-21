import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { exchangeCodeForToken } from '@/utils/googleDocsUtils';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState('처리 중...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        setMessage(`인증 오류: ${error}`);
        toast({
          title: "구글 인증 실패",
          description: "사용자가 인증을 거부했거나 오류가 발생했습니다.",
          variant: "destructive",
        });
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (code) {
        setMessage('구글 인증 코드를 받았으며, 토큰으로 교환하는 중입니다...');
        try {
          // 로컬 스토리지에 액세스 토큰을 저장합니다.
          const { accessToken, refreshToken } = await exchangeCodeForToken(code);
          localStorage.setItem('google_access_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('google_refresh_token', refreshToken);
          }

          setMessage('인증에 성공했습니다! 메인 페이지로 돌아갑니다.');
          toast({
            title: "구글 인증 성공",
            description: "Google Docs에 성공적으로 연결되었습니다.",
          });

          // 성공 후 메인 페이지로 돌아갑니다.
          // URL에서 code 파라미터를 제거하고 이동합니다.
          window.location.href = '/';

        } catch (exchangeError) {
          console.error('토큰 교환 실패:', exchangeError);
          setMessage(`토큰 교환에 실패했습니다: ${exchangeError instanceof Error ? exchangeError.message : String(exchangeError)}`);
          toast({
            title: "토큰 교환 실패",
            description: "인증 코드를 토큰으로 바꾸는 데 실패했습니다. 다시 시도해주세요.",
            variant: "destructive",
          });
          setTimeout(() => navigate('/'), 5000);
        }
      } else {
        // 이 페이지는 콜백 전용이므로, 코드가 없으면 메인으로 보냅니다.
        navigate('/');
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Google 인증 처리 중...</h1>
        <p className="text-muted-foreground">{message}</p>
        <div className="mt-4 w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary mx-auto"></div>
      </div>
    </div>
  );
};

export default Auth;
