import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../types';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { Badge } from './Badge';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  onStockIn?: (product: Product) => void;
  onStockOut?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onStockIn,
  onStockOut,
}) => {
  const isOutOfStock = product.stock_quantity === 0;
  const isLowStock = !isOutOfStock && product.stock_quantity <= product.min_stock;

  const getStatusBadge = () => {
    if (isOutOfStock) {
      return <Badge label="หมดสต๊อก" variant="danger" />;
    }
    if (isLowStock) {
      return <Badge label="ใกล้หมด" variant="warning" />;
    }
    return <Badge label="พร้อมขาย" variant="success" />;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => onPress(product)}
    >
      <View style={styles.mainRow}>
        {/* Thumbnail icon box */}
        <View style={styles.thumbBox}>
          <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
        </View>

        {/* Product Info */}
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {product.name}
            </Text>
            {getStatusBadge()}
          </View>

          <Text style={styles.sku}>{product.sku}</Text>

          {/* Stock Metrics */}
          <View style={styles.stockRow}>
            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>คงเหลือ </Text>
              <Text
                style={[
                  styles.stockValue,
                  isOutOfStock && { color: COLORS.danger },
                  isLowStock && { color: COLORS.warning },
                ]}
              >
                {product.stock_quantity}
              </Text>
              <Text style={styles.stockUnit}> หน่วย</Text>
            </View>

            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>ขั้นต่ำ </Text>
              <Text style={styles.minStockValue}>{product.min_stock}</Text>
              <Text style={styles.stockUnit}> หน่วย</Text>
            </View>

            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>฿{product.price.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.detailBtn}
          onPress={() => onPress(product)}
          activeOpacity={0.7}
        >
          <Text style={styles.detailBtnText}>ดูรายละเอียด</Text>
        </TouchableOpacity>

        {onStockIn && (
          <TouchableOpacity
            style={styles.stockInBtn}
            onPress={(e) => {
              e.stopPropagation();
              onStockIn(product);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.stockInBtnText}>รับเข้า</Text>
          </TouchableOpacity>
        )}

        {onStockOut && (
          <TouchableOpacity
            disabled={isOutOfStock}
            style={[styles.stockOutBtn, isOutOfStock && styles.stockOutBtnDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              onStockOut(product);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.stockOutBtnText, isOutOfStock && styles.stockOutBtnTextDisabled]}>
              เบิกออก
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  mainRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  thumbBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  sku: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: 6,
  },
  stockItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stockLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  stockValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  minStockValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stockUnit: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm + 2,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  detailBtn: {
    flex: 1.2,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stockInBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockInBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
  stockOutBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockOutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
  stockOutBtnDisabled: {
    backgroundColor: COLORS.surfaceSecondary,
    opacity: 0.6,
  },
  stockOutBtnTextDisabled: {
    color: COLORS.textMuted,
  },
});
