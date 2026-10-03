# Discord Gaming Voice Bot (free NVIDIA stack)

**Repository:** https://github.com/eatbikesleep/discord-gaming-bot-nvidia  
**Terms of Service:** [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) | **Privacy Policy:** [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)

> **Security note:** Never commit `.env` or your `nvapi-...` key to GitHub. `.env` is already in `.gitignore` — keep it that way.

Talk to an AI gaming assistant by voice while you play on Xbox.
Pipeline: Discord mic -> NVIDIA Parakeet (STT) -> NVIDIA-hosted LLM (streamed) -> NVIDIA Magpie (TTS) -> Discord voice. Talking over the bot interrupts it.
One free NVIDIA API key covers all three services.

## Files
| File | Role |
|---|---|
| `src/index.js` | Discord client, slash commands, session lifecycle |
| `src/audio.js` | Voice connection, PCM capture, barge-in, playback queue |
| `src/stt.js` | Streams 16kHz mono PCM to Riva ASR over gRPC |
| `src/llmClient.js` | Streaming chat via `integrate.api.nvidia.com/v1`, memory, sentence chunking |
| `src/tts.js` | Riva TTS gRPC stream -> 48kHz stereo PCM |
| `src/riva.js` | gRPC clients + auth metadata (loads `proto/`) |
| `src/persona.js` | System prompt, greeting, speech cleanup |
| `src/config.js`, `src/commands.js`, `src/deploy-commands.js` | env, slash commands, registration |
| `proto/` | Riva protobuf definitions (NVIDIA, Apache-2.0) |

## 1. Install
Node.js 20+.
```
npm install
```

## 2. Fill in .env
1. Discord Developer Portal -> New Application -> Bot -> Reset Token -> `DISCORD_TOKEN`; Application ID -> `DISCORD_CLIENT_ID`.
2. OAuth2 -> URL Generator: scopes `bot` + `applications.commands`; permissions View Channels, Connect, Speak. Open the URL to add the bot to your server.
3. Optional `GUILD_ID` (your server ID) for instant command registration.
4. NVIDIA: sign in at https://build.nvidia.com, click Get API Key on any model, paste the `nvapi-...` key into `NVIDIA_API_KEY`.
5. Function IDs: open the model pages `parakeet-ctc-1_1b-asr` and `magpie-tts-multilingual` on build.nvidia.com, open the API tab, and copy each Function ID into `NVIDIA_ASR_FUNCTION_ID` / `NVIDIA_TTS_FUNCTION_ID` if they differ from the defaults. Free hosted endpoints change over time, so re-check these first when speech fails.
6. `NVIDIA_LLM_MODEL`: any chat model on build.nvidia.com. Small non-reasoning models (default `meta/llama-3.1-8b-instruct`) are fastest. Avoid reasoning models; they stall before speaking.

## 3. Register slash commands
```
npm run deploy
```

## 4. Run
```
npm start
```

## 5. Use from Xbox Discord
1. Link Xbox in Discord: User Settings -> Connections -> Xbox.
2. Join your voice channel on phone or PC, then use the Xbox icon in the voice panel to move voice to your console (menu names vary by version).
3. `/join` from your phone/PC. The bot enters your channel and says "Ready."
4. Talk. Speak over the bot to interrupt. `/game <title>`, `/reset`, `/leave` also available.

## Audio pipeline
- Capture: Discord Opus packets -> `prism.opus.Decoder` configured for 16kHz mono PCM (no resampling code needed).
- STT: each PCM chunk is written to a Riva `StreamingRecognize` gRPC stream; ending the stream flushes the final transcript.
- LLM: transcript -> streamed chat completion -> chunks split at clause/sentence boundaries.
- TTS: each chunk starts a Riva `SynthesizeOnline` stream immediately (prefetched while the previous chunk plays); ffmpeg converts to 48kHz stereo PCM for Discord.
- Interrupt: 250ms of your speech aborts the LLM request, cancels the gRPC TTS calls, and stops playback.

## Troubleshooting
- **"Missing/placeholder values in .env":** fill in the Discord and NVIDIA keys.
- **`[stt]` or `[tts]` errors with NOT_FOUND / UNAUTHENTICATED / PERMISSION_DENIED:** wrong or stale Function ID, or a bad `nvapi-` key. Re-copy from the model's API tab.
- **`[llm]` 404:** model ID not in the free catalog; pick another from build.nvidia.com.
- **429 / RESOURCE_EXHAUSTED:** free tier is rate limited (about 40 requests/minute observed). Each reply uses 1 LLM call plus 1 TTS call per chunk. Ask for shorter answers, use fewer chunks (edit `persona.js`), or wait a minute.
- **Bot hears nothing:** run `/join` yourself (it only listens to you), check your Xbox mic is not muted, check the bot is not server-deafened.
- **Transcripts wrong/empty:** speak after a short pause; try `LANGUAGE_CODE=en-US`; use a headset.
- **Bot interrupts itself:** game audio leaking into your mic. Use a headset; raise `BARGE_IN_BYTES` in `src/audio.js`.
- **Slash commands missing:** `npm run deploy`; global commands can take up to an hour without `GUILD_ID`.
- **Voice connect fails:** `npm update` (`@discordjs/voice`, `@snazzah/davey`), allow outbound UDP.
- **Free hosted endpoints can queue under load:** first-token delay varies; this is normal for free tiers.

## Latency optimization
- Use a small LLM (`meta/llama-3.1-8b-instruct` or similar); latency is mostly time to first token.
- Lower `SILENCE_MS` in `src/audio.js` (default 700; 500 is aggressive).
- gRPC channels stay open between utterances, so there is no reconnect cost.
- First reply chunk can flush at a clause (30+ chars); keep persona answers short (1-3 sentences).
- Run on a wired connection; avoid hotspot upstream.
- If TTS first-audio is slow, try a smaller `TTS_SAMPLE_RATE` (e.g. 16000).
