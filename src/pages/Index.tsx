// src/pages/Index.tsx

import React, { useEffect, useRef } from 'react';
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
    handleDeleteLog, handleDownloadPdf
  } = useReadings(logs, setLogs, savedReadings, setSavedReadings, equipment);
  
  const reportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate('/auth');
    }
  }, [user, isAuthLoading, navigate]);

  // handleSubmit을 useAppState에서 직접 가져와 사용
  const handleSubmission = async () => {
    await handleSubmit();
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>사용자 정보를 불러오는 중입니다...</p>
        </div>
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
        onDownloadPdf={() => handleDownloadPdf(reportContentRef.current)}
        onChatOpen={() => setChatOpen(true)}
        onAddLogEntry={(tag: string, content: string) => {
          setLogs(prev => [...prev, { 
            id: Date.now().toString(), 
            tag, 
            content, 
            isResponse: false, 
            timestamp: Date.now() 
          }]);
        }}
      />

      <FloatingButtons 
        isProcessing={isProcessing} 
        class2={class2} 
        onChatOpen={() => setChatOpen(true)}
        onOCRResult={(result: string) => {
          setLogs(prev => [...prev, { 
            id: Date.now().toString(), 
            tag: 'OCR 결과', 
            content: result, 
            isResponse: false, 
            timestamp: Date.now() 
          }]);
        }}
        onAddLogEntry={(tag: string, content: string) => {
          setLogs(prev => [...prev, { 
            id: Date.now().toString(), 
            tag, 
            content, 
            isResponse: false, 
            timestamp: Date.now() 
          }]);
        }}
      />
      
      <ChatModal
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)}
        onSendMessage={(message: string) => addTempMessage(message)}
        isDark={isDark}
        tempMessages={tempMessages.map(msg => msg.content)}
        onTempMessageAdd={addTempMessage}
        onTempMessageUpdate={(index: number, newMessage: string) => {
          const messageId = tempMessages[index]?.id;
          if (messageId) {
            updateTempMessage(messageId, newMessage);
          }
        }}
        onTempMessageDelete={(index: number) => {
          const messageId = tempMessages[index]?.id;
          if (messageId) {
            deleteTempMessage(messageId);
          }
        }}
      />
    </div>
  );
};

export default Index;
