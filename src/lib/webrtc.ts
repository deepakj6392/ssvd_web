import Peer from 'simple-peer';

export interface PeerConnection {
  peer: Peer.Instance;
  userId: string;
  stream?: MediaStream;
}

export interface DrawingAction {
  type: 'draw' | 'clear' | 'text';
  userId: string;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  color?: string;
  width?: number;
  text?: string;
  timestamp: number;
}

export class WebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  private localStream?: MediaStream;
  private onStreamCallback?: (userId: string, stream: MediaStream) => void;
  private onPeerLeaveCallback?: (userId: string) => void;
  private onDrawingActionCallback?: (action: DrawingAction) => void;

  constructor(
    private socket: any,
    private userId: string,
    private sessionId: string
  ) {}

  async initializeMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      // Replace video track in local stream
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
          this.localStream.removeTrack(videoTrack);
          videoTrack.stop();
        }
        this.localStream.addTrack(screenStream.getVideoTracks()[0]);

        // Update all existing peers with new stream
        this.peers.forEach((peerConnection) => {
          peerConnection.peer.replaceTrack(
            videoTrack,
            screenStream.getVideoTracks()[0],
            this.localStream!
          );
        });
      }

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  stopScreenShare(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        // Reinitialize camera
        this.initializeMedia({ video: true, audio: true });
      }
    }
  }

  createPeer(userId: string, initiator: boolean = true): Peer.Instance {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: this.localStream,
    });

    peer.on('signal', (data) => {
      this.socket.emit('signal', {
        sessionId: this.sessionId,
        fromUserId: this.userId,
        toUserId: userId,
        data,
      });
    });

    peer.on('stream', (stream) => {
      this.peers.set(userId, {
        ...this.peers.get(userId)!,
        stream,
      });

      if (this.onStreamCallback) {
        this.onStreamCallback(userId, stream);
      }
    });

    peer.on('close', () => {
      this.peers.delete(userId);
      if (this.onPeerLeaveCallback) {
        this.onPeerLeaveCallback(userId);
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      this.peers.delete(userId);
    });

    this.peers.set(userId, { peer, userId });
    return peer;
  }

  addPeer(userId: string, signal: any): void {
    let peerConnection = this.peers.get(userId);
    if (!peerConnection) {
      // Create peer as non-initiator (receiving peer)
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: this.localStream,
      });

      peer.on('signal', (data) => {
        this.socket.emit('signal', {
          sessionId: this.sessionId,
          fromUserId: this.userId,
          toUserId: userId,
          data,
        });
      });

      peer.on('stream', (stream) => {
        this.peers.set(userId, {
          ...this.peers.get(userId)!,
          stream,
        });

        if (this.onStreamCallback) {
          this.onStreamCallback(userId, stream);
        }
      });

      peer.on('close', () => {
        this.peers.delete(userId);
        if (this.onPeerLeaveCallback) {
          this.onPeerLeaveCallback(userId);
        }
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.peers.delete(userId);
      });

      this.peers.set(userId, { peer, userId });
      peerConnection = this.peers.get(userId)!;
    }

    // Signal the peer
    peerConnection.peer.signal(signal);
  }

  handleSignal(data: any): void {
    const peerConnection = this.peers.get(data.fromUserId);
    if (peerConnection) {
      peerConnection.peer.signal(data.data);
    }
  }

  removePeer(userId: string): void {
    const peerConnection = this.peers.get(userId);
    if (peerConnection) {
      peerConnection.peer.destroy();
      this.peers.delete(userId);
    }
  }

  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  getLocalStream(): MediaStream | undefined {
    return this.localStream;
  }

  getPeers(): Map<string, PeerConnection> {
    return this.peers;
  }

  onStream(callback: (userId: string, stream: MediaStream) => void): void {
    this.onStreamCallback = callback;
  }

  onPeerLeave(callback: (userId: string) => void): void {
    this.onPeerLeaveCallback = callback;
  }

  onDrawingAction(callback: (action: DrawingAction) => void): void {
    this.onDrawingActionCallback = callback;
  }

  sendDrawingAction(action: Omit<DrawingAction, 'userId' | 'timestamp'>): void {
    const fullAction: DrawingAction = {
      ...action,
      userId: this.userId,
      timestamp: Date.now(),
    };

    // Send to all peers via data channel or socket
    this.socket?.emit('drawing-action', {
      sessionId: this.sessionId,
      action: fullAction,
    });

    // Also trigger local callback for immediate feedback
    if (this.onDrawingActionCallback) {
      this.onDrawingActionCallback(fullAction);
    }
  }

  handleDrawingAction(action: DrawingAction): void {
    if (this.onDrawingActionCallback) {
      this.onDrawingActionCallback(action);
    }
  }

  cleanup(): void {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Destroy all peers
    this.peers.forEach((peerConnection) => {
      peerConnection.peer.destroy();
    });

    this.peers.clear();
  }
}

export class MediaRecorderManager {
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private onRecordingCallback?: (blob: Blob) => void;

  startRecording(stream: MediaStream): void {
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      if (this.onRecordingCallback) {
        this.onRecordingCallback(blob);
      }
    };

    this.recorder.start();
  }

  stopRecording(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.stop();
    }
  }

  onRecordingComplete(callback: (blob: Blob) => void): void {
    this.onRecordingCallback = callback;
  }

  downloadRecording(blob: Blob, filename: string = 'recording.webm'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
