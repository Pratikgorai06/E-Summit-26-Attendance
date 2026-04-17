import type { Metadata } from "next";
import "./globals.css"; // Global styles
import { AuthProvider } from "@/hooks/use-auth";

export const metadata: Metadata = {
  title: "E-Summit 26 Attendance",
  description: "E-Summit 26 Attendance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
