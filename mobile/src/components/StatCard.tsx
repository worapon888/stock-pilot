import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  style?: ViewStyle;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  icon,
  iconBg = COLORS.primaryLight,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>

      {unit ? (
        <Text style={styles.unit} numberOfLines={1}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
    justifyContent: 'space-between',
    minHeight: 104,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    marginBottom: SPACING.xs,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  unit: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
