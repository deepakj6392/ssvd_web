'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useSubscription, gql } from '@apollo/client';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Mic, MicOff, Monitor, MessageSquare, Users, ArrowLeft, Pen, Type, Eraser } from 'lucide-react';
import Link from 'next/link';
import { WebRTCManager, DrawingAction } from '@/lib/webrtc';
import { Message, Session } from '@/lib';
import { isMobile } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { getUserPreferences } from '@/lib/settings';
import { client } from '@/lib/auth';

const SESSION_QUERY = gql`
  query Session($id: String!) {
    session(id: $id) {
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



export default function SessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { user, isLoggedIn } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [streams, setStreams] = useState<{ [key: string]: MediaStream }>({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => getUserPreferences().audioEnabled);
  const [isVideoEnabled, setIsVideoEnabled] = useState(() => getUserPreferences().videoEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  // Drawing/annotation state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'text' | 'eraser'>('pen');
  const [drawingColor, setDrawingColor] = useState('#ff0000');
  const [drawingWidth, setDrawingWidth] = useState(2);
  const [drawingActions, setDrawingActions] = useState<DrawingAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  const userVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  const { data: sessionData, loading: sessionLoading, refetch: refetchSession } = useQuery(SESSION_QUERY, {
    variables: { id: sessionId },
    skip: !sessionId,
    client,
  });

  const [joinSession] = useMutation(JOIN_SESSION_MUTATION, {
    client,
  });

  useSubscription(SESSION_UPDATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data?.data?.sessionUpdated && data.data.sessionUpdated.id === sessionId) {
        setCurrentSession(data.data.sessionUpdated);
      }
    },
    client,
  });

  useEffect(() => {
    if (sessionData?.session) {
      setCurrentSession(sessionData.session);
      // Load existing chat messages
      if (sessionData.session.messages) {
        setChatMessages(sessionData.session.messages);
      }
    }
  }, [sessionData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    // Initialize socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL|| 'http://10.160.2.165:3001');
    setSocket(newSocket);

    // Initialize WebRTC manager
    webrtcManagerRef.current = new WebRTCManager(newSocket, user?.id || 'test-user-id', sessionId);

    // Socket event listeners
    newSocket.on('signal', (data) => {
      webrtcManagerRef.current?.addPeer(data.fromUserId, data.data);
    });

    newSocket.on('user-joined', (data: { userId: string; sessionId: string }) => {
      // Create peer for new user (we initiate the connection)
      if (data.userId !== (user?.id || 'test-user-id')) {
        webrtcManagerRef.current?.createPeer(data.userId, true); // true = initiator
      }
    });

    newSocket.on('user-left', (data: { userId: string }) => {
      webrtcManagerRef.current?.removePeer(data.userId);
    });

    newSocket.on('chat-message', (message: Message) => {
      setChatMessages(prev => [...prev, message]);
      // Update session data to include new message
      refetchSession();
    });

    newSocket.on('drawing-action', (data: { action: DrawingAction }) => {
      webrtcManagerRef.current?.handleDrawingAction(data.action);
      setDrawingActions(prev => [...prev, data.action]);
    });

    // WebRTC callbacks
    webrtcManagerRef.current.onStream((userId, stream) => {
      setStreams(prev => ({ ...prev, [userId]: stream }));
    });

    webrtcManagerRef.current.onPeerLeave((userId) => {
      setStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
    });

    webrtcManagerRef.current.onDrawingAction((action) => {
      setDrawingActions(prev => [...prev, action]);
    });

    return () => {
      newSocket.disconnect();
      webrtcManagerRef.current?.cleanup();
    };
  }, [sessionId]);



  const handleJoinSession = async () => {
    if (!isLoggedIn) {
      console.error('User not authenticated');
      return;
    }

    try {
      console.log(sessionId, user)
      const { data } = await joinSession({ variables: { sessionId } });
      console.log(data)
      if (data?.joinSession) {
        setCurrentSession(data.joinSession);
        setIsJoined(true);

        // Initialize media first (audio only)
        const localStream = await webrtcManagerRef.current?.initializeMedia({ audio: true, video: true });
        if (localStream) {
          setStreams(prev => ({ ...prev, 'self': localStream }));
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = localStream;
          }
        }

        // Join session after media is initialized
        socket?.emit('join-session', { sessionId, userId: user?.id || 'test-user-id' });

        // Create peers for existing participants (as non-initiator)
        const existingParticipants = data.joinSession.participants.filter((id: string) => id !== (user?.id || 'test-user-id'));
        existingParticipants.forEach((participantId: string) => {
          webrtcManagerRef.current?.createPeer(participantId, false); // false = non-initiator
        });
      }
    } catch (error) {
      console.error('Error joining session:', error);
    }
  };



  const toggleAudio = () => {
    const enabled = webrtcManagerRef.current?.toggleAudio();
    if (enabled !== undefined) {
      setIsAudioEnabled(enabled);
    }
  };

  const toggleVideo = () => {
    const enabled = webrtcManagerRef.current?.toggleVideo();
    if (enabled !== undefined) {
      setIsVideoEnabled(enabled);
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await webrtcManagerRef.current?.startScreenShare();
      if (screenStream) {
        setIsScreenSharing(true);
        // Update video element with screen share stream
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = screenStream;
        }
      }
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };

  const stopScreenShare = async () => {
    try {
      await webrtcManagerRef.current?.stopScreenShare();
      setIsScreenSharing(false);
      // Update video element back to local stream
      const localStream = webrtcManagerRef.current?.getLocalStream();
      if (localStream && userVideoRef.current) {
        userVideoRef.current.srcObject = localStream;
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  };

  // Drawing functions
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;

    const { x, y } = getCanvasCoordinates(e);
    setIsDrawing(true);
    setLastPos({ x, y });

    if (drawingTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        webrtcManagerRef.current?.sendDrawingAction({
          type: 'text',
          x,
          y,
          text,
          color: drawingColor,
        });
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode || drawingTool === 'text') return;

    const { x, y } = getCanvasCoordinates(e);
    if (!lastPos) return;

    webrtcManagerRef.current?.sendDrawingAction({
      type: 'draw',
      x: lastPos.x,
      y: lastPos.y,
      x2: x,
      y2: y,
      color: drawingColor,
      width: drawingWidth,
    });

    setLastPos({ x, y });
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  const clearCanvas = () => {
    webrtcManagerRef.current?.sendDrawingAction({
      type: 'clear',
    });
    setDrawingActions([]);
  };

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all actions
    drawingActions.forEach(action => {
      ctx.strokeStyle = action.color || '#000000';
      ctx.lineWidth = action.width || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (action.type === 'draw' && action.x !== undefined && action.y !== undefined && action.x2 !== undefined && action.y2 !== undefined) {
        ctx.beginPath();
        ctx.moveTo(action.x, action.y);
        ctx.lineTo(action.x2, action.y2);
        ctx.stroke();
      } else if (action.type === 'text' && action.x !== undefined && action.y !== undefined && action.text) {
        ctx.fillStyle = action.color || '#000000';
        ctx.font = '16px Arial';
        ctx.fillText(action.text, action.x, action.y);
      }
    });
  }, [drawingActions]);

  const sendMessage = () => {
    if (!newMessage.trim() || !currentSession) return;

    socket?.emit('chat-message', {
      sessionId: currentSession.id,
      userId: user?.id || 'test-user-id',
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  // Prevent hydration issues by not rendering until mounted
  if (!isMounted) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  if (sessionLoading) {
    return <div className="flex justify-center items-center h-screen">Loading session...</div>;
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Session Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                The session with ID "{sessionId}" could not be found.
              </p>
              <Link href="/collaboration">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Collaboration
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-8 pt-4">
          <Link href="/collaboration">
            <Button variant="outline" className="bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white/90 transition-all duration-300">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sessions
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              {currentSession.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-0 px-3 py-1">
                <Users className="h-3 w-3 mr-1" />
                {currentSession.participants.length} participants
              </Badge>
              <Badge variant={currentSession.isActive ? "default" : "secondary"} className="bg-white/80 backdrop-blur-sm border-0 px-3 py-1">
                {currentSession.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        {!isJoined ? (
          <div className="max-w-lg mx-auto">
            <Card className="group relative overflow-hidden border-0 shadow-2xl bg-white/90 backdrop-blur-sm hover:shadow-3xl transition-all duration-500">

              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-6 p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl w-fit shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Video className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-800 mb-2">Join Session</CardTitle>
                <CardDescription className="text-gray-600 text-lg">
                  Ready to collaborate? Join this session to start connecting with your team.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-3">Session Details:</p>
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Name:</span>
                          <p className="font-semibold text-gray-800">{currentSession.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Host:</span>
                          <p className="font-semibold text-gray-800">{currentSession.hostName || currentSession.hostId}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Participants:</span>
                          <p className="font-semibold text-gray-800">{currentSession.participants.length}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <Badge variant={currentSession.isActive ? "default" : "secondary"} className="mt-1">
                            {currentSession.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  {!isLoggedIn ? (
                    <div className="text-center p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-600 font-medium">Authentication Required</p>
                      <p className="text-red-500 text-sm mt-1">Please log in to join the session.</p>
                      <Link href="/login">
                        <Button className="mt-3 bg-red-600 hover:bg-red-700">
                          Go to Login
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Button
                      onClick={handleJoinSession}

                      className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      <Video className="h-5 w-5 mr-3" />
                      Join Session Now
                    </Button>
                  )}
                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      Make sure your microphone is ready
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Video Area */}
            <div className="lg:col-span-3">
              <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-800">Video Conference</CardTitle>
                      <p className="text-gray-600">Real-time collaboration in progress</p>
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

                  {/* Drawing Controls */}
                  <div className="flex flex-wrap justify-center gap-3 mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
                    <Button
                      variant={isDrawingMode ? "default" : "outline"}
                      onClick={() => setIsDrawingMode(!isDrawingMode)}
                      className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 ${
                        isDrawingMode
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg'
                          : 'border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <Pen className="h-4 w-4 mr-2" />
                      {isDrawingMode ? 'Exit Drawing' : 'Start Drawing'}
                    </Button>

                    {isDrawingMode && (
                      <>
                        <div className="flex gap-2">
                          <Button
                            variant={drawingTool === 'pen' ? "default" : "outline"}
                            onClick={() => setDrawingTool('pen')}
                            className={`px-3 py-2 rounded-lg transition-all duration-300 ${
                              drawingTool === 'pen'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-md'
                                : 'border border-gray-300 hover:border-green-400'
                            }`}
                          >
                            <Pen className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={drawingTool === 'text' ? "default" : "outline"}
                            onClick={() => setDrawingTool('text')}
                            className={`px-3 py-2 rounded-lg transition-all duration-300 ${
                              drawingTool === 'text'
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md'
                                : 'border border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            <Type className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={drawingTool === 'eraser' ? "default" : "outline"}
                            onClick={() => setDrawingTool('eraser')}
                            className={`px-3 py-2 rounded-lg transition-all duration-300 ${
                              drawingTool === 'eraser'
                                ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-md'
                                : 'border border-gray-300 hover:border-red-400'
                            }`}
                          >
                            <Eraser className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Color:</span>
                          <input
                            type="color"
                            value={drawingColor}
                            onChange={(e) => setDrawingColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border-2 border-gray-300 cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Size:</span>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={drawingWidth}
                            onChange={(e) => setDrawingWidth(Number(e.target.value))}
                            className="w-20 accent-blue-500"
                          />
                          <span className="text-sm text-gray-600 w-6">{drawingWidth}</span>
                        </div>
                        <Button
                          onClick={clearCanvas}
                          variant="destructive"
                          className="px-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          Clear Canvas
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Canvas Overlay */}
                  {isDrawingMode && (
                    <div className="relative mt-2">
                      <canvas
                        ref={canvasRef}
                        width={640}
                        height={360}
                        className="absolute top-0 left-0 w-full h-full border-2 border-blue-500 bg-transparent cursor-crosshair"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                      />
                    </div>
                  )}

                  {/* Media Controls */}
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
                      onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                      className={`px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 ${
                        isScreenSharing
                          ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
                          : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                      }`}
                    >
                      <Monitor className="h-5 w-5 mr-2" />
                      {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
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
                        <p className="text-gray-500 text-lg">No messages yet</p>
                        <p className="text-gray-400 text-sm">Start the conversation!</p>
                      </div>
                    ) : (
                      chatMessages.map((message, index) => {
                        const isCurrentUser = message.userId === (user?.id || 'test-user-id');
                        const showAvatar = index === 0 || chatMessages[index - 1].userId !== message.userId;

                        return (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                          >
                            {!isCurrentUser && showAvatar && (
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                {message.userId.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {!isCurrentUser && !showAvatar && <div className="w-8" />}
                            <div className={`max-w-[70%] ${isCurrentUser ? 'order-first' : ''}`}>
                              {!isCurrentUser && showAvatar && (
                                <div className="text-xs text-gray-500 mb-1 ml-1">
                                  {message.userId}
                                </div>
                              )}
                              <div
                                className={`px-4 py-3 rounded-2xl text-sm ${
                                  isCurrentUser
                                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm'
                                    : 'bg-gray-50 border border-gray-200 text-gray-700 rounded-bl-sm'
                                }`}
                              >
                                {message.content}
                              </div>
                              <div className={`text-xs text-gray-400 mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            {isCurrentUser && showAvatar && (
                              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                Y
                              </div>
                            )}
                            {isCurrentUser && !showAvatar && <div className="w-8" />}
                          </div>
                        );
                      })
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
