import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaveBites",
  description: "Half-off surplus meals near you. Pickup only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-foreground bg-background">
        {children}
      </body>
    </html>
  );
}
