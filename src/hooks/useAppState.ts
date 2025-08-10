import { useState, useEffect } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookData } from '@/services/webhookService';
import { GoogleAuthState, authenticateGoogle, validateGoogleToken, fetchGoogleClientId, exchangeCodeForToken } from '@/utils/googleDocsUtils';
import { supabase } from '@/integrations/supabase/client';

export const useAppState = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
  
  const [equipment, setEquipment] = useState<string>('');
  const [class1, setClass1] = useState<string>('');
  const [class2, setClass2] = useState<string>('');
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempMessages, setTempMessages] = useState<string[]>([]);
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthState>({
    isAuthenticated: false,
    accessToken: null
  });
  
  const { toast } = useToast();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const resetSelections = (level: number) => {
    if (level <= 0) {
      setClass1('');
      setClass2('');
    } else if (level === 1) {
      setClass2('');
    }
  };

  const handleEquipmentChange = (value: string) => {
    setEquipment(value);
    resetSelections(0);
  };

  const handleClass1Change = (value: string) => {
    setClass1(value);
    resetSelections(1);
  };

  const addTempMessage = (message: string) => {
    setTempMessages(prev => [...prev, message]);
  };

  const updateTempMessage = (index: number, newMessage: string) => {
    setTempMessages(prev => prev.map((msg, idx) => idx === index ? newMessage : msg));
  };

  const deleteTempMessage = (index: number) => {
    setTempMessages(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearTempMessages = () => {
    setTempMessages([]);
  };

  const addLogEntry = (tag: string, content: string, isResponse = false) => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      tag,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      isResponse,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, logEntry]);
  };

  const sendWebhook = async (payload: any) => {
    addLogEntry('📤 전송', payload);
    setIsProcessing(true);
    
    try {
      const responseText = await sendWebhookData(payload);
      addLogEntry('📥 응답', responseText, true);
      
      toast({
        title: "전송 완료",
        description: "전문 기술검토가 완료되었습니다.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 오류', errorMessage);
      
      toast({
        title: "전송 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleAuth = async (): Promise<string> => {
    try {
      // 1. 현재 access token이 유효한지 확인
      if (googleAuth.accessToken) {
        const isValid = await validateGoogleToken(googleAuth.accessToken);
        if (isValid) {
          console.log('✅ 기존 액세스 토큰이 유효합니다.');
          return googleAuth.accessToken;
        }
      }

      // 2. refresh token이 있는지 확인
      const refreshToken = localStorage.getItem('googleRefreshToken');
      if (refreshToken) {
        console.log('🔄 리프레시 토큰으로 새로운 액세스 토큰을 요청합니다.');
        // Supabase function을 호출하여 새로운 access token을 받아옴
        const { data, error } = await supabase.functions.invoke('refresh-token', {
          body: { refresh_token: refreshToken },
        });
        if (error) {
          throw new Error('리프레시 토큰으로 액세스 토큰을 갱신하는 데 실패했습니다.');
        }
        const newAccessToken = (data as any)?.access_token as string | undefined;
        if (!newAccessToken) {
          throw new Error('리프레시 토큰 응답에서 access_token을 받지 못했습니다.');
        }
        setGoogleAuth({ isAuthenticated: true, accessToken: newAccessToken });
        return newAccessToken;
      }

      // 3. 새로 인증 (authorization code 받기)
      console.log('✨ 새로운 인증을 시작합니다.');
      const code = await authenticateGoogle();

      // 4. authorization code를 access token과 refresh token으로 교환
      const { accessToken, refreshToken: newRefreshToken } = await exchangeCodeForToken(code);

      if (newRefreshToken) {
        localStorage.setItem('googleRefreshToken', newRefreshToken);
      }
      
      setGoogleAuth({ isAuthenticated: true, accessToken });

      toast({
        title: "Google 인증 완료",
        description: "Google Docs 연동이 완료되었습니다.",
      });

      return accessToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google 인증에 실패했습니다.';
      
      toast({
        title: "Google 인증 실패",
        description: errorMessage,
        variant: "destructive",
      });

      // 인증 실패 시 관련 데이터 초기화
      localStorage.removeItem('googleRefreshToken');
      setGoogleAuth({ isAuthenticated: false, accessToken: null });

      throw error;
    }
  };

  return {
    // State
    isDark,
    equipment,
    class1,
    class2,
    savedReadings,
    logs,
    chatOpen,
    isProcessing,
    tempMessages,
    googleAuth,
    
    // Actions
    toggleTheme,
    handleEquipmentChange,
    handleClass1Change,
    setEquipment,
    setClass1,
    setClass2,
    setSavedReadings,
    setLogs,
    setChatOpen,
    addTempMessage,
    updateTempMessage,
    deleteTempMessage,
    clearTempMessages,
    addLogEntry,
    sendWebhook,
    handleGoogleAuth,
    toast
  };
};