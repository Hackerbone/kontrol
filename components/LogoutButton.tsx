import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { logoutUser } from "../services/authService";

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      const { error } = await logoutUser();
      if (!error) {
        router.replace("/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleLogout}>
      <Text style={styles.buttonText}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
