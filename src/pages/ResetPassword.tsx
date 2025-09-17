// src/pages/ResetPassword.tsx
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  // ↓ Supabase 대시보드(Project settings → API)에서 복사한 값으로 교체
  "https://rigbiqjmszdlacjdkhep.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw"
);

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); // 세션 준비 여부

  // 1) 페이지 진입 시 URL에 포함된 토큰/코드를 세션으로 교환
  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);

        // A) PKCE/매직링크 방식 (?code=...)
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setReady(true);
          return;
        }

        // B) 해시 토큰 방식 (#access_token=...&refresh_token=...)
        if (url.hash && url.hash.includes("access_token")) {
          const hash = new URLSearchParams(url.hash.substring(1));
          const access_token = hash.get("access_token") || undefined;
          const refresh_token = hash.get("refresh_token") || undefined;
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;
            setReady(true);
            return;
          }
        }

        // C) token_hash & type=recovery 방식
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        if (token_hash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash,
          });
          if (error) throw error;
          setReady(true);
          return;
        }

        // 위 세 가지 모두 없다면: 이메일 링크를 통해 오지 않은 것
        setErr("이 페이지는 이메일의 재설정 링크를 통해서만 접근할 수 있습니다.");
      } catch (e: any) {
        setErr(e?.message ?? "세션 복구 중 오류가 발생했습니다.");
      } finally {
        // 세션이 없더라도 폼은 표시하되, 제출 시 에러 안내를 보여주기 위해 ready를 true로 둠
        setReady(true);
      }
    };

    run();
  }, []);

  // 2) 비밀번호 변경
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    setErr(null);

    if (password.length < 6) {
      setErr("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("인증 세션이 없습니다. 이메일의 비밀번호 재설정 링크로 다시 들어와 주세요.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setOk("비밀번호가 변경되었습니다. 이제 새 비밀번호로 로그인하세요.");
    } catch (e: any) {
      setErr(e?.message ?? "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={onSubmit} style={{ width: 360, border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, textAlign: "center" }}>새 비밀번호 설정</h1>
        <p style={{ fontSize: 12, color: "#666", textAlign: "center", marginTop: 8 }}>
          메일의 비밀번호 재설정 링크를 통해 진입해야 정상 동작합니다.
        </p>

        <label htmlFor="pw" style={{ display: "block", marginTop: 16, marginBottom: 6 }}>새 비밀번호</label>
        <input
          id="pw"
          type="password"
          placeholder="6자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />

        <button
          type="submit"
          disabled={loading || !ready}
          style={{ width: "100%", marginTop: 14, padding: 10, borderRadius: 6, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}
        >
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>

        {ok && <div style={{ marginTop: 12, color: "#0a7b0a", fontSize: 14 }}>{ok}</div>}
        {err && <div style={{ marginTop: 12, color: "#d00", fontSize: 14 }}>{err}</div>}
      </form>
    </div>
  );
};

export default ResetPassword;
