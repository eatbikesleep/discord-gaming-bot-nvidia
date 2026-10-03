import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { config } from './config.js';

const protoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'proto');
const HOST = 'grpc.nvcf.nvidia.com:443';

const def = protoLoader.loadSync(['riva/proto/riva_asr.proto', 'riva/proto/riva_tts.proto'], {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [protoDir],
});
const pkg = grpc.loadPackageDefinition(def).nvidia.riva;

// Shared channels (kept warm between utterances = lower latency).
const creds = grpc.credentials.createSsl();
export const asrClient = new pkg.asr.RivaSpeechRecognition(HOST, creds);
export const ttsClient = new pkg.tts.RivaSpeechSynthesis(HOST, creds);

export function metadata(functionId) {
  const md = new grpc.Metadata();
  md.set('function-id', functionId);
  md.set('authorization', `Bearer ${config.nvidiaKey}`);
  return md;
}

export const CANCELLED = grpc.status.CANCELLED;
