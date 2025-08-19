// src/hooks/useAppState.ts

import { useState, useEffect } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
// ⭐️ 1. 방금 수정한 새 함수를 가져옵니다.
import { sendWebhookRequest } from '@/services/webhookService';
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

  // ⭐️ 2. 현재 진행 중인 요청의 ID를 저장할 새로운 상태 변수를 추가합니다.
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

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

  // ⭐️ 3. Supabase Realtime을 구독하는 핵심 로직입니다.
  useEffect(() => {
    // 구독할 요청 ID가 없으면 아무것도 하지 않습니다.
    if (!currentRequestId) return;

    const channel = supabase.channel(`diagnosis_results:${currentRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'diagnosis_results',
          filter: `request_id=eq.${currentRequestId}`, // 내가 보낸 요청 ID와 일치하는 결과만 받습니다.
        },
        (payload) => {
          console.log('Realtime payload received:', payload);
          const newResult = payload.new as any;
          const content = newResult.content;

          // is_final 플래그로 최종 보고서인지 확인합니다.
          if (newResult.is_final) {
              addLogEntry('📥 최종 보고서', content, true);
              setIsProcessing(false); // 로딩 종료
              toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
              setCurrentRequestId(null); // 요청 ID 초기화
          } else {
              addLogEntry(`📥 ${newResult.step_name}`, content); // 중간 결과 로그 추가
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to request ID: ${currentRequestId}`);
        }
        if (err) {
          console.error('Realtime subscription error:', err);
          setIsProcessing(false);
          toast({ title: "❌ 실시간 연결 실패", description: err.message, variant: "destructive" });
        }
      });

    // 다른 페이지로 이동하거나 앱을 끌 때 구독을 해제합니다.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRequestId]); // currentRequestId가 바뀔 때마다 이 로직이 실행됩니다.


  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  const handleEquipmentChange = (value: string) => { setEquipment(value); setClass1(''); setClass2(''); };
  const handleClass1Change = (value: string) => { setClass1(value); setClass2(''); };
  const addLogEntry = (tag: string, content: any, isResponse = false) => {
    // content가 이미 객체나 배열이면 JSON.stringify 처리
    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const logEntry: LogEntry = { id: Date.now().toString(), tag, content: contentString, isResponse, timestamp: Date.now() };
    setLogs(prev => [...prev, logEntry]);
  };
  const addTempMessage = (message: string) => setTempMessages(prev => [...prev, message]);
  const updateTempMessage = (index: number, newMessage: string) => setTempMessages(prev => prev.map((msg, idx) => idx === index ? newMessage : msg));
  const deleteTempMessage = (index: number) => setTempMessages(prev => prev.filter((_, idx) => idx !== index));
  const clearTempMessages = () => setTempMessages([]);

  // ⭐️ 4. '진단 받기' 버튼을 눌렀을 때 실행될 함수를 수정합니다.
  const sendWebhook = async (payload: any) => {
    setIsProcessing(true);
    // 이전 로그는 깨끗하게 비워줍니다.
    setLogs([]);

    try {
      // Make.com으로 요청을 보내고, 고유한 요청 ID를 받아옵니다.
      const requestId = await sendWebhookRequest(payload);
      // 받아온 요청 ID를 상태에 저장하면, 위에서 만든 Realtime 구독 로직이 자동으로 작동 시작합니다.
      setCurrentRequestId(requestId);
      addLogEntry('📤 전송 시작', { ...payload, request_id: requestId });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 전송 오류', errorMessage);
      toast({ title: "❌ 전송 실패", description: errorMessage, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  const clearSavedReadings = () => {
    setSavedReadings([]);
  };

  const handleGoogleAuth = async (): Promise<string> => {
    toast({ title: "Google 인증", description: "Google 인증 기능이 구현될 예정입니다." });
    return '';
  };

  const handleSignOut = async () => {
    setIsProcessing(true);
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      toast({ title: "로그아웃 실패", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    user, isAuthLoading, isDark, equipment, class1, class2, savedReadings, logs, chatOpen, isProcessing, tempMessages,
    toggleTheme, handleEquipmentChange, handleClass1Change, setEquipment, setClass1, setClass2, setSavedReadings, setLogs, setChatOpen,
    addTempMessage, updateTempMessage, deleteTempMessage, clearTempMessages, addLogEntry, sendWebhook, handleGoogleAuth, handleSignOut, toast
  };
};
