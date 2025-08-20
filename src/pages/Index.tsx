import { useAppState } from "@/hooks/useAppState";
import ReportHeader from "@/components/ReportHeader";
import MainContent from "@/components/MainContent";
import FloatingButtons from "@/components/FloatingButtons";
import ChatModal from "@/components/ChatModal";

const Index = () => {
  const {
    user, isDark, toggleTheme, handleSignOut,
    equipment, setEquipment, class1, setClass1, class2, setClass2,
    savedReadings, setSavedReadings,
    isProcessing, handleSubmit,
    logs,
    chatOpen, setChatOpen,
    tempMessages, addTempMessage, updateTempMessage, deleteTempMessage,
    isWebhookReady // [수정됨] 이 줄 추가
  } = useAppState();

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'dark' : ''}`}>
      <ReportHeader
        onPdfDownload={() => {}}
        onGoogleDocsDownload={() => {}}
        onDeleteAll={() => {}}
        isDownloading={false}
        isGoogleDocsDownloading={false}
      />
      <MainContent
        equipment={equipment}
        setEquipment={setEquipment}
        class1={class1}
        setClass1={setClass1}
        class2={class2}
        setClass2={setClass2}
        savedReadings={savedReadings}
        setSavedReadings={setSavedReadings}
        isProcessing={isProcessing}
        handleSubmit={handleSubmit}
        isDark={isDark}
        tempMessagesCount={tempMessages.length}
        logs={logs}
        isWebhookReady={isWebhookReady}
        onChatOpen={() => setChatOpen(true)}
      />
      <FloatingButtons 
        isProcessing={isProcessing}
        class2={class2}
        onChatOpen={() => setChatOpen(true)}
        onOCRResult={() => {}}
        onAddLogEntry={() => {}}
      />
      <ChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onSendMessage={() => {}}
        isDark={isDark}
        tempMessages={tempMessages.map(m => m.content)}
        onTempMessageAdd={addTempMessage}
        onTempMessageUpdate={(index, content) => {
          const msgId = tempMessages[index]?.id;
          if (msgId) updateTempMessage(msgId, content);
        }}
        onTempMessageDelete={(index) => {
          const msgId = tempMessages[index]?.id;
          if (msgId) deleteTempMessage(msgId);
        }}
      />
    </div>
  );
};

export default Index;
