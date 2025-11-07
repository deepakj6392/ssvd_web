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
import type { Session, Message } from '../../../../../packages/shared/src/index';

const SESSIONS_QUERY = gql`
  query Sessions {
    sessions {
      id
      name
      hostId
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
      participants
      createdAt
      isActive
    }
  }
`;

export default function CollaborationPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [peers, setPeers] = useState<{ [key: string]: Peer.Instance }>({});
  const [streams, setStreams] = useState<{ [key: string]: MediaStream }>({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionName, setSessionName] = useState('');

  const userVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});

  const { data: sessionsData, loading: sessionsLoading, refetch: refetchSessions } = useQuery(SESSIONS_QUERY);
  const [createSession] = useMutation(CREATE_SESSION_MUTATION);
  const [joinSession] = useMutation(JOIN_SESSION_MUTATION);

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
    const newSocket = io('http://10.160.2.165:3001');
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
        socket?.emit('join-session', { sessionId, userId: 'test-user-id' });
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
      setIsScreenSharing(true);
      // Handle screen sharing logic
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !currentSession) return;

    socket?.emit('chat-message', {
      sessionId: currentSession.id,
      userId: 'test-user-id',
      content: newMessage,
    });

    setNewMessage('');
  };

  if (sessionsLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Real-Time Collaboration</h1>

        {!currentSession ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Session */}
            <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                  <Video className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Create New Session</CardTitle>
                <CardDescription>
                  Start a new real-time collaboration session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="session-name" className="text-sm font-medium">
                      Session Name
                    </label>
                    <Input
                      id="session-name"
                      placeholder="e.g., Team Standup, Project Review..."
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className="text-center"
                    />
                  </div>
                  <Button
                    onClick={handleCreateSession}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    disabled={!sessionName.trim()}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Create & Join Session
                  </Button>
                  {sessionName && (
                    <div className="text-center">
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        ✓ Ready to create "{sessionName}"
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        You'll be redirected to join immediately
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Join Session */}
            <Card>
              <CardHeader>
                <CardTitle>Join Existing Session</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessionsData?.sessions?.map((session: Session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <h3 className="font-medium">{session.name}</h3>
                        <p className="text-sm text-gray-500">
                          {session.participants.length} participants
                        </p>
                      </div>
                      <Link href={`/collaboration/${session.id}`}>
                        <Button>
                          Join
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Area */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    {currentSession.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Self Video */}
                    <div className="relative">
                      <video
                        ref={userVideoRef}
                        autoPlay
                        muted
                        className="w-full h-48 bg-black rounded"
                      />
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary">You</Badge>
                      </div>
                    </div>

                    {/* Peer Videos */}
                    {Object.entries(streams).filter(([id]) => id !== 'self').map(([userId, stream]) => (
                      <div key={userId} className="relative">
                        <video
                          autoPlay
                          className="w-full h-48 bg-black rounded"
                          ref={(video) => {
                            if (video && video.srcObject !== stream) {
                              video.srcObject = stream;
                            }
                          }}
                        />
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary">Peer {userId}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Controls */}
                  <div className="flex justify-center gap-4 mt-4">
                    <Button
                      variant={isAudioEnabled ? "default" : "destructive"}
                      onClick={toggleAudio}
                    >
                      {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant={isVideoEnabled ? "default" : "destructive"}
                      onClick={toggleVideo}
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button onClick={startScreenShare}>
                      <Monitor className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chat */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Chat
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col h-96">
                  <div className="flex-1 overflow-y-auto mb-4">
                    {chatMessages.map((message) => (
                      <div key={message.id} className="mb-2">
                        <div className="text-sm font-medium">{message.userId}</div>
                        <div className="text-sm text-gray-600">{message.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button onClick={sendMessage}>Send</Button>
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
