
import { Reading } from '@/types';
import { useToast } from '@/hooks/use-toast';

export const useReadings = (
  savedReadings: Reading[],
  setSavedReadings: React.Dispatch<React.SetStateAction<Reading[]>>
) => {
  const { toast } = useToast();

  const handleSaveReading = (reading: Reading) => {
    setSavedReadings(prev => [...prev, reading]);
  };

  const handleUpdateReading = (index: number, reading: Reading) => {
    setSavedReadings(prev => prev.map((item, idx) => idx === index ? reading : item));
  };

  const handleDeleteReading = (index: number) => {
    setSavedReadings(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearSavedReadings = () => {
    setSavedReadings([]);
  };

  const handleDeleteLog = (id: string, setLogs: React.Dispatch<React.SetStateAction<any[]>>) => {
    setLogs(prev => prev.filter(log => log.id !== id));
    toast({
      title: "삭제 완료",
      description: "진단 결과가 삭제되었습니다.",
    });
  };

  const handleDownloadPdf = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `진단결과_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "다운로드 완료",
      description: "진단 결과가 다운로드되었습니다.",
    });
  };

  return {
    handleSaveReading,
    handleUpdateReading,
    handleDeleteReading,
    clearSavedReadings,
    handleDeleteLog,
    handleDownloadPdf
  };
};
