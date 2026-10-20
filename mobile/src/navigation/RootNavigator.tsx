import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { TabNavigator } from './TabNavigator';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { CreateEditProductScreen } from '../screens/CreateEditProductScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Product } from '../types';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  MainTabs: undefined;
  ProductDetail: { productId: string };
  CreateProduct: undefined;
  EditProduct: { product: Product };
  Settings: undefined;
  StockAdjustment: { type?: 'IN' | 'OUT'; productId?: string };
  Products: { filter?: string };
  Movements: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#F7FAFE' },
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen
        name="CreateProduct"
        component={CreateEditProductScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditProduct"
        component={CreateEditProductScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
};
