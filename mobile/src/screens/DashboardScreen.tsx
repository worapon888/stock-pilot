import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../components/Header';
import { StatCard } from '../components/StatCard';
import { MovementCard } from '../components/MovementCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useInventoryStore } from '../store/inventoryStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isDemoMode, setDemoMode } = useSettingsStore();
  const { user } = useAuthStore();
  const { dashboard, isLoading, error, fetchDashboard } = useInventoryStore();

  const canManageProducts = isDemoMode || user?.role === 'ADMIN';

  const loadData = useCallback(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!dashboard && !error) {
      loadData();
    }
  }, [loadData, isDemoMode, dashboard, error]);

  if (isLoading && !dashboard) {
    return (
      <View style={styles.container}>
        <Header title="ภาพรวมสต๊อก" subtitle="สรุปข้อมูลสินค้าในคลัง" />
        <LoadingView message="กำลังโหลดข้อมูลภาพรวม..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="ภาพรวมสต๊อก"
        subtitle="สรุปข้อมูลสินค้าในคลัง"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadData}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Error notification banner */}
        {error && (
          <View style={styles.errorBanner}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
            <View style={styles.errorActions}>
              <TouchableOpacity style={styles.retryButton} onPress={loadData}>
                <Text style={styles.retryText}>ลองใหม่</Text>
              </TouchableOpacity>
              {!isDemoMode && (
                <TouchableOpacity
                  style={styles.demoSwitchButton}
                  onPress={() => setDemoMode(true)}
                >
                  <Text style={styles.demoSwitchText}>สลับเป็นโหมดทดลอง</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 3 Quick Action Buttons */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionIn]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MainTabs', { screen: 'StockAdjustment', params: { type: 'IN' } })}
          >
            <View style={styles.actionIconWrapIn}>
              <Ionicons name="arrow-down" size={16} color={COLORS.success} />
            </View>
            <Text style={styles.actionInText}>รับเข้าสินค้า</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionOut]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MainTabs', { screen: 'StockAdjustment', params: { type: 'OUT' } })}
          >
            <View style={styles.actionIconWrapOut}>
              <Ionicons name="arrow-up" size={16} color={COLORS.danger} />
            </View>
            <Text style={styles.actionOutText}>เบิกสินค้า</Text>
          </TouchableOpacity>

          {canManageProducts && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionAdd]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('CreateProduct')}
            >
              <View style={styles.actionIconWrapAdd}>
                <Ionicons name="add" size={16} color={COLORS.textInverse} />
              </View>
              <Text style={styles.actionAddText}>เพิ่มสินค้า</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 4 KPI Summary Cards (2-column Grid) */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              title="จำนวนสินค้า"
              value={dashboard?.total_products ?? 0}
              unit="รายการ"
              icon={<Ionicons name="cube-outline" size={16} color={COLORS.primary} />}
              iconBg={COLORS.primaryLight}
              style={styles.gridItem}
            />
            <StatCard
              title="คงเหลือรวม"
              value={(dashboard?.total_stock ?? 0).toLocaleString()}
              unit="หน่วย"
              icon={<Ionicons name="layers-outline" size={16} color={COLORS.success} />}
              iconBg={COLORS.successBg}
              style={styles.gridItem}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title="สินค้าใกล้หมด"
              value={dashboard?.low_stock_count ?? 0}
              unit="รายการ"
              icon={<Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />}
              iconBg={COLORS.warningBg}
              style={styles.gridItem}
            />
            <StatCard
              title="มูลค่าสินค้ารวม"
              value={`฿${(dashboard?.total_value ?? 0).toLocaleString('th-TH', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`}
              unit="บาท"
              icon={<Ionicons name="cash-outline" size={16} color={COLORS.success} />}
              iconBg={COLORS.successBg}
              style={styles.gridItem}
            />
          </View>
        </View>

        {/* Low Stock Alerts Section */}
        {dashboard && dashboard.low_stock_products.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="alert-circle" size={18} color={COLORS.warning} />
                <Text style={styles.sectionTitle}>สินค้าใกล้หมด</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Products', params: { filter: 'low_stock' } })}>
                <Text style={styles.seeAllText}>ดูทั้งหมด ({dashboard.low_stock_count})</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.lowStockCard}>
              {dashboard.low_stock_products.map((prod, idx) => (
                <TouchableOpacity
                  key={prod.id}
                  style={[
                    styles.lowStockItem,
                    idx !== dashboard.low_stock_products.length - 1 && styles.lowStockDivider,
                  ]}
                  onPress={() => navigation.navigate('ProductDetail', { productId: prod.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.lowStockThumb}>
                    <Ionicons name="cube-outline" size={20} color={COLORS.warning} />
                  </View>

                  <View style={styles.lowStockInfo}>
                    <Text style={styles.lowStockName} numberOfLines={1}>
                      {prod.name}
                    </Text>
                    <Text style={styles.lowStockSku}>{prod.sku}</Text>
                  </View>

                  <View style={styles.lowStockBadgeCol}>
                    <View style={styles.lowStockPill}>
                      <Text style={styles.lowStockPillText}>
                        {prod.stock_quantity} / {prod.min_stock}
                      </Text>
                    </View>
                    <Text style={styles.lowStockSubText}>ขั้นต่ำ: {prod.min_stock}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recent Stock Movements Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.sectionTitle}>รายการล่าสุด</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Movements' })}>
              <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          {dashboard && dashboard.recent_movements.length > 0 ? (
            dashboard.recent_movements.map((mov) => (
              <MovementCard key={mov.id} movement={mov} />
            ))
          ) : (
            <EmptyState
              title="ยังไม่มีรายการเคลื่อนไหว"
              description="เมื่อมีการรับเข้าหรือเบิกออกสินค้า รายการจะปรากฏที่นี่"
              actionTitle="รับเข้าสินค้า"
              onAction={() => navigation.navigate('MainTabs', { screen: 'StockAdjustment', params: { type: 'IN' } })}
            />
          )}
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
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '500',
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.xs + 2,
  },
  retryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.xs,
  },
  retryText: {
    color: COLORS.textInverse,
    fontSize: 11,
    fontWeight: '600',
  },
  demoSwitchButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoSwitchText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '500',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  actionIn: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.successBorder,
  },
  actionIconWrapIn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInText: {
    color: COLORS.success,
    fontWeight: '700',
    fontSize: 12,
  },
  actionOut: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.dangerBorder,
  },
  actionIconWrapOut: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOutText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  actionAdd: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionIconWrapAdd: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAddText: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 12,
  },
  statsGrid: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  gridItem: {
    flex: 1,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  lowStockCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  lowStockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  lowStockDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  lowStockThumb: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowStockInfo: {
    flex: 1,
  },
  lowStockName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  lowStockSku: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  lowStockBadgeCol: {
    alignItems: 'flex-end',
  },
  lowStockPill: {
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  lowStockPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.warning,
  },
  lowStockSubText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
