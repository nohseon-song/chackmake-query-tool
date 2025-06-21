
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileDown, Edit, Save, X, Trash2 } from 'lucide-react';
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
  const [design, setDesign] = useState('');
  const [measure, setMeasure] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);
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

  const handleEditStart = (index: number, reading: Reading) => {
    setEditingIndex(index);
    setEditingReading({ ...reading });
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditingReading(null);
  };

  const handleEditSave = (index: number) => {
    if (!editingReading?.design.trim() || !editingReading?.measure.trim()) {
      toast({
        title: "입력 오류",
        description: "설계값과 측정값을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    onUpdateReading(index, editingReading);
    setEditingIndex(null);
    setEditingReading(null);
    
    toast({
      title: "수정 완료",
      description: "측정값이 수정되었습니다.",
    });
  };

  const handleDelete = (index: number) => {
    onDeleteReading(index);
    toast({
      title: "삭제 완료",
      description: "측정값이 삭제되었습니다.",
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
            <Label htmlFor="design" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              📐 설계값 입력
            </Label>
            <Input
              id="design"
              value={design}
              onChange={(e) => setDesign(e.target.value)}
              placeholder="설계값"
              className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}
            />
          </div>
          <div>
            <Label htmlFor="measure" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              📏 측정값 입력
            </Label>
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
              className="px-6 py-2 text-sm flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              PDF 다운로드
            </Button>
          </div>
        </div>
      )}

      {savedReadings.length > 0 && (
        <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 text-base space-y-3`}>
          {savedReadings.map((reading, idx) => (
            <div key={idx} className={`${isDark ? 'bg-gray-600' : 'bg-white'} rounded-lg p-3 border`}>
              {editingIndex === idx ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {idx + 1}. [{reading.equipment}{'>'}{reading.class1}{'>'}{reading.class2}]
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium mb-1 block">설계값</Label>
                      <Input
                        value={editingReading?.design || ''}
                        onChange={(e) => setEditingReading(prev => prev ? {...prev, design: e.target.value} : null)}
                        className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1 block">측정값</Label>
                      <Input
                        value={editingReading?.measure || ''}
                        onChange={(e) => setEditingReading(prev => prev ? {...prev, measure: e.target.value} : null)}
                        className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => handleEditSave(idx)}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      저장
                    </Button>
                    <Button
                      onClick={handleEditCancel}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-medium">
                      {idx + 1}. [{reading.equipment}{'>'}{reading.class1}{'>'}{reading.class2}]
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      설계: {reading.design} / 측정: {reading.measure}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEditStart(idx, reading)}
                      size="sm"
                      variant="ghost"
                      className="flex items-center gap-1 p-2"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(idx)}
                      size="sm"
                      variant="ghost"
                      className="flex items-center gap-1 p-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ReadingsManagement;
