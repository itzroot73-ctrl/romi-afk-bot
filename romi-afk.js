require('dotenv').config();

const mineflayer = require('mineflayer');
const chalk = require('chalk');
chalk.level = 1;
const readline = require('readline');
const fs = require('fs');
const pathfinder = require('mineflayer-pathfinder').pathfinder;

const config = {
  host: process.env.HOST || 'localhost',
  port: parseInt(process.env.PORT) || 25565,
  username: process.env.USERNAME || 'Romi',
  version: process.env.VERSION || '1.20.1',
  reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 10000,
  antiAfkInterval: parseInt(process.env.ANTI_AFK_INTERVAL) || 20000,
  interval: parseInt(process.env.INTERVAL) || 60000,
  chestFrom: {
    x: parseInt(process.env.CHEST_FROM_X) || 0,
    y: parseInt(process.env.CHEST_FROM_Y) || 64,
    z: parseInt(process.env.CHEST_FROM_Z) || 0
  },
  chestTo: {
    x: parseInt(process.env.CHEST_TO_X) || 0,
    y: parseInt(process.env.CHEST_TO_Y) || 64,
    z: parseInt(process.env.CHEST_TO_Z) || 0
  },
  discord: process.env.DISCORD_TOKEN ? {
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID
  } : null
};

let bot = null;
let antiAfkInterval = null;
let chestInterval = null;

function timestamp() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

function logSystem(msg) {
  console.log(`[${timestamp()}] ${chalk.yellow('[SYSTEM]')} ${msg}`);
}

function logChat(msg) {
  console.log(`[${timestamp()}] ${chalk.cyan('[CHAT]')} ${msg}`);
}

function logSuccess(msg) {
  console.log(`[${timestamp()}] ${chalk.green('[SUCCESS]')} ${msg}`);
}

function logError(msg) {
  console.log(`[${timestamp()}] ${chalk.red('[ERROR]')} ${msg}`);
}

function printHeader() {
  const ascii = [
    ' _____   ____  __  __ _____ ',
    '|  __ \\ / __ \\|  \\/  |_   _|',
    '| |__) | |  | | \\  / | | |  ',
    '|  _  /| |  | | |\\/| | | |  ',
    '| | \\ \\| |__| | |  | |_| |_ ',
    '|_|  \\_\\\\____/|_|  |_|_____|'
  ];
  ascii.forEach(line => console.log(chalk.cyan(line)));
  console.log(chalk.gray(`  Default IP: ${config.host}:${config.port}`));
  console.log(chalk.gray(`  Default Username: ${config.username}`));
  console.log(chalk.gray(`  Version: ${config.version}`));
  console.log('');
}

function createBot() {
  if (bot) {
    bot.quit();
  }

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version
  });

  bot.loadPlugin(require('mineflayer-pathfinder').pathfinder);

  bot.on('login', () => {
    logSuccess(`Logged in as ${bot.username} on ${config.host}:${config.port}`);
  });

  bot.on('message', (message) => {
    const msg = message.toString();
    logChat(msg);

    if (discordClient) {
      const channel = discordClient.channels.cache.get(config.discord.channelId);
      if (channel) {
        channel.send(`[MC] ${msg}`).catch(() => {});
      }
    }

    if (msg.startsWith('!setip')) {
      const args = msg.split(' ');
      if (args[1]) {
        const parts = args[1].split(':');
        config.host = parts[0];
        config.port = parts[1] ? parseInt(parts[1]) : 25565;
        logSystem(`IP set to ${config.host}:${config.port}`);
        bot.chat(`Server IP set to ${config.host}:${config.port}`);
        scheduleReconnect(true);
      }
    } else if (msg.startsWith('!setname')) {
      const args = msg.split(' ');
      if (args[1]) {
        config.username = args[1];
        logSystem(`Username set to ${config.username}`);
        bot.chat(`Username set to ${config.username}`);
        scheduleReconnect(true);
      }
    } else if (msg.startsWith('!afk on')) {
      logSystem('Command: !afk on');
      startAntiAfk();
    } else if (msg.startsWith('!afk off')) {
      logSystem('Command: !afk off');
      stopAntiAfk();
    } else if (msg.startsWith('!help')) {
      logSystem('Command: !help');
      bot.chat('Commands: !afk on, !afk off, !status, !help, !setip <ip:port>, !setname <name>, !sort on, !sort off, !repeat on <msg>, !repeat off');
    } else if (msg.startsWith('!status')) {
      logSystem('Command: !status');
      const health = Math.floor(bot.health);
      const food = bot.food;
      bot.chat(`Health: ${health}/20, Food: ${food}/20`);
    } else if (msg.startsWith('!sort on')) {
      logSystem('Command: !sort on');
      startChestSort();
      bot.chat('Chest sorting enabled!');
    } else if (msg.startsWith('!sort off')) {
      logSystem('Command: !sort off');
      stopChestSort();
      bot.chat('Chest sorting disabled!');
    } else if (msg.startsWith('!repeat')) {
      const args = msg.split(' ');
      if (args[1] === 'on' && args[2]) {
        repeatMessage = args.slice(2).join(' ');
        logSystem(`Repeat enabled: "${repeatMessage}"`);
        bot.chat(`Repeat enabled: "${repeatMessage}"`);
        if (repeatInterval) clearInterval(repeatInterval);
        repeatInterval = setInterval(() => {
          if (bot && bot.player) {
            bot.chat(repeatMessage);
            logSystem(`Repeated: ${repeatMessage}`);
          }
        }, 6000);
      } else if (args[1] === 'off') {
        if (repeatInterval) {
          clearInterval(repeatInterval);
          repeatInterval = null;
        }
        repeatMessage = null;
        logSystem('Repeat disabled');
        bot.chat('Repeat disabled!');
      } else {
        bot.chat('Usage: !repeat on <message> or !repeat off');
      }
    } else if (msg.startsWith('!server')) {
      bot.chat(`Current Server: ${config.host}:${config.port}`);
    }
  });

  bot.on('kick', (reason) => {
    logError(`Kicked: ${reason}`);
    scheduleReconnect(false);
  });

  bot.on('disconnect', () => {
    logError('Disconnected from server');
    scheduleReconnect(false);
  });

  bot.on('error', (err) => {
    logError(err.message);
  });
}

function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);

  bot.chat('AFK Mode Enabled');
  logSuccess('AFK Mode Enabled');

  antiAfkInterval = setInterval(() => {
    if (!bot || !bot.player) return;

    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);

    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * Math.PI;
    bot.look(yaw, pitch, false);

    logSystem('Anti-AFK: Jumped and rotated');
  }, config.antiAfkInterval);
}

function stopAntiAfk() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
  bot.chat('AFK Mode Disabled');
  logSuccess('AFK Mode Disabled');
}

function scheduleReconnect(immediate) {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
  
  const delay = immediate ? 1000 : config.reconnectDelay;
  logSystem(`Reconnecting in ${delay / 1000} seconds...`);
  
  setTimeout(() => {
    logSystem('Attempting to reconnect...');
    createBot();
  }, delay);
}

function moveTo(x, y, z) {
  return new Promise((resolve) => {
    const goal = new pathfinder.goals.GoalNear(x, y, z, 2);
    bot.pathfinder.setGoal(goal);
    
    const checkArrival = setInterval(() => {
      const pos = bot.entity.position;
      const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2 + (pos.z - z) ** 2);
      if (dist < 2) {
        clearInterval(checkArrival);
        setTimeout(resolve, 500);
      }
    }, 500);
  });
}

async function openChest(x, y, z) {
  const pos = { x, y, z };
  const block = bot.blockAt(pos);
  if (!block || block.name !== 'chest') {
    logError(`No chest at ${x}, ${y}, ${z}`);
    return null;
  }
  
  try {
    const chest = await bot.openContainer(block);
    return chest;
  } catch (err) {
    logError(`Cannot open chest: ${err.message}`);
    return null;
  }
}

async function sortChests() {
  if (!config.chestFrom || !config.chestTo) {
    logSystem('Chest positions not configured');
    return;
  }

  logSystem('Starting chest sorting...');

  try {
    await moveTo(config.chestFrom.x, config.chestFrom.y, config.chestFrom.z);

    const fromChest = await openChest(config.chestFrom.x, config.chestFrom.y, config.chestFrom.z);
    if (!fromChest) return;

    const items = fromChest.items();
    const bones = items.filter(item => item.name === 'bone');
    const arrows = items.filter(item => item.name === 'arrow');
    
    if (bones.length === 0 && arrows.length === 0) {
      logSystem('No bones or arrows in spawner chest');
      fromChest.close();
      return;
    }

    if (arrows.length > 0) {
      logSystem(`Found ${arrows.length} arrows - dropping...`);
      for (const arrow of arrows) {
        await fromChest.clickWindow(arrow.slot, 0, 0);
        await new Promise(r => setTimeout(r, 100));
        bot.toss(arrow.type, null, arrow.count);
        await new Promise(r => setTimeout(r, 200));
      }
      logSuccess(`Dropped ${arrows.length} arrows`);
    }

    const remainingBones = fromChest.items().filter(item => item.name === 'bone');
    
    if (remainingBones.length > 0) {
      logSystem(`Found ${remainingBones.length} bones - moving to destination...`);
    }
    
    fromChest.close();

    if (remainingBones.length > 0) {
      await new Promise(r => setTimeout(r, 500));
      await moveTo(config.chestTo.x, config.chestTo.y, config.chestTo.z);

      const toChest = await openChest(config.chestTo.x, config.chestTo.y, config.chestTo.z);
      if (!toChest) return;

      for (const bone of remainingBones) {
        await toChest.clickWindow(bone.slot, 0, 0);
        await new Promise(r => setTimeout(r, 200));
      }

      logSuccess(`Moved ${remainingBones.length} bones to destination chest`);
      toChest.close();
    }

  } catch (err) {
    logError(`Chest sorting error: ${err.message}`);
  }
}

function startChestSort() {
  if (chestInterval) clearInterval(chestInterval);
  
  const interval = config.interval || 60000;
  logSystem(`Chest sorting started (every ${interval/1000}s)`);
  
  sortChests();
  chestInterval = setInterval(sortChests, interval);
}

function stopChestSort() {
  if (chestInterval) {
    clearInterval(chestInterval);
    chestInterval = null;
  }
  logSystem('Chest sorting stopped');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  const args = input.trim().split(' ');
  const cmd = args[0].toLowerCase();

  if (cmd === 'setip') {
    if (args[1]) {
      const parts = args[1].split(':');
      config.host = parts[0];
      config.port = parts[1] ? parseInt(parts[1]) : 25565;
      logSystem(`IP set to ${config.host}:${config.port}`);
      if (bot) scheduleReconnect(true);
    } else {
      console.log(chalk.red('Usage: setip <ip:port>'));
    }
  } else if (cmd === 'setname') {
    if (args[1]) {
      config.username = args[1];
      logSystem(`Username set to ${config.username}`);
      if (bot) scheduleReconnect(true);
    } else {
      console.log(chalk.red('Usage: setname <username>'));
    }
  } else if (cmd === 'status') {
    if (bot && bot.player) {
      const health = Math.floor(bot.health);
      const food = bot.food;
      console.log(chalk.white(`Health: ${health}/20, Food: ${food}/20`));
    } else {
      console.log(chalk.red('Bot not connected'));
    }
  } else if (cmd === 'help') {
    console.log(chalk.gray('Console Commands: setip <ip:port>, setname <username>, status, exit'));
    console.log(chalk.gray('Chat Commands: !afk on, !afk off, !status, !help, !setip <ip:port>, !setname <name>, !server'));
  } else if (cmd === 'exit') {
    logSystem('Shutting down...');
    if (antiAfkInterval) clearInterval(antiAfkInterval);
    if (bot) bot.quit();
    rl.close();
    process.exit(0);
  }
});

let discordClient = null;
let repeatMessage = null;
let repeatInterval = null;

async function startDiscordBot() {
  if (!config.discord || !config.discord.token || !config.discord.channelId) {
    logSystem('Discord not configured - skipping');
    return;
  }

  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    discordClient.once('ready', () => {
      logSuccess(`Discord bot logged in as ${discordClient.user.tag}`);
    });

    discordClient.on('messageCreate', async (message) => {
      if (message.channelId !== config.discord.channelId) return;
      if (message.author.bot) return;

      const content = message.content;
      logSystem(`[Discord] ${message.author.username}: ${content}`);

      if (bot && bot.player) {
        bot.chat(content);
        logSuccess(`Sent to MC: ${content}`);
      } else {
        logError('Bot not connected - cannot send message');
      }
    });

    await discordClient.login(config.discord.token);
  } catch (err) {
    logError(`Discord error: ${err.message}`);
  }
}

process.on('SIGINT', () => {
  logSystem('Shutting down...');
  if (antiAfkInterval) clearInterval(antiAfkInterval);
  if (chestInterval) clearInterval(chestInterval);
  if (repeatInterval) clearInterval(repeatInterval);
  if (bot) bot.quit();
  if (discordClient) discordClient.destroy();
  rl.close();
  process.exit(0);
});

printHeader();
logSystem('Starting bot...');
createBot();
startDiscordBot();
