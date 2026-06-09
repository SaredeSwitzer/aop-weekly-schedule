import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AOP Shala NYC — Weekly Schedule",
  description: "Yoga class schedule and signups for AOP Shala NYC",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AOP Shala",
  },
  icons: {
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "AOP Shala NYC — Weekly Schedule",
    description: "Yoga class schedule and signups for AOP Shala NYC",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "AOP Shala NYC" }],
  },
  twitter: {
    card: "summary",
    title: "AOP Shala NYC — Weekly Schedule",
    description: "Yoga class schedule and signups for AOP Shala NYC",
    images: ["/icon-512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${dmSans.variable} ${dmSerifDisplay.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
