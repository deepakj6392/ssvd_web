'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, setToken, removeToken } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => isAuthenticated());
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const login = (token: string) => {
    setToken(token);
    setIsLoggedIn(true);
    // TODO: Decode JWT to get user info
    // For now, we'll set a placeholder user
    setUser({ id: '1', email: 'user@example.com', name: 'User' });
    router.push('/');
  };

  const logout = () => {
    removeToken();
    setIsLoggedIn(false);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
