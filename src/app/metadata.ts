import { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#10b981',
};

export const metadata: Metadata = {
  title: "Quadra de Tênis - Igrejinha",
  description: "Agenda comunitária da quadra de tênis em Igrejinha, RS",
  manifest: "/manifest.json",
};
