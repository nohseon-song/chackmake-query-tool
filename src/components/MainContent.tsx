
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import EquipmentSelection from '@/components/EquipmentSelection';
import ReadingsManagement from '@/components/ReadingsManagement';
import ActionButtons from '@/components/ActionButtons';
import LogDisplay from '@/components/LogDisplay';
interface Reading {
  equipment: string;
  class1: string;
  class2: string;
  design: string;
  measure: string;
}

interface LogEntry {
  id: string;
  tag: string;
  content: string;
  isResponse?: boolean;
  timestamp: number;
}

interface MainContentProps {
  equipment: string;
  class1: string;
  class2: string;
  equipmentTree: Record<string, any>;
  savedReadings: Reading[];
  logs: LogEntry[];
  isProcessing: boolean;
  isDark: boolean;
  tempMessagesCount: number;
  onEquipmentChange: (value: string) => void;
  onClass1Change: (value: string) => void;
  onClass2Change: (value: string) => void;
  onSaveReading: (reading: Reading) => void;
  onUpdateReading: (index: number, reading: Reading) => void;
  onDeleteReading: (index: number) => void;
  onSubmit: () => void;
  onDeleteLog: (id: string) => void;
  
  onChatOpen: () => void;
  onAddLogEntry: (tag: string, content: string) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  equipment,
  class1,
  class2,
  equipmentTree,
  savedReadings,
  logs,
  isProcessing,
  isDark,
  tempMessagesCount,
  onEquipmentChange,
  onClass1Change,
  onClass2Change,
  onSaveReading,
  onUpdateReading,
  onDeleteReading,
  onSubmit,
  onDeleteLog,
  onChatOpen,
  onAddLogEntry
}) => {
  const selectedEquipment = equipmentTree[equipment as keyof typeof equipmentTree];
  const selectedClass1 = selectedEquipment?.[class1 as keyof typeof selectedEquipment];
  const showInputs = class2 && selectedClass1;

  return (
    <main className="flex-1 overflow-y-auto p-3 pb-24">
      <Card className="mt-4">
        <CardContent className="p-4 space-y-4">
          <EquipmentSelection
            equipment={equipment}
            class1={class1}
            class2={class2}
            equipmentTree={equipmentTree}
            onEquipmentChange={onEquipmentChange}
            onClass1Change={onClass1Change}
            onClass2Change={onClass2Change}
            onChatOpen={onChatOpen}
            onOCRResult={() => {}}
            onAddLogEntry={onAddLogEntry}
            isDark={isDark}
          />

          <ReadingsManagement
            equipment={equipment}
            class1={class1}
            class2={class2}
            showInputs={showInputs}
            savedReadings={savedReadings}
            onSaveReading={onSaveReading}
            onUpdateReading={onUpdateReading}
            onDeleteReading={onDeleteReading}
            isDark={isDark}
            logs={logs}
          />
        </CardContent>
      </Card>

      <ActionButtons
        savedReadingsCount={savedReadings.length}
        isProcessing={isProcessing}
        onSubmit={onSubmit}
        isDark={isDark}
        tempMessagesCount={tempMessagesCount}
      />

      <LogDisplay 
        logs={logs} 
        isDark={isDark} 
        equipment={equipment}
        onDeleteLog={onDeleteLog}
      />

    </main>
  );
};

export default MainContent;
