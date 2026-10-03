import { asrClient, metadata, CANCELLED } from './riva.js';
import { config } from './config.js';

/**
 * Streams PCM (16kHz, mono, s16le) to NVIDIA Riva (Parakeet) while the user speaks.
 * Resolves with the final transcript once the stream ends.
 */
export function transcribe(pcm) {
  return new Promise((resolve) => {
    const call = asrClient.StreamingRecognize(metadata(config.asrFunctionId));
    const parts = [];
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { call.cancel(); } catch {}
      resolve(parts.join(' ').trim());
    };
    const timer = setTimeout(finish, 10_000);

    call.on('data', (res) => {
      for (const r of res.results || []) {
        const t = r.is_final && r.alternatives?.[0]?.transcript;
        if (t) parts.push(t.trim());
      }
    });
    call.on('end', finish);
    call.on('error', (e) => {
      if (e.code !== CANCELLED) console.error('[stt]', e.details || e.message);
      finish();
    });

    call.write({
      streaming_config: {
        config: {
          encoding: 'LINEAR_PCM',
          sample_rate_hertz: 16000,
          language_code: config.language,
          max_alternatives: 1,
          audio_channel_count: 1,
          enable_automatic_punctuation: true,
        },
        interim_results: false,
      },
    });

    pcm.on('data', (chunk) => { if (!settled) call.write({ audio_content: chunk }); });
    pcm.on('end', () => { if (!settled) call.end(); });
    pcm.on('error', (e) => { console.error('[stt] audio error:', e.message); if (!settled) call.end(); });
  });
}
