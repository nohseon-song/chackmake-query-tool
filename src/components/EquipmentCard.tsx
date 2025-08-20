
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface EquipmentCardProps {
  name: string;
  isSelected: boolean;
  onClick: () => void;
}

const EquipmentCard: React.FC<EquipmentCardProps> = ({
  name,
  isSelected,
  onClick
}) => {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 bg-card hover:bg-accent ${
        isSelected 
          ? 'ring-2 ring-primary bg-accent' 
          : 'hover:shadow-md hover:scale-105'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="text-sm font-medium text-center leading-tight">
          {name}
        </div>
      </CardContent>
    </Card>
  );
};

export default EquipmentCard;
