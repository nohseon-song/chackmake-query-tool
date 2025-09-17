// src/pages/ResetPassword.tsx
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  // ↑ Forgot.tsx와 동일한 값으로 교체
  "https://rigbiqjmszdlacjdkhep.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw"
);

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null); setErr(null);
    if (password.length < 6) { setErr("비밀번호는 최소 6자 이상이어야 합니다."); return; }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setOk("비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.");
    } catch (e: any) {
      setErr(e?.message ?? "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <form onSubmit={onSubmit} style={{width:360,border:"1px solid #ddd",borderRadius:8,padding:16}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:700,textAlign:"center"}}>새 비밀번호 설정</h1>
        <label htmlFor="pw" style={{display:"block",marginTop:16,marginBottom:6}}>새 비밀번호</label>
        <input id="pw" type="password" placeholder="6자 이상"
               value={password} onChange={(e)=>setPassword(e.target.value)}
               style={{width:"100%",padding:10,border:"1px solid #ccc",borderRadius:6}}/>
        <button type="submit" disabled={loading}
                style={{width:"100%",marginTop:14,padding:10,borderRadius:6,border:"none",background:"#111",color:"#fff",cursor:"pointer"}}>
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>
        {ok && <div style={{marginTop:10,color:"#0a7b0a"}}>{ok}</div>}
        {err && <div style={{marginTop:10,color:"#d00"}}>{err}</div>}
      </form>
    </div>
  );
};

export default ResetPassword;
