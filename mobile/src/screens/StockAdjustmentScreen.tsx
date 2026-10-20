import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';
import { MovementType, Product } from '../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useInventoryStore } from '../store/inventoryStore';

export const StockAdjustmentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const initialType: MovementType = route.params?.type === 'OUT' ? 'OUT' : 'IN';
  const initialProductId: string | undefined = route.params?.productId;

  const [type, setType] = useState<MovementType>(initialType);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || '');
  const [quantity, setQuantity] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Searchable Product Picker Modal State
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const { products, fetchProducts, adjustStock, isMutating } = useInventoryStore();

  useEffect(() => {
    if (products.length === 0) {
      fetchProducts();
    }
  }, [fetchProducts, products.length]);

  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [initialProductId, products, selectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const parsedQty = parseInt(quantity, 10) || 0;
  const currentStock = selectedProduct ? selectedProduct.stock_quantity : 0;
  const projectedStock = type === 'IN' ? currentStock + parsedQty : currentStock - parsedQty;

  const isInvalidStockOut = type === 'OUT' && (parsedQty > currentStock || currentStock === 0);

  const filteredPickerProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const handleConfirmSubmit = () => {
    setErrorMsg(null);

    if (!selectedProduct) {
      setErrorMsg('กรุณาเลือกสินค้าที่ต้องการทำรายการ');
      return;
    }

    if (parsedQty <= 0) {
      setErrorMsg('กรุณาระบุจำนวนที่มากกว่า 0');
      return;
    }

    if (type === 'OUT' && parsedQty > currentStock) {
      setErrorMsg(`สินค้าคงเหลือไม่พอ (มี ${currentStock} หน่วย, ต้องการเบิก ${parsedQty} หน่วย)`);
      return;
    }

    // Native Confirmation Alert
    Alert.alert(
      type === 'IN' ? 'ยืนยันการรับเข้าสินค้า' : 'ยืนยันการเบิกสินค้า',
      `คุณต้องการ${type === 'IN' ? 'รับเข้า' : 'เบิกออก'}สินค้า "${selectedProduct.name}" จำนวน ${parsedQty} หน่วย ใช่หรือไม่?\n\nคงเหลือหลังทำรายการ: ${projectedStock} หน่วย`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยันการทำรายการ',
          style: type === 'OUT' ? 'destructive' : 'default',
          onPress: executeAdjustment,
        },
      ]
    );
  };

  const executeAdjustment = async () => {
    try {
      await adjustStock(selectedProductId, type, parsedQty, note);
      Alert.alert(
        'บันทึกรายการสำเร็จ',
        `อัปเดตสต๊อกสินค้า ${selectedProduct?.name} เรียบร้อยแล้ว (คงเหลือใหม่: ${projectedStock} หน่วย)`,
        [
          {
            text: 'ดูประวัติรายการ',
            onPress: () => navigation.navigate('Movements'),
          },
          {
            text: 'ตกลง',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกรายการ');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="บันทึกรายการสินค้า"
        subtitle="รับเข้าสินค้า หรือ เบิกสินค้าจากคลัง"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Segmented Type Switcher */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              type === 'IN' && styles.segmentTabActiveIn,
            ]}
            onPress={() => setType('IN')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-down"
              size={16}
              color={type === 'IN' ? COLORS.success : COLORS.textMuted}
            />
            <Text
              style={[
                styles.segmentText,
                type === 'IN' && styles.segmentTextActiveIn,
              ]}
            >
              รับเข้า
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              type === 'OUT' && styles.segmentTabActiveOut,
            ]}
            onPress={() => setType('OUT')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-up"
              size={16}
              color={type === 'OUT' ? COLORS.danger : COLORS.textMuted}
            />
            <Text
              style={[
                styles.segmentText,
                type === 'OUT' && styles.segmentTextActiveOut,
              ]}
            >
              เบิกออก
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          {/* Section: เลือกสินค้า * */}
          <Text style={styles.fieldLabel}>เลือกสินค้า *</Text>
          <TouchableOpacity
            style={styles.selectorBar}
            activeOpacity={0.7}
            onPress={() => setIsPickerVisible(true)}
          >
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
            <Text style={styles.selectorBarText} numberOfLines={1}>
              {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : 'ค้นหาหรือเลือกสินค้า'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Selected Product Preview Card */}
          {selectedProduct && (
            <View style={styles.selectedProductCard}>
              <View style={styles.prodThumb}>
                <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.prodMeta}>
                <Text style={styles.prodName} numberOfLines={1}>
                  {selectedProduct.name}
                </Text>
                <Text style={styles.prodSku}>{selectedProduct.sku}</Text>
                <Text style={styles.prodStock}>
                  คงเหลือปัจจุบัน: <Text style={styles.prodStockBold}>{currentStock} หน่วย</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Section: จำนวน * */}
          <View style={styles.inputSpacing}>
            <InputField
              label="จำนวน *"
              placeholder="ระบุจำนวน"
              keyboardType="number-pad"
              value={quantity}
              onChangeText={setQuantity}
              suffix="หน่วย"
              error={
                isInvalidStockOut
                  ? `สินค้าไม่พอเบิก (คงเหลือปัจจุบัน ${currentStock} หน่วย)`
                  : undefined
              }
            />
          </View>

          {/* Section: หมายเหตุ */}
          <View style={styles.inputSpacing}>
            <View style={styles.noteHeader}>
              <Text style={styles.fieldLabel}>หมายเหตุ</Text>
              <Text style={styles.charCounter}>{note.length}/200</Text>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="เช่น ใบสั่งซื้อ, การรับคืน, เติมสต๊อก"
              placeholderTextColor={COLORS.textMuted}
              value={note}
              maxLength={200}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Section: สรุปการทำรายการ */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryHeader}>สรุปการทำรายการ</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>คงเหลือเดิม</Text>
                <Text style={styles.summaryVal}>{currentStock}</Text>
                <Text style={styles.summaryUnit}>หน่วย</Text>
              </View>

              <Ionicons name="arrow-forward" size={18} color={COLORS.textMuted} style={{ marginTop: 12 }} />

              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>คงเหลือหลังทำรายการ</Text>
                <Text
                  style={[
                    styles.summaryVal,
                    { color: projectedStock < 0 ? COLORS.danger : COLORS.success },
                  ]}
                >
                  {projectedStock}
                </Text>
                <Text style={styles.summaryUnit}>หน่วย</Text>
              </View>
            </View>
          </View>

          {/* Action Button: บันทึกรายการ */}
          <Button
            title="บันทึกรายการ"
            onPress={handleConfirmSubmit}
            loading={isMutating}
            disabled={isInvalidStockOut || parsedQty <= 0}
            variant="primary"
            size="lg"
            style={styles.submitBtn}
          />
        </View>
      </ScrollView>

      {/* Searchable Product Picker Modal */}
      <Modal visible={isPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เลือกสินค้าในคลัง</Text>
              <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchRow}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="ค้นหาชื่อสินค้า หรือ SKU..."
                placeholderTextColor={COLORS.textMuted}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredPickerProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: SPACING.xs }}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedProductId;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedProductId(item.id);
                      setIsPickerVisible(false);
                      setPickerSearch('');
                    }}
                  >
                    <View style={styles.modalItemInfo}>
                      <Text style={styles.modalItemName}>{item.name}</Text>
                      <Text style={styles.modalItemSku}>{item.sku}</Text>
                    </View>
                    <View style={styles.modalItemStock}>
                      <Text style={styles.modalItemStockText}>คงเหลือ: {item.stock_quantity}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  segmentTabActiveIn: {
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  segmentTabActiveOut: {
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  segmentTextActiveIn: {
    color: COLORS.success,
    fontWeight: '700',
  },
  segmentTextActiveOut: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  selectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 44,
    gap: SPACING.sm,
  },
  selectorBarText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  selectedProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prodThumb: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodMeta: {
    flex: 1,
  },
  prodName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  prodSku: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  prodStock: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  prodStockBold: {
    fontWeight: '700',
    color: COLORS.success,
  },
  inputSpacing: {
    marginTop: SPACING.md,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCounter: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  noteInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 13,
    color: COLORS.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 4,
  },
  summaryCol: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  summaryVal: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  summaryUnit: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  submitBtn: {
    marginTop: SPACING.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 40,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalItemSku: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  modalItemStock: {
    alignItems: 'flex-end',
  },
  modalItemStockText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
});
