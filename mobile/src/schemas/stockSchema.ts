import { z } from 'zod';

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
  type: z.enum(['IN', 'OUT']),
  quantity: z
    .number({ message: 'จำนวนต้องเป็นตัวเลข' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .positive('จำนวนต้องมากกว่า 0'),
  note: z.string().max(200, 'หมายเหตุต้องไม่เกิน 200 ตัวอักษร').optional().default(''),
});

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;
