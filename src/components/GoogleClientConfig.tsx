import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface GoogleClientConfigProps {
  onClientIdSet: (clientId: string) => void;
}

const GoogleClientConfig: React.FC<GoogleClientConfigProps> = ({ onClientIdSet }) => {
  const [clientId, setClientId] = useState('');
  const [isSet, setIsSet] = useState(false);

  const handleSetClientId = () => {
    if (clientId.trim()) {
      // 환경변수 설정 (개발용)
      if (typeof window !== 'undefined') {
        localStorage.setItem('GOOGLE_CLIENT_ID', clientId.trim());
      }
      onClientIdSet(clientId.trim());
      setIsSet(true);
    }
  };

  if (isSet) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Google Client ID가 설정되었습니다. 이제 Google Docs 내보내기를 사용할 수 있습니다.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Google API 설정</CardTitle>
        <CardDescription>
          Google Docs 내보내기 기능을 사용하려면 Google Client ID가 필요합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">Google Client ID</Label>
          <Input
            id="clientId"
            type="text"
            placeholder="your-client-id.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <Button onClick={handleSetClientId} disabled={!clientId.trim()}>
          설정 완료
        </Button>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 생성하고 입력하세요.
            <br />
            승인된 JavaScript 원본에 현재 도메인을 추가해야 합니다.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default GoogleClientConfig;