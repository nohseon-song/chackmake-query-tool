import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { sendWebhookRequest } from '@/services/webhookService';
import { LogEntry, Reading } from '@/types';
import { equipmentData, EQUIPMENT_TREE } from '@/constants/equipment';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';

interface TempMessage {
  id: string;
  content: string;
  timestamp: number;
}

export const useAppState = () => {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Theme state
  const isDark = theme === 'dark';
  
  // Equipment state
  const [equipment, setEquipment] = useState<string>('');
  const [class1, setClass1] = useState<string>('');
  const [class2, setClass2] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  
  // Readings state
  const [readings, setReadings] = useState<Reading[]>([]);
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  
  // Processing state
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [tempMessages, setTempMessages] = useState<TempMessage[]>([]);

  // Auth effect
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsAuthLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Basic functions
  const addReading = useCallback(() => {
    const newReading: Reading = {
      equipment: equipment,
      class1: class1,
      class2: class2,
      design: '',
      measure: ''
    };
    setReadings(prev => [...prev, newReading]);
  }, [equipment, class1, class2]);

  const updateReading = useCallback((index: number, field: keyof Reading, value: any) => {
    setReadings(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }, []);

  const removeReading = useCallback((index: number) => {
    setReadings(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAllInputs = useCallback(() => {
    setSelectedEquipment([]);
    setReadings([]);
    setLogs([]);
    setCurrentRequestId(null);
  }, []);

  // Theme toggle
  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  // Equipment handlers
  const handleEquipmentChange = useCallback((value: string) => {
    setEquipment(value);
    setClass1('');
    setClass2('');
  }, []);

  const handleClass1Change = useCallback((value: string) => {
    setClass1(value);
    setClass2('');
  }, []);

  // Temp message handlers
  const addTempMessage = useCallback((content: string) => {
    const newMessage: TempMessage = {
      id: Date.now().toString(),
      content,
      timestamp: Date.now()
    };
    setTempMessages(prev => [...prev, newMessage]);
  }, []);

  const updateTempMessage = useCallback((id: string, content: string) => {
    setTempMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, content } : msg
    ));
  }, []);

  const deleteTempMessage = useCallback((id: string) => {
    setTempMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async (payload: any) => {
    setIsProcessing(true);
    setLogs([]);
    
    const submitPayload = {
      equipment: selectedEquipment.map(id => equipmentData.find(e => e.id === id)?.name),
      readings: readings.map(({ equipment, class1, class2, design, measure }) => ({ 
        equipment, class1, class2, design, measure 
      })),
      ...payload
    };
    
    setLogs(prev => [...prev, { 
      id: Date.now().toString(), 
      tag: '📤 데이터 전송', 
      content: JSON.stringify(submitPayload, null, 2), 
      isResponse: false, 
      timestamp: Date.now() 
    }]);

    try {
      const requestId = await sendWebhookRequest(submitPayload);
      setCurrentRequestId(requestId);
      toast({ title: "진단 시작됨", description: "Supabase로 데이터가 전송되었습니다." });
    } catch (error: any) {
      setIsProcessing(false);
      toast({ title: "전송 실패", description: error.message, variant: "destructive" });
      setLogs(prev => [...prev, { 
        id: Date.now().toString(), 
        tag: '❌ 전송 실패', 
        content: error.message, 
        isResponse: true, 
        timestamp: Date.now() 
      }]);
    }
  }, [selectedEquipment, readings, toast]);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  }, [navigate]);

  // Processing effect
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
      })
      .subscribe((status, err) => {
        if (err) {
          setIsProcessing(false);
          toast({ title: "❌ 실시간 연결 실패", description: err.message, variant: "destructive" });
        }
      });
      
    return () => { supabase.removeChannel(channel); };
  }, [currentRequestId, toast, clearAllInputs]);

  const startProcessing = async () => {
    if (selectedEquipment.length === 0) {
      toast({ title: "장비 선택 필요", description: "하나 이상의 장비를 선택해주세요.", variant: "destructive" });
      return;
    }
    await handleSubmit({});
  };

  return {
    // Auth
    user,
    isAuthLoading,
    
    // Theme
    isDark,
    toggleTheme,
    
    // Equipment
    equipment,
    setEquipment,
    class1,
    setClass1,
    class2,
    setClass2,
    selectedEquipment,
    setSelectedEquipment,
    handleEquipmentChange,
    handleClass1Change,
    
    // Readings
    readings,
    addReading,
    updateReading,
    removeReading,
    savedReadings,
    setSavedReadings,
    
    // Processing
    isProcessing,
    logs,
    setLogs,
    startProcessing,
    clearAllInputs,
    
    // Chat
    chatOpen,
    setChatOpen,
    tempMessages,
    setTempMessages,
    addTempMessage,
    updateTempMessage,
    deleteTempMessage,
    
    // Handlers
    handleSubmit,
    handleSignOut,
    toast
  };
};