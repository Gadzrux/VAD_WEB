import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketConfig {
  candidateId: string;
  jobDescription: string;
  onAudioReceived: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: string) => void;
}

export const useAudioWebSocket = ({
  candidateId,
  jobDescription,
  onAudioReceived,
  onError,
  onStateChange,
}: WebSocketConfig) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentState, setCurrentState] = useState<string>("idle");
  const audioChunksRef = useRef<Blob[]>([]);

  const connect = useCallback(() => {
    const wsUrl = `ws://localhost:8000/api/audio-interview/ws?candidate_id=${encodeURIComponent(
      candidateId
    )}&job_description=${encodeURIComponent(jobDescription)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = "blob"; // Changed from 'arraybuffer' to 'blob'

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      // Send start session message
      ws.send(JSON.stringify({ type: "start_session" }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        // Handle binary audio data from server
        console.log(`📥 Received audio chunk: ${event.data.size} bytes`);
        audioChunksRef.current.push(event.data);
      } else {
        // Handle JSON messages
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message:", data);

          if (data.type === "session_status") {
            console.log(`Session status: ${data.status}`);
            setCurrentState(data.status);
            onStateChange?.(data.status);
          } else if (data.type === "audio_complete") {
            // All audio chunks received, create blob
            console.log(
              `✅ Audio complete, received ${audioChunksRef.current.length} chunks`
            );
            if (audioChunksRef.current.length > 0) {
              const blob = new Blob(audioChunksRef.current, {
                type: "audio/mpeg",
              });
              onAudioReceived(blob);
              audioChunksRef.current = [];
            }
          } else if (data.type === "error") {
            console.error("WebSocket error:", data.message);
            onError?.(new Error(data.message));
          } else if (data.type === "audio_interrupted") {
            console.log("Audio interrupted:", data.message);
            audioChunksRef.current = [];
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      onError?.(new Error("WebSocket connection error"));
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
      setCurrentState("idle");
    };
  }, [candidateId, jobDescription, onAudioReceived, onError, onStateChange]);

  const sendAudioChunk = useCallback((chunk: Uint8Array | Blob) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(chunk);
    }
  }, []);

  const sendAudioEnd = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("📤 Sending audio_end signal");
      wsRef.current.send(JSON.stringify({ type: "audio_end" }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "end_session" }));
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendAudioChunk,
    sendAudioEnd,
    isConnected,
    currentState,
  };
};
