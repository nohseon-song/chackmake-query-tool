
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

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

  return (
    <>
      <div>
        <Label className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 block">
          🔧 점검 설비를 선택해 주세요.
        </Label>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* 첫 번째 행 */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "냉동기(일반/압축식)" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("냉동기(일반/압축식)")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                냉동기(일반/압축식)
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "냉동기(흡수식)" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("냉동기(흡수식)")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                냉동기(흡수식)
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "냉각탑" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("냉각탑")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                냉각탑
              </div>
            </CardContent>
          </Card>

          {/* 두 번째 행 */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "축열조" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("축열조")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                축열조
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "보일러" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("보일러")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                보일러
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "열교환기" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("열교환기")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                열교환기
              </div>
            </CardContent>
          </Card>

          {/* 세 번째 행 */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "펌프" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("펌프")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                펌프
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "공기조화기" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("공기조화기")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                공기조화기
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "환기설비" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("환기설비")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                환기설비
              </div>
            </CardContent>
          </Card>

          {/* 네 번째 행 */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "현열교환기" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("현열교환기")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                현열교환기
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "전열교환기" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("전열교환기")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                전열교환기
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "팬코일유니트" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("팬코일유니트")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                팬코일유니트
              </div>
            </CardContent>
          </Card>

          {/* 다섯 번째 행 */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "위생기구설비" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("위생기구설비")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                위생기구설비
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              equipment === "급수급탕설비" 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:shadow-md hover:scale-105'
            } ${isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => onEquipmentChange("급수급탕설비")}
          >
            <CardContent className="p-3">
              <div className="text-sm font-medium text-center leading-tight">
                급수급탕설비
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${
              isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'
            }`}
            onClick={onChatOpen}
          >
            <CardContent className="p-3 flex items-center justify-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Chatbot AI</span>
            </CardContent>
          </Card>
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
