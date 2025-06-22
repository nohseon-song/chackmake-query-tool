
import React from 'react';
import ReadingInputs from '@/components/ReadingInputs';
import SavedReadingsList from '@/components/SavedReadingsList';
import { Reading } from '@/types';

interface ReadingsManagementProps {
  equipment: string;
  class1: string;
  class2: string;
  showInputs: boolean;
  savedReadings: Reading[];
  onSaveReading: (reading: Reading) => void;
  onUpdateReading: (index: number, reading: Reading) => void;
  onDeleteReading: (index: number) => void;
  isDark: boolean;
  logs: any[];
}

const ReadingsManagement: React.FC<ReadingsManagementProps> = ({
  equipment,
  class1,
  class2,
  showInputs,
  savedReadings,
  onSaveReading,
  onUpdateReading,
  onDeleteReading,
  isDark,
  logs
}) => {
  return (
    <>
      {showInputs && (
        <ReadingInputs
          equipment={equipment}
          class1={class1}
          class2={class2}
          onSaveReading={onSaveReading}
          isDark={isDark}
          logs={logs}
        />
      )}

      <SavedReadingsList
        savedReadings={savedReadings}
        onUpdateReading={onUpdateReading}
        onDeleteReading={onDeleteReading}
        isDark={isDark}
      />
    </>
  );
};

export default ReadingsManagement;
