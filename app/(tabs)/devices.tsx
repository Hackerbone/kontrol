import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  View,
  Dimensions,
  Animated,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useColorScheme } from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useRouter } from "expo-router";
import { Timestamp } from "firebase/firestore";
import {
  Device,
  Log,
  addDevice,
  subscribeToDevices,
  addLog,
  subscribeToDeviceLogs,
} from "@/services/deviceService";
import { SafeAreaView } from "react-native-safe-area-context"; // or from "react-native" if you're not using safe-area-context

// Default device images
const deviceImages = {
  Sensor: require("@/assets/images/partial-react-logo.png"),
  Controller: require("@/assets/images/partial-react-logo.png"),
  Camera: require("@/assets/images/partial-react-logo.png"),
  Gateway: require("@/assets/images/partial-react-logo.png"),
};

const DEVICE_TYPES = ["Sensor", "Controller", "Camera", "Gateway"];
const { width, height } = Dimensions.get("window");

export default function DevicesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [carouselMode, setCarouselMode] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);
  const [newDevice, setNewDevice] = useState<Partial<Device>>({
    name: "",
    type: "Sensor",
    status: "offline",
  });
  const [loading, setLoading] = useState(true);

  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#000" : "#fff";
  const textColor = isDark ? "#fff" : "#000";
  const secondaryColor = isDark ? "#1a1a1a" : "#f0f0f0";
  const borderColor = isDark ? "#444" : "#ddd";
  const accentColor = isDark ? "#fff" : "#000";

  // Subscribe to devices from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToDevices((updatedDevices) => {
      setDevices(updatedDevices);
      setLoading(false);

      // If we've just loaded devices, set the first one as selected
      if (updatedDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(updatedDevices[0].id);
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to logs for the selected device
  useEffect(() => {
    if (!selectedDevice) return;

    const unsubscribe = subscribeToDeviceLogs(selectedDevice, (updatedLogs) => {
      setLogs(updatedLogs);
    });

    return () => unsubscribe();
  }, [selectedDevice]);

  const handleSendCommand = async () => {
    if (!command.trim() || !selectedDevice) return;

    try {
      // Add log entry to Firestore
      await addLog({
        deviceId: selectedDevice,
        message: `Command sent: ${command}`,
      });

      setCommand("");
    } catch (error) {
      console.error("Error sending command:", error);
    }
  };

  const handleDevicePress = (deviceId: string) => {
    setSelectedDevice(deviceId);
    router.push(`/device/${deviceId}`);
  };

  const handleAddDevice = async () => {
    if (!newDevice.name) return;

    try {
      setLoading(true);

      await addDevice({
        name: newDevice.name,
        status: newDevice.status as "online" | "offline",
        type: newDevice.type || "Sensor",
      });

      setNewDevice({ name: "", type: "Sensor", status: "offline" });
      setModalVisible(false);
    } catch (error) {
      console.error("Error adding device:", error);
    }
  };

  const renderDeviceItem = ({ item }: { item: Device }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        {
          backgroundColor: secondaryColor,
          borderColor,
        },
        selectedDevice === item.id && {
          borderColor: accentColor,
          borderWidth: 2,
        },
      ]}
      onPress={() => handleDevicePress(item.id)}
    >
      <View style={styles.deviceHeader}>
        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
        <View
          style={[
            styles.statusIndicator,
            {
              backgroundColor: item.status === "online" ? "#4CAF50" : "#F44336",
            },
          ]}
        />
      </View>
      <ThemedText style={styles.deviceType}>{item.type}</ThemedText>
      <ThemedText style={styles.lastSeen}>
        {item.lastSeen
          ? item.lastSeen
          : item.updatedAt
          ? new Date(item.updatedAt.toDate()).toLocaleString()
          : "Never"}
      </ThemedText>
    </TouchableOpacity>
  );

  const renderLogItem = ({ item }: { item: Log }) => (
    <View
      style={[styles.logItem, { backgroundColor: secondaryColor, borderColor }]}
    >
      <ThemedText style={styles.logTimestamp}>
        {item.timestamp instanceof Timestamp
          ? new Date(item.timestamp.toDate()).toLocaleString()
          : item.timestamp}
      </ThemedText>
      <ThemedText>{item.message}</ThemedText>
    </View>
  );

  const renderCarouselItem = ({
    item,
    index,
  }: {
    item: Device;
    index: number;
  }) => {
    const deviceImage =
      deviceImages[item.type as keyof typeof deviceImages] ||
      deviceImages.Sensor;

    return (
      <View style={styles.carouselItemContainer}>
        <View
          style={[
            styles.carouselCard,
            {
              backgroundColor: secondaryColor,
              borderColor: item.status === "online" ? "#4CAF50" : "#F44336",
            },
          ]}
        >
          <View style={styles.imageContainer}>
            <Image source={deviceImage} style={styles.deviceImage} />
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.status === "online" ? "#4CAF50" : "#F44336",
                },
              ]}
            >
              <ThemedText style={styles.statusText}>{item.status}</ThemedText>
            </View>
          </View>

          <View style={styles.carouselCardContent}>
            <ThemedText type="title" style={styles.deviceName}>
              {item.name}
            </ThemedText>
            <ThemedText style={styles.deviceTypeLabel}>{item.type}</ThemedText>

            {item.lastSeen && (
              <ThemedText style={styles.lastSeenText}>
                Last seen: {item.lastSeen}
              </ThemedText>
            )}

            <View style={styles.carouselActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: accentColor }]}
                onPress={() => handleDevicePress(item.id)}
              >
                <ThemedText
                  style={[
                    styles.actionButtonText,
                    { color: isDark ? "#000" : "#fff" },
                  ]}
                >
                  View Details
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: accentColor,
                  },
                ]}
                onPress={() => {
                  setSelectedDevice(item.id);
                  setCarouselMode(false);
                }}
              >
                <ThemedText style={styles.actionButtonText}>
                  Send Command
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.pagination}>
        {devices.map((_, index) => {
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 16, 8],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor: isDark ? "#fff" : "#000",
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  if (loading && devices.length === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={textColor} />
          <ThemedText style={{ marginTop: 20 }}>Loading devices...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <ThemedView style={[styles.container, { backgroundColor }]}>
        {carouselMode ? (
          // Carousel View
          <View style={styles.carouselContainer}>
            <View style={styles.carouselHeader}>
              <TouchableOpacity onPress={() => setCarouselMode(false)}>
                <IconSymbol name="list.bullet" color={textColor} size={24} />
              </TouchableOpacity>
              <ThemedText type="title">All Devices</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(true)}>
                <IconSymbol name="plus.circle" color={textColor} size={24} />
              </TouchableOpacity>
            </View>

            {devices.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <ThemedText style={styles.emptyStateText}>
                  No devices found
                </ThemedText>
                <TouchableOpacity
                  style={[
                    styles.addDeviceButton,
                    { backgroundColor: accentColor },
                  ]}
                  onPress={() => setModalVisible(true)}
                >
                  <ThemedText
                    style={[
                      styles.addDeviceButtonText,
                      { color: isDark ? "#000" : "#fff" },
                    ]}
                  >
                    Add Your First Device
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Animated.FlatList
                  data={devices}
                  keyExtractor={(item) => item.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  renderItem={renderCarouselItem}
                  onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                  )}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(
                      event.nativeEvent.contentOffset.x / width
                    );
                    setCurrentIndex(index);
                    setSelectedDevice(devices[index]?.id || null);
                  }}
                  contentContainerStyle={styles.carouselList}
                />

                {renderPagination()}
              </>
            )}
          </View>
        ) : (
          // List View
          <>
            <ThemedView style={styles.header}>
              <ThemedText type="title">Device Manager</ThemedText>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setCarouselMode(true)}
                >
                  <IconSymbol name="list.bullet" color={textColor} size={24} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setModalVisible(true)}
                >
                  <IconSymbol name="plus.circle" color={textColor} size={24} />
                </TouchableOpacity>
              </View>
            </ThemedView>

            <ThemedView style={styles.content}>
              <ThemedView style={styles.devicesSection}>
                <ThemedText type="subtitle">Devices</ThemedText>
                {devices.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <ThemedText style={styles.emptyStateText}>
                      No devices found
                    </ThemedText>
                    <TouchableOpacity
                      style={[
                        styles.addDeviceButton,
                        { backgroundColor: accentColor },
                      ]}
                      onPress={() => setModalVisible(true)}
                    >
                      <ThemedText
                        style={[
                          styles.addDeviceButtonText,
                          { color: isDark ? "#000" : "#fff" },
                        ]}
                      >
                        Add Your First Device
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={devices}
                    renderItem={renderDeviceItem}
                    keyExtractor={(item) => item.id}
                    style={styles.deviceList}
                  />
                )}
              </ThemedView>
            </ThemedView>
          </>
        )}

        {/* Add Device Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: secondaryColor,
                  borderColor,
                },
              ]}
            >
              <ThemedText type="title" style={styles.modalTitle}>
                Add New Device
              </ThemedText>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Device Name</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor, color: textColor, borderColor },
                  ]}
                  placeholder="Enter device name"
                  placeholderTextColor={isDark ? "#888" : "#999"}
                  value={newDevice.name}
                  onChangeText={(text) =>
                    setNewDevice({ ...newDevice, name: text })
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Device Type</ThemedText>
                <View style={styles.typeSelector}>
                  {DEVICE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeOption,
                        {
                          backgroundColor:
                            newDevice.type === type
                              ? accentColor
                              : "transparent",
                          borderColor: accentColor,
                        },
                      ]}
                      onPress={() => setNewDevice({ ...newDevice, type })}
                    >
                      <ThemedText
                        style={[
                          styles.typeOptionText,
                          newDevice.type === type && {
                            color: isDark ? "#000" : "#fff",
                          },
                        ]}
                      >
                        {type}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Status</ThemedText>
                <View style={styles.statusSelector}>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor:
                          newDevice.status === "online"
                            ? "#4CAF50"
                            : "transparent",
                        borderColor: "#4CAF50",
                      },
                    ]}
                    onPress={() =>
                      setNewDevice({ ...newDevice, status: "online" })
                    }
                  >
                    <ThemedText
                      style={[
                        styles.statusOptionText,
                        newDevice.status === "online" && { color: "#fff" },
                      ]}
                    >
                      Online
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor:
                          newDevice.status === "offline"
                            ? "#F44336"
                            : "transparent",
                        borderColor: "#F44336",
                      },
                    ]}
                    onPress={() =>
                      setNewDevice({ ...newDevice, status: "offline" })
                    }
                  >
                    <ThemedText
                      style={[
                        styles.statusOptionText,
                        newDevice.status === "offline" && { color: "#fff" },
                      ]}
                    >
                      Offline
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

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
                  onPress={() => setModalVisible(false)}
                >
                  <ThemedText>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: accentColor,
                      opacity: !newDevice.name ? 0.5 : 1,
                    },
                  ]}
                  disabled={!newDevice.name}
                  onPress={handleAddDevice}
                >
                  <ThemedText
                    style={[
                      styles.modalButtonText,
                      { color: isDark ? "#000" : "#fff" },
                    ]}
                  >
                    Add Device
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
  },
  iconButton: {
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  devicesSection: {
    marginBottom: 16,
  },
  deviceList: {
    marginTop: 16,
  },
  deviceItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 12,
    opacity: 0.7,
  },
  lastSeen: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.5,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sendButton: {
    padding: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    fontWeight: "bold",
  },
  logItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  logTimestamp: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  carouselContainer: {
    flex: 1,
  },
  carouselHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  carouselList: {
    alignItems: "center",
  },
  carouselItemContainer: {
    width,
    height: height * 0.7,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  carouselCard: {
    height: height * 0.6,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
  },
  imageContainer: {
    height: "50%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  deviceImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  statusBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: "#fff",
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  carouselCardContent: {
    padding: 20,
  },
  deviceName: {
    marginBottom: 4,
  },
  deviceTypeLabel: {
    fontSize: 16,
    marginBottom: 16,
  },
  lastSeenText: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 16,
  },
  carouselActions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    padding: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    fontWeight: "bold",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: 50,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "85%",
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    marginBottom: 24,
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontWeight: "bold",
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  typeOptionText: {
    fontWeight: "500",
  },
  statusSelector: {
    flexDirection: "row",
    marginTop: 8,
    gap: 12,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  statusOptionText: {
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  modalButtonText: {
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    marginBottom: 20,
    opacity: 0.7,
  },
  addDeviceButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
    maxWidth: 300,
  },
  addDeviceButtonText: {
    fontWeight: "bold",
  },
});
