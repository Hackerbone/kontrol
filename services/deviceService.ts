import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/config/firebase";

// Define types
export interface Device {
  id: string;
  name: string;
  status: "online" | "offline";
  type: string;
  ipAddress?: string;
  firmwareVersion?: string;
  lastSeen?: string;
  apiEndpoint?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metrics: {
    cpu: number;
    memory: number;
    temperature: number;
  };
}

export interface Log {
  id: string;
  deviceId: string;
  message: string;
  timestamp: Timestamp;
}

// Create new device
export const addDevice = async (
  device: Omit<Device, "id" | "createdAt" | "updatedAt">
) => {
  try {
    const deviceData = {
      ...device,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, "devices"), deviceData);
    return { id: docRef.id, ...deviceData };
  } catch (error) {
    console.error("Error adding device: ", error);
    throw error;
  }
};

// Get all devices
export const getDevices = async (): Promise<Device[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "devices"));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Device[];
  } catch (error) {
    console.error("Error getting devices: ", error);
    throw error;
  }
};

// Listen to devices in real-time
export const subscribeToDevices = (onUpdate: (devices: Device[]) => void) => {
  const q = query(collection(db, "devices"), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (querySnapshot) => {
      const devices = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Device[];

      onUpdate(devices);
    },
    (error) => {
      console.error("Error listening to devices: ", error);
    }
  );
};

// Update device
export const updateDevice = async (
  id: string,
  data: Partial<Omit<Device, "id" | "createdAt">>
) => {
  try {
    const deviceRef = doc(db, "devices", id);
    await updateDoc(deviceRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (error) {
    console.error("Error updating device: ", error);
    throw error;
  }
};

// Delete device
export const deleteDevice = async (id: string) => {
  try {
    await deleteDoc(doc(db, "devices", id));
    return true;
  } catch (error) {
    console.error("Error deleting device: ", error);
    throw error;
  }
};

// Add log entry
export const addLog = async (log: Omit<Log, "id" | "timestamp">) => {
  try {
    const logData = {
      ...log,
      timestamp: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, "logs"), logData);
    return { id: docRef.id, ...logData };
  } catch (error) {
    console.error("Error adding log: ", error);
    throw error;
  }
};

// Get logs for a device
export const getDeviceLogs = async (deviceId: string): Promise<Log[]> => {
  try {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          deviceId: data.deviceId,
          message: data.message,
          timestamp: data.timestamp,
        } as Log;
      })
      .filter((log) => log.deviceId === deviceId);
  } catch (error) {
    console.error("Error getting device logs: ", error);
    throw error;
  }
};

// Listen to logs for a device in real-time
export const subscribeToDeviceLogs = (
  deviceId: string,
  onUpdate: (logs: Log[]) => void
) => {
  const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));

  return onSnapshot(
    q,
    (querySnapshot) => {
      const logs = querySnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            deviceId: data.deviceId,
            message: data.message,
            timestamp: data.timestamp,
          } as Log;
        })
        .filter((log) => log.deviceId === deviceId);

      onUpdate(logs);
    },
    (error) => {
      console.error("Error listening to device logs: ", error);
    }
  );
};

// Get device status from API
export const getDeviceStatusFromAPI = async (
  deviceId?: string
): Promise<boolean> => {
  try {
    let apiUrl = "https://nikillan-api.vercel.app/GetStatusJSON";

    // If deviceId is provided, try to get the device's API endpoint
    if (deviceId) {
      try {
        const devices = await getDevices();
        const device = devices.find((d) => d.id === deviceId);
        if (device && device.apiEndpoint) {
          apiUrl = `${device.apiEndpoint}/GetStatusJSON`;
          console.log(`Using device's API endpoint: ${apiUrl}`);
        }
      } catch (error) {
        console.error("Error fetching device for API endpoint:", error);
        // Continue with default URL
      }
    }

    const response = await fetch(apiUrl, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Check content type to determine how to parse the response
    const contentType = response.headers.get("content-type");
    let status = false;

    if (contentType && contentType.includes("application/json")) {
      // Parse as JSON
      const data = await response.json();
      console.log("API JSON response:", JSON.stringify(data));
      console.log(data);
      console.log(data.msg);

      // Check if msg property exists and is a boolean
      if (data.msg !== undefined) {
        status = data.msg;
      } else {
        console.warn(
          "API response doesn't contain expected status field:",
          data
        );
        status = false;
      }
    } else {
      // Parse as text and check for specific strings
      const text = await response.text();
      console.log("API text response:", text);

      // Check if the text contains "true" or "1" (case insensitive)
      status = /true|1/i.test(text);
    }

    console.log("Parsed status value:", status);
    return status;
  } catch (error) {
    console.error("Error getting device status from API: ", error);
    throw error;
  }
};

// Set device status via API
export const setDeviceStatusViaAPI = async (
  status: boolean,
  deviceId?: string
): Promise<boolean> => {
  try {
    console.log(`Setting device status to ${status} via API...`);

    let apiUrl = `https://nikillan-api.vercel.app/SetStatus/${status}`;

    // If deviceId is provided, try to get the device's API endpoint
    if (deviceId) {
      try {
        const devices = await getDevices();
        const device = devices.find((d) => d.id === deviceId);
        if (device && device.apiEndpoint) {
          apiUrl = `${device.apiEndpoint}/SetStatus/${status}`;
          console.log(`Using device's API endpoint: ${apiUrl}`);
        }
      } catch (error) {
        console.error("Error fetching device for API endpoint:", error);
        // Continue with default URL
      }
    }

    const response = await fetch(apiUrl, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Check content type to determine how to parse the response
    let success = true;

    console.log("API call success:", success);
    return success;
  } catch (error) {
    console.error("Error setting device status via API: ", error);
    throw error;
  }
};

// Get logs from API
export const getLogsFromAPI = async (deviceId?: string): Promise<string[]> => {
  try {
    console.log("Fetching logs from API...");

    let apiUrl = "https://nikillan-api.vercel.app/getLogs";

    // If deviceId is provided, try to get the device's API endpoint
    if (deviceId) {
      try {
        const devices = await getDevices();
        const device = devices.find((d) => d.id === deviceId);
        if (device && device.apiEndpoint) {
          apiUrl = `${device.apiEndpoint}/getLogs`;
          console.log(`Using device's API endpoint: ${apiUrl}`);
        }
      } catch (error) {
        console.error("Error fetching device for API endpoint:", error);
        // Continue with default URL
      }
    }

    const response = await fetch(apiUrl, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("API logs response:", JSON.stringify(data));

    // Return the logs array if it exists, otherwise return an empty array
    if (data.log) {
      return data.log;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error getting logs from API: ", error);
    throw error;
  }
};

// Add a log to the API
export const addLogToAPI = async (
  message: string,
  deviceId?: string
): Promise<boolean> => {
  try {
    console.log(`Adding log to API: ${message}`);
    // Encode the message for URL safety
    const encodedMessage = encodeURIComponent(message);

    let apiUrl = `https://nikillan-api.vercel.app/addLog/${encodedMessage}`;

    // If deviceId is provided, try to get the device's API endpoint
    if (deviceId) {
      try {
        const devices = await getDevices();
        const device = devices.find((d) => d.id === deviceId);
        if (device && device.apiEndpoint) {
          apiUrl = `${device.apiEndpoint}/addLog/${encodedMessage}`;
          console.log(`Using device's API endpoint: ${apiUrl}`);
        }
      } catch (error) {
        console.error("Error fetching device for API endpoint:", error);
        // Continue with default URL
      }
    }

    const response = await fetch(apiUrl, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    console.log("Log added successfully to API");
    return true;
  } catch (error) {
    console.error("Error adding log to API: ", error);
    throw error;
  }
};

// Clear logs from API
export const clearLogsFromAPI = async (deviceId?: string): Promise<boolean> => {
  try {
    console.log("Clearing logs from API...");

    let apiUrl = "https://nikillan-api.vercel.app/ClearLogs";

    // If deviceId is provided, try to get the device's API endpoint
    if (deviceId) {
      try {
        const devices = await getDevices();
        const device = devices.find((d) => d.id === deviceId);
        if (device && device.apiEndpoint) {
          apiUrl = `${device.apiEndpoint}/ClearLogs`;
          console.log(`Using device's API endpoint: ${apiUrl}`);
        }
      } catch (error) {
        console.error("Error fetching device for API endpoint:", error);
        // Continue with default URL
      }
    }

    const response = await fetch(apiUrl, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    console.log("Logs cleared successfully from API");
    return true;
  } catch (error) {
    console.error("Error clearing logs from API: ", error);
    throw error;
  }
};

// Fetch metrics from a device's API endpoint
export const fetchDeviceMetrics = async (apiEndpoint: string): Promise<any> => {
  try {
    console.log(`Fetching metrics from API endpoint: ${apiEndpoint}`);
    const response = await fetch(apiEndpoint, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Try to parse as JSON first
    try {
      const data = await response.json();
      console.log("API metrics response:", JSON.stringify(data));
      return data;
    } catch (e) {
      // If JSON parsing fails, try text
      const text = await response.text();
      console.log("API metrics text response:", text);
      return { text };
    }
  } catch (error) {
    console.error("Error fetching metrics from API endpoint:", error);
    throw error;
  }
};

// Update device metrics with data from API
export const updateDeviceMetrics = async (
  deviceId: string
): Promise<boolean> => {
  try {
    // First, get the device to get its API endpoint
    const devices = await getDevices();
    const device = devices.find((d) => d.id === deviceId);

    if (!device || !device.apiEndpoint) {
      console.log(`Device ${deviceId} has no API endpoint configured`);
      return false;
    }

    // Fetch metrics from the device's API endpoint
    const metricsData = await fetchDeviceMetrics(device.apiEndpoint);

    // Extract metrics from the response
    let metrics = {
      cpu: 0,
      memory: 0,
      temperature: 0,
    };

    // Try to extract metrics values from the response
    if (metricsData.cpu !== undefined) {
      metrics.cpu = Number(metricsData.cpu);
    }

    if (metricsData.memory !== undefined) {
      metrics.memory = Number(metricsData.memory);
    }

    if (metricsData.temperature !== undefined) {
      metrics.temperature = Number(metricsData.temperature);
    }

    // Update the device with the new metrics
    await updateDevice(deviceId, {
      metrics,
      lastSeen: new Date().toLocaleString(),
    });

    // Add a log entry
    await addLog({
      deviceId,
      message: `Metrics updated: CPU: ${metrics.cpu}%, Memory: ${metrics.memory}%, Temp: ${metrics.temperature}°C`,
    });

    return true;
  } catch (error) {
    console.error("Error updating device metrics:", error);
    return false;
  }
};
