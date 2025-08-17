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
    toast,
    handleSignOut
  } = useAppState();

  const {
    handleSaveReading,
    handleUpdateReading,
    handleDeleteReading,
    clearSavedReadings,
    handleDeleteLog,
    handleDownloadPdf
  } = useReadings(savedReadings, setSavedReadings);
  
  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate('/auth');
    }
  }, [user, isAuthLoading, navigate]);


  const handleSubmit = async () => {
    if (savedReadings.length === 0) {
      toast({
        title: "경고",
        description: "저장된 측정값이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      equipment,
      class1,
      class2,
      readings: savedReadings.map(r => ({ ...r, value: parseFloat(r.value) }))
    };

    await sendWebhook(data, 'Submitting readings to webhook...');
  };

  const handleChatMessage = async (message: string) => {
    addLogEntry('info', `Sending message to chat: ${message}`);
    
    // Simulate API call to chatbot
    setTimeout(() => {
      addLogEntry('success', 'Received response from chat.');
      toast({
        title: "채팅 응답",
        description: "AI로부터 응답을 받았습니다.",
      });
    }, 1000);
  };
  
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        로딩 중...
      </div>
    );
  }


  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`flex flex-col items-center p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm relative`}>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <User className="w-4 h-4" />
              <span>{user.email}</span>
            </div>
          )}
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
            disabled={isProcessing}
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </Button>
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>
        <h1 className="text-xl font-bold mb-1">CheckMake Pro-Ultra 2.0</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">기계설비 성능점검 + 유지관리 현장 기술 진단 App</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">professional-engineering Insight by SNS</p>
      </header>

      <MainContent
        equipment={equipment}
        class1={class1}
        class2={class2}
        savedReadings={savedReadings}
        isDark={isDark}
        isProcessing={isProcessing}
        handleEquipmentChange={handleEquipmentChange}
        handleClass1Change={handleClass1Change}
        setClass2={setClass2}
        handleSaveReading={handleSaveReading}
        handleUpdateReading={handleUpdateReading}
        handleDeleteReading={handleDeleteReading}
        handleSubmit={handleSubmit}
        clearSavedReadings={clearSavedReadings}
        equipmentTree={EQUIPMENT_TREE}
      />
      
      <FloatingButtons
        onChatClick={() => setChatOpen(true)}
        onPdfClick={() => handleDownloadPdf(equipment, class1, class2)}
      />

      <ChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onSendMessage={handleChatMessage}
        isDark={isDark}
        tempMessages={tempMessages}
        addTempMessage={addTempMessage}
        updateTempMessage={updateTempMessage}
        deleteTempMessage={deleteTempMessage}
        clearTempMessages={clearTempMessages}
      />
      
      <LogDisplay logs={logs} onDeleteLog={handleDeleteLog} />
    </div>
  );
};

export default Index;
