import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { MovementCard } from '../components/MovementCard';
import { LoadingView } from '../components/LoadingView';
import { Product, StockMovement } from '../types';
import { productsApi } from '../api/products';
import { inventoryApi } from '../api/inventory';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useInventoryStore } from '../store/inventoryStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

export const ProductDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { productId } = route.params;

  const { isDemoMode } = useSettingsStore();
  const { user } = useAuthStore();
  const { products, movements } = useInventoryStore();

  const canEditProduct = isDemoMode || user?.role === 'ADMIN';

  const [product, setProduct] = useState<Product | null>(null);
  const [productMovements, setProductMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProductData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isDemoMode) {
        const found = products.find((p) => p.id === productId);
        setProduct(found || null);
        const movs = movements.filter((m) => m.product_id === productId);
        setProductMovements(movs);
      } else {
        const p = await productsApi.getById(productId);
        setProduct(p);
        const { movements: mList } = await inventoryApi.getProductMovements(productId);
        setProductMovements(mList);
      }
    } catch (err: any) {
      Alert.alert('ข้อผิดพลาด', err.message || 'ไม่สามารถโหลดข้อมูลสินค้าได้');
    } finally {
      setIsLoading(false);
    }
  }, [productId, isDemoMode, products, movements]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  if (isLoading && !product) {
    return <LoadingView message="กำลังโหลดข้อมูลสินค้า..." />;
  }

  if (!product) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>ไม่พบข้อมูลสินค้านี้</Text>
        <Button title="ย้อนกลับ" onPress={() => navigation.goBack()} variant="secondary" />
      </View>
    );
  }

  const isOutOfStock = product.stock_quantity === 0;
  const isLowStock = !isOutOfStock && product.stock_quantity <= product.min_stock;
  const totalValuation = product.price * product.stock_quantity;

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          รายละเอียดสินค้า
        </Text>
        {canEditProduct ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProduct', { product })}
          >
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadProductData}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Main Product Card */}
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <View style={styles.skuBadge}>
              <Text style={styles.skuText}>{product.sku}</Text>
            </View>
            {isOutOfStock ? (
              <Badge label="หมดสต๊อก" variant="danger" />
            ) : isLowStock ? (
              <Badge label="สินค้าใกล้หมด" variant="warning" />
            ) : (
              <Badge label="พร้อมขาย" variant="success" />
            )}
          </View>

          <Text style={styles.productName}>{product.name}</Text>

          <View style={styles.metricsGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricBoxLabel}>ราคาต่อหน่วย</Text>
              <Text style={styles.metricBoxValue}>฿{product.price.toFixed(2)}</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricBoxLabel}>คงเหลือในคลัง</Text>
              <Text
                style={[
                  styles.metricBoxValue,
                  isOutOfStock && { color: COLORS.danger },
                  isLowStock && { color: COLORS.warning },
                ]}
              >
                {product.stock_quantity} หน่วย
              </Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricBoxLabel}>จำนวนขั้นต่ำ</Text>
              <Text style={styles.metricBoxValue}>{product.min_stock} หน่วย</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricBoxLabel}>มูลค่ารวม</Text>
              <Text style={styles.metricBoxValue}>฿{totalValuation.toLocaleString()}</Text>
            </View>
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.actionButtonGroup}>
            <Button
              title="รับเข้าสินค้า"
              onPress={() =>
                navigation.navigate('MainTabs', {
                  screen: 'StockAdjustment',
                  params: { type: 'IN', productId: product.id },
                })
              }
              variant="success"
              size="md"
              style={styles.actionBtnIn}
              icon={<Ionicons name="arrow-down" size={16} color="#FFFFFF" />}
            />

            <Button
              title="เบิกสินค้า"
              onPress={() =>
                navigation.navigate('MainTabs', {
                  screen: 'StockAdjustment',
                  params: { type: 'OUT', productId: product.id },
                })
              }
              variant="danger"
              size="md"
              disabled={isOutOfStock}
              style={styles.actionBtnOut}
              icon={<Ionicons name="arrow-up" size={16} color="#FFFFFF" />}
            />
          </View>
        </View>

        {/* Movements History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ประวัติการเคลื่อนไหวสินค้านี้</Text>
          <Text style={styles.sectionBadge}>{productMovements.length} รายการ</Text>
        </View>

        {productMovements.length > 0 ? (
          productMovements.map((mov) => <MovementCard key={mov.id} movement={mov} />)
        ) : (
          <View style={styles.emptyMovements}>
            <Ionicons name="document-text-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyMovementsText}>
              ยังไม่มีประวัติการทำรายการสำหรับสินค้านี้
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginHorizontal: SPACING.sm,
    textAlign: 'center',
  },
  editButton: {
    padding: SPACING.xs,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  mainCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  skuBadge: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  skuText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  metricBox: {
    flexBasis: '48%',
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricBoxLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  metricBoxValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtnIn: {
    flex: 1,
  },
  actionBtnOut: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionBadge: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyMovements: {
    padding: SPACING.xl,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyMovementsText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  notFoundText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
});
