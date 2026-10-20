import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface InputFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  prefix?: string;
  suffix?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  helperText,
  prefix,
  suffix,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={COLORS.textMuted}
          style={[styles.input, style]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md + 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerBg,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 8,
  },
  affix: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginHorizontal: SPACING.xs,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
