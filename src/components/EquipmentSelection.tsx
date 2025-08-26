
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MessageSquare } from 'lucide-react';
import EquipmentCard from '@/components/EquipmentCard';
import { Card, CardContent } from '@/components/ui/card';

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

const EQUIPMENT_ITEMS = [
  "냉동기(압축식)", "냉동기(흡수식)", "냉각탑",
  "축열조", "보일러", "열교환기",
  "펌프", "공기조화기", "환기설비",
  "현열교환기", "전열교환기", "팬코일유니트",
  "위생기구설비", "급수급탕설비"
];

const EquipmentSelection: React.FC<EquipmentSelectionProps> = ({
  equipment,
  class1,
  class2,
  equipmentTree,
  onEquipmentChange,
  onClass1Change,
  onClass2Change,
  onChatOpen,
  isDark
}) => {
  const selectedEquipment = equipmentTree[equipment];
  const selectedClass1 = selectedEquipment?.[class1];

  return (
    <>
      <div>
        <Label className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 block">
          ◉ 대상 설비를 선택해 주세요 ◉
        </Label>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {EQUIPMENT_ITEMS.map((item) => (
            <EquipmentCard
              key={item}
              name={item}
              isSelected={equipment === item}
              onClick={() => onEquipmentChange(item)}
              isDark={isDark}
            />
          ))}
          
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${
              isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'
            }`}
            onClick={onChatOpen}
          >
            <CardContent className="p-3 flex items-center justify-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Agent Team </span>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedEquipment && (
        <div>
          <Label className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
            ✹ 주요 점검부 선택 ✹
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
            ✦ 세부 점검 항목 ✦
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
