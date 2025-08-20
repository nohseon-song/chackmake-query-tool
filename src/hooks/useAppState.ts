// src/hooks/useAppState.ts

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { sendWebhookRequest } from '@/services/webhookService';
import { LogEntry, Reading } from '@/types';
import { equipmentData } from '@/constants/equipment';
import { v4 as uuidv4 } from 'uuid';

export const useAppState = () => {
    const { toast } = useToast();
    const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
    const [readings, setReadings] = useState<Reading[]>([]);
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const addReading = useCallback(() => {
        setReadings(prev => [...prev, { id: uuidv4(), name: '', value: '', file: null, progress: 0 }]);
    }, []);

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

    const startProcessing = async () => {
        if (selectedEquipment.length === 0) {
            toast({ title: "장비 선택 필요", description: "하나 이상의 장비를 선택해주세요.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        setLogs([]);
        const payload = {
            equipment: selectedEquipment.map(id => equipmentData.find(e => e.id === id)?.name),
            readings: readings.map(({ name, value }) => ({ name, value }))
        };
        setLogs(prev => [...prev, { id: Date.now().toString(), tag: '📤 데이터 전송', content: JSON.stringify(payload, null, 2), isResponse: false, timestamp: Date.now() }]);

        try {
            const requestId = await sendWebhookRequest(payload);
            setCurrentRequestId(requestId);
            toast({ title: "진단 시작됨", description: "Supabase로 데이터가 전송되었습니다." });
        } catch (error: any) {
            setIsProcessing(false);
            toast({ title: "전송 실패", description: error.message, variant: "destructive" });
            setLogs(prev => [...prev, { id: Date.now().toString(), tag: '❌ 전송 실패', content: error.message, isResponse: true, timestamp: Date.now() }]);
        }
    };

    useEffect(() => {
        if (!currentRequestId) return;

        const channel = supabase.channel(`diagnosis_results:${currentRequestId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diagnosis_results', filter: `request_id=eq.${currentRequestId}` },
                (payload) => {
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
                        clearAllInputs(); // 진단 완료 후 모든 입력 초기화
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

    return {
        selectedEquipment, setSelectedEquipment,
        readings, addReading, updateReading, removeReading,
        isProcessing, logs,
        startProcessing, clearAllInputs
    };
};
