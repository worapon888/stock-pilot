import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', size = 'sm' }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: COLORS.successBg, text: COLORS.success, border: COLORS.successBorder };
      case 'warning':
        return { bg: COLORS.warningBg, text: COLORS.warning, border: COLORS.warningBorder };
      case 'danger':
        return { bg: COLORS.dangerBg, text: COLORS.danger, border: COLORS.dangerBorder };
      case 'info':
        return { bg: COLORS.infoBg, text: COLORS.info, border: COLORS.infoBorder };
      case 'neutral':
      default:
        return { bg: COLORS.surfaceSecondary, text: COLORS.textSecondary, border: COLORS.border };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: size === 'sm' ? SPACING.sm : SPACING.md,
          paddingVertical: size === 'sm' ? 2 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: size === 'sm' ? 11 : 12,
            fontWeight: '600',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    letterSpacing: 0.2,
  },
});
