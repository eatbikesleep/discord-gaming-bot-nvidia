import 'dotenv/config';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'NVIDIA_API_KEY'];
const missing = required.filter((k) => !process.env[k] || /^(your-|nvapi-your)/.test(process.env[k]));
if (missing.length) {
  console.error(`Missing/placeholder values in .env: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  nvidiaKey: process.env.NVIDIA_API_KEY,
  llmModel: process.env.NVIDIA_LLM_MODEL || 'meta/llama-3.1-8b-instruct',
  asrFunctionId: process.env.NVIDIA_ASR_FUNCTION_ID || '1598d209-5e27-4d3c-8079-4751568b1081',
  ttsFunctionId: process.env.NVIDIA_TTS_FUNCTION_ID || '877104f7-e885-42b9-8de8-f6e4c6303969',
  ttsVoice: process.env.NVIDIA_TTS_VOICE || 'Magpie-Multilingual.EN-US.Aria',
  language: process.env.LANGUAGE_CODE || 'en-US',
  ttsRate: Number(process.env.TTS_SAMPLE_RATE || 22050),
};
