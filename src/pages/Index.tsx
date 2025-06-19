
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Thermometer, Settings, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Equipment {
  label: string;
  primary?: Record<string, {
    label: string;
    secondary?: { value: string; label: string }[];
  }>;
}

const EQUIPMENT: Record<string, Equipment> = {
  chiller: {
    label: '냉동기',
    primary: {
      evaporator: {
        label: '증발기(냉수)',
        secondary: [
          { value: 'inlet-temp', label: '입구온도 [℃]' },
          { value: 'outlet-temp', label: '출구온도 [℃]' },
        ],
      },
      condenser: {
        label: '응축기(냉각수)',
        secondary: [
          { value: 'inlet-temp', label: '입구온도 [℃]' },
          { value: 'outlet-temp', label: '출구온도 [℃]' },
        ],
      },
    },
  },
  boiler: {
    label: '보일러',
    primary: {
      'hot-water': {
        label: '온수',
        secondary: [
          { value: 'supply-temp', label: '공급온도 [℃]' },
          { value: 'return-temp', label: '환수온도 [℃]' },
        ],
      },
    },
  },
  'air-handler': {
    label: '공조기',
    primary: {
      'supply-air': {
        label: '급기',
        secondary: [
          { value: 'temp', label: '온도 [℃]' },
          { value: 'humidity', label: '습도 [%]' },
        ],
      },
      'return-air': {
        label: '환기',
        secondary: [
          { value: 'temp', label: '온도 [℃]' },
          { value: 'humidity', label: '습도 [%]' },
        ],
      },
    },
  },
  'free-question': {
    label: '편하게 질문하기!',
    primary: {
      qna: {
        label: '문의',
        secondary: [],
      },
    },
  },
};

const Index = () => {
  const [equipment, setEquipment] = useState<string>('');
  const [primary, setPrimary] = useState<string>('');
  const [secondary, setSecondary] = useState<string>('');
  const [designValue, setDesignValue] = useState<string>('');
  const [measureValue, setMeasureValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const { toast } = useToast();

  const selectedEquipment = EQUIPMENT[equipment];
  const selectedPrimary = selectedEquipment?.primary?.[primary];
  const isQnaMode = equipment === 'free-question';
  const canShowInputs = (selectedPrimary && !selectedPrimary.secondary?.length) || secondary || isQnaMode;

  const handleEquipmentChange = (value: string) => {
    setEquipment(value);
    setPrimary('');
    setSecondary('');
    setError('');
  };

  const handlePrimaryChange = (value: string) => {
    setPrimary(value);
    setSecondary('');
    setError('');
  };

  const handleSecondaryChange = (value: string) => {
    setSecondary(value);
    setError('');
  };

  const validateForm = () => {
    if (!equipment) {
      setError('설비를 선택하세요.');
      return false;
    }
    if (isQnaMode && !designValue.trim()) {
      setError('질문 내용을 입력하세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;

    const payload = {
      equipment,
      primary,
      secondary,
      design: designValue.trim(),
      measure: measureValue.trim(),
    };

    setIsLoading(true);
    try {
      console.log('Sending payload:', payload);
      
      // Simulate API call for demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResponse = {
        status: 'success',
        analysis: isQnaMode 
          ? `질문에 대한 답변: ${designValue}에 대한 전문적인 분석 결과입니다.`
          : `${selectedEquipment?.label} - ${selectedPrimary?.label} 분석 결과\n설계값: ${designValue}\n측정값: ${measureValue}\n\n분석: 정상 범위 내에 있습니다.`,
        timestamp: new Date().toLocaleString('ko-KR'),
      };
      
      setResponse(JSON.stringify(mockResponse, null, 2));
      toast({
        title: "분석 완료",
        description: "결과가 성공적으로 생성되었습니다.",
      });
    } catch (err) {
      const errorMessage = '분석 중 오류가 발생했습니다.';
      setError(errorMessage);
      toast({
        title: "오류",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEquipment('');
    setPrimary('');
    setSecondary('');
    setDesignValue('');
    setMeasureValue('');
    setResponse('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            ChackMake PRO‑Ultra v2.0
          </h1>
          <p className="text-slate-300 text-lg">
            고급 HVAC 설비 분석 도구
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                설비 선택 및 설정
              </CardTitle>
              <CardDescription className="text-slate-400">
                분석할 설비와 측정값을 입력하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Equipment Selection */}
                <div className="space-y-2">
                  <Label htmlFor="equipment" className="text-white">설비 선택</Label>
                  <Select value={equipment} onValueChange={handleEquipmentChange}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="설비를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {Object.entries(EQUIPMENT).map(([key, eq]) => (
                        <SelectItem key={key} value={key} className="text-white focus:bg-slate-600">
                          {eq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Primary Classification */}
                {selectedEquipment?.primary && (
                  <div className="space-y-2">
                    <Label htmlFor="primary" className="text-white">1차 분류</Label>
                    <Select value={primary} onValueChange={handlePrimaryChange}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="1차 분류를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {Object.entries(selectedEquipment.primary).map(([key, prim]) => (
                          <SelectItem key={key} value={key} className="text-white focus:bg-slate-600">
                            {prim.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Secondary Classification */}
                {selectedPrimary?.secondary && selectedPrimary.secondary.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="secondary" className="text-white">2차 분류</Label>
                    <Select value={secondary} onValueChange={handleSecondaryChange}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="2차 분류를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {selectedPrimary.secondary.map((sec) => (
                          <SelectItem key={sec.value} value={sec.value} className="text-white focus:bg-slate-600">
                            {sec.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Input Fields */}
                {canShowInputs && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="design" className="text-white flex items-center gap-2">
                        {isQnaMode ? (
                          <>
                            <MessageSquare className="w-4 h-4 text-green-400" />
                            질문 내용
                          </>
                        ) : (
                          <>
                            <Thermometer className="w-4 h-4 text-blue-400" />
                            설계값
                          </>
                        )}
                      </Label>
                      <Input
                        id="design"
                        value={designValue}
                        onChange={(e) => setDesignValue(e.target.value)}
                        placeholder={isQnaMode ? "궁금한 내용을 자유롭게 입력하세요..." : "설계값을 입력하세요"}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                      />
                    </div>

                    {!isQnaMode && (
                      <div className="space-y-2">
                        <Label htmlFor="measure" className="text-white flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-orange-400" />
                          측정값
                        </Label>
                        <Input
                          id="measure"
                          value={measureValue}
                          onChange={(e) => setMeasureValue(e.target.value)}
                          placeholder="측정값을 입력하세요"
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Error Display */}
                {error && (
                  <Alert className="bg-red-900/20 border-red-500 text-red-300">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      '결과 요청'
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={resetForm}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    초기화
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-white">분석 결과</CardTitle>
              <CardDescription className="text-slate-400">
                전문적인 HVAC 설비 분석 결과
              </CardDescription>
            </CardHeader>
            <CardContent>
              {response ? (
                <div className="bg-slate-900/50 rounded-lg p-4 min-h-[300px] overflow-auto">
                  <pre className="text-sm text-green-300 whitespace-pre-wrap font-mono">
                    {response}
                  </pre>
                </div>
              ) : (
                <div className="bg-slate-900/30 rounded-lg p-8 min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-600">
                  <div className="text-center text-slate-400">
                    <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">분석 결과 대기 중</p>
                    <p className="text-sm">설비를 선택하고 값을 입력한 후 분석을 요청하세요</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-400 text-sm">
          <p>© 2025 ChackMake PRO‑Ultra v2.0 - 고급 HVAC 분석 도구</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
