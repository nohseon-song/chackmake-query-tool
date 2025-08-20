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
        user={user}
        isDark={isDark}
        toggleTheme={toggleTheme}
        handleSignOut={handleSignOut}
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
        isWebhookReady={isWebhookReady} // [수정됨] 이 줄 추가
      />
      <FloatingButtons onChatClick={() => setChatOpen(true)} />
      <ChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={tempMessages}
        onAddMessage={addTempMessage}
        onUpdateMessage={updateTempMessage}
        onDeleteMessage={deleteTempMessage}
      />
    </div>
  );
};

export default Index;
