import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';
import { dashboardApi } from '../api/dashboard';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useSettingsStore } from '../store/settingsStore';
import { useInventoryStore } from '../store/inventoryStore';
import { useAuthStore } from '../store/authStore';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isDemoMode, setDemoMode, apiBaseUrl, setApiBaseUrl } = useSettingsStore();
  const { resetDemoData, fetchDashboard } = useInventoryStore();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [inputUrl, setInputUrl] = useState(apiBaseUrl);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<string | null>(null);

  const handleLogout = () => {
    Alert.alert(
      'ต้องการออกจากระบบใช่หรือไม่?',
      '',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  };

  const handleSaveUrl = async () => {
    await setApiBaseUrl(inputUrl);
    Alert.alert('บันทึกสำเร็จ', `อัปเดต API Base URL เป็น:\n${inputUrl}`);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      await setApiBaseUrl(inputUrl);
      const res = await dashboardApi.checkHealth();
      setConnectionResult(`เชื่อมต่อสำเร็จ!\nฐานข้อมูล: ${res.database}\nบริการ: StockPilot Go API`);
    } catch (err: any) {
      setConnectionResult(`เชื่อมต่อไม่สำเร็จ:\n${err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleResetDemo = () => {
    Alert.alert(
      'คืนค่าข้อมูลจำลอง',
      'คุณต้องการล้างข้อมูลและโหลดชุดข้อมูลตัวอย่างเริ่มต้นใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          style: 'destructive',
          onPress: async () => {
            await resetDemoData();
            Alert.alert('สำเร็จ', 'คืนค่าข้อมูลจำลองเริ่มต้นเรียบร้อยแล้ว');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="ตั้งค่าระบบ"
        subtitle="สถานะและการเชื่อมต่อเซิร์ฟเวอร์"
        showSettings={false}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Account Card */}
        <View style={styles.card}>
          <View style={styles.accountHeader}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.sectionTitle}>บัญชีผู้ใช้</Text>
              <Text style={styles.sectionDesc}>
                {isDemoMode ? 'โหมดทดลองออฟไลน์' : 'ข้อมูลผู้ใช้งานที่เข้าสู่ระบบ'}
              </Text>
            </View>
          </View>

          {isDemoMode ? (
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>สถานะ:</Text>
              <Text style={styles.profileValue}>ผู้เยี่ยมชม (Offline Demo)</Text>
            </View>
          ) : (
            <View style={styles.profileDetails}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>ชื่อผู้ใช้งาน</Text>
                <Text style={styles.profileValue}>{user?.full_name || 'ผู้ใช้งาน StockPilot'}</Text>
              </View>

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>อีเมล</Text>
                <Text style={styles.profileValue}>{user?.email || '-'}</Text>
              </View>

              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>สิทธิ์การใช้งาน</Text>
                <View style={[styles.rolePill, user?.role === 'ADMIN' ? styles.roleAdmin : styles.roleStaff]}>
                  <Text style={[styles.rolePillText, user?.role === 'ADMIN' ? styles.roleAdminText : styles.roleStaffText]}>
                    {user?.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
          </TouchableOpacity>
        </View>

        {/* Mode Toggle Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>โหมดออฟไลน์จำลอง (Demo Mode)</Text>
              <Text style={styles.toggleDesc}>
                {isDemoMode
                  ? 'ใช้งานข้อมูลจำลองในเครื่อง (AsyncStorage) ไม่มีการบันทึกลง PostgreSQL'
                  : 'เชื่อมต่อกับ Go REST API และฐานข้อมูล PostgreSQL จริง'}
              </Text>
            </View>
            <Switch
              value={isDemoMode}
              onValueChange={async (val) => {
                await setDemoMode(val);
                await fetchDashboard();
              }}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={COLORS.textInverse}
            />
          </View>

          <View style={styles.badgeBanner}>
            <Ionicons
              name={isDemoMode ? 'information-circle' : 'checkmark-circle'}
              size={18}
              color={isDemoMode ? COLORS.warning : COLORS.success}
            />
            <Text
              style={[
                styles.badgeBannerText,
                { color: isDemoMode ? COLORS.warning : COLORS.success },
              ]}
            >
              สถานะปัจจุบัน: {isDemoMode ? 'โหมดทดลองออฟไลน์' : 'ออนไลน์ (เชื่อมต่อเซิร์ฟเวอร์)'}
            </Text>
          </View>
        </View>

        {/* Backend API Configuration */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>การตั้งค่า Go REST API</Text>
          <Text style={styles.sectionDesc}>
            กำหนด Base URL สำหรับเรียกข้อมูล (Android Emulator ใช้ 10.0.2.2)
          </Text>

          <InputField
            label="API Base URL"
            value={inputUrl}
            onChangeText={setInputUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.presetLabel}>ค่าลัดที่แนะนำ:</Text>
          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setInputUrl('http://10.0.2.2:8080/api/v1')}
            >
              <Text style={styles.presetBtnText}>Android Emulator (10.0.2.2:8080)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setInputUrl('http://localhost:8080/api/v1')}
            >
              <Text style={styles.presetBtnText}>Localhost (127.0.0.1:8080)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.btnRow}>
            <Button
              title="ทดสอบเชื่อมต่อ"
              onPress={handleTestConnection}
              loading={testingConnection}
              variant="outline"
              size="md"
              style={{ flex: 1 }}
              icon={<Ionicons name="pulse" size={16} color={COLORS.primary} />}
            />
            <Button
              title="บันทึก URL"
              onPress={handleSaveUrl}
              variant="primary"
              size="md"
              style={{ flex: 1 }}
            />
          </View>

          {connectionResult && (
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{connectionResult}</Text>
            </View>
          )}
        </View>

        {/* Offline Demo Controls */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>จัดการข้อมูลตัวอย่าง</Text>
          <Text style={styles.sectionDesc}>
            รีเซ็ตสินค้าและประวัติการเคลื่อนไหวในโหมดทดลองกลับเป็นค่าเริ่มต้น
          </Text>

          <Button
            title="รีเซ็ตข้อมูลจำลอง"
            onPress={handleResetDemo}
            variant="secondary"
            size="md"
            icon={<Ionicons name="refresh" size={16} color={COLORS.textPrimary} />}
          />
        </View>

        {/* System Architecture */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>โครงสร้างระบบ StockPilot</Text>
          <Text style={styles.infoLine}>• ฟรอนต์เอนด์: React Native + Expo (TypeScript strict)</Text>
          <Text style={styles.infoLine}>• การจัดการ State & Form: Zustand, React Hook Form + Zod</Text>
          <Text style={styles.infoLine}>• แบ็กเอนด์: Golang + Gin Web Framework</Text>
          <Text style={styles.infoLine}>• ฐานข้อมูล: PostgreSQL + pgx/v5 (ACID Transactions)</Text>
          <Text style={styles.infoLine}>• ความปลอดภัย: SELECT FOR UPDATE Row Locking & Idempotency</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  toggleDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  badgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  badgeBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  presetRow: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  presetBtn: {
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  resultBox: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  infoLine: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.xs,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  profileLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  profileValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleAdmin: {
    backgroundColor: '#EEF2FF',
  },
  roleStaff: {
    backgroundColor: '#F0FDF4',
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleAdminText: {
    color: COLORS.primary,
  },
  roleStaffText: {
    color: COLORS.success,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    marginTop: SPACING.md,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
});
