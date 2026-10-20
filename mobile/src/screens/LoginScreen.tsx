import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { loginSchema, LoginFormData } from '../schemas/authSchema';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useInventoryStore } from '../store/inventoryStore';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { login, isLoading, authError } = useAuthStore();
  const { isDemoMode, setDemoMode } = useSettingsStore();
  const { fetchDashboard } = useInventoryStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const success = await login({
        email: data.email,
        password: data.password,
      });

      if (success) {
        // Fetch fresh inventory data for authenticated user
        await fetchDashboard();
        navigation.replace('MainTabs');
      } else {
        const errorState = useAuthStore.getState().authError;
        if (errorState && (errorState.toLowerCase().includes('network') || errorState.includes('เชื่อมต่อ'))) {
          setServerError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } else {
          setServerError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
      }
    } catch {
      setServerError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  const handleEnterDemoMode = async () => {
    await setDemoMode(true);
    await fetchDashboard();
    navigation.replace('MainTabs');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 24) + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/splash-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>StockPilot</Text>
          <Text style={styles.brandSubtitle}>ระบบจัดการสินค้าคงคลัง</Text>
        </View>

        {/* Error Notification Card */}
        {(serverError || authError) && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.errorBannerText}>
              {serverError || (authError && authError.includes('Network')
                ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
                : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')}
            </Text>
          </View>
        )}

        {/* Login Form Card */}
        <View style={styles.card}>
          {/* Email Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>อีเมล</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                  <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@company.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onBlur={onBlur}
                    onChangeText={(val) => {
                      setServerError(null);
                      onChange(val);
                    }}
                    value={value}
                    editable={!isLoading}
                  />
                </View>
              )}
            />
            {errors.email && (
              <Text style={styles.fieldErrorText}>{errors.email.message}</Text>
            )}
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>รหัสผ่าน</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onBlur={onBlur}
                    onChangeText={(val) => {
                      setServerError(null);
                      onChange(val);
                    }}
                    value={value}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityLabel="แสดง / ซ่อนรหัสผ่าน"
                    accessibilityRole="button"
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && (
              <Text style={styles.fieldErrorText}>{errors.password.message}</Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={() => handleSubmit(onSubmit)()}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>กำลังเข้าสู่ระบบ...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Isolated Offline Demo Mode Option */}
        <View style={styles.demoSection}>
          <Text style={styles.demoHintText}>ต้องการทดลองใช้งานแบบออฟไลน์?</Text>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={handleEnterDemoMode}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Ionicons name="cube-outline" size={16} color="#2457A7" style={{ marginRight: 6 }} />
            <Text style={styles.demoButtonText}>เข้าสู่ระบบด้วยโหมดทดลองออฟไลน์</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  logo: {
    width: 48,
    height: 48,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#172334',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#172334',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  fieldIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#172334',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
    marginLeft: 2,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#2457A7',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 1,
    shadowColor: '#2457A7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoSection: {
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  demoHintText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2457A7',
  },
});
