
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileDown } from 'lucide-react';
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
  logs: any[];
}

const ReadingsManagement: React.FC<ReadingsManagementProps> = ({
  equipment,
  class1,
  class2,
  showInputs,
  savedReadings,
  onSaveReading,
  isDark,
  logs
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

  const downloadPDF = () => {
    const responseEntries = logs.filter(log => log.isResponse);
    if (responseEntries.length === 0) {
      toast({
        title: "다운로드 불가",
        description: "다운로드할 응답 데이터가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "PDF 다운로드",
      description: "PDF 다운로드 기능은 추후 구현 예정입니다.",
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
          <div className="flex gap-2 justify-end">
            <Button
              onClick={handleSaveReading}
              variant="outline"
              className="px-4 py-2 text-sm"
            >
              임시저장
            </Button>
            <Button
              onClick={downloadPDF}
              variant="outline"
              className="px-4 py-2 text-sm flex items-center gap-2 min-w-[120px]"
            >
              <FileDown className="w-4 h-4" />
              PDF 다운로드
            </Button>
          </div>
        </div>
      )}

      {savedReadings.length > 0 && (
        <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 text-sm`}>
          {savedReadings.map((reading, idx) => (
            <div key={idx} className="mb-1">
              {idx + 1}. [{reading.equipment}{'>'}{reading.class1}{'>'}{reading.class2}] 설계: {reading.design} / 측정: {reading.measure}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ReadingsManagement;
