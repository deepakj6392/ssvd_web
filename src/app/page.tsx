'use client';

import { useQuery, gql } from '@apollo/client';
import { useAuth } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Zap, Shield, Users, Video } from 'lucide-react';
import Link from 'next/link';

const HELLO_QUERY = gql`
  query Hello {
    hello
  }
`;

function HomeContent() {
  const { data, loading, error } = useQuery(HELLO_QUERY);
  const { logout, user } = useAuth();

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900 pt-20">
      {/* Header */}
      <header className="fixed top-0 w-full border-b bg-white/90 backdrop-blur-md dark:bg-black/90 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Video className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-black dark:text-white">Connect</h1>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <a href="/collaboration" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 transition-colors">
              Collaborate
            </a>
          </nav>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400 hidden sm:block">
              Welcome back, {user?.name || user?.email || 'User'}!
            </span>
            <Button onClick={logout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Zap className="h-4 w-4 mr-1" />
            Real-Time Collaboration Platform
          </Badge>
          <h1 className="text-6xl font-bold text-black dark:text-white mb-6 leading-tight">
            Connect & <span className="text-blue-600">Collaborate</span>
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
            Experience seamless real-time video collaboration with integrated chat, screen sharing,
            and cross-platform connectivity. Built for teams that work together, anywhere.
          </p>
          <div className="flex justify-center space-x-4 mb-12">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3" asChild>
              <Link href="/collaboration">
                <Video className="mr-2 h-5 w-5" />
                Start Collaborating
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-3" asChild>
              <Link href="/register">Join the Platform</Link>
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">Real-Time</div>
              <div className="text-zinc-600 dark:text-zinc-400">Video & Audio</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">Cross-Platform</div>
              <div className="text-zinc-600 dark:text-zinc-400">Web & Desktop</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">Secure</div>
              <div className="text-zinc-600 dark:text-zinc-400">End-to-End</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-black dark:text-white mb-4">
            Powerful Collaboration Features
          </h2>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Everything you need for seamless remote collaboration, built with cutting-edge technology.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                <Video className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle>HD Video Calls</CardTitle>
              <CardDescription>
                Crystal-clear video conferencing with WebRTC technology for lag-free communication.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-green-100 dark:bg-green-900 rounded-full w-fit">
                <Shield className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                End-to-end encryption with JWT authentication ensuring your data stays protected.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-purple-100 dark:bg-purple-900 rounded-full w-fit">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle>Real-Time Chat</CardTitle>
              <CardDescription>
                Integrated messaging system with file sharing and collaborative features.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-orange-100 dark:bg-orange-900 rounded-full w-fit">
                <Globe className="h-8 w-8 text-orange-600" />
              </div>
              <CardTitle>Cross-Platform</CardTitle>
              <CardDescription>
                Works seamlessly on web browsers and desktop applications with Electron.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-zinc-50 dark:bg-zinc-900 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-black dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Get started with collaboration in just three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-semibold mb-4">Create a Session</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Start a new collaboration session with a custom name and invite participants.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-semibold mb-4">Share the Link</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Share the unique session URL with your team members to join instantly.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold mb-4">Start Collaborating</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Begin video calls, share screens, and chat in real-time with your team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API Status Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">API Status</CardTitle>
            <CardDescription className="text-center">
              Current backend connection status
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                GraphQL Response: {data?.hello}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm dark:bg-black/80 mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">
            © 2024 Connect. Build by Cozeniths.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
