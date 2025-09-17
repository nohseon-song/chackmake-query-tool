// src/pages/Forgot.tsx
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  // ↓ Supabase 대시보드(Project settings → API)에서 복사한 값으로 교체
  "https://rigbiqjmszdlacjdkhep.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw"
);

const Forgot: React.FC = () => {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = "https://chackmake-query-tool.lovable.app/reset-password";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null); setErr(null);
    if (!email) { setErr("이메일을 입력하세요."); return; }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setOk("재설정 링크를 이메일로 보냈습니다. 메일함을 확인해 주세요.");
    } catch (e: any) {
      setErr(e?.message ?? "전송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <form onSubmit={onSubmit} style={{width:360,border:"1px solid #ddd",borderRadius:8,padding:16}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:700,textAlign:"center"}}>비밀번호 찾기</h1>
        <label htmlFor="email" style={{display:"block",marginTop:16,marginBottom:6}}>가입 이메일</label>
        <input id="email" type="email" placeholder="user@example.com"
               value={email} onChange={(e)=>setEmail(e.target.value)}
               style={{width:"100%",padding:10,border:"1px solid #ccc",borderRadius:6}}/>
        <button type="submit" disabled={loading}
                style={{width:"100%",marginTop:14,padding:10,borderRadius:6,border:"none",background:"#111",color:"#fff",cursor:"pointer"}}>
          {loading ? "전송 중..." : "재설정 메일 보내기"}
        </button>
        {ok && <div style={{marginTop:10,color:"#0a7b0a"}}>{ok}</div>}
        {err && <div style={{marginTop:10,color:"#d00"}}>{err}</div>}
      </form>
    </div>
  );
};

export default Forgot;
