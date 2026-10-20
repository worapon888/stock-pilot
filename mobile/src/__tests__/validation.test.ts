import { productSchema } from '../schemas/productSchema';
import { stockAdjustmentSchema } from '../schemas/stockSchema';

describe('Mobile Form Validation Schemas', () => {
  describe('Product Schema Validation', () => {
    it('accepts valid product input and uppercases SKU', () => {
      const valid = {
        name: 'กระดาษ A4 80 แกรม',
        sku: 'sku-paper-a4',
        price: 120.0,
        stock_quantity: 250,
        min_stock: 20,
      };

      const result = productSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sku).toBe('SKU-PAPER-A4');
      }
    });

    it('rejects product with negative price', () => {
      const invalid = {
        name: 'สินค้าทดสอบ',
        sku: 'SKU-001',
        price: -10,
        stock_quantity: 5,
        min_stock: 2,
      };

      const result = productSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ราคาต้องไม่ติดลบ');
      }
    });

    it('rejects product with negative stock', () => {
      const invalid = {
        name: 'สินค้าทดสอบ',
        sku: 'SKU-001',
        price: 15,
        stock_quantity: -1,
        min_stock: 2,
      };

      const result = productSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('จำนวนสต๊อกต้องไม่ติดลบ');
      }
    });

    it('rejects short product names', () => {
      const invalid = {
        name: 'A',
        sku: 'SKU-001',
        price: 15,
        stock_quantity: 0,
        min_stock: 2,
      };

      const result = productSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('อย่างน้อย 2 ตัวอักษร');
      }
    });
  });

  describe('Stock Adjustment Schema Validation', () => {
    it('validates stock IN and OUT quantities', () => {
      const validIn = {
        productId: 'prod-123',
        type: 'IN',
        quantity: 10,
        note: 'เติมสต๊อก',
      };

      expect(stockAdjustmentSchema.safeParse(validIn).success).toBe(true);

      const invalidQty = {
        productId: 'prod-123',
        type: 'OUT',
        quantity: 0,
        note: '',
      };

      const result = stockAdjustmentSchema.safeParse(invalidQty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('มากกว่า 0');
      }
    });
  });
});
