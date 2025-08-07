
import { useState, useEffect } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { sendWebhookData } from '@/services/webhookService';
import { GoogleAuthState, authenticateGoogle, validateGoogleToken } from '@/utils/googleDocsUtils';

export const useAppState = () => {
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
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const resetSelections = (level: number) => {
    if (level <= 0) {
      setClass1('');
      setClass2('');
    } else if (level === 1) {
      setClass2('');
    }
  };

  const handleEquipmentChange = (value: string) => {
    setEquipment(value);
    resetSelections(0);
  };

  const handleClass1Change = (value: string) => {
    setClass1(value);
    resetSelections(1);
  };

  const addTempMessage = (message: string) => {
    setTempMessages(prev => [...prev, message]);
  };

  const updateTempMessage = (index: number, newMessage: string) => {
    setTempMessages(prev => prev.map((msg, idx) => idx === index ? newMessage : msg));
  };

  const deleteTempMessage = (index: number) => {
    setTempMessages(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearTempMessages = () => {
    setTempMessages([]);
  };

  const addLogEntry = (tag: string, content: string, isResponse = false) => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      tag,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      isResponse,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, logEntry]);
  };

  const sendWebhook = async (payload: any) => {
    addLogEntry('📤 전송', payload);
    setIsProcessing(true);
    
    try {
      const responseText = await sendWebhookData(payload);
      addLogEntry('📥 응답', responseText, true);
      
      toast({
        title: "전송 완료",
        description: "전문 기술검토가 완료되었습니다.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 오류', errorMessage);
      
      toast({
        title: "전송 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleAuth = async (): Promise<string> => {
    try {
      
      // 기존 토큰이 있다면 검증
      if (googleAuth.accessToken) {
        const isValid = await validateGoogleToken(googleAuth.accessToken);
        if (isValid) {
          return googleAuth.accessToken;
        }
      }

      // 새로운 인증 진행
      const accessToken = await authenticateGoogle();
      setGoogleAuth({
        isAuthenticated: true,
        accessToken
      });

      toast({
        title: "Google 인증 완료",
        description: "Google Docs 연동이 완료되었습니다.",
      });

      return accessToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google 인증에 실패했습니다.';
      
      toast({
        title: "Google 인증 실패",
        description: errorMessage,
        variant: "destructive",
      });

      throw error;
    }
  };

  return {
    // State
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
    
    // Actions
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
