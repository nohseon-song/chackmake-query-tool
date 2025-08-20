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
  
  // useRef를 사용하여 webhook 객체를 안정적으로 관리
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

  // Lovable Webhook 생성 및 관리
  useEffect(() => {
    // 앱이 로드될 때 한 번만 웹훅을 생성
    if (window.lovable && typeof window.lovable.createWebhook === 'function' && !webhookRef.current) {
      window.lovable.createWebhook((data) => {
        console.log('Lovable Webhook을 통해 데이터 수신:', data);
        const newResult = data;

        setLogs(prevLogs => {
          const newLogEntry: LogEntry = {
            id: uuidv4(), // 고유 ID 생성
            tag: newResult.is_final ? '📥 최종 보고서' : `📥 ${newResult.step_name || '진단 단계'}`,
            content: newResult.content,
            isResponse: true,
            timestamp: Date.now(),
          };
          // 시간순으로 정렬하여 로그를 업데이트
          return [...prevLogs, newLogEntry].sort((a, b) => a.timestamp - b.timestamp);
        });

        if (newResult.is_final) {
          setIsProcessing(false);
          toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
          // 작업 완료 후 웹훅을 닫고 새로 생성 준비
          webhookRef.current?.close();
          webhookRef.current = null;
        }
      }).then(createdWebhook => {
        console.log("새로운 Webhook 생성됨:", createdWebhook.url);
        webhookRef.current = createdWebhook;
      }).catch(err => {
        console.error("Webhook 생성 실패:", err);
        toast({ title: "오류", description: "데이터 수신 채널 생성에 실패했습니다.", variant: "destructive" });
      });
    }

    // 컴포넌트가 언마운트될 때 웹훅 정리
    return () => {
      webhookRef.current?.close();
    };
  }, [toast]);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }
    if (!webhookRef.current) {
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
        delivery_webhook_url: webhookRef.current.url, // 생성된 Lovable Webhook URL을 전달
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
  }, [user, savedReadings, tempMessages, toast]);
  
  // 나머지 함수들...
  const clearReadingsAndMessages = useCallback(() => { setSavedReadings([]); setTempMessages([]); }, []);
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
    handleSubmit, handleSignOut,
  };
};
