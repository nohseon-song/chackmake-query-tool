
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface EquipmentCardProps {
  name: string;
  isSelected: boolean;
  onClick: () => void;
  isDark: boolean;
}

const EquipmentCard: React.FC<EquipmentCardProps> = ({
  name,
  isSelected,
  onClick,
  isDark
}) => {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-ring bg-accent' 
          : 'hover:shadow-md hover:scale-105'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="text-sm font-medium text-center leading-tight text-foreground">
          {name}
        </div>
      </CardContent>
    </Card>
  );
};

export default EquipmentCard;
