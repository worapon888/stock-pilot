import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { MovementCard } from '../components/MovementCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { StockMovement } from '../types';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { useInventoryStore } from '../store/inventoryStore';

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'IN', label: 'รับเข้า' },
  { key: 'OUT', label: 'เบิกออก' },
];

export const MovementsScreen: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { movements, isLoading, error, fetchMovements } = useInventoryStore();

  const loadMovements = useCallback(() => {
    fetchMovements(undefined, selectedFilter === 'all' ? undefined : selectedFilter);
  }, [fetchMovements, selectedFilter]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Filter movements by search term (product name, sku, or note)
  const filteredMovements = movements.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.product_name && m.product_name.toLowerCase().includes(q)) ||
      (m.product_sku && m.product_sku.toLowerCase().includes(q)) ||
      (m.note && m.note.toLowerCase().includes(q))
    );
  });

  // Helper to format date in Thai: วันที่ (15 มี.ค. 2567)
  const formatThaiDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ];
      const day = d.getDate();
      const month = thaiMonths[d.getMonth()];
      const year = d.getFullYear() + 543;
      return `วันที่ (${day} ${month} ${year})`;
    } catch {
      return dateStr;
    }
  };

  // Group movements by date
  type GroupedMovements = {
    date: string;
    items: StockMovement[];
  };

  const grouped = filteredMovements.reduce<GroupedMovements[]>((acc, mov) => {
    const dateKey = formatThaiDate(mov.created_at);
    let group = acc.find((g) => g.date === dateKey);
    if (!group) {
      group = { date: dateKey, items: [] };
      acc.push(group);
    }
    group.items.push(mov);
    return acc;
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title="ประวัติรายการ"
        subtitle="ดูประวัติการรับเข้า - เบิกออกสินค้า"
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
          <TouchableOpacity style={styles.retryButton} onPress={loadMovements}>
            <Text style={styles.retryText}>ลองใหม่</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="ค้นหารายการ..."
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

        <View style={styles.filterTabsRow}>
          {FILTERS.map((f) => {
            const isSelected = selectedFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, isSelected && styles.filterTabActive]}
                onPress={() => setSelectedFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isSelected && styles.filterTabTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Movement List Grouped by Date */}
      {isLoading && movements.length === 0 ? (
        <LoadingView message="กำลังโหลดประวัติรายการ..." />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadMovements}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{item.date}</Text>
              {item.items.map((m) => (
                <MovementCard key={m.id} movement={m} />
              ))}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="ไม่มีรายการประวัติ"
              description={
                search
                  ? `ไม่พบรายการที่ตรงกับ "${search}"`
                  : 'ยังไม่มีประวัติการรับเข้าหรือเบิกออกสินค้า'
              }
              actionTitle={search ? 'ล้างการค้นหา' : undefined}
              onAction={search ? () => setSearch('') : undefined}
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
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchContainer: {
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
  filterTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SPACING.sm,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  dateGroup: {
    marginBottom: SPACING.md,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs + 2,
    paddingLeft: 2,
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
