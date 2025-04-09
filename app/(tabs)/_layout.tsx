import { Tabs } from "expo-router";
import React from "react";
import { Platform, useColorScheme } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import BlurTabBarBackground from "@/components/ui/TabBarBackground.ios";
import { Colors } from "@/constants/Colors";

interface TabIconProps {
  color: string;
  size: number;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      initialRouteName="devices"
      screenOptions={{
        tabBarActiveTintColor: isDark ? "#fff" : "#000",
        tabBarInactiveTintColor: isDark ? "#888" : "#666",
        tabBarStyle: {
          backgroundColor: isDark ? "#000" : "#fff",
          borderTopColor: isDark ? "#333" : "#ddd",
        },
        headerStyle: {
          backgroundColor: isDark ? "#000" : "#fff",
        },
        headerTintColor: isDark ? "#fff" : "#000",
        tabBarBackground: Platform.select({
          ios: () => <BlurTabBarBackground />,
          default: undefined,
        }),
      }}
    >
      <Tabs.Screen
        name="devices"
        options={{
          title: "Devices",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <IconSymbol
              name="chevron.left.forwardslash.chevron.right"
              color={color}
              size={size}
            />
          ),
          tabBarButton: (props: any) => <HapticTab {...props} />,
          headerShown: false,
        }}
      />
      {/* <Tabs.Screen
        name="index"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <IconSymbol name="house.fill" color={color} size={size} />
          ),
          tabBarButton: (props: any) => <HapticTab {...props} />,
        }}
      /> */}
    </Tabs>
  );
}
