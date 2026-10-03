# Privacy Policy

**Last updated:** [DATE]

[BOT NAME] ("the Bot") is a Discord voice bot that lets you talk to an AI gaming assistant while you play. This policy explains what data the Bot handles and how.

## 1. What we collect
- **Voice data (transient):** While you are in a voice channel with the Bot, your microphone audio is streamed to speech-to-text and converted into text so the Bot can respond. Audio is processed in real time and is **not recorded or stored**.
- **Transcripts and conversation text (transient):** Speech-to-text transcripts are sent to a third-party LLM to generate responses. Conversation context for the current session is kept only in memory and is cleared when you use `/reset`, leave the channel, or the session ends.
- **Discord metadata:** The Bot sees your Discord user ID and the server/channel IDs needed to operate voice sessions, route commands, and respond to you. It does not read message content in text channels.

## 2. Third-party processors
To function, the Bot sends your voice transcripts and conversation text to NVIDIA-hosted services (Parakeet ASR, an NVIDIA-hosted LLM, and Magpie TTS). Audio and text are processed under NVIDIA's own terms and privacy policy, available at https://www.nvidia.com/en-us/about-nvidia/privacy/. The Bot owner does not control how NVIDIA handles this data. Do not use the Bot for sensitive or private conversations.

## 3. What we do NOT do
- We do not sell your data.
- We do not store recordings of your voice.
- We do not share conversation data with anyone other than the service providers listed above.
- We do not use your voice or transcripts to train models.

## 4. Data retention
Nothing is persisted. Session memory lives in RAM for the duration of a voice session and is discarded on `/reset`, `/leave`, or disconnect. Server admins may remove the Bot at any time, ending all sessions.

## 5. Children
The Bot is not directed at children under 13 (or the minimum age allowed by Discord). Do not use it if you are under that age.

## 6. Your choices
- Use `/reset` at any time to clear conversation memory.
- Use `/leave` to end the session immediately.
- Ask the server admin or Bot owner to remove the Bot from the server to stop all processing.

## 7. Contact
Questions or data concerns: [CONTACT EMAIL / DISCORD].

## 8. Changes
This policy may be updated from time to time. The "Last updated" date will be revised accordingly.
