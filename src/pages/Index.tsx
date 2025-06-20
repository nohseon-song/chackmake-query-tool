
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, MessageSquare, Moon, Sun, ArrowLeft, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Reading {
  equipment: string;
  class1: string;
  class2: string;
  design: string;
  measure: string;
}

interface LogEntry {
  id: string;
  tag: string;
  content: string;
  isResponse?: boolean;
  timestamp: number;
}

const EQUIPMENT_TREE = {
  "냉동기(일반/압축식)": {
    "증발기(냉수)": ["입구 온도 [℃]","출구 온도 [℃]","냉수 유량 [LPM]","출열 [kcal/h]","냉수 설정 온도 [℃]"],
    "압축기": ["운전시 전력소비량 [kW]","입열 [kcal/h]"],
    "응축기(냉각수)": ["입구 온도 [℃]","출구 온도 [℃]","냉각수 유량 [LPM]","냉각수 설정 온도 [℃]"],
    "성적계수(COP)": ["냉매 종류","냉방 능력 (usRT)","[냉수] 입구 온도 (℃)","[냉수] 출구 온도 (℃)","[냉수] 순환량 (㎥/h)","소비전력 (kWh)"]
  },
  "냉동기(흡수식)": {
    "증발기(냉수)": ["입구 온도 [℃]","출구 온도 [℃]","냉수 유량 [LPM]","냉수 설정 온도 [℃]"],
    "압축기(재생기)": ["입열 [kcal/h]"],
    "응축기(냉각수)": ["입구 온도 [℃]","출구 온도 [℃]","냉각수 유량 [LPM]","냉각수 설정 온도 [℃]"],
    "성적계수(COP)": ["냉매 종류","냉방 능력(usRT)","[냉수] 입구온도(℃)","[냉수] 출구온도(℃)","[냉수] 순환량(㎥/h)","[흡수제 펌프 등] 소비전력(kWh)","[직화식] 연료 발열량(kcal/㎥)","[직화식-가스] 연료 사용량(㎥)","[중온수] 중온수 열량(kcal)","[중온수] 중온수 유량(LPM)","[중온수] 냉수 유량(LPM)","[증기식] 증기 열량(kcal)","[증기식] 증기 사용량(㎏)"]
  },
  "냉각탑": {
    "냉각수": ["입구 온도 [℃]","출구 온도 [℃]","냉각수 유량 [LPM]","냉각수 설정 온도 [℃]"],
    "외기 조건": ["외기 온도 [℃]","외기 습도 [%]","습구 온도 [℃]","엔탈피 [kcal/kg]"],
    "냉각 능력(CRT)": ["정격 냉각 열량 [kcal/h]","측정 냉각 열량 [kcal/h]"]
  },
  "축열조": {
    "브라인(1차측)": ["입구 온도 [℃]","출구 온도 [℃]","유량 [㎥/h]"],
    "냉수(2차측)": ["입구 온도 [℃]","출구 온도 [℃]","유량 [㎥/h]"]
  },
  "보일러": {
    "사용 조건": ["외기 온도 [℃]","실내 온도 [℃]"],
    "사용 연료": ["연료 종류(가스)","연료 종류(경유)","연료 종류(벙커C유)","연료 종류(기타 입력)","연료 사용량 [㎥/h]","연료 공급 온도 [℃]"],
    "급수 및 증기량": ["급수 공급 온도 [℃]","증기 공급 온도 [℃]","급수 및 증기량 [㎏]"],
    "성능 조건": ["운전 압력 [MPa]","연소용 공기온도 [℃]","운전부하(상당증발량) [㎏/h]","부하율 [%]","공기비","효율 [%]"]
  },
  "열교환기": {
    "중온수(1차 열원)": ["입구 온도 [℃]","출구 온도 [℃]","유량 [LPM]","처리열량 [kcal/h]"],
    "온수(2차 공급)": ["입구 온도 [℃]","출구 온도 [℃]","유량 [LPM]","처리열량 [kcal/h_]"],
    "압력(1차 열원)": ["입구 압력 [㎏/㎠]","출구 압력 [㎏/㎠]"],
    "압력(2차 공급)": ["입구 압력 [㎏/㎠]","출구 압력 [㎏/㎠]"]
  },
  "펌프": {
    "양정": ["흡입 압력 [㎏f/㎠]","토출 압력 [㎏f/㎠]"],
    "사용 조건": ["유량 [LPM]","소비 전류 [A]","소비 전력 [㎾]"]
  },
  "공기조화기": {
    "풍량": ["급기 단면적 [㎡]","환기 단면적 [㎡]","급기 풍속 [m/s]","환기 풍속 [m/s]","급기 풍량 [CMH]","환기 풍량 [CMH]"],
    "운전 정압": ["급기 [㎜Aq]","환기 [㎜Aq]"],
    "소비 전력 및 전류": ["급기 소비 전력 [kW]","급기 소비 전류 [A]","환기 소비 전력 [kW]","환기 소비 전류 [A]"],
    "필터 차압": ["정압 손실 [㎜Aq]"]
  },
  "환기설비": {
    "풍량": ["급기 단면적 [㎡]","배기 단면적 [㎡]","급기 풍속 [m/s]","배기 풍속 [m/s]","급기 풍량 [CMH]","배기 풍량 [CMH]"],
    "운전 정압": ["급기 [㎜Aq]","배기 [㎜Aq]"],
    "소비 전력 및 전류": ["급기 소비 전력 [kW]","급기 소비 전류 [A]","배기 소비 전력 [kW]","배기 소비 전류 [A]"],
    "필터 차압": ["정압 손실 [㎜Aq]"]
  },
  "현열교환기": {
    "현열 교환 효율": ["외기 건구 온도 [℃]","급기 건구 온도 [℃]","환기 건구 온도 [℃]"]
  },
  "전열교환기": {
    "전열 교환 효율": ["외기 엔탈피 [kJ/kg(DA)]","급기 엔탈피 [kJ/kg(DA)]","환기 엔탈피 [kJ/kg(DA)]","외기 건구 온도 [℃]","급기 건구 온도 [℃]","환기 건구 온도 [℃]","외기 상대 습도 [%]","급기 상대 습도 [%]","환기 상대 습도 [%]"]
  },
  "팬코일유니트": {
    "강": ["풍량 [CMH]","풍속 [m/s]"],
    "중": ["풍량 [CMH]","풍속 [m/s]"],
    "약": ["풍량 [CMH]","풍속 [m/s]"],
    "토출 공기": ["토출 공기 온도 [℃]"]
  },
  "위생기구설비": {
    "최상층": ["압력 [kPa]"],
    "최하층": ["압력 [kPa]"]
  },
  "급수급탕설비": {
    "1차 증기": ["증기 압력 [kPa]"],
    "2차 공급": ["공급 압력 [kPa]"],
    "급탕 온도": ["급탕 온도 [℃]"]
  }
};

const WEBHOOK_URL = 'https://hook.eu2.make.com/8fj69eg79sbcssao26zgtxd1360pd1rq';

const Index = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
  
  const [equipment, setEquipment] = useState<string>('');
  const [class1, setClass1] = useState<string>('');
  const [class2, setClass2] = useState<string>('');
  const [design, setDesign] = useState<string>('');
  const [measure, setMeasure] = useState<string>('');
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{text: string, isUser: boolean}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const resetSelections = (level: number) => {
    if (level <= 0) {
      setClass1('');
      setClass2('');
    } else if (level === 1) {
      setClass2('');
    }
  };

  const handleEquipmentChange = (value: string) => {
    setEquipment(value);
    resetSelections(0);
  };

  const handleClass1Change = (value: string) => {
    setClass1(value);
    resetSelections(1);
  };

  const saveReading = () => {
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

    setSavedReadings(prev => [...prev, newReading]);
    setDesign('');
    setMeasure('');
    
    toast({
      title: "임시저장 완료",
      description: "측정값이 저장되었습니다.",
    });
  };

  const clearSavedReadings = () => {
    setSavedReadings([]);
  };

  const addLogEntry = (tag: string, content: string, isResponse = false) => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      tag,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      isResponse,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, logEntry]);
  };

  const sendWebhook = async (payload: any) => {
    addLogEntry('📤 전송', payload);
    setIsProcessing(true);
    
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const responseText = await response.text();
      addLogEntry('📥 응답', responseText, true);
      
      toast({
        title: "전송 완료",
        description: "전문 기술검토가 완료되었습니다.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      addLogEntry('⚠️ 오류', errorMessage);
      
      toast({
        title: "전송 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (savedReadings.length === 0) {
      toast({
        title: "데이터 없음",
        description: "저장된 측정값이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    await sendWebhook({
      readings: savedReadings,
      timestamp: Date.now()
    });
    
    clearSavedReadings();
    setEquipment('');
    setClass1('');
    setClass2('');
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setChatInput('');

    await sendWebhook({
      chat: userMessage,
      timestamp: Date.now()
    });
  };

  const handleOCR = () => {
    if (!class2) {
      addLogEntry('🔔 안내', '설비→주요 점검 부분→세부 점검 항목을 먼저 선택하세요.');
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
      setIsProcessing(true);
      
      // OCR 기능은 실제 구현을 위해 별도 라이브러리가 필요하므로 
      // 여기서는 시뮬레이션으로 처리
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockOCRResult = "25.5°C";
      setDesign(mockOCRResult);
      
      addLogEntry('📑 OCR 결과', mockOCRResult);
      
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
    } finally {
      setIsProcessing(false);
    }
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

    // PDF 생성 로직은 실제 구현을 위해 별도 라이브러리가 필요
    toast({
      title: "PDF 다운로드",
      description: "PDF 다운로드 기능은 추후 구현 예정입니다.",
    });
  };

  const selectedEquipment = EQUIPMENT_TREE[equipment as keyof typeof EQUIPMENT_TREE];
  const selectedClass1 = selectedEquipment?.[class1 as keyof typeof selectedEquipment];
  const showInputs = class2 && selectedClass1;

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`flex flex-col items-center p-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm relative`}>
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <h1 className="text-xl font-bold mb-1">CheckMake Pro-Ultra 2.0</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">기계설비 성능점검 + 유지관리 전문 기술 진단 App</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-3 pb-24">
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4 space-y-4">
            {/* Equipment Selection */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
                점검 설비를 선택해 주세요.
              </Label>
              <Select value={equipment} onValueChange={handleEquipmentChange}>
                <SelectTrigger className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}>
                  <SelectValue placeholder="선택…" />
                </SelectTrigger>
                <SelectContent className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white'}`}>
                  {Object.keys(EQUIPMENT_TREE).map((eq) => (
                    <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class 1 Selection */}
            {selectedEquipment && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
                  주요 점검 부분 선택
                </Label>
                <Select value={class1} onValueChange={handleClass1Change}>
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

            {/* Class 2 Selection */}
            {selectedClass1 && Array.isArray(selectedClass1) && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
                  세부 점검 항목
                </Label>
                <Select value={class2} onValueChange={setClass2}>
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

            {/* Input Fields */}
            {showInputs && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">설계값</Label>
                  <Input
                    value={design}
                    onChange={(e) => setDesign(e.target.value)}
                    placeholder="설계값"
                    className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">측정값</Label>
                  <Input
                    value={measure}
                    onChange={(e) => setMeasure(e.target.value)}
                    placeholder="측정값"
                    className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}
                  />
                </div>
                <Button
                  onClick={saveReading}
                  variant="outline"
                  className="ml-auto block px-4 py-2 text-sm"
                >
                  임시저장
                </Button>
              </div>
            )}

            {/* Saved Readings Display */}
            {savedReadings.length > 0 && (
              <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-3 text-sm`}>
                {savedReadings.map((reading, idx) => (
                  <div key={idx} className="mb-1">
                    {idx + 1}. [{reading.equipment}>{reading.class1}>{reading.class2}] 설계: {reading.design} / 측정: {reading.measure}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={savedReadings.length === 0 || isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full"
          >
            {isProcessing ? '처리 중...' : '전문 기술검토 및 진단 받기'}
          </Button>
          <Button
            onClick={downloadPDF}
            variant="outline"
            className="ml-auto block px-4 py-2 text-sm"
          >
            <FileDown className="w-4 h-4 mr-2" />
            PDF 다운로드
          </Button>
        </div>

        {/* Log Section */}
        {logs.length > 0 && (
          <div className="mt-4 space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg text-sm ${
                  log.isResponse
                    ? `border-l-4 border-blue-500 ${isDark ? 'bg-gray-800' : 'bg-white'}`
                    : `${isDark ? 'bg-gray-800' : 'bg-white'}`
                } shadow-sm`}
              >
                <div className="font-medium mb-1">{log.tag}</div>
                <pre className="whitespace-pre-wrap text-xs">{log.content}</pre>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-20 right-4 space-y-3">
        <Button
          onClick={handleOCR}
          disabled={isProcessing}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        >
          <Camera className="w-6 h-6" />
        </Button>
        <Button
          onClick={() => setChatOpen(true)}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </div>

      {/* Hidden File Input for OCR */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} w-full max-h-[60%] rounded-t-2xl flex flex-col`}>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`max-w-[70%] p-3 rounded-xl text-sm ${
                    msg.isUser
                      ? 'ml-auto bg-blue-600 text-white'
                      : `mr-auto ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={handleChatSubmit} className="flex p-3 border-t border-gray-200 dark:border-gray-700">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="메시지를 입력하세요…"
                className="flex-1 mr-2"
              />
              <Button type="submit" className="px-4">전송</Button>
            </form>
            <Button
              onClick={() => setChatOpen(false)}
              variant="ghost"
              className="absolute top-2 right-2"
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
