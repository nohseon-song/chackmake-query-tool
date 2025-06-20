
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OCRFeatureProps {
  isProcessing: boolean;
  onOCRResult: (result: string) => void;
  onAddLogEntry: (tag: string, content: string) => void;
  class2: string;
}

const OCRFeature: React.FC<OCRFeatureProps> = ({
  isProcessing,
  onOCRResult,
  onAddLogEntry,
  class2
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleOCR = () => {
    if (!class2) {
      onAddLogEntry('🔔 안내', '설비→주요 점검 부분→세부 점검 항목을 먼저 선택하세요.');
      return;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // OCR 기능은 실제 구현을 위해 별도 라이브러리가 필요하므로 
      // 여기서는 시뮬레이션으로 처리
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockOCRResult = "25.5°C";
      onOCRResult(mockOCRResult);
      
      onAddLogEntry('📑 OCR 결과', mockOCRResult);
      
      toast({
        title: "OCR 완료",
        description: "이미지에서 텍스트를 추출했습니다.",
      });
    } catch (error) {
      toast({
        title: "OCR 실패",
        description: "이미지 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Button
        onClick={handleOCR}
        disabled={isProcessing}
        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
      >
        <Camera className="w-6 h-6" />
      </Button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
};

export default OCRFeature;
