import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StockMovement } from '../types';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';

interface MovementCardProps {
  movement: StockMovement;
}

export const MovementCard: React.FC<MovementCardProps> = ({ movement }) => {
  const isIncoming = movement.type === 'IN';

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins} น.`;
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.card}>
      {/* Type Icon */}
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isIncoming ? COLORS.successBg : COLORS.dangerBg },
        ]}
      >
        <Ionicons
          name={isIncoming ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={20}
          color={isIncoming ? COLORS.success : COLORS.danger}
        />
      </View>

      {/* Main Content */}
      <View style={styles.contentCol}>
        <View style={styles.topRow}>
          <Text style={styles.typeText}>{isIncoming ? 'รับเข้า' : 'เบิกออก'}</Text>
          <Text
            style={[
              styles.quantityText,
              { color: isIncoming ? COLORS.success : COLORS.danger },
            ]}
          >
            {isIncoming ? `+${movement.quantity}` : `-${movement.quantity}`} หน่วย
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.timeText}>{formatTime(movement.created_at)}</Text>
          <Text style={styles.dotSeparator}>•</Text>
          <Text style={styles.productName} numberOfLines={1}>
            {movement.product_name || movement.product_sku || 'สินค้า'}
          </Text>
        </View>

        {movement.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {movement.note}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xs + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  dotSeparator: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  productName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  note: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontStyle: 'normal',
  },
});
