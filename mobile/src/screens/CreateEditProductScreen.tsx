import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, ProductFormData } from '../schemas/productSchema';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';
import { Product } from '../types';
import { ProtectedScreen } from '../components/ProtectedScreen';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useInventoryStore } from '../store/inventoryStore';

export const CreateEditProductScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const existingProduct: Product | undefined = route.params?.product;
  const isEditing = !!existingProduct;

  const { createProduct, updateProduct, isMutating } = useInventoryStore();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: existingProduct?.name || '',
      sku: existingProduct?.sku || '',
      price: existingProduct?.price ?? 0,
      stock_quantity: existingProduct?.stock_quantity ?? 0,
      min_stock: existingProduct?.min_stock ?? 5,
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    setFormError(null);
    try {
      if (isEditing && existingProduct) {
        await updateProduct(existingProduct.id, {
          name: data.name,
          sku: data.sku,
          price: data.price,
          min_stock: data.min_stock,
        });
        Alert.alert('สำเร็จ', 'อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว', [
          { text: 'ตกลง', onPress: () => navigation.goBack() },
        ]);
      } else {
        await createProduct({
          name: data.name,
          sku: data.sku,
          price: data.price,
          stock_quantity: data.stock_quantity,
          min_stock: data.min_stock,
        });
        Alert.alert('สำเร็จ', 'เพิ่มสินค้าใหม่เข้าสู่ระบบเรียบร้อยแล้ว', [
          { text: 'ตกลง', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  return (
    <ProtectedScreen
      allowedRoles={['ADMIN']}
      fallbackTitle={isEditing ? 'ไม่มีสิทธิ์แก้ไขสินค้า' : 'ไม่มีสิทธิ์เพิ่มสินค้า'}
      fallbackMessage={
        isEditing
          ? 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลสินค้านี้ เฉพาะผู้ดูแลระบบเท่านั้น'
          : 'คุณไม่มีสิทธิ์ในการเพิ่มสินค้าใหม่เข้าสู่ระบบ เฉพาะผู้ดูแลระบบเท่านั้น'
      }
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.navBar, { paddingTop: insets.top + SPACING.sm }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>
            {isEditing ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
        {formError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          {/* Product Name */}
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="ชื่อสินค้า *"
                placeholder="เช่น กระดาษ A4 80 แกรม"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.name?.message}
              />
            )}
          />

          {/* SKU */}
          <Controller
            control={control}
            name="sku"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="รหัสสินค้า (SKU) *"
                placeholder="เช่น SKU-PAPER-A4"
                autoCapitalize="characters"
                value={value}
                onBlur={onBlur}
                onChangeText={(text) => onChange(text.toUpperCase())}
                error={errors.sku?.message}
                helperText="รหัสสินค้าเฉพาะภาษาอังกฤษตัวพิมพ์ใหญ่"
              />
            )}
          />

          {/* Unit Price */}
          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="ราคาต่อหน่วย (บาท) *"
                placeholder="0.00"
                keyboardType="decimal-pad"
                prefix="฿"
                value={value !== undefined ? String(value) : ''}
                onBlur={onBlur}
                onChangeText={(text) => {
                  const parsed = parseFloat(text);
                  onChange(isNaN(parsed) ? 0 : parsed);
                }}
                error={errors.price?.message}
              />
            )}
          />

          {/* Initial Stock Quantity */}
          {!isEditing && (
            <Controller
              control={control}
              name="stock_quantity"
              render={({ field: { onChange, onBlur, value } }) => (
                <InputField
                  label="จำนวนสต๊อกเริ่มต้น *"
                  placeholder="0"
                  keyboardType="number-pad"
                  suffix="หน่วย"
                  value={value !== undefined ? String(value) : ''}
                  onBlur={onBlur}
                  onChangeText={(text) => {
                    const parsed = parseInt(text, 10);
                    onChange(isNaN(parsed) ? 0 : parsed);
                  }}
                  error={errors.stock_quantity?.message}
                  helperText="จำนวนสินค้าคงคลังที่มีอยู่จริงในปัจจุบัน"
                />
              )}
            />
          )}

          {/* Minimum Stock Threshold */}
          <Controller
            control={control}
            name="min_stock"
            render={({ field: { onChange, onBlur, value } }) => (
              <InputField
                label="จำนวนแจ้งเตือนขั้นต่ำ *"
                placeholder="5"
                keyboardType="number-pad"
                suffix="หน่วย"
                value={value !== undefined ? String(value) : ''}
                onBlur={onBlur}
                onChangeText={(text) => {
                  const parsed = parseInt(text, 10);
                  onChange(isNaN(parsed) ? 0 : parsed);
                }}
                error={errors.min_stock?.message}
                helperText="ระบบจะแจ้งเตือนเมื่อสินค้าลดลงถึงหรือต่ำกว่าจำนวนนี้"
              />
            )}
          />

          <Button
            title={isEditing ? 'บันทึกการแก้ไข' : 'บันทึกสินค้า'}
            onPress={handleSubmit(onSubmit)}
            loading={isMutating}
            style={styles.submitButton}
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </ProtectedScreen>
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
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
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
  submitButton: {
    marginTop: SPACING.md,
  },
});
