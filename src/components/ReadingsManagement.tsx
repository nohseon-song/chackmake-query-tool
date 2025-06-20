
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Reading {
  equipment: string;
  class1: string;
  class2: string;
  design: string;
  measure: string;
}

interface ReadingsManagementProps {
  equipment: string;
  class1: string;
  class2: string;
  showInputs: boolean;
  savedReadings: Reading[];
  onSaveReading: (reading: Reading) => void;
  isDark: boolean;
}

const ReadingsManagement: React.FC<ReadingsManagementProps> = ({
  equipment,
  class1,
  class2,
  showInputs,
  savedReadings,
  onSaveReading,
  isDark
}) => {
  const [design, setDesign] = useState('');
  const [measure, setMeasure] = useState('');
  const { toast } = useToast();

  const handleSaveReading = () => {
    if (!design.trim() || !measure.trim()) {
      toast({
        title: "입력 오류",
        description: "설계값과 측정값을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const newReading: Reading = {
      equipment,
      class1,
      class2,
      design: design.trim(),
      measure: measure.trim()
    };

    onSaveReading(newReading);
    setDesign('');
    setMeasure('');
    
    toast({
      title: "임시저장 완료",
      description: "측정값이 저장되었습니다.",
    });
  };

  return (
    <>
      {showInputs && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="design" className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">설계값</Label>
            <Input
              id="design"
              value={design}
              onChange={(e) => setDesign(e.target.value)}
              placeholder="설계값"
              className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}
            />
          </div>
          <div>
            <Label htmlFor="measure" className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">측정값</Label>
            <Input
              id="measure"
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              placeholder="측정값"
              className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}
            />
          </div>
          <Button
            onClick={handleSaveReading}
            variant="outline"
            className="ml-auto block px-4 py-2 text-sm"
          >
            임시저장
          </Button>
        </div>
      )}

      {savedReadings.length > 0 && (
        <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 text-sm`}>
          {savedReadings.map((reading, idx) => (
            <div key={idx} className="mb-1">
              {idx + 1}. [{reading.equipment}&gt;{reading.class1}&gt;{reading.class2}] 설계: {reading.design} / 측정: {reading.measure}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ReadingsManagement;
