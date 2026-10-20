import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'กรุณากรอกอีเมล')
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .trim(),
  password: z
    .string()
    .min(1, 'กรุณากรอกรหัสผ่าน'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
