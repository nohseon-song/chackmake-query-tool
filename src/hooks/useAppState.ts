// src/hooks/useAppState.ts

import { useState, useEffect } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookData } from '@/services/webhookService';
import { GoogleAuthState, authenticateGoogle, validateGoogleToken, fetchGoogleClientId, exchangeCodeForToken } from '@/utils/googleDocsUtils';
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
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthState>({
    isAuthenticated: false,
    accessToken: null
  });
  
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


  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const handleEquipmentChange = (value: string) => {
    setEquipment(value);
    setClass1('');
    setClass2('');
  };

  const handleClass1Change = (value: string) => {
    setClass1(value);
    setClass2('');
  };

  const addLogEntry = (type: 'info' | 'error' | 'success', message: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      tag: type,
      content: message,
      timestamp: Date.now()
    };
    setLogs(prevLogs => [...prevLogs, newLog]);
  };

  const addTempMessage = (message: string) => {
    setTempMessages(prev => [...prev, message]);
  };
  
  const updateTempMessage = (index: number, message: string) => {
    setTempMessages(prev => prev.map((msg, i) => (i === index ? message : msg)));
  };
  
  const deleteTempMessage = (index: number) => {
    setTempMessages(prev => prev.filter((_, i) => i !== index));
  };
  
  const clearTempMessages = () => {
    setTempMessages([]);
  };

  const sendWebhook = async (data: any, message: string) => {
    setIsProcessing(true);
    addLogEntry('info', message);
    try {
      await sendWebhookData(data);
      addLogEntry('success', 'Webhook sent successfully!');
      toast({
        title: "성공",
        description: "데이터가 성공적으로 전송되었습니다.",
      });
    } catch (error) {
      addLogEntry('error', 'Failed to send webhook.');
      toast({
        title: "오류",
        description: "데이터 전송에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleGoogleAuth = async () => {
    if (googleAuth.isAuthenticated) {
      setGoogleAuth({ isAuthenticated: false, accessToken: null });
      toast({ title: 'Google 로그아웃', description: 'Google 계정에서 로그아웃되었습니다.' });
    } else {
      try {
        const clientId = await fetchGoogleClientId();
        const token = await authenticateGoogle();
        await validateGoogleToken(token);
        setGoogleAuth({ isAuthenticated: true, accessToken: token });
        toast({ title: 'Google 로그인 성공', description: 'Google 계정에 성공적으로 로그인했습니다.' });
      } catch (error: any) {
        toast({ title: 'Google 인증 오류', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleSignOut = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setEquipment('');
      setClass1('');
      setClass2('');
      setSavedReadings([]);
      setLogs([]);
      setTempMessages([]);
      
      toast({
        title: "로그아웃 성공",
        description: "성공적으로 로그아웃되었습니다.",
      });
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "로그아웃 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    user,
    isAuthLoading,
    isDark,
    equipment,
    class1,
    class2,
    savedReadings,
    logs,
    chatOpen,
    isProcessing,
    tempMessages,
    googleAuth,
    
    handleSignOut,
    toggleTheme,
    handleEquipmentChange,
    handleClass1Change,
    setEquipment,
    setClass1,
    setClass2,
    setSavedReadings,
    setLogs,
    setChatOpen,
    addTempMessage,
    updateTempMessage,
    deleteTempMessage,
    clearTempMessages,
    addLogEntry,
    sendWebhook,
    handleGoogleAuth,
    toast
  };
};
