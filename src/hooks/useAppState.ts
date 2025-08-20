import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { LogEntry, Reading } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

interface TempMessage {
  id: string;
  content: string;
  timestamp: number;
}

// Lovable Webhook을 사용하기 위한 타입 정의
declare global {
  interface Window {
    lovable: {
      createWebhook: (callback: (data: any) => void) => Promise<{ url: string; close: () => void }>;
    };
  }
}

export const useAppState = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [equipment, setEquipment] = useState<string>('');
  const [class1, setClass1] = useState<string>('');
  const [class2, setClass2] = useState<string>('');
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [tempMessages, setTempMessages] = useState<TempMessage[]>([]);
  
  // [수정] Lovable Webhook 참조를 위한 Ref 추가
  const webhookRef = useRef<{ url: string; close: () => void } | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    };
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (matches: boolean) => {
      setIsDark(matches);
      document.documentElement.classList.toggle('dark', matches);
    }
    applyTheme(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // [수정] 앱이 시작될 때 Lovable Webhook을 생성하는 로직 추가
  const createNewWebhook = useCallback(() => {
    if (window.lovable && typeof window.lovable.createWebhook === 'function') {
      webhookRef.current?.close(); // 기존 웹훅 정리

      window.lovable.createWebhook((data) => {
        // Make.com 시나리오에서 HTTP 모듈을 통해 보낸 최종 결과를 여기서 받음
        const newResult = data;
        setLogs(prevLogs => {
          const newLogEntry: LogEntry = {
            id: uuidv4(),
            tag: newResult.is_final ? '📥 최종 보고서' : `📥 ${newResult.step_name || '진단 단계'}`,
            content: newResult.content,
            isResponse: true,
            timestamp: Date.now(),
          };
          return [...prevLogs, newLogEntry].sort((a, b) => a.timestamp - b.timestamp);
        });

        if (newResult.is_final) {
          setIsProcessing(false);
          toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
          createNewWebhook(); // 작업 완료 후 다음 작업을 위해 새 웹훅 생성
        }
      }).then(createdWebhook => {
        console.log("Lovable Webhook 생성 성공! URL:", createdWebhook.url);
        webhookRef.current = createdWebhook;
      }).catch(err => {
        console.error("Lovable Webhook 생성 실패:", err);
        toast({ title: "치명적 오류", description: "결과 수신 채널 생성에 실패했습니다. 새로고침 해주세요.", variant: "destructive" });
      });
    }
  }, [toast]);

  useEffect(() => {
    createNewWebhook();
    return () => {
      webhookRef.current?.close();
    };
  }, [createNewWebhook]);


  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }
    // [수정] 전송 직전에 웹훅 URL이 생성되었는지 다시 한번 확인
    if (!webhookRef.current?.url) {
      toast({ title: "준비 오류", description: "결과를 수신할 주소가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    setLogs([]);
    
    try {
      // [수정] payload에 delivery_webhook_url을 포함시켜서 전송
      const payload = {
        readings: savedReadings,
        messages: tempMessages.map(m => m.content),
        user_id: user.id,
        timestamp: new Date().toISOString(),
        request_id: uuidv4(),
        delivery_webhook_url: webhookRef.current.url, 
      };
      
      const { error } = await supabase.functions.invoke('send-webhook-to-make', { body: payload });

      if (error) throw error;
      
      toast({ title: "진단 시작됨", description: "데이터를 서버로 전송했습니다." });
      setSavedReadings([]);
      setTempMessages([]);

    } catch (error: any) {
      console.error("전송 실패:", error);
      setIsProcessing(false);
      // CORS 오류가 여기서 잡히는 경우가 많음
      if (error.message.includes('Failed to fetch')) {
          toast({ title: "서버 연결 실패", description: "서버(Supabase)와 통신에 실패했습니다. CORS 설정을 확인해주세요.", variant: "destructive" });
      } else {
          toast({ title: "전송 실패", description: error.message, variant: "destructive" });
      }
    }
  }, [user, savedReadings, tempMessages, toast]);
  
  const toggleTheme = useCallback(() => setIsDark(p => !p), []);
  const handleEquipmentChange = useCallback((value: string) => { setEquipment(value); setClass1(''); setClass2(''); }, []);
  const handleClass1Change = useCallback((value: string) => { setClass1(value); setClass2(''); }, []);
  const addTempMessage = useCallback((content: string) => { setTempMessages(prev => [...prev, { id: Date.now().toString(), content, timestamp: Date.now() }]); }, []);
  const updateTempMessage = useCallback((id: string, content: string) => { setTempMessages(prev => prev.map(msg => msg.id === id ? { ...msg, content } : msg)); }, []);
  const deleteTempMessage = useCallback((id: string) => { setTempMessages(prev => prev.filter(msg => msg.id !== id)); }, []);
  const handleSignOut = useCallback(async () => { await supabase.auth.signOut(); navigate('/auth'); }, [navigate]);

  return {
    user, isAuthLoading, isDark, equipment, setEquipment, class1, setClass1, class2, setClass2,
    savedReadings, setSavedReadings, logs, setLogs, chatOpen, setChatOpen,
    isProcessing, tempMessages, setTempMessages,
    toggleTheme, handleEquipmentChange, handleClass1Change,
    addTempMessage, updateTempMessage, deleteTempMessage,
    handleSubmit, handleSignOut,
    toast
  };
};
