// src/hooks/useAppState.ts

import { useState, useEffect, useCallback } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookRequest } from '@/services/webhookService';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

export const useAppState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
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

  const clearAllInputs = useCallback(() => {
    setSavedReadings([]);
    setTempMessages([]);
    setEquipment('');
    setClass1('');
    setClass2('');
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    };
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentRequestId) return;

    const channel = supabase.channel(`diagnosis_results:${currentRequestId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diagnosis_results', filter: `request_id=eq.${currentRequestId}` },
        (payload) => {
          const newResult = payload.new as any;
          
          // ⭐️ '기억력 좋은 점원' 로직: setLogs의 함수형 업데이트를 사용합니다.
          // 이렇게 하면 항상 최신 'logs' 장바구니에 새 아이템을 추가하게 됩니다.
          setLogs(prevLogs => {
            const contentString = typeof newResult.content === 'string' ? newResult.content : JSON.stringify(newResult.content, null, 2);
            const newLogEntry: LogEntry = {
              id: Date.now().toString(),
              tag: newResult.is_final ? '📥 최종 보고서' : `📥 ${newResult.step_name}`,
              content: contentString,
              isResponse: newResult.is_final,
              timestamp: Date.now()
            };
            return [...prevLogs, newLogEntry];
          });

          if (newResult.is_final) {
            setIsProcessing(false);
            toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
            setCurrentRequestId(null);
            clearAllInputs();
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          setIsProcessing(false);
          toast({ title: "❌ 실시간 연결 실패", description: err.message, variant: "destructive" });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [currentRequestId, toast, clearAllInputs]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  const handleEquipmentChange = (value: string) => { setEquipment(value); setClass1(''); setClass2(''); };
  const handleClass1Change = (value: string) => { setClass1(value); setClass2(''); };
  const addTempMessage = (message: string) => setTempMessages(prev => [...prev, message]);
  const updateTempMessage = (index: number, newMessage: string) => setTempMessages(prev => prev.map((msg, idx) => idx === index ? newMessage : msg));
  const deleteTempMessage = (index: number) => setTempMessages(prev => prev.filter((_, idx) => idx !== index));
  
  const handleSubmit = async (payload: any) => {
    setIsProcessing(true);
    setLogs([]);
    try {
      const requestId = await sendWebhookRequest(payload);
      setCurrentRequestId(requestId);
      setLogs([{
          id: Date.now().toString(),
          tag: '📤 전송 시작',
          content: JSON.stringify({ ...payload, request_id: requestId }, null, 2),
          isResponse: false,
          timestamp: Date.now()
      }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      setLogs(prev => [...prev, { id: Date.now().toString(), tag: '⚠️ 전송 오류', content: errorMessage, isResponse: false, timestamp: Date.now() }]);
      toast({ title: "❌ 전송 실패", description: errorMessage, variant: "destructive" });
      setIsProcessing(false);
    }
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
    user, isAuthLoading, isDark, equipment, setEquipment, class1, setClass1, class2, setClass2,
    savedReadings, setSavedReadings, logs, setLogs, chatOpen, setChatOpen,
    isProcessing, tempMessages, setTempMessages,
    toggleTheme, handleEquipmentChange, handleClass1Change,
    addTempMessage, updateTempMessage, deleteTempMessage,
    handleSubmit, handleSignOut, toast
  };
};
