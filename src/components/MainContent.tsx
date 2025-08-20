// src/components/MainContent.tsx

import React from 'react';
import EquipmentSelection from './EquipmentSelection';
import EquipmentCard from './EquipmentCard';
import ReadingsManagement from './ReadingsManagement';
import ActionButtons from './ActionButtons';
import LogDisplay from './LogDisplay';
import { Reading, LogEntry } from '@/types';

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
}) => {
  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {!isProcessing ? (
          <>
            <EquipmentSelection
              equipment={equipment}
              onEquipmentChange={(value) => { setEquipment(value); setClass1(''); setClass2(''); }}
              class1={class1}
              onClass1Change={(value) => { setClass1(value); setClass2(''); }}
              class2={class2}
              onClass2Change={setClass2}
            />
            
            {equipment && (
              <div className="mt-6">
                <EquipmentCard
                  equipment={equipment}
                  class1={class1}
                  class2={class2}
                />
                <ReadingsManagement
                  savedReadings={savedReadings}
                  setSavedReadings={setSavedReadings}
                />
              </div>
            )}
            
            <ActionButtons
              savedReadingsCount={savedReadings.length}
              isProcessing={isProcessing}
              onSubmit={handleSubmit}
              isDark={isDark}
              tempMessagesCount={tempMessagesCount}
              isWebhookReady={isWebhookReady}
            />
          </>
        ) : (
          <LogDisplay logs={logs} />
        )}
      </div>
    </main>
  );
};

export default MainContent;
