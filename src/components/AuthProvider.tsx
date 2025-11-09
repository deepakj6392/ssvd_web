'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, setToken, removeToken, getToken } from '@/lib/auth';
import {jwtDecode} from 'jwt-decode';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface JwtPayload {
  sub: string;
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
  const [user, setUser] = useState<User | null>(() => {
    // Initialize user state if authenticated
    if (isAuthenticated()) {
      const token = getToken();
      if (token) {
        try {
          const decoded: JwtPayload = jwtDecode(token);
          return {
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
          };
        } catch (error) {
          console.error('Failed to decode JWT token:', error);
          return null;
        }
      }
    }
    return null;
  });
  const router = useRouter();

  const login = (token: string) => {
    setToken(token);
    setIsLoggedIn(true);
    try {
      const decoded: JwtPayload = jwtDecode(token);
      setUser({
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
      });
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      setUser(null);
    }
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
