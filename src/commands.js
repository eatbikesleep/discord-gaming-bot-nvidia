import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder().setName('join').setDescription('Join your voice channel and start listening'),
  new SlashCommandBuilder().setName('leave').setDescription('Leave the voice channel'),
  new SlashCommandBuilder().setName('reset').setDescription('Clear conversation memory'),
  new SlashCommandBuilder()
    .setName('game')
    .setDescription('Tell the assistant which game you are playing')
    .addStringOption((o) => o.setName('name').setDescription('Game title, e.g. Diablo IV').setRequired(true)),
].map((c) => c.toJSON());
