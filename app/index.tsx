import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const { isAuthenticated } = useAuth();

  // If authenticated, redirect to devices page
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/devices" />;
  }

  // Otherwise, redirect to login page
  return <Redirect href="/login" />;
}
