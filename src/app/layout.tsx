import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { GlobalConfirmModal } from "@/components/ui/confirm-modal";
import { SWRProvider } from "@/providers/swr-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Faction Digital Ecosystem | Admin CRM",
  description: "Administrative CRM for Faction Digital educational ecosystem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased overflow-hidden`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SWRProvider>
            {children}
            <Toaster position="bottom-right" richColors theme="system" />
            <GlobalConfirmModal />
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
