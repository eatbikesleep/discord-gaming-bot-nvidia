import { PassThrough } from 'node:stream';
import prism from 'prism-media';
import { ttsClient, metadata, CANCELLED } from './riva.js';
import { config } from './config.js';

/**
 * Streams text through NVIDIA Riva (Magpie) TTS. Returns a Readable of
 * 48kHz stereo s16le PCM, ready for createAudioResource({ inputType: StreamType.Raw }).
 */
export async function synthesize(text, signal) {
  const call = ttsClient.SynthesizeOnline(metadata(config.ttsFunctionId));
  call.write({
    text,
    language_code: config.language,
    encoding: 'LINEAR_PCM',
    sample_rate_hz: config.ttsRate,
    voice_name: config.ttsVoice,
  });
  call.end();

  // Riva PCM (mono, ttsRate) -> Discord PCM (stereo, 48kHz)
  const ffmpeg = new prism.FFmpeg({
    args: [
      '-analyzeduration', '0', '-loglevel', '0',
      '-f', 's16le', '-ar', String(config.ttsRate), '-ac', '1', '-i', '-',
      '-f', 's16le', '-ar', '48000', '-ac', '2',
    ],
  });
  const pcm = new PassThrough();
  pcm.pipe(ffmpeg);

  call.on('data', (r) => { if (r.audio?.length) pcm.write(r.audio); });
  call.on('end', () => pcm.end());
  call.on('error', (e) => {
    if (e.code === CANCELLED) return;
    ffmpeg.destroy(new Error(`NVIDIA TTS: ${e.details || e.message}`));
  });

  const stop = () => { try { call.cancel(); } catch {} pcm.destroy(); };
  ffmpeg.on('close', stop);
  signal?.addEventListener('abort', () => { stop(); ffmpeg.destroy(); }, { once: true });
  return ffmpeg;
}
