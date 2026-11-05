// ============================================================
// AgriSweep — Modern Tab Navigation Layout
// ============================================================

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LayoutDashboard, History, Settings, Info } from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../constants/theme';

function TabIcon({ icon: Icon, label, focused }: { icon: typeof LayoutDashboard; label: string; focused: boolean }) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Icon
        size={20}
        color={focused ? '#059669' : '#94A3B8'}
        strokeWidth={focused ? 2.5 : 1.8}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={LayoutDashboard} label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={History} label="History" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Settings} label="Settings" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Info} label="About" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    height: Platform.OS === 'ios' ? 88 : 74,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    ...Shadows.md,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: '#ECFDF5',
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: '#94A3B8',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: '#059669',
    fontWeight: FontWeight.bold,
  },
});
