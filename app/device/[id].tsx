import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useColorScheme } from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import {
  addLog,
  updateDevice,
  subscribeToDeviceLogs,
} from "@/services/deviceService";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Timestamp } from "firebase/firestore";

// Local device type
interface DeviceData {
  id: string;
  name: string;
  status: "online" | "offline";
  type: string;
  ipAddress?: string;
  firmwareVersion?: string;
  lastSeen?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  metrics?: {
    cpu: number;
    memory: number;
    temperature: number;
  };
}

// Local log type
interface LogData {
  id: string;
  deviceId: string;
  message: string;
  timestamp: Timestamp | string;
}

// Mock data for device details
const mockDeviceDetails: Record<string, DeviceData> = {
  "1": {
    id: "1",
    name: "Device 1",
    status: "online",
    type: "Sensor",
    ipAddress: "192.168.1.101",
    firmwareVersion: "v1.2.3",
    lastSeen: "2023-04-08 10:30:45",
    metrics: {
      cpu: 25,
      memory: 60,
      temperature: 42,
    },
  },
  "2": {
    id: "2",
    name: "Device 2",
    status: "offline",
    type: "Controller",
    ipAddress: "192.168.1.102",
    firmwareVersion: "v2.0.1",
    lastSeen: "2023-04-08 09:15:30",
    metrics: {
      cpu: 0,
      memory: 0,
      temperature: 0,
    },
  },
  "3": {
    id: "3",
    name: "Device 3",
    status: "online",
    type: "Camera",
    ipAddress: "192.168.1.103",
    firmwareVersion: "v1.5.0",
    lastSeen: "2023-04-08 10:45:12",
    metrics: {
      cpu: 45,
      memory: 75,
      temperature: 38,
    },
  },
  "4": {
    id: "4",
    name: "Device 4",
    status: "online",
    type: "Gateway",
    ipAddress: "192.168.1.104",
    firmwareVersion: "v3.1.2",
    lastSeen: "2023-04-08 10:50:22",
    metrics: {
      cpu: 30,
      memory: 65,
      temperature: 40,
    },
  },
};

// Mock data for device logs
const mockDeviceLogs: Record<string, LogData[]> = {
  "1": [
    {
      id: "1",
      deviceId: "1",
      message: "Device connected",
      timestamp: "2023-04-08 10:30:45",
    },
    {
      id: "2",
      deviceId: "1",
      message: "Command sent: getStatus",
      timestamp: "2023-04-08 10:31:00",
    },
    {
      id: "3",
      deviceId: "1",
      message: "Response received: OK",
      timestamp: "2023-04-08 10:31:05",
    },
    {
      id: "4",
      deviceId: "1",
      message: "Command sent: getMetrics",
      timestamp: "2023-04-08 10:32:00",
    },
    {
      id: "5",
      deviceId: "1",
      message: "Response received: CPU: 25%, Memory: 60%, Temp: 42°C",
      timestamp: "2023-04-08 10:32:05",
    },
  ],
  "2": [
    {
      id: "6",
      deviceId: "2",
      message: "Device disconnected",
      timestamp: "2023-04-08 09:15:30",
    },
    {
      id: "7",
      deviceId: "2",
      message: "Last command sent: restart",
      timestamp: "2023-04-08 09:15:00",
    },
  ],
  "3": [
    {
      id: "8",
      deviceId: "3",
      message: "Device connected",
      timestamp: "2023-04-08 10:45:12",
    },
    {
      id: "9",
      deviceId: "3",
      message: "Command sent: startRecording",
      timestamp: "2023-04-08 10:46:00",
    },
    {
      id: "10",
      deviceId: "3",
      message: "Response received: Recording started",
      timestamp: "2023-04-08 10:46:05",
    },
  ],
  "4": [
    {
      id: "11",
      deviceId: "4",
      message: "Device connected",
      timestamp: "2023-04-08 10:50:22",
    },
    {
      id: "12",
      deviceId: "4",
      message: "Command sent: getConnectedDevices",
      timestamp: "2023-04-08 10:51:00",
    },
    {
      id: "13",
      deviceId: "4",
      message: "Response received: 3 devices connected",
      timestamp: "2023-04-08 10:51:05",
    },
  ],
};

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#000" : "#fff";
  const textColor = isDark ? "#fff" : "#000";
  const secondaryColor = isDark ? "#1a1a1a" : "#f0f0f0";
  const borderColor = isDark ? "#444" : "#ddd";
  const accentColor = isDark ? "#fff" : "#000";

  // Subscribe to device changes
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      doc(db, "devices", id as string),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const deviceData = {
            id: docSnapshot.id,
            ...docSnapshot.data(),
          } as DeviceData;
          setDevice(deviceData);
          setIsLoading(false);
        } else {
          setDevice(null);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("Error getting device:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Subscribe to device logs
  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToDeviceLogs(id as string, (updatedLogs) => {
      // Convert the logs to our local LogData type
      const convertedLogs = updatedLogs.map((log) => ({
        id: log.id,
        deviceId: log.deviceId,
        message: log.message,
        timestamp: log.timestamp,
      }));
      setLogs(convertedLogs);
    });

    return () => unsubscribe();
  }, [id]);

  const handleSendCommand = async () => {
    if (!command.trim() || !device) return;

    try {
      setIsUpdating(true);

      // Add log entry to Firestore
      await addLog({
        deviceId: device.id,
        message: `Command sent: ${command}`,
      });

      // Update device's lastSeen field
      await updateDevice(device.id, {
        lastSeen: new Date().toLocaleString(),
      });

      setCommand("");
      setIsUpdating(false);
    } catch (error) {
      console.error("Error sending command:", error);
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!device) return;

    try {
      setIsUpdating(true);

      const newStatus = device.status === "online" ? "offline" : "online";

      // Update device status
      await updateDevice(device.id, {
        status: newStatus,
        lastSeen: new Date().toLocaleString(),
      });

      // Add log entry about status change
      await addLog({
        deviceId: device.id,
        message: `Device status changed to ${newStatus}`,
      });

      setIsUpdating(false);
    } catch (error) {
      console.error("Error updating device status:", error);
      setIsUpdating(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />
          <ThemedText style={styles.loadingText}>
            Loading device details...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!device) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={styles.errorContainer}>
          <ThemedText type="title">Device Not Found</ThemedText>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: accentColor }]}
            onPress={handleBack}
          >
            <ThemedText style={{ color: isDark ? "#000" : "#fff" }}>
              Go Back
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // Calculate metrics for display
  const metrics = {
    cpu: device.metrics?.cpu || 0,
    memory: device.metrics?.memory || 0,
    temperature: device.metrics?.temperature || 0,
  };

  const formatTimestamp = (timestamp: any) => {
    if (timestamp instanceof Timestamp) {
      return new Date(timestamp.toDate()).toLocaleString();
    } else if (timestamp) {
      return timestamp.toString();
    }
    return "Unknown";
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? "#1a1a1a" : "#ddd" },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <IconSymbol name="chevron.left" color={textColor} size={24} />
        </TouchableOpacity>
        <ThemedText type="title">{device.name}</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <ThemedView
          style={[
            styles.card,
            { backgroundColor: secondaryColor, borderColor },
          ]}
        >
          <View style={styles.infoHeader}>
            <ThemedText type="subtitle">Device Information</ThemedText>
            <TouchableOpacity
              onPress={handleToggleStatus}
              disabled={isUpdating}
              style={{ opacity: isUpdating ? 0.5 : 1 }}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={textColor} />
              ) : (
                <ThemedText>Toggle Status</ThemedText>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Status:</ThemedText>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor:
                      device.status === "online" ? "#4CAF50" : "#F44336",
                  },
                ]}
              />
              <ThemedText style={styles.statusText}>{device.status}</ThemedText>
            </View>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Type:</ThemedText>
            <ThemedText>{device.type}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>IP Address:</ThemedText>
            <ThemedText>{device.ipAddress || "Not available"}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Firmware:</ThemedText>
            <ThemedText>{device.firmwareVersion || "Not available"}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Last Seen:</ThemedText>
            <ThemedText>{device.lastSeen || "Never"}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Created:</ThemedText>
            <ThemedText>{formatTimestamp(device.createdAt)}</ThemedText>
          </View>
        </ThemedView>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: secondaryColor, borderColor },
          ]}
        >
          <ThemedText type="subtitle">Metrics</ThemedText>
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricValue}>{metrics.cpu}%</ThemedText>
              <ThemedText style={styles.metricLabel}>CPU</ThemedText>
            </View>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricValue}>
                {metrics.memory}%
              </ThemedText>
              <ThemedText style={styles.metricLabel}>Memory</ThemedText>
            </View>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricValue}>
                {metrics.temperature}°C
              </ThemedText>
              <ThemedText style={styles.metricLabel}>Temperature</ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: secondaryColor, borderColor },
          ]}
        >
          <ThemedText type="subtitle">Command</ThemedText>
          <View style={styles.commandInputContainer}>
            <TextInput
              style={[
                styles.commandInput,
                {
                  backgroundColor: backgroundColor,
                  color: textColor,
                  borderColor,
                },
              ]}
              placeholder="Enter command..."
              placeholderTextColor={isDark ? "#888" : "#999"}
              value={command}
              onChangeText={setCommand}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: accentColor,
                  opacity: !command.trim() || isUpdating ? 0.5 : 1,
                },
              ]}
              onPress={handleSendCommand}
              disabled={!command.trim() || isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#000" : "#fff"}
                />
              ) : (
                <ThemedText
                  style={{
                    color: isDark ? "#000" : "#fff",
                    fontWeight: "bold",
                  }}
                >
                  Send
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: secondaryColor, borderColor },
          ]}
        >
          <ThemedText type="subtitle">Logs</ThemedText>
          {logs.length === 0 ? (
            <View style={styles.emptyLogsContainer}>
              <ThemedText style={styles.emptyText}>
                No logs available
              </ThemedText>
            </View>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={[styles.logItem, { borderColor }]}>
                <ThemedText style={styles.logTimestamp}>
                  {formatTimestamp(log.timestamp)}
                </ThemedText>
                <ThemedText>{log.message}</ThemedText>
              </View>
            ))
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  infoLabel: {
    fontWeight: "bold",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    textTransform: "capitalize",
  },
  metricsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  metricItem: {
    alignItems: "center",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  commandInputContainer: {
    flexDirection: "row",
    marginTop: 8,
  },
  commandInput: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  sendButton: {
    padding: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
  logItem: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  logTimestamp: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    gap: 20,
  },
  actionButton: {
    padding: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 120,
  },
  emptyLogsContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    opacity: 0.7,
  },
});
