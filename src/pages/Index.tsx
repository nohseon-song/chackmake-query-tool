// src/pages/Index.tsx

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import MainContent from '@/components/MainContent';
import FloatingButtons from '@/components/FloatingButtons';
import ChatModal from '@/components/ChatModal';
import { EQUIPMENT_TREE } from '@/constants/equipment';
import { useAppState } from '@/hooks/useAppState';
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
    setClass1,
    setClass2,
    setLogs,
    setChatOpen,
    addTempMessage,
    updateTempMessage,
    deleteTempMessage,
    addLogEntry,
    // ⭐️ 1. useAppState에서 우리가 만든 새로운 handleSubmit 함수를 가져옵니다.
    handleSubmit,
    handleSignOut,
    toast,
    // useReadings에서 필요한 함수들을 직접 가져옵니다.
    handleSaveReading,
    handleUpdateReading,
    handleDeleteReading,
    handleDeleteLog,
    handleDownloadPdf
  } = useAppState();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate('/auth');
    }
  }, [user, isAuthLoading, navigate]);

  // ⭐️ 2. 버튼 클릭 시 실행될 함수입니다.
  // 이 함수가 현장 데이터와 채팅 메시지를 모아 'payload'를 만들고,
  // useAppState에 있는 handleSubmit에게 전달하는 중요한 역할을 합니다.
  const handleSubmission = async () => {
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

    // ⭐️ 3. 여기서 payload와 함께 useAppState의 handleSubmit을 호출합니다!
    await handleSubmit(payload);
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
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3"
                  disabled={isProcessing}
                >
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

      {/* ⭐️ 4. MainContent에 새롭게 연결된 함수들을 전달합니다. */}
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
        onSubmit={handleSubmission}
        onDeleteLog={(id) => handleDeleteLog(id, logs, setLogs)}
        onDownloadPdf={handleDownloadPdf}
        onChatOpen={() => setChatOpen(true)}
        onAddLogEntry={addLogEntry}
      />

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
        onSendMessage={(message: string) => {}}
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
