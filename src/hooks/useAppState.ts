// src/hooks/useAppState.ts

import { useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth'; // 사용자 ID를 가져오기 위함
import * as webhookService from '@/services/webhookService'; // webhookService 임포트
import { supabase } from '@/integrations/supabase/client';

function useAppState() {
    const [logs, setLogs] = useState<any[]>([]); // 단계별 결과를 화면에 표시할 저장 공간
    const [reportContent, setReportContent] = useState<string>(''); // 최종 보고서 내용을 저장할 공간
    const [isDownloadReady, setIsDownloadReady] = useState<boolean>(false); // 다운로드 버튼 활성화를 위한 스위치
    const [processingMessage, setProcessingMessage] = useState<string>(''); // 앱 화면에 보일 메시지
    const { user } = useAuth(); // 현재 로그인한 사용자 정보 가져오기

    // Make.com 요청 ID (주문 번호)를 저장할 변수
    const currentRequestId = useRef<string | null>(null);

    // Make.com으로 데이터를 전송하는 함수 (이제 sendWebhookDataStream을 호출합니다)
    // 이 함수는 아마 앱의 '데이터 전송' 버튼 클릭 시 호출될 것입니다.
    const handleSendToMake = async (initialPayload: any) => { // 함수 이름은 앱에서 사용하는 것과 다를 수 있습니다.
        try {
            // webhookService.ts에서 request_id를 payload에 추가하므로, 여기서는 그 payload를 그대로 전달합니다.
            // sendWebhookDataStream이 호출될 때 payload.request_id에 값이 들어있을 것으로 예상합니다.
            if (initialPayload && initialPayload.request_id) {
                currentRequestId.current = initialPayload.request_id; // 현재 요청 ID 저장
            } else {
                // 만약 이곳에서 initialPayload에 request_id가 없다면,
                // webhookService.ts에서 request_id를 생성한 후,
                // 이 함수로 그 request_id를 다시 받아와서 currentRequestId에 저장해야 합니다.
                // 현재 webhookService.ts는 request_id를 반환하지 않으므로,
                // 이 부분은 Make.com으로 보내는 payload에 request_id가 이미 있다고 가정합니다.
                console.warn("Payload에 request_id가 없어 Realtime 필터링이 어려울 수 있습니다. Make.com 전송 함수를 확인하세요.");
                // 임시로 uuid를 여기서도 생성하여 사용 (실제 앱에서는 이 부분이 더 정교해야 함)
                const newRequestId = new Date().getTime().toString(); // 간단한 임시 ID 생성
                initialPayload.request_id = newRequestId;
                currentRequestId.current = newRequestId;
            }


            setProcessingMessage('전문 기술검토 요청을 전송 중입니다...');
            // 실제 웹훅 전송 함수 호출
            await webhookService.sendWebhookDataStream(initialPayload);
            setProcessingMessage('전문 기술검토 요청이 성공적으로 접수되었습니다. 곧 결과가 도착할 것입니다.');
        } catch (error) {
            setProcessingMessage(`오류 발생: ${error instanceof Error ? error.message : String(error)}`);
            console.error('Webhook 전송 오류:', error);
        }
    };

    // Make.com 단계별 결과를 수파베이스에서 실시간으로 받아오는 코드
    useEffect(() => {
        // 로그인한 사용자의 ID가 없으면 아무것도 하지 않고 기다립니다.
        if (!user?.id) {
            return;
        }

        // 'api_logs_channel'이라는 이름으로 수파베이스 채널을 만듭니다.
        const channel = supabase
            .channel('api_logs_channel')
            .on(
                'postgres_changes', // 수파베이스 데이터가 바뀔 때 알려달라는 신호
                {
                    event: 'INSERT',   // '새로운 데이터가 추가될 때만' 알려줘!
                    schema: 'public',  // 'public' 스키마에서
                    table: 'api_logs', // 'api_logs' 테이블에
                    // '지금 로그인한 사용자가 만든 데이터만' 그리고 '현재 주문 번호에 맞는 데이터만' 알려줘!
                    // currentRequestId.current가 있을 때만 request_id 필터를 적용합니다.
                    filter: `user_id=eq.${user.id}${currentRequestId.current ? `&request_id=eq.${currentRequestId.current}` : ''}`
                },
                (payload) => {
                    // 새로운 데이터가 도착하면 이 부분이 실행됩니다!
                    console.log('API 로그 변화 감지 (Make.com 단계 결과):', payload.new);
                    const newLog = payload.new; // 새로 들어온 데이터

                    // 'output_data'에 결과가 있다면
                    if (newLog.output_data) {
                        let contentToDisplay = newLog.output_data;

                        // logs 상태에 새로운 결과를 추가합니다.
                        // 각 단계별로 새로운 로그가 앱 화면에 추가될 겁니다.
                        setLogs((prev) => [
                            ...prev,
                            {
                                id: newLog.id,
                                request_id: newLog.request_id, // Make.com에서 받은 request_id도 저장
                                type: 'make_stage_result', // 로그 타입을 명확히 구분
                                content: contentToDisplay, // 여기에 HTML 또는 텍스트 결과가 들어갑니다
                                timestamp: new Date(newLog.created_at),
                                source: `Make.com 단계 (${newLog.id})` // 어떤 로그인지 구분
                            }
                        ]);

                        // --- 최종 결과 처리: 4단계가 완료되었을 때 최종 보고서 내용 설정 ---
                        // Make.com에서 api_logs에 stage_number나 is_final 같은 정보도 저장한다면 더 좋음.
                        // 지금은 마지막으로 들어오는 로그를 일단 최종 결과로 처리합니다.
                        setReportContent(newLog.output_data); // 최종 보고서 내용을 임시로 마지막 로그로 설정
                        setIsDownloadReady(true); // 다운로드 버튼 활성화
                        setProcessingMessage('보고서 준비 완료!');
                    }
                }
            )
            .subscribe(); // 이제 채널 구독을 시작합니다!

        // 이펙트가 끝날 때 (예: 앱 화면을 닫을 때) 채널을 정리합니다.
        return () => {
            console.log('API 로그 채널 구독 해제');
            supabase.removeChannel(channel);
        };
    }, [user?.id, currentRequestId.current]); // user.id와 currentRequestId.current가 바뀔 때마다 이 코드도 다시 실행됩니다.

    // 앱의 다른 부분에서 이 값들을 사용할 수 있도록 반환합니다.
    return {
        logs,
        setLogs,
        reportContent,
        setReportContent,
        isDownloadReady,
        setIsDownloadReady,
        processingMessage,
        sendWebhookDataStream: handleSendToMake, // 원래 sendWebhookDataStream 대신 handleSendToMake를 반환
        // ... 기존의 다른 반환 값들 (만약 있다면 여기에 그대로 둡니다) ...
    };
}

export default useAppState; // useAppState 훅을 내보냅니다.
