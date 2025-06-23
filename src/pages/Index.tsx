
import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import MainContent from '@/components/MainContent';
import FloatingButtons from '@/components/FloatingButtons';
import ChatModal from '@/components/ChatModal';
import { EQUIPMENT_TREE } from '@/constants/equipment';
import { useAppState } from '@/hooks/useAppState';
import { useReadings } from '@/hooks/useReadings';

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
    deleteTempMessage,
    clearTempMessages,
    addLogEntry,
    sendWebhook,
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

    const payload: any = {
      timestamp: Date.now()
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
    await sendWebhook({
      chat: message,
      timestamp: Date.now()
    });
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`flex flex-col items-center p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm relative`}>
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        <h1 className="text-xl font-bold mb-1">CheckMake Pro-Ultra 2.0</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">기계설비 성능점검 + 유지관리 전문 기술 진단 App</p>
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
        onTempMessageDelete={deleteTempMessage}
      />
    </div>
  );
};

export default Index;
