import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { UserRole } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface ProtectedScreenProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export const ProtectedScreen: React.FC<ProtectedScreenProps> = ({
  children,
  allowedRoles,
  fallbackTitle = 'ไม่มีสิทธิ์เข้าถึงหน้านี้',
  fallbackMessage = 'คุณไม่มีสิทธิ์ในการเข้าถึงหรือดำเนินการในส่วนนี้ เฉพาะผู้ดูแลระบบเท่านั้น',
}) => {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuthStore();
  const { isDemoMode } = useSettingsStore();

  // In Offline Demo Mode, allow full access for demo exploration
  if (isDemoMode) {
    return <>{children}</>;
  }

  // Live Mode: Check authentication and RBAC
  const userRole = user?.role;
  const isAuthorized = isAuthenticated && userRole && allowedRoles.includes(userRole);

  if (isAuthorized) {
    return <>{children}</>;
  }

  const roleLabel = userRole === 'ADMIN' ? 'ผู้ดูแลระบบ' : userRole === 'STAFF' ? 'พนักงาน' : 'ไม่ระบุ';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-outline" size={36} color={COLORS.danger} />
        </View>

        <Text style={styles.title}>{fallbackTitle}</Text>
        <Text style={styles.message}>{fallbackMessage}</Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeLabel}>สิทธิ์ปัจจุบันของคุณ:</Text>
          <Text style={styles.roleBadgeValue}>{roleLabel}</Text>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.backButtonText}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xl,
    gap: 6,
  },
  roleBadgeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  roleBadgeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  backButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
