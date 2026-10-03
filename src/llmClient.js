import OpenAI from 'openai';
import { config } from './config.js';
import { buildSystemPrompt, cleanForSpeech } from './persona.js';

const client = new OpenAI({ apiKey: config.nvidiaKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
const MAX_TURNS = 16; // messages kept in memory

export class LlmClient {
  constructor() {
    this.history = [];
    this.game = null;
  }

  reset() { this.history = []; }
  setGame(name) { this.game = name; }

  addUser(text) {
    const last = this.history[this.history.length - 1];
    if (last?.role === 'user') last.content += ` ${text}`; // previous turn was interrupted before any reply
    else this.history.push({ role: 'user', content: text });
    if (this.history.length > MAX_TURNS) this.history.splice(0, this.history.length - MAX_TURNS);
    while (this.history[0]?.role === 'assistant') this.history.shift();
  }

  /** Streams the reply, yielding speakable chunks as soon as they complete. */
  async *respond(userText, signal) {
    this.addUser(userText);
    let full = '';
    let buf = '';
    let first = true;

    try {
      const stream = await client.chat.completions.create(
        {
          model: config.llmModel,
          messages: [{ role: 'system', content: buildSystemPrompt(this.game) }, ...this.history],
          max_tokens: 300,
          temperature: 0.6,
          stream: true,
        },
        { signal },
      );
      for await (const part of stream) {
        const delta = part.choices?.[0]?.delta?.content;
        if (!delta) continue;
        buf += delta;
        full += delta;

        let m;
        // First chunk may split on a clause to cut time-to-first-audio; later chunks need ~40+ chars
        // so we make fewer TTS requests (the free tier is rate limited).
        const re = first ? /^(.{30,}?[,;:.!?]["')\]]?\s)/s : /^(.{40,}?[.!?]["')\]]?\s)/s;
        while ((m = buf.match(re))) {
          const chunk = cleanForSpeech(m[0]).trim();
          buf = buf.slice(m[0].length);
          if (chunk.length > 1) { first = false; yield chunk; }
        }
      }
      const tail = cleanForSpeech(buf).trim();
      if (tail) yield tail;
    } finally {
      if (full.trim()) this.history.push({ role: 'assistant', content: full.trim() });
    }
  }
}
