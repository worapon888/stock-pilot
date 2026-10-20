import { z } from 'zod';

export const productSchema = z.object({
  name: z
    .string()
    .min(2, 'ชื่อสินค้าต้องมีอย่างน้อย 2 ตัวอักษร')
    .max(255, 'ชื่อสินค้าต้องไม่เกิน 255 ตัวอักษร'),
  sku: z
    .string()
    .min(2, 'รหัสสินค้า (SKU) ต้องมีอย่างน้อย 2 ตัวอักษร')
    .max(64, 'รหัสสินค้าต้องไม่เกิน 64 ตัวอักษร')
    .regex(/^[A-Za-z0-9-_]+$/, 'รหัสสินค้าต้องเป็นตัวอักษรภาษาอังกฤษ, ตัวเลข หรือเครื่องหมาย - _')
    .transform((val) => val.toUpperCase()),
  price: z
    .number({ message: 'ราคาต้องเป็นตัวเลข' })
    .min(0, 'ราคาต้องไม่ติดลบ'),
  stock_quantity: z
    .number({ message: 'จำนวนสินค้าต้องเป็นจำนวนเต็ม' })
    .int('จำนวนสินค้าต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนสต๊อกต้องไม่ติดลบ'),
  min_stock: z
    .number({ message: 'จำนวนขั้นต่ำต้องเป็นจำนวนเต็ม' })
    .int('จำนวนขั้นต่ำต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนขั้นต่ำต้องไม่ติดลบ'),
});

export type ProductFormData = z.infer<typeof productSchema>;
