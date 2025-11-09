'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useSubscription, gql } from '@apollo/client';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Mic, MicOff, Monitor, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';
import type { Session, Message } from '@/lib';
import { isMobile } from '@/lib/utils';
import { getUserPreferences } from '@/lib/settings';
import { useAuth } from '@/components/AuthProvider';
import { client } from '@/lib/auth';

const SESSIONS_QUERY = gql`
  query Sessions {
    sessions {
      id
      name
      hostId
      hostName
      participants
      createdAt
      isActive
    }
  }
`;

const CREATE_SESSION_MUTATION = gql`
  mutation CreateSession($name: String!) {
    createSession(name: $name) {
      id
      name
      hostId
      hostName
      participants
      createdAt
      isActive
    }
  }
`;

const JOIN_SESSION_MUTATION = gql`
  mutation JoinSession($sessionId: String!) {
    joinSession(sessionId: $sessionId) {
      id
      name
      hostId
      hostName
      participants
      createdAt
      isActive
    }
  }
`;

const SESSION_CREATED_SUBSCRIPTION = gql`
  subscription SessionCreated {
    sessionCreated {
      id
      name
      hostId
      hostName
      participants
      createdAt
      isActive
    }
  }
`;

const SESSION_UPDATED_SUBSCRIPTION = gql`
  subscription SessionUpdated {
    sessionUpdated {
      id
      name
      hostId
      hostName
      participants
      createdAt
      isActive
    }
  }
`;

export default function CollaborationPage() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [peers, setPeers] = useState<{ [key: string]: Peer.Instance }>({});
  const [streams, setStreams] = useState<{ [key: string]: MediaStream }>({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => getUserPreferences().audioEnabled);
  const [isVideoEnabled, setIsVideoEnabled] = useState(() => getUserPreferences().videoEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionName, setSessionName] = useState('');

  const userVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});

  const { data: sessionsData, loading: sessionsLoading, refetch: refetchSessions } = useQuery(SESSIONS_QUERY, {
    client: client,
  });
  const [createSession] = useMutation(CREATE_SESSION_MUTATION, {
    client: client,
  });
  const [joinSession] = useMutation(JOIN_SESSION_MUTATION, {
    client: client,
  });

  useSubscription(SESSION_CREATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data?.data?.sessionCreated) {
        refetchSessions();
      }
    },
  });

  useSubscription(SESSION_UPDATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data?.data?.sessionUpdated) {
        refetchSessions();
      }
    },
  });

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://10.160.2.165:3001');
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('signal', (data) => {
      const peer = peersRef.current[data.fromUserId];
      if (peer) {
        peer.signal(data.data);
      }
    });

    newSocket.on('chat-message', (message: Message) => {
      setChatMessages(prev => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const createPeer = (userId: string, callerId: string, stream: MediaStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', (data) => {
      socket?.emit('signal', {
        sessionId: currentSession?.id,
        fromUserId: callerId,
        toUserId: userId,
        data,
      });
    });

    peer.on('stream', (peerStream) => {
      setStreams(prev => ({ ...prev, [userId]: peerStream }));
    });

    return peer;
  };

  const addPeer = (incomingSignal: any, callerId: string, stream: MediaStream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', (data) => {
      socket?.emit('signal', {
        sessionId: currentSession?.id,
        fromUserId: callerId,
        toUserId: callerId,
        data,
      });
    });

    peer.on('stream', (peerStream) => {
      setStreams(prev => ({ ...prev, [callerId]: peerStream }));
    });

    peer.signal(incomingSignal);
    return peer;
  };

  const handleCreateSession = async () => {
    if (!sessionName.trim()) return;

    try {
      const { data } = await createSession({ variables: { name: sessionName } });
      if (data?.createSession) {
        // Redirect to the session page
        window.location.href = `/collaboration/${data.createSession.id}`;
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    try {
      const { data } = await joinSession({ variables: { sessionId } });
      if (data?.joinSession) {
        setCurrentSession(data.joinSession);
        socket?.emit('join-session', { sessionId, userId: user?.id || 'test-user-id' });
        initializeMedia();
      }
    } catch (error) {
      console.error('Error joining session:', error);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }

      setStreams(prev => ({ ...prev, 'self': stream }));
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const toggleAudio = () => {
    const stream = streams['self'];
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    const stream = streams['self'];
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      // Replace video track in local stream
      const localStream = streams['self'];
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          localStream.removeTrack(videoTrack);
          videoTrack.stop();
        }
        localStream.addTrack(screenStream.getVideoTracks()[0]);

        // Update all existing peers with new stream
        Object.values(peers).forEach((peer) => {
          peer.replaceTrack(
            videoTrack,
            screenStream.getVideoTracks()[0],
            localStream
          );
        });
      }

      setIsScreenSharing(true);
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !currentSession) return;

    socket?.emit('chat-message', {
      sessionId: currentSession.id,
      userId: user?.id || 'test-user-id',
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  if (sessionsLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

        <div className="relative max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
              Real-Time Collaboration
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Connect, collaborate, and create together in immersive video sessions with real-time drawing and screen sharing capabilities.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-16">
        {!currentSession ? (
          <div className="space-y-12">
            {/* Centered Create Session Form */}
            <div className="flex justify-center">
              <Card className="group relative overflow-hidden border-0 shadow-2xl bg-white/80 backdrop-blur-sm hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 w-full max-w-md">
                <CardHeader className="text-center pb-6">
                  <div className="mx-auto mb-6 p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl w-fit shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Video className="h-10 w-10 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-800 mb-2">Create New Session</CardTitle>
                  <CardDescription className="text-gray-600 text-lg">
                    Start a new real-time collaboration session and invite your team
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <label htmlFor="session-name" className="text-sm font-semibold text-gray-700 block text-center">
                      Session Name
                    </label>
                    <Input
                      id="session-name"
                      placeholder="e.g., Team Standup, Project Review..."
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className="text-center text-lg py-3 border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-colors"
                    />
                  </div>
                  <Button
                    onClick={handleCreateSession}
                    className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    disabled={!sessionName.trim()}
                  >
                    <Video className="h-5 w-5 mr-3" />
                    Create & Join Session
                  </Button>
                  {sessionName && (
                    <div className="text-center bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-700 font-semibold">
                        ✓ Ready to create "{sessionName}"
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        You'll be redirected to join immediately
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sessions Grid Card */}
            <Card className="group relative overflow-hidden border-0 shadow-2xl bg-white/80 backdrop-blur-sm hover:shadow-3xl transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl shadow-lg">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-800">Join Existing Session</CardTitle>
                    <CardDescription className="text-gray-600 text-lg">
                      Connect with your team in active sessions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sessionsData?.sessions?.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No active sessions</p>
                    <p className="text-gray-400 text-sm">Create one to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sessionsData?.sessions?.map((session: Session) => (
                      <div key={session.id} className="group/session relative overflow-hidden border-2 border-gray-100 rounded-xl hover:border-green-300 hover:bg-green-50/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <h3 className="font-bold text-gray-800 text-lg leading-tight">{session.name}</h3>
                            <Badge variant={session.isActive ? "default" : "secondary"} className="text-xs ml-2 flex-shrink-0">
                              {session.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="space-y-3">
                            <p className="text-sm text-gray-600 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {session.participants.length} participants
                            </p>
                            <Link href={`/collaboration/${session.id}`}>
                              <Button className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 shadow-md hover:shadow-lg transition-all duration-300 group-hover/session:scale-105">
                                Join Session
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Video Area */}
            <div className="lg:col-span-3">
              <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-800">{currentSession.name}</CardTitle>
                      <p className="text-gray-600">Active collaboration session</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Self Video */}
                    <div className="relative group">
                      <video
                        ref={userVideoRef}
                        autoPlay
                        muted
                        className="w-full h-64 bg-gray-900 rounded-2xl shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                      />
                      <div className="absolute bottom-4 left-4">
                        <Badge className="bg-black/70 text-white border-0 px-3 py-1 text-sm font-medium">
                          You
                        </Badge>
                      </div>
                      {!isVideoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-2xl">
                          <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center">
                            <Video className="h-10 w-10 text-gray-400" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Peer Videos */}
                    {Object.entries(streams).filter(([id]) => id !== 'self').map(([userId, stream]) => (
                      <div key={userId} className="relative group">
                        <video
                          autoPlay
                          className="w-full h-64 bg-gray-900 rounded-2xl shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                          ref={(video) => {
                            if (video && video.srcObject !== stream) {
                              video.srcObject = stream;
                            }
                          }}
                        />
                        <div className="absolute bottom-4 left-4">
                          <Badge className="bg-black/70 text-white border-0 px-3 py-1 text-sm font-medium">
                            Peer {userId}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Enhanced Controls */}
                  <div className="flex justify-center gap-6 mt-8">
                    <Button
                      variant={isAudioEnabled ? "default" : "destructive"}
                      onClick={toggleAudio}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                        isAudioEnabled
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
                          : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {isAudioEnabled ? <Mic className="h-5 w-5 mr-2" /> : <MicOff className="h-5 w-5 mr-2" />}
                      {isAudioEnabled ? 'Mic On' : 'Mic Off'}
                    </Button>
                    <Button
                      variant={isVideoEnabled ? "default" : "destructive"}
                      onClick={toggleVideo}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                        isVideoEnabled
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                          : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      <Video className="h-5 w-5 mr-2" />
                      {isVideoEnabled ? 'Video On' : 'Video Off'}
                    </Button>
                    <Button
                      onClick={startScreenShare}
                      className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Monitor className="h-5 w-5 mr-2" />
                      Share Screen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Chat */}
            <div className="lg:col-span-1">
              <Card className="h-full border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg shadow-lg">
                      <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-xl font-bold text-gray-800">Team Chat</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col h-96">
                  <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-2">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No messages yet</p>
                        <p className="text-gray-400 text-xs">Start the conversation!</p>
                      </div>
                    ) : (
                      chatMessages.map((message) => (
                        <div key={message.id} className="flex gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {message.userId.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-800">{message.userId}</span>
                              <span className="text-xs text-gray-500">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="bg-gray-50 rounded-2xl rounded-tl-md px-4 py-2 text-sm text-gray-700">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className="flex-1 border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 transition-colors"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
