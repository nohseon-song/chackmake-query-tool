import React from 'react';
import EquipmentSelection from './EquipmentSelection';
import EquipmentCard from './EquipmentCard';
import ReadingsManagement from './ReadingsManagement';
import ActionButtons from './ActionButtons';
import LogDisplay from './LogDisplay';
import { Reading, LogEntry } from '@/types';
import { EQUIPMENT_TREE } from '@/constants/equipment';

interface MainContentProps {
  equipment: string;
  setEquipment: (value: string) => void;
  class1: string;
  setClass1: (value: string) => void;
  class2: string;
  setClass2: (value: string) => void;
  savedReadings: Reading[];
  setSavedReadings: (readings: Reading[]) => void;
  isProcessing: boolean;
  handleSubmit: () => void;
  isDark: boolean;
  tempMessagesCount: number;
  logs: LogEntry[];
  isWebhookReady: boolean;
  onChatOpen: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
  equipment,
  setEquipment,
  class1,
  setClass1,
  class2,
  setClass2,
  savedReadings,
  setSavedReadings,
  isProcessing,
  handleSubmit,
  isDark,
  tempMessagesCount,
  logs,
  isWebhookReady,
  onChatOpen,
}) => {
  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {!isProcessing ? (
          <>
            <EquipmentSelection
              equipment={equipment}
              class1={class1}
              class2={class2}
              equipmentTree={EQUIPMENT_TREE}
              onEquipmentChange={setEquipment}
              onClass1Change={setClass1}
              onClass2Change={setClass2}
              onChatOpen={onChatOpen}
              onOCRResult={() => {}}
              onAddLogEntry={() => {}}
              isDark={isDark}
            />
            {equipment && (
              <div className="mt-6">
                <EquipmentCard
                  name={equipment}
                  isSelected={true}
                  onClick={() => {}}
                  isDark={isDark}
                />
                <ReadingsManagement
                  equipment={equipment}
                  class1={class1}
                  class2={class2}
                  showInputs={true}
                  savedReadings={savedReadings}
                  onSaveReading={(reading) => setSavedReadings([...savedReadings, reading])}
                  onUpdateReading={(index, reading) => {
                    const updated = [...savedReadings];
                    updated[index] = reading;
                    setSavedReadings(updated);
                  }}
                  onDeleteReading={(index) => {
                    const filtered = savedReadings.filter((_, i) => i !== index);
                    setSavedReadings(filtered);
                  }}
                  isDark={isDark}
                  logs={logs}
                />
              </div>
            )}
            <ActionButtons
              savedReadingsCount={savedReadings.length}
              isProcessing={isProcessing}
              onSubmit={handleSubmit}
              isDark={isDark}
              tempMessagesCount={tempMessagesCount}
              isWebhookReady={isWebhookReady} // [수정됨] 이 줄 추가
            />
          </>
        ) : (
          <LogDisplay logs={logs} isDark={isDark} />
        )}
      </div>
    </main>
  );
};

export default MainContent;
