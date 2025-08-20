// src/hooks/useAppState.ts

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
  
  // [수정] 웹훅 준비 상태를 추적하는 상태 추가
  const [isWebhookReady, setIsWebhookReady] = useState(false);
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

  const createNewWebhook = useCallback(() => {
    if (window.lovable && typeof window.lovable.createWebhook === 'function') {
      setIsWebhookReady(false);
      webhookRef.current?.close();

      window.lovable.createWebhook((data) => {
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
          createNewWebhook();
        }
      }).then(createdWebhook => {
        webhookRef.current = createdWebhook;
        setIsWebhookReady(true); // [수정] 웹훅 준비 완료!
      }).catch(err => {
        console.error("Webhook 생성 실패:", err);
        toast({ title: "오류", description: "데이터 수신 채널 생성에 실패했습니다.", variant: "destructive" });
        setIsWebhookReady(false);
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
    if (!isWebhookReady || !webhookRef.current) { // [수정] 웹훅 준비 상태 확인
      toast({ title: "준비 오류", description: "데이터 수신 채널이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    setLogs([]);
    
    try {
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
      setIsProcessing(false);
      toast({ title: "전송 실패", description: error.message, variant: "destructive" });
    }
  }, [user, savedReadings, tempMessages, toast, isWebhookReady]);

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
    handleSubmit, handleSignOut, isWebhookReady, // [수정] isWebhookReady를 반환값에 추가
    toast
  };
};
