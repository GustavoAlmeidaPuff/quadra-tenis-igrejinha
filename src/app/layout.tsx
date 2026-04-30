import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#10b981',
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teniscreas.vercel.app";

const siteTitle = "QuadraLivre — Tennis court bookings and schedule";
const siteDescription =
  "Book slots, organize matches, and follow the schedule across multiple tennis courts in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | QuadraLivre",
  },
  description: siteDescription,
  keywords: [
    "tennis",
    "tennis court",
    "court booking",
    "schedule",
    "QuadraLivre",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/images/logo-white.svg",
    apple: "/images/logo-white.svg",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "QuadraLivre",
    images: [
      {
        url: new URL("/images/Ad-og.jpg", siteUrl).href,
        width: 1200,
        height: 630,
        alt: "Faça sua reserva, Eleve seu nível, Desafie todos!",
      },
    ],
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [new URL("/images/Ad-og.jpg", siteUrl).href],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
