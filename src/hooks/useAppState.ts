// src/hooks/useAppState.ts

import { useState, useEffect, useCallback, useRef } from 'react'; // useRef 추가
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { LogEntry, Reading } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// [추가] Lovable Webhook 타입을 사용하기 위한 정의
declare global {
  interface Window {
    lovable: {
      createWebhook: (callback: (data: any) => void) => Promise<{ url: string; close: () => void }>;
    };
  }
}

interface TempMessage {
  id: string;
  content: string;
  timestamp: number;
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

  // [추가] Lovable Webhook 객체를 저장하기 위한 ref
  const webhookRef = useRef<{ url: string; close: () => void } | null>(null);
  // [추가] Lovable 객체 로드 대기 유틸 (최대 6초 대기)
  const waitForLovable = useCallback(async (timeoutMs = 6000, intervalMs = 150): Promise<void> => {
    const start = Date.now();
    while (!(window.lovable && typeof window.lovable.createWebhook === 'function')) {
      if (Date.now() - start > timeoutMs) throw new Error('Lovable SDK가 준비되지 않았습니다.');
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }, []);

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

  // [추가] 앱이 시작될 때 Lovable Webhook을 생성하고, 결과를 수신하는 로직
  const createNewWebhook = useCallback(async (): Promise<string | null> => {
    try {
      await waitForLovable();
      // 기존 웹훅이 있으면 정리 후 새로 생성
      webhookRef.current?.close();

      const createdWebhook = await window.lovable.createWebhook((data) => {
        console.log('Lovable Webhook을 통해 데이터 수신:', data);
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
          // 다음 작업을 위해 새 웹훅을 미리 준비
          createNewWebhook();
        }
      });

      console.log("새로운 Webhook 생성 성공:", createdWebhook.url);
      webhookRef.current = createdWebhook;
      return createdWebhook.url;
    } catch (err) {
      console.error("Webhook 생성 실패:", err);
      toast({ title: "❌ 채널 생성 실패", description: "결과 수신 채널 생성에 실패했습니다. 잠시 후 다시 시도해주세요.", variant: "destructive" });
      return null;
    }
  }, [toast, waitForLovable]);

  // [추가] 앱이 로드될 때 웹훅을 생성하도록 함
  useEffect(() => {
    createNewWebhook();
    return () => {
      webhookRef.current?.close(); // 앱을 나갈 때 웹훅 정리
    };
  }, [createNewWebhook]);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }

    // 전송 직전에 웹훅 주소가 성공적으로 만들어졌는지 확인하고, 없으면 즉시 생성 시도
    if (!webhookRef.current?.url) {
      const url = await createNewWebhook();
      if (!url) {
        toast({ title: "준비 오류", description: "결과를 수신할 주소가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.", variant: "destructive" });
        return;
      }
    }

    setIsProcessing(true);
    setLogs([]);

    try {
      // payload에 'delivery_webhook_url'을 담아서 보냄
      const payload = {
        readings: savedReadings,
        messages: tempMessages.map(m => m.content),
        user_id: user.id,
        timestamp: new Date().toISOString(),
        request_id: uuidv4(),
        delivery_webhook_url: webhookRef.current!.url,
      };

      const { error } = await supabase.functions.invoke('send-webhook-to-make', { body: payload });
      if (error) throw error;

      toast({ title: "진단 시작됨", description: "데이터를 서버로 전송했습니다." });
      setSavedReadings([]);
      setTempMessages([]);

    } catch (error: any) {
      setIsProcessing(false);
      toast({ title: "전송 실패", description: error.message, variant: "destructive" });
    }
  }, [user, savedReadings, tempMessages, toast, createNewWebhook]);

  const toggleTheme = useCallback(() => setIsDark(prev => !prev), []);
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
    handleSubmit, handleSignOut, toast,
  };
};
