-- Seed initial products
INSERT INTO products (id, sku, name, price, stock_quantity, min_stock, created_at, updated_at)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'SKU-LOGI-MX3', 'Logitech MX Master 3S Wireless Mouse', 99.99, 45, 15, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
    ('a0000000-0000-0000-0000-000000000002', 'SKU-APPL-M3P', 'Apple MacBook Pro 16" M3 Pro', 2499.00, 8, 10, NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
    ('a0000000-0000-0000-0000-000000000003', 'SKU-DELL-U27', 'Dell UltraSharp 27" 4K USB-C Hub Monitor', 619.50, 14, 10, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
    ('a0000000-0000-0000-0000-000000000004', 'SKU-KEYC-Q1P', 'Keychron Q1 Pro Mechanical Keyboard', 199.00, 4, 12, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
    ('a0000000-0000-0000-0000-000000000005', 'SKU-SONY-XM5', 'Sony WH-1000XM5 Noise Canceling Headphones', 398.00, 22, 10, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
    ('a0000000-0000-0000-0000-000000000006', 'SKU-ANKR-737', 'Anker 737 Power Bank 24,000mAh 140W', 149.99, 3, 15, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    ('a0000000-0000-0000-0000-000000000007', 'SKU-SAMS-T7S', 'Samsung T7 Shield 2TB Portable SSD', 179.99, 0, 8, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
    ('a0000000-0000-0000-0000-000000000008', 'SKU-CALD-TS4', 'CalDigit TS4 Thunderbolt 4 Dock', 399.95, 18, 5, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Seed initial stock movements for audit history
INSERT INTO stock_movements (id, product_id, type, quantity, note, idempotency_key, created_at)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'IN', 50, 'Initial supplier batch receiving', 'SEED-INIT-001', NOW() - INTERVAL '10 days'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'OUT', 5, 'Dispatched to retail branch #1', 'SEED-INIT-002', NOW() - INTERVAL '8 days'),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'IN', 12, 'Supplier purchase order PO-8821', 'SEED-INIT-003', NOW() - INTERVAL '9 days'),
    ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'OUT', 4, 'B2B enterprise corporate fulfillment', 'SEED-INIT-004', NOW() - INTERVAL '4 days'),
    ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006', 'IN', 15, 'Emergency restock air freight', 'SEED-INIT-005', NOW() - INTERVAL '5 days'),
    ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'OUT', 12, 'Bulk sale event dispatch', 'SEED-INIT-006', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;
