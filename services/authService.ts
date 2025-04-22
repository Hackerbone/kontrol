import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  getAuth,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import the Firebase config
import { firebaseConfig } from "../config/firebase";

// Initialize Firebase if not already initialized
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Custom persistence keys
const AUTH_USER_KEY = "@auth_user";

// Custom persistence functions
export const saveUserToStorage = async (user: User | null) => {
  try {
    if (user) {
      // Store essential user data
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
      };
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    } else {
      // Clear user data on logout
      await AsyncStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (error) {
    console.error("Error saving user to storage:", error);
  }
};

export const getUserFromStorage = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (userData) {
      // Return the stored user data
      return JSON.parse(userData) as User;
    }
    return null;
  } catch (error) {
    console.error("Error getting user from storage:", error);
    return null;
  }
};

// Set up auth state listener to save user to storage
onAuthStateChanged(auth, (user) => {
  saveUserToStorage(user);
});

// Register a new user
export const registerUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

// Login a user
export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

// Logout a user
export const logoutUser = async () => {
  try {
    await signOut(auth);
    // Clear stored user data
    await saveUserToStorage(null);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Subscribe to auth state changes
export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};
