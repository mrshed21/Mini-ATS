import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ImpersonationProvider } from '@/lib/contexts/impersonation-context'
import AuthGuard from '@/components/auth-guard'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mini ATS",
  description: "A simple applicant tracking system built with Next.js and Supabase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <ImpersonationProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </ImpersonationProvider>
      </body>
    </html>
  );
}
