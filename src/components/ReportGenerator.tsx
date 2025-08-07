import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateProfessionalReport } from '@/utils/reportGenerator';
import { createGoogleDoc } from '@/utils/googleDocsUtils';

interface ReportGeneratorProps {
  onGoogleAuth: () => Promise<string>;
  isDark: boolean;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ onGoogleAuth, isDark }) => {
  const [rawContent, setRawContent] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const { toast } = useToast();

  const handleGenerateReport = () => {
    if (!rawContent.trim()) {
      toast({
        title: "입력 오류",
        description: "원문 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const report = generateProfessionalReport(rawContent, customTitle);
      setGeneratedReport(report);
      
      toast({
        title: "보고서 생성 완료",
        description: "기계설비 성능진단 보고서가 생성되었습니다.",
      });
    } catch (error) {
      toast({
        title: "생성 실패",
        description: "보고서 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleGoogleDocsExport = async () => {
    if (!generatedReport.trim()) {
      toast({
        title: "내보내기 오류",
        description: "먼저 보고서를 생성해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const accessToken = await onGoogleAuth();
      const documentUrl = await createGoogleDoc(generatedReport, accessToken);
      
      toast({
        title: "Google Docs 생성 완료",
        description: "보고서가 지정된 폴더에 저장되었습니다.",
      });

      // 새 창에서 문서 열기
      window.open(documentUrl, '_blank');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google Docs 생성에 실패했습니다.';
      toast({
        title: "내보내기 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            기계설비 성능진단 보고서 자동 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="custom-title">사용자 정의 제목 (선택사항)</Label>
            <Input
              id="custom-title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="예: 냉각탑 시스템 성능진단 보고서"
              className={isDark ? 'bg-gray-700 border-gray-600' : ''}
            />
          </div>
          
          <div>
            <Label htmlFor="raw-content">원문 내용 입력</Label>
            <Textarea
              id="raw-content"
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder="음성인식 결과나 초안 텍스트를 여기에 붙여넣어 주세요..."
              className={`min-h-[200px] ${isDark ? 'bg-gray-700 border-gray-600' : ''}`}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleGenerateReport}
              disabled={!rawContent.trim()}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              보고서 생성
            </Button>
            
            <Button
              onClick={handleGoogleDocsExport}
              disabled={!generatedReport.trim() || isGenerating}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isGenerating ? 'Google Docs 생성 중...' : 'Google Docs로 내보내기'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generatedReport && (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <CardHeader>
            <CardTitle>생성된 보고서 미리보기</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className={`p-4 border rounded-md max-h-96 overflow-y-auto ${
                isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}
              dangerouslySetInnerHTML={{ __html: generatedReport }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportGenerator;