import { useColorScheme } from "react-native";

// Semantic color tokens. Screens build their StyleSheet from these instead
// of hardcoding hex literals, so the app follows the device's light/dark
// setting instead of staying pinned to a bright theme.
export type ThemeColors = {
  background: string;
  surface: string; // card / input backgrounds
  surfaceAlt: string; // subtle secondary bg: tab bar track, segmented control track
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  inverseSurface: string; // solid bg for active pills/buttons (was hardcoded #111)
  inverseText: string; // text on inverseSurface
  accent: string; // German text / links
  success: string;
  successSurface: string; // "reviewed" badge bg
  danger: string;
  warning: string;
  isDark: boolean;
};

const light: ThemeColors = {
  background: "#f5f5f7",
  surface: "#ffffff",
  surfaceAlt: "#ececef",
  border: "#ececef",
  textPrimary: "#111111",
  textSecondary: "#5a5a5a",
  textMuted: "#8a8a8a",
  textFaint: "#b5b5bd",
  inverseSurface: "#111111",
  inverseText: "#ffffff",
  accent: "#2b6cb0",
  success: "#1a7f37",
  successSurface: "#e6f4ea",
  danger: "#b42318",
  warning: "#c9960c",
  isDark: false,
};

const dark: ThemeColors = {
  background: "#0d0d10",
  surface: "#1c1c1f",
  surfaceAlt: "#2a2a2e",
  border: "#2e2e33",
  textPrimary: "#f2f2f4",
  textSecondary: "#b8b8c0",
  textMuted: "#8a8a90",
  textFaint: "#6a6a72",
  inverseSurface: "#f2f2f4",
  inverseText: "#111111",
  accent: "#5b9bd8",
  success: "#3fbf60",
  successSurface: "rgba(63,191,96,0.16)",
  danger: "#ff6b5e",
  warning: "#e0ac2b",
  isDark: true,
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
