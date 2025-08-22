// src/services/jobResultService.ts
// NOTE: import 경로는 프로젝트에 맞게 한 줄만 맞춰주면 됩니다.
// 예) '@/lib/supabase' 또는 '@/utils/supabaseClient' 등
import { supabase } from '@/integrations/supabase/client';

type JobStatus = 'processing' | 'done' | 'error';
export type JobRow = {
  job_id: string;
  status: JobStatus;
  html: string | null;
  html_url: string | null;
  error_message: string | null;
  completed_at: string | null;
};

const SELECT_COLS = 'job_id,status,html,html_url,error_message,completed_at';

/**
 * 주어진 job_id의 완료를 기다린다.
 * 1) 즉시 1회 조회
 * 2) Realtime 구독 (job_id 기준)
 * 3) 폴백 폴링(기본 4s)
 * 4) 타임아웃(기본 10분)
 */
export async function pollUntilDone(
  jobId: string,
  opts: { timeoutMs?: number; pollMs?: number } = {}
): Promise<JobRow> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000; // 10분
  const pollMs = opts.pollMs ?? 4000;                 // 4초

  return new Promise<JobRow>(async (resolve, reject) => {
    let finished = false;
    const cleanups: Array<() => void> = [];
    const finish = (row: JobRow) => {
      if (finished) return;
      finished = true;
      cleanups.forEach(fn => fn());
      resolve(row);
    };

    // 0) 현재 상태 한 번 읽어보기
    const initial = await (supabase as any)
      .from('job_results')
      .select(SELECT_COLS)
      .eq('job_id', jobId)
      .maybeSingle();

    if (initial.data && (initial.data.status === 'done' || initial.data.status === 'error')) {
      return finish(initial.data as JobRow);
    }

    // 1) Realtime 구독 (job_id 한 건만)
    const channel = supabase
      .channel(`job_results:${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_results', filter: `job_id=eq.${jobId}` },
        (payload) => {
          const row = payload.new as JobRow;
          if (row.status === 'done' || row.status === 'error') {
            finish(row);
          }
        }
      )
      .subscribe();
    cleanups.push(() => { try { supabase.removeChannel(channel); } catch {} });

    // 2) 폴백 폴링
    const iid = setInterval(async () => {
      const { data } = await (supabase as any)
        .from('job_results')
        .select(SELECT_COLS)
        .eq('job_id', jobId)
        .maybeSingle();
      if (data && (data.status === 'done' || data.status === 'error')) {
        finish(data as JobRow);
      }
    }, pollMs);
    cleanups.push(() => clearInterval(iid));

    // 3) 타임아웃
    const tid = setTimeout(() => {
      cleanups.forEach(fn => fn());
      reject(new Error('RESULT_TIMEOUT'));
    }, timeoutMs);
    cleanups.push(() => clearTimeout(tid));
  });
}

// 호환성 유지를 위한 래퍼: 이전 코드에서 사용하던 waitForJob 시그니처를 유지
export async function waitForJob(job_id: string, timeoutMs = 10 * 60 * 1000, intervalMs = 2000) {
  const row = await pollUntilDone(job_id, { timeoutMs, pollMs: intervalMs });
  return row;
}
