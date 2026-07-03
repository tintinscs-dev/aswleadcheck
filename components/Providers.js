'use client';
import { SessionProvider } from 'next-auth/react';
import { LangProvider } from './LangContext';

export default function Providers({ children, session }) {
  return (
    <SessionProvider session={session}>
      <LangProvider>{children}</LangProvider>
    </SessionProvider>
  );
}
