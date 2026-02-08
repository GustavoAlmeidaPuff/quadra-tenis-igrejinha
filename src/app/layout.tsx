import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#10b981',
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teniscreas.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Quadra de Tênis - Igrejinha",
  description: "Agenda comunitária da quadra de tênis em Igrejinha, RS",
  manifest: "/manifest.json",
  icons: {
    icon: "/images/logo-white.svg",
    apple: "/images/logo-white.svg",
  },
  openGraph: {
    title: "Quadra de Tênis - Igrejinha",
    description: "Agenda comunitária da quadra de tênis em Igrejinha, RS",
    url: siteUrl,
    siteName: "Quadra de Tênis - Igrejinha",
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
    title: "Quadra de Tênis - Igrejinha",
    description: "Agenda comunitária da quadra de tênis em Igrejinha, RS",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
