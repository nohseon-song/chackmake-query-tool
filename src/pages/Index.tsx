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
    if (savedReadings.length === 0 && tempMessages.length === 0) {
      toast({
        title: "데이터 없음",
        description: "저장된 측정값이나 임시저장된 메시지가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      toast({ title: "오류", description: "사용자 프로필 또는 조직 정보를 찾을 수 없습니다.", variant: "destructive" });
      console.error("Profile Error:", profileError);
      return;
    }

    const payload: any = {
      timestamp: Date.now(),
      user_id: user.id,
      organization_id: profile.organization_id,
    };

    if (savedReadings.length > 0) {
      payload.readings = savedReadings;
    }

    if (tempMessages.length > 0) {
      payload.messages = tempMessages;
    }

    await sendWebhook(payload);
    
    clearSavedReadings();
    clearTempMessages();
    setEquipment('');
    setClass1('');
    setClass2('');
  };

  const handleChatMessage = async (message: string) => {
    // 채팅 메시지는 임시 저장 후 handleSubmit을 통해 전송됩니다.
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

      {/* 🔽🔽🔽 빠졌던 연결선(props)들을 모두 다시 연결했어! 🔽🔽🔽 */}
      <MainContent
        equipment={equipment}
        class1={class1}
        class2={class2}
        equipmentTree={EQUIPMENT_TREE}
        savedReadings={savedReadings}
        logs={logs}
        isProcessing={isProcessing}
        isDark={isDark}
        tempMessagesCount={tempMessages.length}
        onEquipmentChange={handleEquipmentChange}
        onClass1Change={handleClass1Change}
        onClass2Change={setClass2}
        onSaveReading={handleSaveReading}
        onUpdateReading={handleUpdateReading}
        onDeleteReading={handleDeleteReading}
        onSubmit={handleSubmit}
        onDeleteLog={(id) => handleDeleteLog(id)}
        onDownloadPdf={handleDownloadPdf}
        onGoogleAuth={handleGoogleAuth}
        onChatOpen={() => setChatOpen(true)}
        onAddLogEntry={addLogEntry}
      />
      {/* 🔼🔼🔼 여기까지 🔼🔼🔼 */}

      <FloatingButtons
        isProcessing={isProcessing}
        class2={class2}
        onChatOpen={() => setChatOpen(true)}
        onOCRResult={() => {}}
        onAddLogEntry={addLogEntry}
      />

      <ChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onSendMessage={handleChatMessage}
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
