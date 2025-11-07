'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, router]);

  if (!isLoggedIn) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
};
