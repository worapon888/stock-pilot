import { INITIAL_DEMO_PRODUCTS } from '../data/demoData';

describe('Search and Stock Filtering Logic', () => {
  it('searches products by name case-insensitively', () => {
    const query = 'keyboard';
    const matches = INITIAL_DEMO_PRODUCTS.filter(
      (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase())
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].sku).toBe('SKU-KEYC-Q1P');
  });

  it('searches products by SKU prefix', () => {
    const query = 'SKU-APPL';
    const matches = INITIAL_DEMO_PRODUCTS.filter(
      (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase())
    );

    expect(matches.length).toBe(1);
    expect(matches[0].name).toContain('MacBook');
  });

  it('filters low-stock products correctly (stock <= min_stock and stock > 0)', () => {
    const lowStock = INITIAL_DEMO_PRODUCTS.filter(
      (p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock
    );

    expect(lowStock.length).toBeGreaterThan(0);
    lowStock.forEach((p) => {
      expect(p.stock_quantity).toBeGreaterThan(0);
      expect(p.stock_quantity).toBeLessThanOrEqual(p.min_stock);
    });
  });

  it('filters out-of-stock products correctly (stock == 0)', () => {
    const outOfStock = INITIAL_DEMO_PRODUCTS.filter((p) => p.stock_quantity === 0);
    expect(outOfStock.length).toBe(1);
    expect(outOfStock[0].sku).toBe('SKU-SAMS-T7S');
  });

  it('computes total stock quantity and valuation accurately', () => {
    const totalQty = INITIAL_DEMO_PRODUCTS.reduce((acc, p) => acc + p.stock_quantity, 0);
    const totalVal = INITIAL_DEMO_PRODUCTS.reduce((acc, p) => acc + p.stock_quantity * p.price, 0);

    expect(totalQty).toBeGreaterThan(0);
    expect(totalVal).toBeGreaterThan(1000);
  });
});
