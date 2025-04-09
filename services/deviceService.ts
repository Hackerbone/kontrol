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
