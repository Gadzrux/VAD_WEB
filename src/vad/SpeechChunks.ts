import MicrophoneAudio from "./MicrophoneAudio";
import { VadDetector } from "./VoiceActivityDetector";

export class SpeechChunks {
  private static readonly SAMPLE_RATE = 16000;
  private static readonly START_THRESHOLD = 0.6;
  private static readonly END_THRESHOLD = 0.45;
  private static readonly MIN_SILENCE_DURATION_MS = 2000;
  private static readonly SPEECH_PAD_MS = 500;
  private static readonly WINDOW_SIZE_SAMPLES = 512;

  private chunks: number[][];
  private microphoneAudio: MicrophoneAudio;
  private vadDetector: VadDetector;
  private isSpeechActive: boolean;
  private onSpeechStart: () => void;
  private onSpeechEnd: (blob: Blob) => void;
  private onAudioComplete?: (blob: Blob) => void;

  constructor(
    onSpeechStart: () => void,
    onSpeechEnd: (blob: Blob) => void,
    onAudioComplete?: (blob: Blob) => void
  ) {
    this.chunks = [];
    this.isSpeechActive = false;

    this.microphoneAudio = new MicrophoneAudio({
      sampleRate: SpeechChunks.SAMPLE_RATE,
      windowSizeSamples: SpeechChunks.WINDOW_SIZE_SAMPLES,
      onAudioData: this.processAudioData.bind(this),
    });

    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onAudioComplete = onAudioComplete;

    this.vadDetector = new VadDetector(
      SpeechChunks.START_THRESHOLD,
      SpeechChunks.END_THRESHOLD,
      SpeechChunks.SAMPLE_RATE,
      SpeechChunks.MIN_SILENCE_DURATION_MS,
      SpeechChunks.SPEECH_PAD_MS
    );

    console.log("SpeechChunks initialized");
  }

  private async processAudioData(audioData: Float32Array): Promise<void> {
    try {
      const result = await this.vadDetector.apply(audioData, false);

      if (result.start !== undefined) {
        this.isSpeechActive = true;
        console.log("Speech start detected");
        this.onSpeechStart();
      } else if (result.end !== undefined) {
        this.isSpeechActive = false;
        console.log("Speech end detected");

        // Create WAV blob from collected chunks
        const audioBlob = this.getBlob();

        // Send empty blob as signal for UI
        this.onSpeechEnd(new Blob([]));

        // Send complete audio if callback provided
        if (this.onAudioComplete && audioBlob.size > 0) {
          this.onAudioComplete(audioBlob);
        }

        // Clear chunks after sending
        this.chunks = [];
        return;
      }

      if (this.isSpeechActive) {
        this.chunks.push(Array.from(audioData));
      }
    } catch (error) {
      console.error("Error processing audio data", error);
    }
  }

  async start(): Promise<void> {
    console.log("Starting SpeechChunks");
    await this.microphoneAudio.start();
  }

  stop(): void {
    console.log("Stopping SpeechChunks");
    this.microphoneAudio.stop();
    this.vadDetector.reset();
    this.isSpeechActive = false;
  }

  getSpeechChunks(): number[][] {
    console.log(`Returning ${this.chunks.length} speech chunks`);
    const speechChunks = this.chunks;
    this.chunks = [];
    return speechChunks;
  }

  getBlob(): Blob {
    console.log("Creating audio blob from speech chunks");
    const combinedChunks = this.chunks;
    const combinedLength = combinedChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );
    const combinedAudio = new Float32Array(combinedLength);
    let offset = 0;
    for (const chunk of combinedChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    const intData = new Int16Array(combinedAudio.length);
    for (let i = 0; i < combinedAudio.length; i++) {
      const s = Math.max(-1, Math.min(1, combinedAudio[i]));
      intData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + intData.length * 2, true);
    this.writeString(view, 8, "WAVE");

    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, SpeechChunks.SAMPLE_RATE, true);
    view.setUint32(28, SpeechChunks.SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    this.writeString(view, 36, "data");
    view.setUint32(40, intData.length * 2, true);

    const blob = new Blob([header, intData], { type: "audio/wav" });
    console.log(`Created blob of size ${blob.size} bytes`);
    return blob;
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  async close(): Promise<void> {
    console.log("Closing SpeechChunks");
    this.stop();
    await this.vadDetector.close();
  }
}
