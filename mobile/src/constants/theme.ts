export const COLORS = {
  // Primary brand palette (matching Thai business software)
  primary: '#2457A7',         // Primary Blue
  primaryDark: '#183B66',     // Primary Dark Navy
  primaryLight: '#EAF1FB',    // Primary Light / Surface Tint
  accent: '#2457A7',
  accentSubtle: '#EAF1FB',

  // Background & Surfaces
  background: '#F6F8FA',      // App Background
  card: '#FFFFFF',            // Surface
  surfaceSecondary: '#F0F3F6',// Secondary Surface
  border: '#E1E6EC',          // Subtle Border
  borderLight: '#EDF1F5',

  // Typography
  textPrimary: '#172334',     // Primary Text
  textSecondary: '#66758A',   // Secondary Text
  textMuted: '#94A0AF',       // Muted Text
  textInverse: '#FFFFFF',

  // Semantic Status Colors
  success: '#258568',         // Stock IN / Success Green
  successBg: '#EAF5F0',       // Light Green Background
  successBorder: '#BDE3D5',

  danger: '#C65B58',          // Stock OUT / Danger Red
  dangerBg: '#FBEFEE',        // Light Red Background
  dangerBorder: '#F2C9C7',

  warning: '#C58A2F',         // Low Stock / Warning Amber
  warningBg: '#FFF5E5',       // Light Amber Background
  warningBorder: '#F7DFB2',

  info: '#2457A7',
  infoBg: '#EAF1FB',
  infoBorder: '#C6DCFA',
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#172334',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1.5,
  },
  md: {
    shadowColor: '#172334',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2.5,
  },
};

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  full: 9999,
};
