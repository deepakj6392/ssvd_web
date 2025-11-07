// Shared types and utilities for the Connect ecosystem

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Session {
  id: string;
  name: string;
  hostId: string;
  participants: string[];
  createdAt: Date;
  isActive: boolean;
}

export interface Message {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  timestamp: Date;
}

export interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate";
  sessionId: string;
  fromUserId: string;
  toUserId: string;
  data: any;
}

export const API_ENDPOINTS = {
  USERS: "/api/users",
  AUTH: "/api/auth",
  SESSIONS: "/api/sessions",
  SIGNALING: "/api/signaling",
} as const;

export function createApiResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

export function createErrorResponse(error: string): ApiResponse<never> {
  return {
    success: false,
    error,
  };
}
