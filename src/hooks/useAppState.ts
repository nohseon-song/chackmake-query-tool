// src/hooks/useAppState.ts

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { sendWebhookRequest } from '@/services/webhookService';
import { LogEntry, Reading } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

interface TempMessage {
  id: string;
  content: string;
  timestamp: number;
}

export const useAppState = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // --- 상태 관리 (State Management) ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(false); // 다크 모드 상태
  const [equipment, setEquipment] = useState<string>('');
  const [class1, setClass1] = useState<string>('');
  const [class2, setClass2] = useState<string>('');
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [tempMessages, setTempMessages] = useState<TempMessage[]>([]);

  // --- 효과 (Effects) ---

  // 1. 앱이 처음 시작될 때 사용자가 로그인했는지 확인
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. 시스템의 다크 모드 설정을 따라가도록 설정
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);
    document.documentElement.classList.toggle('dark', mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
        setIsDark(e.matches);
        document.documentElement.classList.toggle('dark', e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 3. Supabase로부터 실시간으로 결과 받아오기
  useEffect(() => {
    if (!currentRequestId) return;

    const channel = supabase.channel(`diagnosis_results:${currentRequestId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'diagnosis_results', 
        filter: `request_id=eq.${currentRequestId}` 
      }, (payload) => {
        const newResult = payload.new as any;
        
        setLogs(prevLogs => {
          const newLogEntry: LogEntry = {
            id: newResult.id || Date.now().toString(),
            tag: newResult.is_final ? '📥 최종 보고서' : `📥 ${newResult.step_name || '진단 단계'}`,
            content: newResult.content || '내용 없음',
            isResponse: true,
            timestamp: new Date(newResult.created_at).getTime(),
            diagnosis_summary_html: newResult.content?.diagnosis_summary_html,
            complementary_summary_html: newResult.content?.complementary_summary_html,
            precision_verification_html: newResult.content?.precision_verification_html,
            final_summary_html: newResult.content?.final_summary_html,
          };
          // 중복된 로그가 들어오지 않도록 방지
          if (!prevLogs.some(log => log.id === newLogEntry.id)) {
            return [...prevLogs, newLogEntry];
          }
          return prevLogs;
        });

        if (newResult.is_final) {
          setIsProcessing(false);
          toast({ title: "✅ 진단 완료", description: "모든 기술검토가 완료되었습니다." });
          setCurrentRequestId(null);
          channel.unsubscribe();
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('실시간 연결 오류:', err);
          setIsProcessing(false);
          toast({ title: "❌ 실시간 연결 실패", description: `결과를 받아올 수 없습니다: ${err.message}`, variant: "destructive" });
        }
      });
      
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [currentRequestId, toast]);

  // --- 함수 (Functions) ---

  const toggleTheme = useCallback(() => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
  }, [isDark]);

  const handleEquipmentChange = useCallback((value: string) => {
    setEquipment(value);
    setClass1('');
    setClass2('');
  }, []);

  const handleClass1Change = useCallback((value: string) => {
    setClass1(value);
    setClass2('');
  }, []);

  const addTempMessage = useCallback((content: string) => {
    const newMessage: TempMessage = { id: Date.now().toString(), content, timestamp: Date.now() };
    setTempMessages(prev => [...prev, newMessage]);
  }, []);

  const updateTempMessage = useCallback((id: string, content: string) => {
    setTempMessages(prev => prev.map(msg => msg.id === id ? { ...msg, content } : msg));
  }, []);

  const deleteTempMessage = useCallback((id: string) => {
    setTempMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    setLogs([]); // 이전 로그는 초기화
    
    const payload = {
      readings: savedReadings,
      messages: tempMessages.map(m => m.content),
      user_id: user.id,
      organization_id: (user.user_metadata as any)?.organization_id, // 사용자 메타데이터에서 가져오기
      timestamp: new Date().toISOString(),
    };
    
    try {
      const requestId = await sendWebhookRequest(payload);
      setCurrentRequestId(requestId);
      toast({ title: "진단 시작됨", description: "데이터를 서버로 전송했습니다." });
    } catch (error: any) {
      setIsProcessing(false);
      toast({ title: "전송 실패", description: error.message, variant: "destructive" });
    }
  }, [savedReadings, tempMessages, user, toast]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  }, [navigate]);

  return {
    user, isAuthLoading, isDark, equipment, setEquipment, class1, setClass1, class2, setClass2,
    savedReadings, setSavedReadings, logs, setLogs, chatOpen, setChatOpen,
    isProcessing, tempMessages, setTempMessages,
    toggleTheme, handleEquipmentChange, handleClass1Change,
    addTempMessage, updateTempMessage, deleteTempMessage,
    handleSubmit, handleSignOut,
  };
};
