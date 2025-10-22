"use client";
import { useEffect, useState, useRef } from "react";
import { SpeechChunks } from "../vad/SpeechChunks";
import Link from "next/link";

interface AudioPlayerProps {
  blob: Blob;
  index: number;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ blob, index }) => {
  return (
    <div className="w-full">
      <audio
        controls
        className="w-full"
        src={URL.createObjectURL(blob)}
        onEnded={(e: React.SyntheticEvent<HTMLAudioElement>) => {
          URL.revokeObjectURL(e.currentTarget.src);
        }}
        aria-label={`Audio recording ${index + 1}`}
      />
    </div>
  );
};

export default function Home() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([]);
  const chunksRef = useRef<SpeechChunks | null>(null);

  useEffect(() => {
    // Prevent double initialization
    if (chunksRef.current) return;

    const chunks = new SpeechChunks(
      () => {
        console.log("Speech detection started");
        setIsListening(true);
      },
      (blob: Blob) => {
        console.log("Speech detection ended");
        setIsListening(false);
        setAudioBlobs((prevBlobs) => [...prevBlobs, blob]);
      }
    );
    chunksRef.current = chunks;
    chunks.start();

    return () => {
      if (chunksRef.current) {
        chunksRef.current.stop();
        chunksRef.current = null;
      }
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8">
          Voice Activity Detection
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-2xl font-semibold mb-2">
              {isListening ? "🎙️ Listening..." : "🔇 Idle"}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {isListening ? "Detecting speech..." : "Waiting for speech input"}
            </p>
          </div>

          {audioBlobs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">
                Recorded Segments ({audioBlobs.length})
              </h2>
              {audioBlobs.map((blob, index) => (
                <AudioPlayer key={index} blob={blob} index={index} />
              ))}
            </div>
          )}

          {audioBlobs.length === 0 && !isListening && (
            <p className="text-center text-gray-500">
              No recordings yet. Start speaking to capture audio.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
