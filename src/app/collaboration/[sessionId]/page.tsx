'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useSubscription, gql } from '@apollo/client';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Mic, MicOff, Monitor, MessageSquare, Users, ArrowLeft, Pen, Type, Eraser } from 'lucide-react';
import Link from 'next/link';
import { WebRTCManager, DrawingAction } from '@/lib/webrtc';
import { Message, Session } from '@/lib';
import { isMobile } from '@/lib/utils';

const SESSION_QUERY = gql`
  query Session($id: String!) {
    session(id: $id) {
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



export default function SessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [streams, setStreams] = useState<{ [key: string]: MediaStream }>({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
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
  });

  const [joinSession] = useMutation(JOIN_SESSION_MUTATION);

  useSubscription(SESSION_UPDATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data?.data?.sessionUpdated && data.data.sessionUpdated.id === sessionId) {
        setCurrentSession(data.data.sessionUpdated);
      }
    },
  });

  useEffect(() => {
    if (sessionData?.session) {
      setCurrentSession(sessionData.session);
    }
  }, [sessionData]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL|| 'http://10.160.2.165:3001');
    setSocket(newSocket);

    // Initialize WebRTC manager
    webrtcManagerRef.current = new WebRTCManager(newSocket, 'test-user-id', sessionId);

    // Socket event listeners
    newSocket.on('signal', (data) => {
      webrtcManagerRef.current?.handleSignal(data);
    });

    newSocket.on('user-joined', (data: { userId: string; sessionId: string }) => {
      // Create peer for new user
      if (data.userId !== 'test-user-id') {
        webrtcManagerRef.current?.createPeer(data.userId);
      }
    });

    newSocket.on('user-left', (data: { userId: string }) => {
      webrtcManagerRef.current?.removePeer(data.userId);
    });

    newSocket.on('chat-message', (message: Message) => {
      setChatMessages(prev => [...prev, message]);
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
    try {
      const { data } = await joinSession({ variables: { sessionId } });
      if (data?.joinSession) {
        setCurrentSession(data.joinSession);
        setIsJoined(true);
        socket?.emit('join-session', { sessionId, userId: 'test-user-id' });

        // Initialize media and create peers for existing participants
        const localStream = await webrtcManagerRef.current?.initializeMedia();
        if (localStream) {
          setStreams(prev => ({ ...prev, 'self': localStream }));
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = localStream;
          }
        }

        // Create peers for existing participants
        const existingParticipants = data.joinSession.participants.filter((id: string) => id !== 'test-user-id');
        existingParticipants.forEach((userId: string) => {
          webrtcManagerRef.current?.createPeer(userId);
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
      await webrtcManagerRef.current?.startScreenShare();
      setIsScreenSharing(true);
    } catch (error) {
      console.error('Error starting screen share:', error);
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
      userId: 'test-user-id',
      content: newMessage,
    });

    setNewMessage('');
  };

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
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/collaboration">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{currentSession.name}</h1>
          <Badge variant="secondary">Session ID: {currentSession.id}</Badge>
        </div>

        {!isJoined ? (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Join Session</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Session Details:</p>
                    <div className="bg-gray-50 p-3 rounded">
                      <p><strong>Name:</strong> {currentSession.name}</p>
                      <p><strong>Host:</strong> {currentSession.hostId}</p>
                      <p><strong>Participants:</strong> {currentSession.participants.length}</p>
                      <p><strong>Status:</strong> {currentSession.isActive ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                  <Button onClick={handleJoinSession} className="w-full">
                    Join Session
                  </Button>
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
                    Video Conference
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

                  {/* Drawing Controls */}
                  <div className="flex flex-wrap justify-center gap-2 mt-4 p-2 bg-gray-50 rounded">
                    <Button
                      variant={isDrawingMode ? "default" : "outline"}
                      onClick={() => setIsDrawingMode(!isDrawingMode)}
                      size="sm"
                    >
                      <Pen className="h-4 w-4 mr-1" />
                      Draw
                    </Button>

                    {isDrawingMode && (
                      <>
                        <Button
                          variant={drawingTool === 'pen' ? "default" : "outline"}
                          onClick={() => setDrawingTool('pen')}
                          size="sm"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={drawingTool === 'text' ? "default" : "outline"}
                          onClick={() => setDrawingTool('text')}
                          size="sm"
                        >
                          <Type className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={drawingTool === 'eraser' ? "default" : "outline"}
                          onClick={() => setDrawingTool('eraser')}
                          size="sm"
                        >
                          <Eraser className="h-4 w-4" />
                        </Button>
                        <input
                          type="color"
                          value={drawingColor}
                          onChange={(e) => setDrawingColor(e.target.value)}
                          className="w-8 h-8 rounded border"
                        />
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={drawingWidth}
                          onChange={(e) => setDrawingWidth(Number(e.target.value))}
                          className="w-16"
                        />
                        <Button onClick={clearCanvas} variant="destructive" size="sm">
                          Clear
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
                    <Button
                      onClick={startScreenShare}
                      disabled={isMobile()}
                      title={isMobile() ? "Screen sharing is not supported on mobile devices" : ""}
                    >
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
                  <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-gray-500 text-sm py-8">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      chatMessages.map((message, index) => {
                        const isCurrentUser = message.userId === 'test-user-id';
                        const showAvatar = index === 0 || chatMessages[index - 1].userId !== message.userId;

                        return (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                          >
                            {!isCurrentUser && showAvatar && (
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
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
                                className={`px-3 py-2 rounded-lg text-sm ${
                                  isCurrentUser
                                    ? 'bg-blue-500 text-white rounded-br-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                                }`}
                              >
                                {message.content}
                              </div>
                              <div className={`text-xs text-gray-400 mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            {isCurrentUser && showAvatar && (
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                                Y
                              </div>
                            )}
                            {isCurrentUser && !showAvatar && <div className="w-8" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      size="sm"
                    >
                      <MessageSquare className="h-4 w-4" />
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
