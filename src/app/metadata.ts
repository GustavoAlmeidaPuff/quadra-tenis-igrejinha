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
  title: "QuadraLivre — Reservas e agenda para quadras de tênis",
  description:
    "Reserve horários, organize partidas e acompanhe a agenda em várias quadras de tênis num só lugar.",
  manifest: "/manifest.json",
};
