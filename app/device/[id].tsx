import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
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
  getDeviceStatusFromAPI,
  setDeviceStatusViaAPI,
  getLogsFromAPI,
  addLogToAPI,
  clearLogsFromAPI,
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
    pressure?: number;
    humidity?: number;
  };
  apiEndpoint?: string;
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
  const [apiLogs, setApiLogs] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);
  const [showApiEditModal, setShowApiEditModal] = useState(false);
  const [newApiEndpoint, setNewApiEndpoint] = useState("");
  const lastStatusCheckRef = useRef<number>(0);
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [sensorData, setSensorData] = useState<{
    temperature: number | null;
    humidity: number | null;
    pressure: number | null;
  }>({
    temperature: null,
    humidity: null,
    pressure: null,
  });

  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#000" : "#fff";
  const textColor = isDark ? "#fff" : "#000";
  const secondaryColor = isDark ? "#1a1a1a" : "#f0f0f0";
  const borderColor = isDark ? "#444" : "#ddd";
  const accentColor = isDark ? "#fff" : "#000";

  // Get screen dimensions for responsive design
  const { width, height } = Dimensions.get("window");

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

  console.log("device", device);
  console.log("apiEndpoint", device?.apiEndpoint);

  // Fetch logs from API
  const fetchApiLogs = async () => {
    try {
      const apiLogs = await getLogsFromAPI(device?.id);
      setApiLogs(apiLogs);
      console.log("API logs fetched:", apiLogs);

      // Parse sensor data from logs
      parseSensorDataFromLogs(apiLogs);
    } catch (error) {
      console.error("Error fetching API logs:", error);
    }
  };

  // Clear logs from API
  const handleClearLogs = async () => {
    if (!device) return;

    try {
      setIsClearingLogs(true);
      await clearLogsFromAPI(device.id);
      await fetchApiLogs(); // Refresh logs after clearing
      setIsClearingLogs(false);
    } catch (error) {
      console.error("Error clearing logs:", error);
      setIsClearingLogs(false);
    }
  };

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

    // Fetch API logs
    fetchApiLogs();

    return () => unsubscribe();
  }, [id]);

  const checkStatus = async (device: DeviceData) => {
    try {
      // Debounce: only check if at least 5 seconds have passed since last check
      const now = Date.now();

      lastStatusCheckRef.current = now;
      console.log("Checking device status from API...");
      const apiStatus = await getDeviceStatusFromAPI(device.id);
      console.log("API status:", apiStatus);

      const currentStatus = device.status === "online";
      console.log("Current UI status:", currentStatus);

      // Only update if there's a mismatch
      if (apiStatus !== currentStatus) {
        console.log("Status mismatch detected, updating Firestore...");
        console.log(
          `API status (${apiStatus}) !== UI status (${currentStatus})`
        );

        await updateDevice(device.id, {
          status: apiStatus ? "online" : "offline",
          lastSeen: new Date().toLocaleString(),
        });

        await addLog({
          deviceId: device.id,
          message: `Device status updated from API: ${
            apiStatus ? "online" : "offline"
          }`,
        });
        console.log("Firestore updated successfully");
      } else {
        console.log("Status in sync, no update needed");
        console.log(
          `API status (${apiStatus}) === UI status (${currentStatus})`
        );
      }
    } catch (error) {
      console.error("Error checking device status from API:", error);
    }
  };

  // Periodically check device status from API
  useEffect(() => {
    if (!device) return;

    // Check immediately
    checkStatus(device);

    // Then check every 30 seconds
    statusCheckIntervalRef.current = setInterval(
      () => checkStatus(device),
      30000
    );

    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);

  const handleSendCommand = async () => {
    if (!command.trim() || !device) return;

    try {
      setIsUpdating(true);

      // Add log entry to Firestore
      await addLog({
        deviceId: device.id,
        message: `Command sent: ${command}`,
      });

      // Add log to API
      await addLogToAPI(
        `Command sent to device ${device.name}: ${command}`,
        device.id
      );

      // Update device's lastSeen field
      await updateDevice(device.id, {
        lastSeen: new Date().toLocaleString(),
      });

      setCommand("");
      setIsUpdating(false);

      // Refresh API logs
      await fetchApiLogs();
    } catch (error) {
      console.error("Error sending command:", error);
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!device) return;

    try {
      setIsUpdating(true);

      // Get current status from API
      console.log("Fetching current status from API...");
      const currentStatus = await getDeviceStatusFromAPI(device.id);
      console.log("Current status from API:", currentStatus);

      // Toggle the status
      const newStatus = !currentStatus;
      console.log("New status to set:", newStatus);

      // Update status via API
      console.log("Sending status update to API...");
      const success = await setDeviceStatusViaAPI(newStatus, device.id);
      console.log("API response success:", success);

      if (success) {
        // Update device status in Firestore to keep UI in sync
        console.log("Updating Firestore with new status...");
        await updateDevice(device.id, {
          status: newStatus ? "online" : "offline",
          lastSeen: new Date().toLocaleString(),
        });

        // Add log entry about status change
        console.log("Adding log entry...");
        await addLog({
          deviceId: device.id,
          message: `Device status changed to ${
            newStatus ? "online" : "offline"
          } via API`,
        });

        // Add log to API
        await addLogToAPI(
          `Device ${device.name} status changed to ${
            newStatus ? "online" : "offline"
          }`,
          device.id
        );

        console.log("Status update completed successfully");
      } else {
        throw new Error("Failed to update device status via API");
      }

      await checkStatus(device);
      setIsUpdating(false);

      // Refresh API logs
      await fetchApiLogs();
    } catch (error) {
      console.error("Error updating device status:", error);
      setIsUpdating(false);

      // Show error to user (you might want to add a toast or alert here)
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Update API endpoint
  const handleUpdateApiEndpoint = async () => {
    if (!device) return;

    try {
      setIsUpdating(true);

      // Update device in Firestore
      await updateDevice(device.id, {
        apiEndpoint: newApiEndpoint,
        lastSeen: new Date().toLocaleString(),
      });

      // Add log entry
      await addLog({
        deviceId: device.id,
        message: `API endpoint updated: ${newApiEndpoint}`,
      });

      // Close modal
      setShowApiEditModal(false);
      setIsUpdating(false);
    } catch (error) {
      console.error("Error updating API endpoint:", error);
      setIsUpdating(false);
    }
  };

  // When device loads, initialize the new API endpoint field
  useEffect(() => {
    if (device && device.apiEndpoint) {
      setNewApiEndpoint(device.apiEndpoint);
    }
  }, [device]);

  // Extract sensor data from API logs
  const parseSensorDataFromLogs = (logs: string[]) => {
    if (!logs || logs.length === 0) return;

    // Find the most recent log entry with sensor data (contains "Temperature" and "Humidity")
    const sensorLogRegex =
      /Pressure\s+([\d.]+)\s+hPaTemperature\s+([\d.]+)\s+CHumidity\s+([\d.]+)/;

    for (const log of logs) {
      const match = log.match(sensorLogRegex);
      if (match) {
        const pressure = parseFloat(match[1]);
        const temperature = parseFloat(match[2]);
        const humidity = parseFloat(match[3]);

        console.log(
          `Parsed sensor data: Temperature: ${temperature}°C, Humidity: ${humidity}%, Pressure: ${pressure} hPa`
        );

        setSensorData({
          temperature,
          humidity,
          pressure,
        });

        // Update device metrics in state if needed
        if (device && device.metrics) {
          const updatedMetrics = {
            cpu: device.metrics.cpu || 0,
            memory: device.metrics.memory || 0,
            temperature,
            humidity,
            pressure,
          };

          setDevice({
            ...device,
            metrics: updatedMetrics,
          });
        }

        return;
      }
    }
  };

  // Process logs when received
  useEffect(() => {
    if (apiLogs && apiLogs.length > 0) {
      parseSensorDataFromLogs(apiLogs);
    }
  }, [apiLogs]);

  // Update periodic metrics refresh
  useEffect(() => {
    if (!device || !device.apiEndpoint) return;

    // Fetch logs immediately to get latest metrics
    fetchApiLogs();

    // Then fetch logs every 30 seconds to keep metrics updated
    const intervalId = setInterval(fetchApiLogs, 30000);

    return () => clearInterval(intervalId);
  }, [device]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />
          <ThemedText style={styles.loadingText}>
            Loading device details...
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
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
      </SafeAreaView>
    );
  }

  // Calculate metrics for display
  const metrics = {
    temperature: sensorData.temperature ?? device?.metrics?.temperature ?? 0,
    humidity: sensorData.humidity ?? 0,
    pressure: sensorData.pressure ?? 0,
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
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? "#1a1a1a" : "#ddd" },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="chevron.left" color={textColor} size={24} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{device.name}</ThemedText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleToggleStatus}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={textColor} />
            ) : (
              <IconSymbol
                name={device.status === "online" ? "wifi" : "wifi.slash"}
                size={22}
                color={textColor}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <ThemedView
          style={[
            styles.card,
            { backgroundColor: secondaryColor, borderColor },
          ]}
        >
          <View style={styles.infoHeader}>
            <ThemedText type="subtitle">Device Information</ThemedText>
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
          {device.apiEndpoint && (
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>API Endpoint:</ThemedText>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  maxWidth: "60%",
                }}
              >
                <ThemedText
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  style={{ flex: 1 }}
                >
                  {device.apiEndpoint}
                </ThemedText>
                <TouchableOpacity
                  style={{ marginLeft: 8 }}
                  onPress={() => setShowApiEditModal(true)}
                >
                  <IconSymbol name="pencil" size={16} color={textColor} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          {!device.apiEndpoint && (
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>API Endpoint:</ThemedText>
              <TouchableOpacity
                style={[styles.addApiButton, { backgroundColor: accentColor }]}
                onPress={() => setShowApiEditModal(true)}
              >
                <ThemedText
                  style={{ color: isDark ? "#000" : "#fff", fontSize: 12 }}
                >
                  Add
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: secondaryColor, borderColor },
          ]}
        >
          <View style={styles.infoHeader}>
            <ThemedText type="subtitle">Sensor Data</ThemedText>
            {device?.apiEndpoint && (
              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: accentColor }]}
                onPress={fetchApiLogs}
              >
                <ThemedText
                  style={{ color: isDark ? "#000" : "#fff", fontSize: 12 }}
                >
                  Refresh
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricValue}>
                {metrics.temperature !== null
                  ? metrics.temperature.toFixed(1)
                  : "N/A"}
                °C
              </ThemedText>
              <ThemedText style={styles.metricLabel}>Temperature</ThemedText>
            </View>
            {sensorData.humidity !== null && (
              <View style={styles.metricItem}>
                <ThemedText style={styles.metricValue}>
                  {metrics.humidity !== null
                    ? metrics.humidity.toFixed(1)
                    : "N/A"}
                  %
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Humidity</ThemedText>
              </View>
            )}
            {sensorData.pressure !== null && (
              <View style={styles.metricItem}>
                <ThemedText style={styles.metricValue}>
                  {metrics.pressure !== null
                    ? metrics.pressure.toFixed(1)
                    : "N/A"}{" "}
                  hPa
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Pressure</ThemedText>
              </View>
            )}
          </View>
          {!device.apiEndpoint && (
            <ThemedText
              style={{ textAlign: "center", marginTop: 10, opacity: 0.7 }}
            >
              No metrics API endpoint configured
            </ThemedText>
          )}
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
          <View style={styles.infoHeader}>
            <ThemedText type="subtitle">API Logs</ThemedText>
          </View>
          {apiLogs.length === 0 ? (
            <View style={styles.emptyLogsContainer}>
              <ThemedText style={styles.emptyText}>
                No API logs available
              </ThemedText>
            </View>
          ) : (
            apiLogs.map((log, index) => (
              <View key={index} style={[styles.logItem, { borderColor }]}>
                <ThemedText>{log}</ThemedText>
              </View>
            ))
          )}
        </ThemedView>
        <ThemedView
          style={[
            styles.card,
            { backgroundColor: secondaryColor, borderColor },
          ]}
        >
          <View style={styles.infoHeader}>
            <ThemedText type="subtitle">Device Logs</ThemedText>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: accentColor }]}
              onPress={handleClearLogs}
              disabled={isClearingLogs}
            >
              {isClearingLogs ? (
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#000" : "#fff"}
                />
              ) : (
                <ThemedText
                  style={{ color: isDark ? "#000" : "#fff", fontSize: 12 }}
                >
                  Clear Logs
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

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

      {/* API Endpoint Edit Modal */}
      <Modal
        visible={showApiEditModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowApiEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: secondaryColor, borderColor },
            ]}
          >
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
              {device.apiEndpoint ? "Edit API Endpoint" : "Add API Endpoint"}
            </ThemedText>

            <TextInput
              style={[
                styles.apiInput,
                { backgroundColor, color: textColor, borderColor },
              ]}
              placeholder="https://your-api-endpoint.com/metrics"
              placeholderTextColor={isDark ? "#888" : "#999"}
              value={newApiEndpoint}
              onChangeText={setNewApiEndpoint}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor,
                  },
                ]}
                onPress={() => setShowApiEditModal(false)}
              >
                <ThemedText>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: accentColor,
                    opacity: isUpdating ? 0.5 : 1,
                  },
                ]}
                onPress={handleUpdateApiEndpoint}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#000" : "#fff"}
                  />
                ) : (
                  <ThemedText style={{ color: isDark ? "#000" : "#fff" }}>
                    Save
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    width: "100%",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  backButton: {
    padding: 4,
    zIndex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32, // Add extra padding at the bottom for better scrolling
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    flexWrap: "wrap",
  },
  metricItem: {
    alignItems: "center",
    width: "30%",
    minWidth: 80,
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  commandInputContainer: {
    flexDirection: "row",
    marginTop: 8,
    width: "100%",
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
  clearButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addApiButton: {
    padding: 6,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "85%",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  apiInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
});
