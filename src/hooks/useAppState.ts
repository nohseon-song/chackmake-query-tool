import { useState, useEffect } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookData } from '@/services/webhookService';
// [ ✨ 여기 수정! ✨ ] 필요한 모든 함수를 가져옵니다.
import { GoogleAuthState, authenticateGoogle, exchangeCodeForToken, getGoogleTokens } from '@/utils/googleDocsUtils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

export const useAppState = () => {
  // --- 기존 코드와 동일한 부분 ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const navigate = useNavigate();
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
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        // 페이지 로드 시 저장된 구글 토큰이 있는지 확인
        const tokens = await getGoogleTokens(session.user.id);
        if (tokens) {
          setGoogleAuth({ isAuthenticated: true, accessToken: tokens.access_token });
        }
      }
      setIsAuthLoading(false);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setGoogleAuth({ isAuthenticated: false, accessToken: null });
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  
  // URL에서 인증 코드 확인 로직 추가
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && user) {
      const exchange = async () => {
        try {
          const tokens = await exchangeCodeForToken(code, user.id);
          setGoogleAuth({ isAuthenticated: true, accessToken: tokens.access_token });
          toast({ title: "✅ 구글 인증 성공", description: "Google Docs에 연결되었습니다." });
        } catch (error) {
          console.error(error);
          toast({ title: "❌ 구글 인증 실패", description: "토큰 교환에 실패했습니다.", variant: "destructive" });
        } finally {
          // URL에서 코드 제거
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      exchange();
    }
  }, [user]);


  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  const handleEquipmentChange = (value: string) => { setEquipment(value); setClass1(''); setClass2(''); };
  const handleClass1Change = (value: string) => { setClass1(value); setClass2(''); };
  const addLogEntry = (tag: string, content: any, isResponse = false) => {
    const logEntry: LogEntry = { id: Date.now().toString(), tag, content: typeof content === 'string' ? content : JSON.stringify(content, null, 2), isResponse, timestamp: Date.now() };
    setLogs(prev => [...prev, logEntry]);
  };
  const addTempMessage = (message: string) => setTempMessages(prev => [...prev, message]);
  const updateTempMessage = (index: number, newMessage: string) => setTempMessages(prev => prev.map((msg, idx) => idx === index ? newMessage : msg));
  const deleteTempMessage = (index: number) => setTempMessages(prev => prev.filter((_, idx) => idx !== index));
  const clearTempMessages = () => setTempMessages([]);
  // --- 여기까지 기존 코드 유지 ---

  // [ ✨ 여기가 핵심 수정 포인트! ✨ ]
  const sendWebhook = async (payload: any) => {
    addLogEntry('📤 전송', payload);
    setIsProcessing(true);
    setLogs(prev => prev.filter(log => !log.isResponse));
    try {
      const responseText = await sendWebhookData(payload);
      addLogEntry('📥 응답', responseText, true);
      toast({ title: "✅ 전송 완료", description: "전문 기술검토가 완료되었습니다." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 오류', errorMessage);
      toast({ title: "❌ 전송 실패", description: errorMessage, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 구글 인증 시작 함수
  const handleGoogleAuth = async () => {
    if (user) {
      await authenticateGoogle(user.id);
    } else {
      toast({ title: "로그인 필요", description: "구글 인증을 위해 먼저 로그인해주세요.", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    setIsProcessing(true);
    try {
      await supabase.auth.signOut();
      setEquipment(''); setClass1(''); setClass2(''); setSavedReadings([]); setLogs([]); setTempMessages([]);
      toast({ title: "로그아웃 성공", description: "성공적으로 로그아웃되었습니다." });
      navigate('/auth');
    } catch (error: any) {
      toast({ title: "로그아웃 실패", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    user, isAuthLoading, isDark, equipment, class1, class2, savedReadings, logs, chatOpen,
    isProcessing, tempMessages, googleAuth, handleSignOut, toggleTheme, handleEquipmentChange,
    handleClass1Change, setEquipment, setClass1, setClass2, setSavedReadings, setLogs,
    setChatOpen, addTempMessage, updateTempMessage, deleteTempMessage, clearTempMessages,
    addLogEntry, sendWebhook, handleGoogleAuth, toast
  };
};
