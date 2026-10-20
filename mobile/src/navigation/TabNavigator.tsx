import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { StockAdjustmentScreen } from '../screens/StockAdjustmentScreen';
import { MovementsScreen } from '../screens/MovementsScreen';
import { COLORS, SHADOWS } from '../constants/theme';

const Tab = createBottomTabNavigator();

export const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 60 : 82,
          paddingBottom: Platform.OS === 'android' ? 6 : 24,
          paddingTop: 6,
          ...SHADOWS.sm,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'หน้าหลัก',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          tabBarLabel: 'สินค้า',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'cube' : 'cube-outline'}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="StockAdjustment"
        component={StockAdjustmentScreen}
        options={{
          tabBarLabel: 'รับเข้า/เบิกออก',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'swap-vertical' : 'swap-vertical-outline'}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Movements"
        component={MovementsScreen}
        options={{
          tabBarLabel: 'ประวัติ',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              size={size - 1}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
