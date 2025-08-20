// src/hooks/useAppState.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { LogEntry, Reading } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
// [수정 1] 방금 만든 마크다운 변환 유틸리티를 가져온다.
import { generateMarkdownReport } from '@/utils/markdownUtils'; 

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

  const webhookRef = useRef<{ url: string; close: () => void } | null>(null);

  const waitForLovableSDK = useCallback(async (): Promise<boolean> => {
    console.log('Lovable SDK 로딩 대기 시작...');
    const maxWaitTime = 15000;
    const checkInterval = 200;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkSDK = () => {
        const elapsed = Date.now() - startTime;
        console.log(`SDK 체크 중... (${elapsed}ms 경과)`);
        
        if (window.lovable && typeof window.lovable.createWebhook === 'function') {
          console.log('✅ Lovable SDK 로딩 완료!');
          resolve(true);
          return;
        }
        
        if (elapsed >= maxWaitTime) {
          console.log('⚠️ Lovable SDK 로딩 타임아웃');
          resolve(false);
          return;
        }
        
        setTimeout(checkSDK, checkInterval);
      };
      checkSDK();
    });
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

  const createWebhookOnDemand = useCallback(async (): Promise<string | null> => {
    console.log('📡 웹훅 생성 요청됨');
    try {
      const sdkReady = await waitForLovableSDK();
      if (!sdkReady) {
        console.warn('⚠️ Lovable SDK 미탑재 - 스트리밍 없이 진행합니다.');
        toast({ title: "스트리밍 업데이트 비활성화", description: "요청은 정상 전송됩니다." });
        return null;
      }
      if (webhookRef.current) {
        webhookRef.current.close();
      }
      const createdWebhook = await window.lovable.createWebhook((data) => {
        console.log('📨 웹훅 데이터 수신:', data);
        setLogs(prevLogs => {
          const newLogEntry: LogEntry = {
            id: uuidv4(),
            tag: data.is_final ? '📥 최종 보고서' : `📥 ${data.step_name || '진단 단계'}`,
            content: data.content,
            isResponse: true,
            timestamp: Date.now(),
          };
          return [...prevLogs, newLogEntry].sort((a, b) => a.timestamp - b.timestamp);
        });
        if (data.is_final) {
          console.log('✅ 진단 프로세스 완료');
          setIsProcessing(false);
          toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
        }
      });
      webhookRef.current = createdWebhook;
      return createdWebhook.url;
    } catch (error: any) {
      console.error('❌ 웹훅 생성 실패:', error);
      toast({ title: "연결 실패", description: `시스템 연결에 실패했습니다: ${error.message}`, variant: "destructive" });
      return null;
    }
  }, [toast, waitForLovableSDK]);

  useEffect(() => {
    return () => {
      if (webhookRef.current) {
        webhookRef.current.close();
      }
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }

    let deliveryUrl = webhookRef.current?.url;
    if (!deliveryUrl) {
      deliveryUrl = await createWebhookOnDemand();
    }

    console.log('🚀 진단 프로세스 시작');
    setIsProcessing(true);
    setLogs([]);

    try {
      // =================================================================
      // [수정 2] 여기서부터가 핵심! 데이터를 보내기 전에 마크다운으로 변환한다.
      // =================================================================
      
      // 1. 방금 만든 유틸리티로 완벽하게 포맷된 마크다운 문자열을 생성한다.
      const markdownContent = generateMarkdownReport(
        savedReadings, 
        tempMessages.map(m => m.content)
      );

      // 2. 최종 전송할 payload를 새롭게 정의한다.
      const payload: any = {
        content: markdownContent, // 가공된 마크다운 최종본만 보낸다.
        user_id: user.id,
        timestamp: new Date().toISOString(),
        request_id: uuidv4(),
      };

      if (deliveryUrl) {
        payload.delivery_webhook_url = deliveryUrl;
      }
      
      // =================================================================

      console.log('📤 서버로 최종 데이터 전송 중...');
      console.log('Final Payload Content:', payload.content);

      const { error } = await supabase.functions.invoke('send-webhook-to-make', { body: payload });
      if (error) throw error;

      console.log('✅ 서버 전송 성공');
      toast({ title: "진단 시작됨", description: "데이터를 서버로 전송했습니다." });
      setSavedReadings([]);
      setTempMessages([]);

    } catch (error: any) {
      console.error('❌ 서버 전송 실패:', error);
      setIsProcessing(false);
      toast({ title: "전송 실패", description: error.message, variant: "destructive" });
    }
  }, [user, savedReadings, tempMessages, toast, createWebhookOnDemand]);

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
