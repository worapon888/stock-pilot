import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Header } from '../components/Header';
import { ProductCard } from '../components/ProductCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { Product } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useInventoryStore } from '../store/inventoryStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'in_stock', label: 'พร้อมขาย' },
  { key: 'low_stock', label: 'ใกล้หมด' },
  { key: 'out_of_stock', label: 'หมดสต๊อก' },
];

export const ProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialFilter = route.params?.filter || 'all';

  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>(initialFilter);

  const { isDemoMode } = useSettingsStore();
  const { user } = useAuthStore();
  const { products, isLoading, error, fetchProducts } = useInventoryStore();

  const canManageProducts = isDemoMode || user?.role === 'ADMIN';

  const loadProducts = useCallback(() => {
    fetchProducts(search, selectedFilter === 'all' ? undefined : selectedFilter);
  }, [fetchProducts, search, selectedFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (route.params?.filter) {
      setSelectedFilter(route.params.filter);
    }
  }, [route.params?.filter]);

  const handleProductPress = (product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.id });
  };

  const handleStockIn = (product: Product) => {
    navigation.navigate('StockAdjustment', { type: 'IN', productId: product.id });
  };

  const handleStockOut = (product: Product) => {
    navigation.navigate('StockAdjustment', { type: 'OUT', productId: product.id });
  };

  return (
    <View style={styles.container}>
      <Header
        title="รายการสินค้า"
        subtitle="จัดการข้อมูลสินค้าในคลัง"
      />

      {/* Connection error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={loadProducts}>
            <Text style={styles.retryText}>ลองใหม่</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search & Filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              placeholder="ค้นหาชื่อสินค้า / รหัสสินค้า"
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              clearButtonMode="while-editing"
            />
            {search !== '' && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearch}>
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {canManageProducts && (
            <TouchableOpacity
              style={styles.addBtnHeader}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('CreateProduct')}
            >
              <Ionicons name="add" size={20} color={COLORS.textInverse} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {FILTERS.map((f) => {
            const isSelected = selectedFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => setSelectedFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Subheader: Item count & Sort info */}
        <View style={styles.subHeaderRow}>
          <Text style={styles.itemCountText}>ทั้งหมด {products.length} รายการ</Text>
          <View style={styles.sortWrap}>
            <Text style={styles.sortText}>เรียงตาม: ชื่อสินค้า</Text>
            <Ionicons name="chevron-down" size={12} color={COLORS.textMuted} />
          </View>
        </View>
      </View>

      {/* Product List */}
      {isLoading && products.length === 0 ? (
        <LoadingView message="กำลังโหลดรายการสินค้า..." />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadProducts}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={handleProductPress}
              onStockIn={handleStockIn}
              onStockOut={handleStockOut}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="ไม่พบรายการสินค้า"
              description={
                search
                  ? `ไม่พบสินค้าที่ตรงกับ "${search}" กรุณาลองค้นหาด้วยคำอื่น`
                  : canManageProducts
                  ? 'ยังไม่มีสินค้าในคลัง กดปุ่มเพิ่มสินค้าเพื่อเริ่มใช้งาน'
                  : 'ยังไม่มีสินค้าในคลัง'
              }
              actionTitle={search ? 'ล้างการค้นหา' : canManageProducts ? 'เพิ่มสินค้า' : undefined}
              onAction={
                search
                  ? () => setSearch('')
                  : canManageProducts
                  ? () => navigation.navigate('CreateProduct')
                  : undefined
              }
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterSection: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  clearSearch: {
    padding: 2,
  },
  addBtnHeader: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  filterPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs + 2,
    paddingTop: SPACING.xs,
  },
  itemCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sortWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '500',
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.xs,
    marginLeft: SPACING.sm,
  },
  retryText: {
    color: COLORS.textInverse,
    fontSize: 11,
    fontWeight: '600',
  },
});
