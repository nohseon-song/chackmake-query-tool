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

  const addLogEntry = useCallback((tag: string, content: any, isResponse = false) => {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const logEntry: LogEntry = { id: Date.now().toString(), tag, content: contentString, isResponse, timestamp: Date.now() };
    setLogs(prev => [...prev, logEntry]);
  }, []);

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
          if (newResult.is_final) {
            addLogEntry('📥 최종 보고서', newResult.content, true);
            setIsProcessing(false);
            toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
            setCurrentRequestId(null);
            clearAllInputs();
          } else {
            addLogEntry(`📥 ${newResult.step_name}`, newResult.content);
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
  }, [currentRequestId, addLogEntry, toast, clearAllInputs]);

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
      addLogEntry('📤 전송 시작', { ...payload, request_id: requestId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 전송 오류', errorMessage);
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
