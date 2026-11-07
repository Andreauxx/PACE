// ============================================================
// AgriSweep — Tab Navigation
// Home · Controls · Automation · History · Settings
// (About opens from Settings as its own page.)
// The active tab gets a short straw mark under its label.
// ============================================================

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, Gamepad2, Bot, History, Settings } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';

function TabIcon({ icon: Icon, label, focused }: { icon: typeof House; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Icon size={21} color={focused ? Colors.ink : Colors.faint} strokeWidth={focused ? 2.3 : 1.8} />
      <Text numberOfLines={1} style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
      <View style={[styles.lamp, focused && styles.lampOn]} />
    </View>
  );
}

const TABS = [
  { name: 'index', label: 'Home', icon: House },
  { name: 'controls', label: 'Controls', icon: Gamepad2 },
  { name: 'automation', label: 'Automation', icon: Bot },
  { name: 'history', label: 'History', icon: History },
  { name: 'settings', label: 'Settings', icon: Settings },
] as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [styles.tabBar, { height: 62 + bottom, paddingBottom: bottom }],
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarAccessibilityLabel: t.label,
            tabBarIcon: ({ focused }) => <TabIcon icon={t.icon} label={t.label} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.steel,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: 8,
    elevation: 0,
  },
  tabBarItem: {
    paddingHorizontal: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: 74,
  },
  lamp: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  lampOn: {
    backgroundColor: Colors.straw,
  },
  tabLabel: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.faint,
  },
  tabLabelActive: {
    fontFamily: Fonts.bold,
    color: Colors.ink,
  },
});
