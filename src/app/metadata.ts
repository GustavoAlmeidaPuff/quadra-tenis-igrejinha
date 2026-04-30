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
  title: "QuadraLivre — Tennis court bookings and schedule",
  description:
    "Book slots, organize matches, and follow the schedule across multiple tennis courts in one place.",
  manifest: "/manifest.json",
};
