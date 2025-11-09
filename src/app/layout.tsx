import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ApolloProviderWrapper from "@/components/ApolloProviderWrapper";
import { AuthProvider } from "@/components/AuthProvider";
import ConnectionStatus from "@/components/ConnectionStatus";
import Header from "@/components/Header";
import "./globals.css";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Connect Web App",
  description: "Cross-platform application ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ApolloProviderWrapper>
          <AuthProvider>
            <Suspense>
            <Header />
            {children}
            <ConnectionStatus />
            </Suspense>
          </AuthProvider>
        </ApolloProviderWrapper>
      </body>
    </html>
  );
}
