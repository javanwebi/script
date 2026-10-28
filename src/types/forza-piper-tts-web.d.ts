// The Piper browser runtime is installed inside the Railway Docker build.
// CI typechecking also runs after npm ci, without a runtime load.
declare module '@mintplex-labs/piper-tts-web' {
  export class TtsSession {
    constructor(options: {
      voiceId: string;
      wasmPaths: { onnxWasm: string; piperData: string; piperWasm: string };
      progress?: (event: { loaded: number; total: number }) => void;
    });
    waitReady: Promise<void>;
    predict(text: string): Promise<Blob>;
  }
}
