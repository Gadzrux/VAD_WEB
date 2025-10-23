"use client";
import { useEffect, useState, useRef } from "react";
import { SpeechChunks } from "../vad/SpeechChunks";
import { useAudioWebSocket } from "./hooks/useAudioWebSocket";

export default function Home() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [serverState, setServerState] = useState<string>("idle");
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const chunksRef = useRef<SpeechChunks | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const {
    connect,
    disconnect,
    sendAudioChunk,
    sendAudioEnd,
    isConnected,
    currentState,
  } = useAudioWebSocket({
    candidateId: "test-candidate-123",
    jobDescription: "Software Engineer Position",
    onAudioReceived: (blob: Blob) => {
      console.log("Received AI audio response");

      // Only play audio if NOT listening (idle state)
      if (!isListening) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;

        setIsSpeaking(true);

        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          setIsSpeaking(false);
        };

        audio.play().catch((e) => {
          console.error("Error playing audio:", e);
          setIsSpeaking(false);
        });
      } else {
        console.log("Skipping audio playback - user is speaking");
      }
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
    },
    onStateChange: (state) => {
      setServerState(state);
    },
  });

  const handleStartSession = async () => {
    if (isSessionActive) return;

    try {
      console.log("Starting interview session...");

      // Connect to WebSocket
      connect();

      // Wait a bit for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Initialize VAD
      const chunks = new SpeechChunks(
        () => {
          console.log("Speech detection started");
          setIsListening(true);

          // Interrupt AI audio if playing
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
            setIsSpeaking(false);
          }
        },
        (blob: Blob) => {
          console.log("Speech detection ended");
          setIsListening(false);
        },
        async (audioBlob: Blob) => {
          // Send complete audio blob to server
          console.log(`📤 Sending audio blob (${audioBlob.size} bytes)`);

          // Send to WebSocket in chunks
          const arrayBuffer = await audioBlob.arrayBuffer();
          const chunkSize = 8192; // 8KB chunks

          for (
            let offset = 0;
            offset < arrayBuffer.byteLength;
            offset += chunkSize
          ) {
            const chunk = arrayBuffer.slice(offset, offset + chunkSize);
            sendAudioChunk(new Uint8Array(chunk));
          }

          // Signal end of audio
          sendAudioEnd();
        }
      );

      chunksRef.current = chunks;
      await chunks.start();

      setIsSessionActive(true);
      console.log("Interview session started successfully");
    } catch (error) {
      console.error("Error starting session:", error);
      alert("Failed to start session. Please check microphone permissions.");
    }
  };

  const handleEndSession = () => {
    if (!isSessionActive) return;

    console.log("Ending interview session...");

    // Stop VAD
    if (chunksRef.current) {
      chunksRef.current.stop();
      chunksRef.current = null;
    }

    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    // Disconnect WebSocket
    disconnect();

    setIsSessionActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    console.log("Interview session ended");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunksRef.current) {
        chunksRef.current.stop();
        chunksRef.current = null;
      }
      disconnect();
    };
  }, [disconnect]);

  if (!isSessionActive) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-6xl">🤖</span>
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI Voice Interview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
            Experience a seamless voice conversation with our AI interviewer
          </p>
          <button
            onClick={handleStartSession}
            className="group relative px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            <span className="flex items-center gap-3 text-lg">
              <span className="text-2xl">📞</span>
              Start AI Interview Call
            </span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-4xl w-full">
        {/* Call Interface */}
        <div className="relative">
          {/* Connection Status Badge */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                }`}
              />
              {serverState === "processing" && "Processing..."}
              {serverState === "sending_audio" && "AI Responding..."}
              {serverState === "idle" && "Connected"}
              {serverState === "receiving_audio" && "Listening..."}
            </div>
          </div>

          {/* Main Call Interface */}
          <div className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-gray-700/50">
            <div className="flex flex-col items-center justify-center gap-16">
              {/* User Avatar */}
              <div className="relative">
                <div
                  className={`w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    isListening
                      ? "ring-8 ring-blue-400/50 scale-110 animate-pulse"
                      : "ring-4 ring-gray-700/50 scale-100"
                  }`}
                >
                  <span className="text-7xl">👤</span>
                </div>
                {isListening && (
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-full shadow-lg animate-bounce">
                      Speaking...
                    </div>
                  </div>
                )}
                <div className="mt-6 text-center">
                  <p className="text-2xl font-semibold text-white">You</p>
                  <p className="text-gray-400 text-sm mt-1">Candidate</p>
                </div>
              </div>

              {/* Waveform Separator */}
              <div className="w-full flex items-center justify-center gap-2 py-4">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-200 ${
                      isListening || isSpeaking
                        ? "bg-gradient-to-t from-purple-500 to-pink-500"
                        : "bg-gray-600"
                    }`}
                    style={{
                      height:
                        isListening || isSpeaking
                          ? `${Math.random() * 40 + 20}px`
                          : "8px",
                      animation:
                        isListening || isSpeaking
                          ? `wave 0.5s ease-in-out infinite ${i * 0.05}s`
                          : "none",
                    }}
                  />
                ))}
              </div>

              {/* AI Avatar */}
              <div className="relative">
                <div
                  className={`w-40 h-40 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    isSpeaking
                      ? "ring-8 ring-purple-400/50 scale-110 animate-pulse"
                      : "ring-4 ring-gray-700/50 scale-100"
                  }`}
                >
                  <span className="text-7xl">🤖</span>
                </div>
                {isSpeaking && (
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-full shadow-lg animate-bounce">
                      Speaking...
                    </div>
                  </div>
                )}
                <div className="mt-6 text-center">
                  <p className="text-2xl font-semibold text-white">
                    AI Interviewer
                  </p>
                  <p className="text-gray-400 text-sm mt-1">Assistant</p>
                </div>
              </div>
            </div>

            {/* End Call Button */}
            <div className="mt-16 text-center">
              <button
                onClick={handleEndSession}
                className="group relative px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <span className="flex items-center gap-3 text-lg">
                  <span className="text-2xl">📞</span>
                  End Call
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes wave {
          0%,
          100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(1.5);
          }
        }
      `}</style>
    </main>
  );
}
