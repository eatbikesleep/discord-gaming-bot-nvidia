import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, entersState,
  VoiceConnectionStatus, AudioPlayerStatus, EndBehaviorType, StreamType, NoSubscriberBehavior,
} from '@discordjs/voice';
import prism from 'prism-media';
import { LlmClient } from './llmClient.js';
import { GREETING } from './persona.js';
import { transcribe } from './stt.js';
import { synthesize } from './tts.js';

const BARGE_IN_BYTES = 16000 * 2 * 0.25; // ~250ms of speech before interrupting (ignores coughs/clicks)
const MIN_UTTERANCE_BYTES = 16000 * 2 * 0.35; // ignore clips shorter than ~350ms
const SILENCE_MS = 700; // end-of-utterance silence

export class VoiceSession {
  constructor({ channel, ownerId }) {
    this.channel = channel;
    this.ownerId = ownerId;
    this.brain = new LlmClient();
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    this.abort = null; // AbortController of the current response
    this.speaking = false; // bot is thinking or talking
    this.listening = false;
    this.destroyed = false;
    this.player.on('error', (e) => console.error('[player]', e.message));
  }

  async start() {
    this.connection = joinVoiceChannel({
      channelId: this.channel.id,
      guildId: this.channel.guild.id,
      adapterCreator: this.channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    this.connection.on('error', (e) => console.error('[voice]', e.message));
    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
    this.connection.subscribe(this.player);

    // Auto-recover from brief disconnects, otherwise clean up.
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    this.connection.receiver.speaking.on('start', (userId) => {
      if (userId === this.ownerId) this.listen(userId);
    });

    this.say([GREETING]);
  }

  listen(userId) {
    if (this.listening || this.destroyed) return;
    this.listening = true;

    const opus = this.connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_MS },
    });
    const decoder = new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 320 });
    const pcm = opus.pipe(decoder);

    let bytes = 0;
    let interrupted = false;
    pcm.on('data', (c) => {
      bytes += c.length;
      if (!interrupted && bytes >= BARGE_IN_BYTES && this.speaking) {
        interrupted = true;
        this.interrupt();
      }
    });
    const onErr = (e) => console.error('[capture]', e.message);
    opus.on('error', onErr);
    decoder.on('error', onErr);

    transcribe(pcm)
      .then((text) => {
        this.listening = false;
        if (bytes < MIN_UTTERANCE_BYTES || text.length < 2) return;
        console.log(`[you] ${text}`);
        return this.respond(text);
      })
      .catch((e) => { this.listening = false; console.error('[pipeline]', e.message); });

    pcm.once('end', () => { this.listening = false; });
  }

  interrupt() {
    this.abort?.abort();
    this.player.stop(true);
  }

  respond(text) {
    return this.runSpeech((signal) => this.brain.respond(text, signal));
  }

  say(sentences) {
    return this.runSpeech(async function* () { yield* sentences; });
  }

  /** Pipelines text chunks -> TTS (fetched ahead of time) -> playback, in order. */
  async runSpeech(makeIterator) {
    this.abort?.abort();
    this.player.stop(true);
    const ac = new AbortController();
    this.abort = ac;
    const { signal } = ac;
    this.speaking = true;

    const queue = [];
    let done = false;
    let wake = null;
    const poke = () => { wake?.(); wake = null; };

    const producer = (async () => {
      try {
        for await (const chunk of makeIterator(signal)) {
          if (signal.aborted) break;
          const p = synthesize(chunk, signal);
          p.catch(() => {});
          queue.push(p);
          poke();
        }
      } catch (e) {
        if (!signal.aborted) console.error('[llm]', e.message);
      } finally {
        done = true;
        poke();
      }
    })();

    try {
      while (!signal.aborted) {
        if (queue.length) {
          let audio;
          try { audio = await queue.shift(); } catch (e) {
            if (!signal.aborted) console.error('[tts]', e.message);
            continue;
          }
          if (signal.aborted) { audio.destroy(); break; }
          await this.play(audio, signal);
        } else if (done) break;
        else await new Promise((r) => { wake = r; });
      }
    } finally {
      if (this.abort === ac) { this.speaking = false; this.abort = null; }
      ac.abort(); // stop any in-flight LLM/TTS work
      await producer.catch(() => {});
    }
  }

  play(stream, signal) {
    return new Promise((resolve) => {
      const resource = createAudioResource(stream, { inputType: StreamType.Raw });
      const finish = () => {
        this.player.off(AudioPlayerStatus.Idle, finish);
        signal.removeEventListener('abort', finish);
        stream.destroy();
        resolve();
      };
      this.player.on(AudioPlayerStatus.Idle, finish);
      signal.addEventListener('abort', finish);
      stream.on('error', (e) => { console.error('[audio]', e.message); finish(); });
      this.player.play(resource);
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort?.abort();
    this.player.stop(true);
    try { this.connection?.destroy(); } catch {}
    this.onDestroy?.();
  }
}
