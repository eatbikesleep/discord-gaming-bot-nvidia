import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { VoiceSession } from './audio.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const sessions = new Map(); // guildId -> VoiceSession

client.once(Events.ClientReady, (c) => console.log(`Logged in as ${c.user.tag}. Run /join in a voice channel.`));

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand() || !i.guildId) return;
  const reply = (content) => (i.deferred ? i.editReply(content) : i.reply({ content, flags: MessageFlags.Ephemeral }));

  try {
    const session = sessions.get(i.guildId);

    if (i.commandName === 'join') {
      const channel = i.member.voice?.channel;
      if (!channel) return reply('Join a voice channel first.');
      session?.destroy();
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const s = new VoiceSession({ channel, ownerId: i.user.id });
      s.onDestroy = () => { if (sessions.get(i.guildId) === s) sessions.delete(i.guildId); };
      sessions.set(i.guildId, s);
      try {
        await s.start();
      } catch (e) {
        s.destroy();
        console.error('[join]', e);
        return reply(`Could not connect: ${e.message}`);
      }
      return reply(`Listening in **${channel.name}**. Just talk.`);
    }

    if (!session) return reply('Not in a voice channel. Use /join first.');

    if (i.commandName === 'leave') { session.destroy(); return reply('Left the channel.'); }
    if (i.commandName === 'reset') { session.brain.reset(); return reply('Memory cleared.'); }
    if (i.commandName === 'game') {
      const name = i.options.getString('name', true);
      session.brain.setGame(name);
      return reply(`Game set to **${name}**.`);
    }
  } catch (e) {
    console.error('[interaction]', e);
    try { await reply('Something went wrong.'); } catch {}
  }
});

// Leave if the owner leaves the channel.
client.on(Events.VoiceStateUpdate, (oldS, newS) => {
  const s = sessions.get(oldS.guild.id);
  if (s && oldS.id === s.ownerId && oldS.channelId && newS.channelId !== oldS.channelId) s.destroy();
});

process.on('unhandledRejection', (e) => console.error('[unhandled]', e));
process.on('SIGINT', () => { sessions.forEach((s) => s.destroy()); client.destroy(); process.exit(0); });

client.login(config.discordToken);
