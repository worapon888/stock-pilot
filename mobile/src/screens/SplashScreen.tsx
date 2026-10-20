import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useSettingsStore } from '../store/settingsStore';
import { useInventoryStore } from '../store/inventoryStore';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');

// Keep splash visible during native boot
ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore in environments where preventAutoHideAsync is unsupported
});

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [showLoadingState, setShowLoadingState] = useState(false);

  // Animated values for the indeterminate progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  // Indeterminate progress bar loop animation
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (showLoadingState) {
      // Fade in the loader smoothly
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      // Loop scanning animation for progress bar
      progressAnim.setValue(0);
      animLoop = Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      );
      animLoop.start();
    }

    return () => {
      if (animLoop) {
        animLoop.stop();
      }
    };
  }, [showLoadingState, progressAnim, fadeAnim]);

  // Main startup initialization flow
  useEffect(() => {
    isMounted.current = true;

    // Show loading indicator only if initialization takes more than 300ms
    const loaderTimer = setTimeout(() => {
      if (isMounted.current) {
        setShowLoadingState(true);
      }
    }, 300);

    const initializeApp = async () => {
      try {
        // 1. Hide native splash once React tree is mounted to avoid white flash
        await ExpoSplashScreen.hideAsync().catch(() => {});

        // 2. Load persisted application settings (mode, API base URL)
        const initSettings = useSettingsStore.getState().initSettings;
        await initSettings();

        const { isDemoMode } = useSettingsStore.getState();
        const { fetchDashboard } = useInventoryStore.getState();
        const { restoreSession } = useAuthStore.getState();

        // 3. Check mode and authentication status
        if (isDemoMode) {
          // Restore offline demo inventory data
          await fetchDashboard().catch(() => {});
          if (isMounted.current) {
            navigation.replace('MainTabs');
          }
        } else {
          // Live API mode: restore secure session credentials
          const hasValidSession = await restoreSession();

          if (hasValidSession) {
            // Valid authenticated session -> preload dashboard data and navigate to Dashboard
            await fetchDashboard().catch(() => {});
            if (isMounted.current) {
              navigation.replace('MainTabs');
            }
          } else {
            // No session or expired session -> navigate to Login
            if (isMounted.current) {
              navigation.replace('Login');
            }
          }
        }
      } catch (err) {
        console.warn('Unexpected error during startup initialization:', err);
        if (isMounted.current) {
          navigation.replace('Login');
        }
      } finally {
        clearTimeout(loaderTimer);
      }
    };

    initializeApp();

    return () => {
      isMounted.current = false;
      clearTimeout(loaderTimer);
    };
  }, [navigation]);

  // Translate indeterminate progress bar indicator across the track
  const trackWidth = 140;
  const indicatorWidth = 44;
  const translateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-indicatorWidth, trackWidth],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {/* Package Logo */}
        <Image
          source={require('../../assets/splash-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          fadeDuration={0}
        />

        {/* Brand App Name */}
        <View style={styles.titleRow}>
          <Text style={styles.titleDark}>Stock</Text>
          <Text style={styles.titleBlue}>Pilot</Text>
        </View>

        {/* Thai Subtitle */}
        <Text style={styles.subtitle}>ระบบจัดการสินค้าคงคลัง</Text>

        {/* Dynamic Loading Section (shown if startup takes longer than expected) */}
        <View style={styles.loaderSlot}>
          {showLoadingState && (
            <Animated.View style={[styles.loaderContainer, { opacity: fadeAnim }]}>
              {/* Subtle animated progress bar */}
              <View style={[styles.progressTrack, { width: trackWidth }]}>
                <Animated.View
                  style={[
                    styles.progressIndicator,
                    {
                      width: indicatorWidth,
                      transform: [{ translateX }],
                    },
                  ]}
                />
              </View>

              {/* Progress Text */}
              <Text style={styles.loadingText}>กำลังเตรียมระบบ...</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  logo: {
    width: Math.min(width * 0.45, 190),
    height: Math.min(width * 0.45, 190),
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleDark: {
    fontSize: 38,
    fontWeight: '800',
    color: '#172A46',
    letterSpacing: -0.6,
  },
  titleBlue: {
    fontSize: 38,
    fontWeight: '800',
    color: '#2457A7',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#77869A',
    marginTop: 8,
    textAlign: 'center',
  },
  loaderSlot: {
    height: 60,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2EAF4',
    overflow: 'hidden',
  },
  progressIndicator: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#2457A7',
  },
  loadingText: {
    fontSize: 13,
    color: '#77869A',
    fontWeight: '400',
    marginTop: 10,
    textAlign: 'center',
  },
});
