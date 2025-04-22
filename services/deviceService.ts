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
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
export const getDeviceStatusFromAPI = async (): Promise<boolean> => {
  try {
    const response = await fetch("https://nikillan-api.vercel.app/GetStatusJSON", {
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
      console.log(data)
      console.log(data.msg);

      // Check if msg property exists and is a boolean
      if (data.msg !== undefined) {
        status = data.msg;
      } else {
        console.warn("API response doesn't contain expected status field:", data);
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
export const setDeviceStatusViaAPI = async (status: boolean): Promise<boolean> => {
  try {
    console.log(`Setting device status to ${status} via API...`);
    const response = await fetch(`https://nikillan-api.vercel.app/SetStatus/${status}`, {
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
export const getLogsFromAPI = async (): Promise<string[]> => {
  try {
    console.log("Fetching logs from API...");
    const response = await fetch("https://nikillan-api.vercel.app/getLogs", {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("API logs response:", JSON.stringify(data));
    
    // Return the logs array if it exists, otherwise return an empty array
    return Array.isArray(data.logs) ? data.logs : [];
  } catch (error) {
    console.error("Error getting logs from API: ", error);
    throw error;
  }
};

// Add a log to the API
export const addLogToAPI = async (message: string): Promise<boolean> => {
  try {
    console.log(`Adding log to API: ${message}`);
    // Encode the message for URL safety
    const encodedMessage = encodeURIComponent(message);
    
    const response = await fetch(`https://nikillan-api.vercel.app/addLog/${encodedMessage}`, {
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
export const clearLogsFromAPI = async (): Promise<boolean> => {
  try {
    console.log("Clearing logs from API...");
    const response = await fetch("https://nikillan-api.vercel.app/ClearLogs", {
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
