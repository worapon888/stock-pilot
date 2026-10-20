import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showSettings?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showSettings = true,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.contentRow}>
        <View style={styles.titleColumn}>
          <Text style={styles.brandTitle}>StockPilot</Text>
          <Text style={styles.screenTitle}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {showSettings && (
          <TouchableOpacity
            style={styles.settingsBtn}
            activeOpacity={0.7}
            onPress={() => {
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate('Settings');
              } else {
                navigation.navigate('Settings');
              }
            }}
          >
            <Ionicons name="settings-outline" size={21} color={COLORS.textInverse} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md + 2,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleColumn: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBDCF4',
    letterSpacing: 0.3,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textInverse,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#9EBFEC',
    marginTop: 2,
  },
  settingsBtn: {
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

