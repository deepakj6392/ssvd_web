'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings, Save, RotateCcw, User, Camera } from 'lucide-react';
import { getUserPreferences, saveUserPreferences, DEFAULT_PREFERENCES, type UserPreferences, type UserProfile } from '@/lib/settings';
import { useAuth } from '@/components/AuthProvider';

function SettingsContent() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(() => getUserPreferences());
  const [hasChanges, setHasChanges] = useState(false);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateProfile = <K extends keyof UserProfile>(
    key: K,
    value: UserProfile[K]
  ) => {
    setPreferences(prev => ({
      ...prev,
      profile: { ...prev.profile, [key]: value }
    }));
    setHasChanges(true);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoUrl = e.target?.result as string;
        updateProfile('photoUrl', photoUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    saveUserPreferences(preferences);
    setHasChanges(false);
  };

  const handleReset = () => {
    setPreferences(DEFAULT_PREFERENCES);
    saveUserPreferences(DEFAULT_PREFERENCES);
    setHasChanges(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Settings className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your collaboration experience and preferences.
          </p>
        </div>

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your personal information and profile details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Photo */}
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                  {preferences.profile.photoUrl ? (
                    <img
                      src={preferences.profile.photoUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    preferences.profile.name.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <label htmlFor="photo-upload" className="absolute -bottom-2 -right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer transition-colors">
                  <Camera className="h-4 w-4" />
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {preferences.profile.name || user?.name || 'Your Name'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {preferences.profile.email || user?.email || 'your.email@example.com'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Profile Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  placeholder="Enter your full name"
                  value={preferences.profile.name}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email Address</Label>
                <Input
                  id="profile-email"
                  type="email"
                  placeholder="Enter your email"
                  value={preferences.profile.email}
                  onChange={(e) => updateProfile('email', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea
                id="profile-bio"
                placeholder="Tell us about yourself..."
                value={preferences.profile.bio}
                onChange={(e) => updateProfile('bio', e.target.value)}
                className="min-h-[100px] resize-none"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Settings Cards */}
        <div className="space-y-6">
          {/* Audio & Video Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Audio & Video</CardTitle>
              <CardDescription>
                Configure your default audio and video settings for collaboration sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="audio-enabled">Enable Audio by Default</Label>
                  <p className="text-sm text-gray-500">
                    Automatically enable microphone when joining sessions
                  </p>
                </div>
                <Switch
                  id="audio-enabled"
                  checked={preferences.audioEnabled}
                  onCheckedChange={(checked) => updatePreference('audioEnabled', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="video-enabled">Enable Video by Default</Label>
                  <p className="text-sm text-gray-500">
                    Automatically enable camera when joining sessions
                  </p>
                </div>
                <Switch
                  id="video-enabled"
                  checked={preferences.videoEnabled}
                  onCheckedChange={(checked) => updatePreference('videoEnabled', checked)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="screen-share-quality">Screen Share Quality</Label>
                <p className="text-sm text-gray-500">
                  Choose the default quality for screen sharing
                </p>
                <Select
                  value={preferences.screenShareQuality}
                  onValueChange={(value: 'low' | 'medium' | 'high') =>
                    updatePreference('screenShareQuality', value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (720p)</SelectItem>
                    <SelectItem value="medium">Medium (1080p)</SelectItem>
                    <SelectItem value="high">High (4K)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <p className="text-sm text-gray-500">
                  Choose your preferred color scheme
                </p>
                <Select
                  value={preferences.theme}
                  onValueChange={(value: 'light' | 'dark' | 'system') =>
                    updatePreference('theme', value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Manage notification preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications-enabled">Enable Notifications</Label>
                  <p className="text-sm text-gray-500">
                    Receive notifications for session updates and messages
                  </p>
                </div>
                <Switch
                  id="notifications-enabled"
                  checked={preferences.notificationsEnabled}
                  onCheckedChange={(checked) => updatePreference('notificationsEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset to Defaults</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
