import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = {
  title: 'RoboScope Lite — Robot telemetry & incident replay',
  description: 'Replay robot failures. Understand what went wrong. A deterministic robot telemetry, fault detection, and incident replay playground.',
};
export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="en"><body><SessionProvider><Shell>{children}</Shell></SessionProvider></body></html>;
}
