import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const getButtonStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: COLORS.primary,
          ...SHADOWS.sm,
        };
      case 'secondary':
        return {
          backgroundColor: COLORS.surfaceSecondary,
          borderWidth: 1,
          borderColor: COLORS.border,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: COLORS.primary,
        };
      case 'danger':
        return {
          backgroundColor: COLORS.danger,
          ...SHADOWS.sm,
        };
      case 'success':
        return {
          backgroundColor: COLORS.success,
          ...SHADOWS.sm,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
    }
  };

  const getTextStyles = (): TextStyle => {
    switch (variant) {
      case 'primary':
      case 'danger':
      case 'success':
        return { color: COLORS.textInverse, fontWeight: '700' };
      case 'secondary':
        return { color: COLORS.textPrimary, fontWeight: '600' };
      case 'outline':
        return { color: COLORS.primary, fontWeight: '700' };
      case 'ghost':
        return { color: COLORS.textSecondary, fontWeight: '500' };
    }
  };

  const getPadding = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 7, paddingHorizontal: SPACING.md };
      case 'md':
        return { paddingVertical: 11, paddingHorizontal: SPACING.lg };
      case 'lg':
        return { paddingVertical: 14, paddingHorizontal: SPACING.xl };
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        getButtonStyles(),
        getPadding(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'secondary' || variant === 'ghost' ? COLORS.primary : COLORS.textInverse}
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, getTextStyles(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
