// src/pages/ResetPassword.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resetPasswordSchema } from "@/lib/validation";
import { z } from "zod";

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); // 세션 준비 여부

  // 1) 페이지가 열리면 URL에 포함된 토큰을 세션으로 교환
  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);

        // A) ?code=... (Supabase 비밀번호 재설정 링크 기본 형태)
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setReady(true);
          return;
        }

        // B) #access_token=...&refresh_token=... (해시 기반 세션)
        if (url.hash && url.hash.includes("access_token")) {
          const hash = new URLSearchParams(url.hash.substring(1));
          const access_token = hash.get("access_token") || undefined;
          const refresh_token = hash.get("refresh_token") || undefined;
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            setReady(true);
            return;
          }
        }

        // C) ?token_hash=...&type=recovery (OTP 기반)
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        if (token_hash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
          if (error) throw error;
          setReady(true);
          return;
        }

        // 세션이 전혀 없으면 직접 접근한 경우
        setErr("이 페이지는 이메일의 비밀번호 재설정 링크를 통해서만 접근할 수 있습니다.");
      } catch (e: any) {
        setErr(e?.message ?? "세션 복구 중 오류가 발생했습니다.");
      } finally {
        setReady(true);
      }
    };
    run();
  }, []);

  // 2) 비밀번호 변경 처리
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    setErr(null);

    try {
      // Validate password using Zod schema
      const validatedData = resetPasswordSchema.parse({ password });
      
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("인증 세션이 없습니다. 이메일의 비밀번호 재설정 링크로 다시 들어와 주세요.");
      }

      const { error } = await supabase.auth.updateUser({ password: validatedData.password });
      if (error) throw error;

      // ✅ UX 개선: 성공 메시지 → 세션 정리 → 로그인 페이지(/auth)로 자동 이동
      setOk("비밀번호가 성공적으로 변경되었습니다. 로그인 화면으로 이동합니다.");
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.href = "/auth"; // 로그인 페이지 경로
      }, 1200);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        setErr(e.issues[0].message);
      } else {
        setErr(e?.message ?? "비밀번호 변경 중 오류가 발생했습니다.");
      }
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
          placeholder="최소 12자, 대/소문자, 숫자, 특수문자 포함"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <p style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
          비밀번호는 최소 12자 이상이며, 대문자, 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.
        </p>

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
