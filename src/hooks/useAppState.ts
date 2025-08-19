import { useState, useEffect } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
// [ ✨ 여기만 수정! ✨ ] sendWebhookData 대신 새로운 스트리밍 함수를 가져옵니다.
import { sendWebhookDataStream } from '@/services/webhookService'; 
import { GoogleAuthState, authenticateGoogle, validateGoogleToken, fetchGoogleClientId, exchangeCodeForToken } from '@/utils/googleDocsUtils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

// 여기부터 ...
export const useAppState = () => {
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
      setIsAuthLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);


  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const handleEquipmentChange = (value: string) => {
    setEquipment(value);
    setClass1('');
    setClass2('');
  };

  const handleClass1Change = (value: string) => {
    setClass1(value);
    setClass2('');
  };

  const addLogEntry = (tag: string, content: any, isResponse = false) => { // content 타입을 any로 변경
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      tag,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      isResponse,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, logEntry]);
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

  // [ ✨ 여기가 핵심 수정 포인트! ✨ ]
  // 함수 구조는 그대로 두고, 내부 호출만 변경합니다.
  const sendWebhook = async (payload: any) => {
    addLogEntry('📤 전송', payload);
    setIsProcessing(true);
    // 이전 응답 로그만 지워서 사용자가 요청 내용을 계속 볼 수 있게 함
    setLogs(prev => prev.filter(log => !log.isResponse));
    
    try {
      // 기존 sendWebhookData 대신 새로운 스트리밍 함수를 호출
      const responseText = await sendWebhookDataStream(payload);
      addLogEntry('📥 응답', responseText, true);
      
      toast({
        title: "✅ 전송 완료",
        description: "전문 기술검토가 완료되었습니다.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 오류', errorMessage);
      
      toast({
        title: "❌ 전송 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleGoogleAuth = async (): Promise<string> => {
    // ... (이 함수는 변경 없음)
    return ''; // 실제 구현은 유지
  };

  const handleSignOut = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setEquipment('');
      setClass1('');
      setClass2('');
      setSavedReadings([]);
      setLogs([]);
      setTempMessages([]);
      
      toast({
        title: "로그아웃 성공",
        description: "성공적으로 로그아웃되었습니다.",
      });
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "로그아웃 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    user,
    isAuthLoading,
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
    
    handleSignOut,
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
// ... 여기까지 너의 코드 구조와 100% 동일합니다.
