import { z } from 'zod';

// Password validation schema with strong requirements
export const passwordSchema = z
  .string()
  .min(12, '비밀번호는 최소 12자 이상이어야 합니다.')
  .regex(/[a-z]/, '비밀번호는 최소 1개의 소문자를 포함해야 합니다.')
  .regex(/[A-Z]/, '비밀번호는 최소 1개의 대문자를 포함해야 합니다.')
  .regex(/[0-9]/, '비밀번호는 최소 1개의 숫자를 포함해야 합니다.')
  .regex(/[^a-zA-Z0-9]/, '비밀번호는 최소 1개의 특수문자를 포함해야 합니다.');

// Email validation schema with proper domain checking
export const emailSchema = z
  .string()
  .trim()
  .min(1, '이메일을 입력해주세요.')
  .email('올바른 이메일 형식을 입력해주세요.')
  .refine(
    (email) => {
      const domain = email.split('@')[1];
      return domain && domain.includes('.');
    },
    { message: '유효한 도메인 주소를 입력해주세요.' }
  );

// Sign in schema
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

// Sign up schema
export const signUpSchema = z.object({
  name: z.string().trim().min(1, '회사명 및 이름을 입력해주세요.').max(100, '이름은 100자를 초과할 수 없습니다.'),
  phone: z
    .string()
    .trim()
    .min(1, '전화번호를 입력해주세요.')
    .regex(/^[0-9\-+() ]+$/, '올바른 전화번호 형식을 입력해주세요.'),
  email: emailSchema,
  password: passwordSchema,
});

// Reset password schema
export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

// Export types
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
