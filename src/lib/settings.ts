export interface UserProfile {
  name: string;
  email: string;
  bio: string;
  photoUrl: string;
}

export interface UserPreferences {
  audioEnabled: boolean;
  videoEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  screenShareQuality: 'low' | 'medium' | 'high';
  profile: UserProfile;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  audioEnabled: true,
  videoEnabled: true,
  theme: 'system',
  notificationsEnabled: true,
  screenShareQuality: 'medium',
  profile: {
    name: '',
    email: '',
    bio: '',
    photoUrl: '',
  },
};

const STORAGE_KEY = 'connect-user-preferences';

export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (error) {
    console.error('Error loading user preferences:', error);
  }

  return DEFAULT_PREFERENCES;
}

export function saveUserPreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving user preferences:', error);
  }
}

export function updateUserPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): void {
  const current = getUserPreferences();
  const updated = { ...current, [key]: value };
  saveUserPreferences(updated);
}
