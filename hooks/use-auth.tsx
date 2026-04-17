"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signInAnonymously } from "firebase/auth";
import { auth } from "@/firebase";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (passcode: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (passcode: string): Promise<{ success: boolean; error?: string }> => {
    if (passcode === process.env.NEXT_PUBLIC_PASSCODE) {
      try {
        await signInAnonymously(auth);
        return { success: true };
      } catch (error: any) {
        console.error("Auth failed:", error);
        if (error.code === "auth/admin-restricted-operation") {
          return { 
            success: false, 
            error: "Authentication service restricted. Please enable Anonymous Auth in Firebase Console." 
          };
        }
        return { success: false, error: error.message || "Authentication failed" };
      }
    }
    return { success: false, error: "Invalid passcode" };
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
