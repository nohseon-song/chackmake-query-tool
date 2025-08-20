// src/hooks/useAppState.ts

import { useState, useEffect, useCallback, useRef } from 'react'; // useRef 추가
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { LogEntry, Reading } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { buildMarkdownFromData } from '@/utils/markdownTransform';
import { generateMarkdownReport } from '@/utils/markdownUtils';

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
  
  // =================================================================
  // [수정된 부분] Lovable SDK 대기 로직 (더욱 안정적으로 변경)
  // =================================================================
  const waitForLovableSDK = useCallback(async (): Promise<boolean> => {
    console.log('Lovable SDK 로딩 대기 시작...');
    
    // 이 값을 15초로 넉넉하게 변경하여 안정성을 확보한다.
    const maxWaitTime = 15000; 
    
    const checkInterval = 200; // 200ms 간격
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
  // =================================================================

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

  // 필요 시점에 웹훅 생성하는 함수
  const createWebhookOnDemand = useCallback(async (): Promise<string | null> => {
    console.log('📡 웹훅 생성 요청됨');
    
    try {
      const sdkReady = await waitForLovableSDK();
      if (!sdkReady) {
        console.warn('⚠️ Lovable SDK 미탑재 - 스트리밍 없이 진행합니다.');
        toast({ 
          title: "스트리밍 업데이트 비활성화", 
          description: "브라우저 제한으로 SDK 없이 진행하지만, 요청은 정상 전송됩니다.", 
        });
        return null;
      }

      // 기존 웹훅이 있으면 정리
      if (webhookRef.current) {
        console.log('🧹 기존 웹훅 정리 중...');
        webhookRef.current.close();
        webhookRef.current = null;
      }

      console.log('🔄 새 웹훅 생성 중...');
      const createdWebhook = await window.lovable.createWebhook((data) => {
        console.log('📨 웹훅 데이터 수신:', data);
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
          console.log('✅ 진단 프로세스 완료');
          setIsProcessing(false);
          toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
        }
      });

      console.log('✅ 웹훅 생성 성공:', createdWebhook.url);
      webhookRef.current = createdWebhook;
      return createdWebhook.url;
      
    } catch (error: any) {
      console.error('❌ 웹훅 생성 실패:', error);
      toast({ 
        title: "연결 실패", 
        description: `시스템 연결에 실패했습니다: ${error.message}`, 
        variant: "destructive" 
      });
      return null;
    }
  }, [toast, waitForLovableSDK]);

  // 앱 종료 시 정리
  useEffect(() => {
    return () => {
      if (webhookRef.current) {
        console.log('🧹 앱 종료 시 웹훅 정리');
        webhookRef.current.close();
      }
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }

    // 전송 직전에 웹훅 주소가 준비되지 않았으면 생성 시도하되, 실패해도 계속 진행(스트리밍 없이)
    let deliveryUrl = webhookRef.current?.url;
    if (!deliveryUrl) {
      console.log('🔄 웹훅이 준비되지 않아 즉시 생성 시도');
      deliveryUrl = await createWebhookOnDemand();
      if (!deliveryUrl) {
        console.log('⏭️ SDK 없이 진행: 스트리밍 업데이트는 제공되지 않습니다.');
      }
    }

    console.log('🚀 진단 프로세스 시작');
    setIsProcessing(true);
    setLogs([]);

    try {
      // 1. Generate the final Markdown content
      const markdownContent = generateMarkdownReport(
        savedReadings, 
        tempMessages.map(m => m.content)
      );

      // 2. Create the new, simplified payload
      const payload: any = {
        content: markdownContent, // Send the formatted Markdown string
        user_id: user.id,
        timestamp: new Date().toISOString(),
        request_id: uuidv4(),
      };
      if (deliveryUrl) {
        payload.delivery_webhook_url = deliveryUrl;
      }

      // 로컬에서 바로 Markdown으로 요약 미리보기 생성 (입력 구조 변경 없음)
      const markdownPreview = buildMarkdownFromData(savedReadings, tempMessages.map(m => m.content));
      setLogs(prev => [
        ...prev,
        {
          id: uuidv4(),
          tag: '🧩 데이터 요약 (Markdown)',
          content: '',
          markdown_content: markdownPreview,
          timestamp: Date.now(),
        },
      ]);

      console.log('📤 서버로 데이터 전송 중...', { 
        readingsCount: savedReadings.length, 
        messagesCount: tempMessages.length,
        webhookUrl: deliveryUrl ?? 'none' 
      });

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
