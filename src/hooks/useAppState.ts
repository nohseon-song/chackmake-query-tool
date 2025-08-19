// src/hooks/useAppState.ts

import { useState, useEffect, useCallback } from 'react'; // ⭐️ 1. useCallback 추가
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookRequest } from '@/services/webhookService';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { downloadPdf } from '@/utils/pdfUtils'; // PDF 다운로드 유틸리티 가져오기

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
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const { toast } = useToast();

  const clearInputs = useCallback(() => {
      setSavedReadings([]);
      setTempMessages([]);
      setEquipment('');
      setClass1('');
      setClass2('');
  }, []);

  // ⭐️ 2. addLogEntry 함수를 useCallback으로 감싸서 '기억력'을 좋게 만들어줍니다.
  const addLogEntry = useCallback((tag: string, content: any, isResponse = false) => {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const logEntry: LogEntry = { id: Date.now().toString(), tag, content: contentString, isResponse, timestamp: Date.now() };
    setLogs(prev => [...prev, logEntry]);
  }, []);


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

  // ⭐️ 3. Supabase 실시간 수신기를 수정하여 항상 최신 함수를 사용하도록 합니다.
  useEffect(() => {
    if (!currentRequestId) return;

    const channel = supabase.channel(`diagnosis_results:${currentRequestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'diagnosis_results', filter: `request_id=eq.${currentRequestId}` },
        (payload) => {
          console.log('Realtime payload received:', payload);
          const newResult = payload.new as any;
          
          if (newResult.is_final) {
              addLogEntry('📥 최종 보고서', newResult.content, true);
              setIsProcessing(false);
              toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
              setCurrentRequestId(null);
              clearInputs(); // 최종 결과 수신 후 입력값 초기화
          } else {
              addLogEntry(`📥 ${newResult.step_name}`, newResult.content);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`Subscribed to request ID: ${currentRequestId}`);
        if (err) {
          console.error('Realtime subscription error:', err);
          setIsProcessing(false);
          toast({ title: "❌ 실시간 연결 실패", description: err.message, variant: "destructive" });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // ⭐️ 4. addLogEntry와 toast, clearInputs를 의존성 배열에 추가하여 항상 최신 상태를 기억하게 합니다.
  }, [currentRequestId, addLogEntry, toast, clearInputs]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  
  const handleSubmit = async (payload: any) => {
    setIsProcessing(true);
    setLogs([]);
    
    try {
      const requestId = await sendWebhookRequest(payload);
      setCurrentRequestId(requestId);
      addLogEntry('📤 전송 시작', { ...payload, request_id: requestId });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 전송 오류', errorMessage);
      toast({ title: "❌ 전송 실패", description: errorMessage, variant: "destructive" });
      setIsProcessing(false);
    }
  };
  
  const handleSignOut = async () => { /* ... 이전과 동일 ... */ };

  return {
    user, isAuthLoading, isDark, equipment, setEquipment, class1, setClass1, class2, setClass2, savedReadings, setSavedReadings, logs, setLogs, chatOpen, setChatOpen, isProcessing, tempMessages, setTempMessages,
    toggleTheme, handleEquipmentChange, handleClass1Change, addLogEntry, handleSubmit, handleSignOut
  };
};
