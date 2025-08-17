import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import MainContent from '@/components/MainContent';
import FloatingButtons from '@/components/FloatingButtons';
import ChatModal from '@/components/ChatModal';
import { EQUIPMENT_TREE } from '@/constants/equipment';
import { useAppState } from '@/hooks/useAppState';
import { useReadings } from '@/hooks/useReadings';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const {
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
    toast
  } = useAppState();

  const {
    handleSaveReading,
    handleUpdateReading,
    handleDeleteReading,
    clearSavedReadings,
    handleDeleteLog,
    handleDownloadPdf
  } = useReadings(savedReadings, setSavedReadings);

  const handleSubmit = async () => {
    if (savedReadings.length === 0 && tempMessages.length === 0) {
      toast({
        title: "데이터 없음",
        description: "저장된 측정값이나 임시저장된 메시지가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // --- 👇 여기가 업그레이드된 핵심 코드입니다 ---
    // 1. 현재 로그인한 사용자의 정보를 가져옵니다.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "인증 오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return;
    }

    // 2. user_profiles 테이블에서 해당 사용자의 조직 ID를 찾습니다.
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
    // --- 👆 여기까지 ---

    const payload: any = {
      timestamp: Date.now(),
      user_id: user.id, // ◀◀◀ 이 한 줄이 추가되었습니다!
      organization_id: profile.organization_id, // 3. payload에 조직 ID를 추가합니다.
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

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`flex flex-col items-center p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm relative`}>
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        <h1 className="text-xl font-bold mb-1">CheckMake Pro-Ultra 2.0</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">기계설비 성능점검 + 유지관리 현장 기술 진단 App</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">professional-engineering Insight by SNS</p>
      </header>

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
        onDeleteLog={(id) => handleDeleteLog(id, setLogs)}
        onDownloadPdf={handleDownloadPdf}
        onGoogleAuth={handleGoogleAuth}
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
