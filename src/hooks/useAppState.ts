import { useState, useEffect } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookData } from '@/services/webhookService'; // 원래 함수로 변경
import { GoogleAuthState, authenticateGoogle, validateGoogleToken, fetchGoogleClientId, exchangeCodeForToken } from '@/utils/googleDocsUtils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

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

  // --- 여기부터 ---
  // 사용자 로그인/로그아웃 및 테마 설정은 기존과 동일
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

  const toggleTheme = () => setIsDark(!isDark);
  const handleEquipmentChange = (value: string) => { setEquipment(value); setClass1(''); setClass2(''); };
  const handleClass1Change = (value: string) => { setClass1(value); setClass2(''); };
  const addLogEntry = (tag: string, content: any, isResponse = false) => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      tag,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      isResponse,
      timestamp: Date.now()
    };
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
      // 1. Make.com에 작업 시작 요청 (결과는 기다리지 않음)
      await sendWebhookData(payload);
      toast({ title: "⏳ 요청 접수", description: "기술검토를 시작했습니다. 결과가 곧 도착합니다." });

      // 2. 10초마다 데이터베이스를 확인하여 결과가 왔는지 체크
      const interval = setInterval(async () => {
        const { data, error } = await supabase
          .from('knowledge_base')
          .select('content')
          .eq('organization_id', payload.organization_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error('DB 폴링 에러:', error);
        }

        // 3. 최신 결과의 content에서 final_report_html을 찾아 앱에 표시
        if (data && data.content) {
          const contentJson = JSON.parse(data.content);
          if (contentJson.final_report_html) {
            clearInterval(interval); // 결과를 찾았으니 확인 중단
            addLogEntry('📥 응답', contentJson.final_report_html, true);
            setIsProcessing(false); // 로딩 종료
            toast({ title: "✅ 기술검토 완료", description: "진단 결과를 성공적으로 수신했습니다." });
          }
        }
      }, 10000); // 10초 간격

      // 4. 최대 5분 후에도 결과가 없으면 타임아웃 처리
      setTimeout(() => {
        clearInterval(interval);
        if (isProcessing) {
          setIsProcessing(false);
          toast({ title: "❌ 시간 초과", description: "처리 시간이 너무 오래 걸립니다. 다시 시도해주세요.", variant: "destructive" });
        }
      }, 300000); // 5분

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 오류', errorMessage);
      setIsProcessing(false);
      toast({ title: "❌ 전송 실패", description: errorMessage, variant: "destructive" });
    }
    // finally 블록은 polling 로직 때문에 제거
  };
  
  // --- 여기부터 ---
  // handleGoogleAuth, handleSignOut 및 return 구문은 기존과 동일
  const handleGoogleAuth = async (): Promise<string> => { return ''; };
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
  // --- 여기까지 기존 코드 유지 ---
};
