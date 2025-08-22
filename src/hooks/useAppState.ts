import { useState, useEffect, useRef } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookData } from '@/services/webhookService';
import { pollJobResult } from '@/services/jobResultService';
import { GoogleAuthState, handleGoogleCallback, createGoogleDocWithAuth } from '@/utils/googleDocsUtils';
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
  const [resultHtml, setResultHtml] = useState<string>('');
  const pollCleanupRef = useRef<(() => void) | null>(null);
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
    // Google 인증 콜백 처리
    const authCode = handleGoogleCallback();
    if (authCode) {
      setGoogleAuth({ isAuthenticated: true, accessToken: null }); // 토큰은 createGoogleDocWithAuth에서 처리
      toast({ title: "✅ 구글 인증 성공", description: "Google Docs 생성을 계속합니다." });
    }
    
    // 인증 대기 상태 확인 (페이지 새로고침 후)
    const authPending = sessionStorage.getItem('google_auth_pending');
    const authTimestamp = sessionStorage.getItem('google_auth_timestamp');
    
    if (authPending && authTimestamp) {
      const elapsed = Date.now() - parseInt(authTimestamp);
      if (elapsed > 300000) { // 5분 초과 시 타임아웃
        sessionStorage.removeItem('google_auth_pending');
        sessionStorage.removeItem('google_auth_timestamp');
        toast({ title: "인증 시간 초과", description: "다시 시도해 주세요.", variant: "destructive" });
      }
    }
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

  const sendWebhook = async (payload: any) => {
    addLogEntry('📤 전송', payload);
    setIsProcessing(true);
    setLogs(prev => prev.filter(log => !log.isResponse));
    setResultHtml(''); // Clear previous results
    
    // Clean up any existing polling
    if (pollCleanupRef.current) {
      pollCleanupRef.current();
      pollCleanupRef.current = null;
    }
    
    try {
      const responseText = await sendWebhookData(payload);
      addLogEntry('📥 응답', responseText, true);
      
      // Parse response to get job_id
      let jobId: string | null = null;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.job_id && parsed.status === 'processing') {
          jobId = parsed.job_id;
        }
      } catch (parseError) {
        console.warn('Failed to parse webhook response:', parseError);
      }
      
      if (jobId) {
        // Start polling for job result
        pollCleanupRef.current = pollJobResult(
          jobId,
          (html?: string, htmlUrl?: string) => {
            if (html) {
              setResultHtml(html);
            } else if (htmlUrl) {
              setResultHtml(`<div class="text-center p-4"><a href="${htmlUrl}" target="_blank" class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">리포트 열기</a></div>`);
            }
            setIsProcessing(false);
            toast({ title: "✅ 처리 완료", description: "전문 기술검토가 완료되었습니다." });
          },
          (errorMessage: string) => {
            setIsProcessing(false);
            toast({ title: "❌ 처리 실패", description: errorMessage, variant: "destructive" });
          }
        );
      } else {
        setIsProcessing(false);
        toast({ title: "✅ 전송 완료", description: "요청이 접수되었습니다." });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 오류', errorMessage);
      toast({ title: "❌ 전송 실패", description: errorMessage, variant: "destructive" });
      setIsProcessing(false);
    }
  };
  
  const handleGoogleAuth = async (htmlContent: string, equipmentName?: string) => {
    try {
      toast({ title: "🚀 Google Docs 다운로드 시작", description: "구글 인증을 진행합니다..." });
      const docUrl = await createGoogleDocWithAuth(htmlContent, equipmentName);
      
      if (docUrl) {
        toast({ title: "✅ Google Docs 생성 완료!", description: "문서가 성공적으로 생성되었습니다." });
        window.open(docUrl, '_blank');
        setGoogleAuth({ isAuthenticated: true, accessToken: null });
      }
    } catch (error: any) {
      if (!error.message?.includes('Redirecting to Google')) {
        console.error('Google Docs 생성 오류:', error);
        toast({ title: "❌ Google Docs 생성 실패", description: error.message, variant: "destructive" });
      }
    }
  };
  const handleSignOut = async () => {
    console.log('handleSignOut function called');
    setIsProcessing(true);
    
    // Clean up polling when signing out
    if (pollCleanupRef.current) {
      pollCleanupRef.current();
      pollCleanupRef.current = null;
    }
    
    try {
      await supabase.auth.signOut();
      setEquipment(''); setClass1(''); setClass2(''); setSavedReadings([]); setLogs([]); setTempMessages([]);
      setResultHtml(''); // Clear results
      toast({ title: "로그아웃 성공" });
      navigate('/auth');
    } catch (error: any) {
      toast({ title: "로그아웃 실패", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const returnValue = {
    user, isAuthLoading, isDark, equipment, class1, class2, savedReadings, logs, chatOpen,
    isProcessing, tempMessages, googleAuth, resultHtml, handleSignOut, toggleTheme, handleEquipmentChange,
    handleClass1Change, setEquipment, setClass1, setClass2, setSavedReadings, setLogs,
    setChatOpen, addTempMessage, updateTempMessage, deleteTempMessage, clearTempMessages,
    addLogEntry, sendWebhook, handleGoogleAuth, toast
  };
  
  console.log('useAppState returning:', { handleSignOut: !!returnValue.handleSignOut });
  return returnValue;
};
