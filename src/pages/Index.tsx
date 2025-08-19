// src/pages/Index.tsx

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import MainContent from '@/components/MainContent';
import FloatingButtons from '@/components/FloatingButtons';
import ChatModal from '@/components/ChatModal';
import { EQUIPMENT_TREE } from '@/constants/equipment';
import { useAppState } from '@/hooks/useAppState';
import { useReadings } from '@/hooks/useReadings';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const {
    user, isAuthLoading, isDark, equipment, setEquipment, class1, setClass1, class2, setClass2,
    savedReadings, setSavedReadings, logs, setLogs, chatOpen, setChatOpen,
    isProcessing, tempMessages, setTempMessages,
    toggleTheme, handleEquipmentChange, handleClass1Change,
    addTempMessage, updateTempMessage, deleteTempMessage,
    handleSubmit, handleSignOut, toast
  } = useAppState();

  const {
    handleSaveReading, handleUpdateReading, handleDeleteReading,
    handleDeleteLog, handleDownloadPdf, handleGoogleDocsExport
  } = useReadings(savedReadings, setSavedReadings, logs, setLogs, equipment);

  useEffect(() => {
    if (!isAuthLoading && !user) navigate('/auth');
  }, [user, isAuthLoading, navigate]);

  const handleSubmission = async () => {
    if (savedReadings.length === 0 && tempMessages.length === 0) {
      toast({ title: "데이터 없음", description: "저장된 측정값이나 메시지가 없습니다.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }
    const { data: profile, error } = await supabase.from('user_profiles').select('organization_id').eq('id', user.id).single();
    if (error || !profile) {
      toast({ title: "오류", description: "사용자 프로필을 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    const payload = {
      timestamp: Date.now(),
      user_id: user.id,
      organization_id: profile.organization_id,
      readings: savedReadings,
      messages: tempMessages,
    };
    await handleSubmit(payload);
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-center sm:text-left">
              <h1 className="text-lg sm:text-xl font-bold">CheckMake Pro-Ultra 2.0</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">기계설비 성능점검 + 유지관리 현장 기술 진단 App</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              {user && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 order-3 sm:order-1">
                  <User className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="truncate max-w-[150px] sm:max-w-none">{user.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
                <Button onClick={handleSignOut} variant="ghost" size="sm" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3" disabled={isProcessing}>
                  <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">로그아웃</span>
                </Button>
              </div>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs text-gray-500 dark:text-gray-500">professional-engineering Insight by SNS</p>
          </div>
        </div>
      </header>
      
      <MainContent
        equipment={equipment} class1={class1} class2={class2}
        equipmentTree={EQUIPMENT_TREE} savedReadings={savedReadings}
        logs={logs} isProcessing={isProcessing} isDark={isDark}
        tempMessagesCount={tempMessages.length}
        onEquipmentChange={handleEquipmentChange} onClass1Change={handleClass1Change} onClass2Change={setClass2}
        onSaveReading={handleSaveReading} onUpdateReading={handleUpdateReading} onDeleteReading={handleDeleteReading}
        onSubmit={handleSubmission}
        onDeleteLog={handleDeleteLog}
        onDownloadPdf={handleDownloadPdf}
        onGoogleDocsExport={handleGoogleDocsExport}
        onChatOpen={() => setChatOpen(true)}
      />

      <FloatingButtons isProcessing={isProcessing} class2={class2} onChatOpen={() => setChatOpen(true)} />
      
      <ChatModal
        isOpen={chatOpen} onClose={() => setChatOpen(false)}
        isDark={isDark}
        tempMessages={tempMessages}
        onTempMessageAdd={addTempMessage}
        onTempMessageUpdate={updateTempMessage}
        onTempMessageDelete={deleteTempMessage}
      />
    </div>
  );
};

export default Index;
