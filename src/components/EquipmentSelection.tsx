
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface EquipmentSelectionProps {
  equipment: string;
  class1: string;
  class2: string;
  equipmentTree: Record<string, any>;
  onEquipmentChange: (value: string) => void;
  onClass1Change: (value: string) => void;
  onClass2Change: (value: string) => void;
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
  isDark
}) => {
  const selectedEquipment = equipmentTree[equipment];
  const selectedClass1 = selectedEquipment?.[class1];

  return (
    <>
      <div>
        <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
          점검 설비를 선택해 주세요.
        </Label>
        <Select value={equipment} onValueChange={onEquipmentChange}>
          <SelectTrigger className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}>
            <SelectValue placeholder="선택…" />
          </SelectTrigger>
          <SelectContent className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white'}`}>
            {Object.keys(equipmentTree).map((eq) => (
              <SelectItem key={eq} value={eq}>{eq}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedEquipment && (
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
            주요 점검 부분 선택
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
          <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
            세부 점검 항목
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
