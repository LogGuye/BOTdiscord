const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const fs = require('fs');

// Đọc token và danh sách viết tắt
const token = fs.readFileSync('token.txt', 'utf8').trim();
const danhSachVietTat = JSON.parse(fs.readFileSync('viettat.json', 'utf8'));

// 👉 Gọi cả 2 module slash command
const xdach = require('./xidach_slash.js');
const music = require('./music_slash.js'); // ✅ Thêm dòng này

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ✅ Slash command xử lý cho cả Xì Dách và Music
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  await xdach.execute(interaction);
  await music.execute(interaction); // ✅ Gọi thêm music lệnh
});

// 🔧 Thay thế từ viết tắt từ file JSON
function thayVietTat(vănBản) {
  const từ = vănBản.split(/\s+/).map(t => {
    const từThường = t.toLowerCase();
    return danhSachVietTat[từThường] || t;
  });
  return từ.join(' ');
}

// 🔧 Phân tích biểu cảm
function phânTíchCảmXúc(vănBản) {
  return vănBản
    .replace(/(:\)+|=\)+)/g, 'mặt cười')
    .replace(/(:\(+|=\(+|:'\()/g, 'mặt buồn')
    .replace(/<3/g, 'trái tim')
    .replace(/:v/g, 'cười đểu')
    .replace(/:o/g, 'ngạc nhiên')
    .replace(/:D/g, 'hahahahaha');
}

// ✅ Biến toàn cục
let hangDoi = [];
let dangNoi = false;
let kếtNốiVoice = null;
let voiceChannelID = null;

client.once('ready', () => {
  console.log(`✅ Bot đăng nhập với tên ${client.user.tag}`);
  console.log(`👉 m_ để nói | b_join để vào voice | b_out để rời`);
});

// ✅ Lệnh điều khiển bot voice
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith('b_')) return;

  const lệnh = msg.content.slice(2).trim().toLowerCase();
  const voiceChannel = msg.member.voice.channel;

  if (lệnh === 'join') {
    if (!voiceChannel) return msg.reply('⚠️ Bạn cần vào kênh thoại trước!');
    voiceChannelID = voiceChannel.id;

    try {
      kếtNốiVoice = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: msg.guild.id,
        adapterCreator: msg.guild.voiceAdapterCreator,
      });
      msg.reply('✅ Bot đã vào kênh!');
    } catch (err) {
      console.error('❌ Lỗi khi join:', err);
      msg.reply('❌ Bot không thể vào kênh.');
    }
  }

  // ✅ Di chuyển phần này ra ngoài, ngang cấp với các lệnh khác
  if (lệnh === 'help') {
    return msg.reply({
      content:
        `📘 **DANH SÁCH LỆNH BOT**\n\n` +
        `🎙️ **Hỗ trợ giọng nói (TTS)**:\n` +
        `• \`m_ [nội dung]\` – Bot sẽ đọc to văn bản bạn nhập\n` +
        `• \`b_join\` – Bot tham gia kênh voice của bạn\n` +
        `• \`b_out\` – Bot rời khỏi kênh voice\n\n` +

        `🃏 **Xì Dách (Slash Command)**:\n` +
        `• \`/xd_start [coin]\`, \`/xd_join\`, \`/xd_deal\`, \`/xd_hit\`, \`/xd_stand\`, ...\n` +
        `• \`/xd_baicuatoi\`, \`/xd_check\`, \`/xd_done\`, \`/xd_coin\`, \`/xd_top\`\n` +
        `• \`/xd_reset\`, \`/xd_setcoin\`, \`/xd_luat\`, \`/xd_lenh\`\n` +
        `• \`/xd_startbot [coin]\` – Chơi solo với BOT\n\n` +

        `🎵 **Nhạc (Slash Command)**:\n` +
        `• \`/save [note] [link]\` – Lưu một link nhạc cá nhân\n` +
        `• \`/list\` – Xem danh sách các link nhạc bạn đã lưu\n\n` +

        `💡 **Gợi ý**:\n` +
        `• Bạn nên dùng lệnh slash bằng dấu \`/\` để tự động gợi ý trong Discord.\n` +
        `• Các lệnh prefix \`b_\` và \`m_\` chỉ dùng cho bot voice TTS.`,
      ephemeral: false
    });
  }
  
  if (lệnh === 'out') {
    if (kếtNốiVoice) {
      kếtNốiVoice.destroy();
      kếtNốiVoice = null;
      msg.reply('👋 Bot đã rời khỏi kênh.');
    } else {
      msg.reply('⚠️ Bot không ở trong kênh.');
    }
  }
});

// ✅ Lệnh nói bằng TTS
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith('m_')) return;

  let vănBản = msg.content.slice(2).trim();
  if (!vănBản) return msg.reply('❗ Bạn chưa nhập nội dung cần nói.');

  vănBản = thayVietTat(vănBản);
  vănBản = phânTíchCảmXúc(vănBản);

  const thànhViên = msg.member;
  const voiceChannel = thànhViên.voice.channel;
  if (!voiceChannel) return msg.reply('⚠️ Bạn cần vào kênh thoại trước.');

  voiceChannelID = voiceChannel.id;

  hangDoi.push({
    vănBản,
    guildId: msg.guild.id,
    adapterCreator: msg.guild.voiceAdapterCreator
  });

  if (!dangNoi) {
    xửLýHàngĐợi();
  }
});

// ✅ Xử lý hàng đợi nói
async function xửLýHàngĐợi() {
  if (hangDoi.length === 0) return;

  const lệnh = hangDoi.shift();
  dangNoi = true;

  try {
    if (!kếtNốiVoice || kếtNốiVoice.state.status === 'destroyed') {
      kếtNốiVoice = joinVoiceChannel({
        channelId: voiceChannelID,
        guildId: lệnh.guildId,
        adapterCreator: lệnh.adapterCreator,
      });

      const kiểmTraNgười = setInterval(() => {
        const guild = client.guilds.cache.get(lệnh.guildId);
        const channel = guild.channels.cache.get(voiceChannelID);
        const người = channel.members.filter(m => !m.user.bot).size;

        if (người === 0) {
          console.log('👋 Không còn ai trong kênh. Bot rời kênh.');
          kếtNốiVoice.destroy();
          kếtNốiVoice = null;
          clearInterval(kiểmTraNgười);
        }
      }, 10000);
    }

    const url = googleTTS.getAudioUrl(lệnh.vănBản, { lang: 'vi', slow: false });
    const âmThanh = createAudioResource(url);
    const trìnhPhát = createAudioPlayer();

    kếtNốiVoice.subscribe(trìnhPhát);
    trìnhPhát.play(âmThanh);

    trìnhPhát.on(AudioPlayerStatus.Idle, () => {
      console.log(`✅ Nói xong: ${lệnh.vănBản}`);
      dangNoi = false;
      xửLýHàngĐợi();
    });

  } catch (err) {
    console.error('❌ Lỗi xử lý hàng đợi:', err);
    dangNoi = false;
    xửLýHàngĐợi();
  }
}

client.login(token);
