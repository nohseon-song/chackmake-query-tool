-- 사용자 프로필 테이블에 대한 Row Level Security (RLS) 정책 추가

-- 1. user_profiles 테이블에 RLS를 활성화합니다. (이미 활성화되어 있어도 안전합니다)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

-- 2. 기존에 있을 수 있는 "select" 정책을 삭제하여 충돌을 방지합니다.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;

-- 3. 새로운 정책 생성: 사용자는 자신의 user_id와 일치하는 프로필 정보만 볼 수 있도록 허용합니다.
CREATE POLICY "Users can view their own profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);
