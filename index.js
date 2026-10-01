const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('اپنا واٹس ایپ نمبر کنٹری کوڈ کے ساتھ لکھیں (مثلاً 923001234567): ');
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\n👉 آپ کا پیئرنگ کوڈ ہے: ${code}\n`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('کنیکشن ختم ہو گیا۔ دوبارہ جوڑ رہے ہیں...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ واٹس ایپ بوٹ کامیابی سے کنیکٹ ہو گیا ہے!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const from = msg.key.remoteJid;
            if (!from.endsWith('@g.us')) continue;

            const body = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || 
                         msg.message.videoMessage?.caption || '';

            const linkRegex = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+|facebook\.com\/[^\s]+|fb\.watch\/[^\s]+|tiktok\.com\/[^\s]+|instagram\.com\/[^\s]+)/i;

            if (linkRegex.test(body)) {
                try {
                    await sock.sendMessage(from, { delete: msg.key });
                    const sender = msg.key.participant;
                    await sock.sendMessage(from, { 
                        text: `@${sender.split('@')[0]} اس گروپ میں لنکس بھیجنا منع ہے!`,
                        mentions: [sender]
                    });
                } catch (err) {
                    console.log("Error deleting link:", err);
                }
            }
        }
    });
}

startBot();
