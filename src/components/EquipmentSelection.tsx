
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EquipmentSelectionProps {
  equipment: string;
  class1: string;
  class2: string;
  equipmentTree: Record<string, any>;
  onEquipmentChange: (value: string) => void;
  onClass1Change: (value: string) => void;
  onClass2Change: (value: string) => void;
  onChatOpen: () => void;
  onOCRResult: (result: string) => void;
  onAddLogEntry: (tag: string, content: string) => void;
  isDark: boolean;
}

const EquipmentSelection: React.FC<EquipmentSelectionProps> = ({
  equipment,
  class1,
  class2,
  equipmentTree,
  onEquipmentChange,
  onClass1Change,
  onClass2Change,
  onChatOpen,
  onOCRResult,
  onAddLogEntry,
  isDark
}) => {
  const selectedEquipment = equipmentTree[equipment];
  const selectedClass1 = selectedEquipment?.[class1];
  const { toast } = useToast();

  const handleOCRClick = () => {
    if (!class2) {
      onAddLogEntry('🔔 안내', '설비→주요 점검 부분→세부 점검 항목을 먼저 선택하세요.');
      return;
    }
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment';
    
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        onAddLogEntry('📸 OCR 시작', '이미지에서 텍스트를 추출하고 있습니다...');
        
        // OCR 시뮬레이션 (실제로는 OCR 라이브러리 사용)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mockOCRResult = "25.5°C";
        onOCRResult(mockOCRResult);
        
        onAddLogEntry('📑 OCR 결과', `추출된 텍스트: ${mockOCRResult}`);
        
        toast({
          title: "OCR 완료",
          description: "이미지에서 텍스트를 추출하여 설계값에 입력했습니다.",
        });
      } catch (error) {
        toast({
          title: "OCR 실패",
          description: "이미지 처리 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };
    
    fileInput.click();
  };

  return (
    <>
      <div>
        <Label className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 block">
          🔧 점검 설비를 선택해 주세요.
        </Label>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.keys(equipmentTree).map((eq, index) => {
            // 팬코일유니트와 급수급탕설비의 인덱스를 찾기
            const isFanCoilUnit = eq === "팬코일유니트";
            const isWaterSupply = eq === "급수급탕설비";
            
            return (
              <div key={eq} className={`${isFanCoilUnit || isWaterSupply ? 'col-span-2' : 'col-span-1'}`}>
                <Card 
                  className={`cursor-pointer transition-all duration-200 ${
                    equipment === eq 
                      ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'hover:shadow-md hover:scale-105'
                  } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
                  onClick={() => onEquipmentChange(eq)}
                >
                  <CardContent className="p-3">
                    <div className="text-sm font-medium text-center leading-tight">
                      {eq}
                    </div>
                  </CardContent>
                </Card>
                
                {/* 팬코일유니트 하단에 챗봇 카드 배치 */}
                {isFanCoilUnit && (
                  <Card 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 mt-3 ${
                      isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'
                    }`}
                    onClick={onChatOpen}
                  >
                    <CardContent className="p-3 flex items-center justify-center space-x-2">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium">Chatbot AI</span>
                    </CardContent>
                  </Card>
                )}
                
                {/* 급수급탕설비 우측에 OCR 카드 배치 - 50% 너비로 조정 */}
                {isWaterSupply && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Card 
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${
                        isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={onChatOpen}
                    >
                      <CardContent className="p-3 flex items-center justify-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium">Chatbot AI</span>
                      </CardContent>
                    </Card>
                    
                    <Card 
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${
                        isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={handleOCRClick}
                    >
                      <CardContent className="p-3 flex items-center justify-center space-x-2">
                        <Camera className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium">명판 OCR</span>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedEquipment && (
        <div>
          <Label className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
            🎯 주요 점검 부분 선택
          </Label>
          <Select value={class1} onValueChange={onClass1Change}>
            <SelectTrigger className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}>
              <SelectValue placeholder="선택…" />
            </SelectTrigger>
            <SelectContent className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white'}`}>
              {Object.keys(selectedEquipment).map((cls) => (
                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedClass1 && Array.isArray(selectedClass1) && (
        <div>
          <Label className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
            📋 세부 점검 항목
          </Label>
          <Select value={class2} onValueChange={onClass2Change}>
            <SelectTrigger className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}>
              <SelectValue placeholder="선택…" />
            </SelectTrigger>
            <SelectContent className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white'}`}>
              {selectedClass1.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
};

export default EquipmentSelection;
