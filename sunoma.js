import express from 'express';
import { toDataURL } from 'qrcode';
import SunoDeno from './suno-deno.js';
import whatsapp from 'wa-multi-session';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import OpenAI from "openai";
import audioToText from './stt.js';

import { API_KEY_OPENAI, SYSTEM_PROMPT, COOKIE, SESS, adminGroupJid } from "../../env.js";

const openai = new OpenAI({
  apiKey: API_KEY_OPENAI
});

// Initialize Express app
const app = express();
app.use(express.json());
const port = 82;

const { log, info, table } = console;

// States to manage session data
const states = {
  stores: {},
  config: {}
};



const suno = new SunoDeno(SESS, COOKIE);

// Initialize SunoDeno
async function initSuno() {
  await suno.init();
  log('SunoDeno initialized');
}

// Function to send messages to a group
async function sendToGroup(text, props = {}) {
  const { answering = null, isGroup = true, sessionId = "admin", to = adminGroupJid } = props;
  const options = { isGroup, sessionId, to, text };
  if (answering) {
    options.answering = answering;
  }
  return whatsapp.sendTextMessage(options);
}

// Get all sessions
app.get('/all', async (req, res, next) => {
  try {
    const stores = whatsapp.getAllSession();
    await sendToGroup("all stores: " + JSON.stringify(stores));
    res.status(200).json({ stores });
  } catch (error) {
    next(error);
  }
});

// Delete a session
app.get('/delete/:store', async (req, res, next) => {
  try {
    const { store } = req.params || "mujeeb";
    await whatsapp.deleteSession(store);
    res.status(200).send("Success Deleted " + store);
    if (states.stores[store]) delete states.stores[store];
    await sendToGroup("❌deleted store #" + store);
  } catch (error) {
    next(error);
  }
});

// Send message to a group
app.post('/send-message', async (req, res, next) => {
  try {
    const { text, symbol, method } = req.body;
    const answering = method === "get" ? answers[symbol] : null;
    const reswats = await sendToGroup(text, { answering });
    if (method === "set") answers[symbol] = reswats;
    res.json({ answering: reswats });
    log("whtsrep", reswats);
  } catch (error) {
    next(error);
  }
});

// Create a new session
app.get('/create/:store', async (req, res, next) => {
  try {
    const { store } = req.params || "mujeeb";
    log('create', store);

    whatsapp.onQRUpdated(async (data) => {
      log('onqrcode', data);
      if (!states.stores[store]) {
        const qr = await toDataURL(data.qr);
        if (data.sessionId === store) {
          res.send(`<img width="50%" src="${qr}" alt="QR Code" />`);
        } else {
          res.status(200).json({ qr: data.qr });
        }
      }
    });

    await whatsapp.startSession(store, { printQR: true });
    await sendToGroup("store created 🥳 #" + store);
  } catch (error) {
    next(error);
    await sendToGroup("error created store : " + store);
  }
});

// Start the Whatsapp glitch bot
async function WhatsappGlitchStart() {
  log("loadSessionsFromStorage");
  const save_session = whatsapp.getSession("admin");
  const sessions = whatsapp.getAllSession();
  states.stores = sessions;

  const session = save_session || await whatsapp.startSession("admin");
  log({ session });

  whatsapp.onMessageReceived(async (msg) => {
    const textIn = extractTextFromMessage(msg);
    if (textIn.startsWith('/suno')) {
      const parts = textIn.split('\n');
      const style = parts[1];
      const lyrics = parts.slice(2).join('\n');
      return await handleSunoRequest(msg, { style, lyrics });
    }
    const message = msg.message;
    const audioMessage = message && message.audioMessage && message.audioMessage.url || null;
    if (audioMessage && !msg.key.fromMe) {
      try {
        const textOutput = await audioToText(msg);
        log("transcri^top,=", { textOutput });
        if (textOutput) {
          const generatedText = await getGpt({
            store: msg.sessionId,
            prompt: states.stores[msg.sessionId] ? states.stores[msg.sessionId].prompt : null,
            text: textOutput,
          });

          let responseData;
          try {
            responseData = JSON.parse(generatedText);
            console.log("Response is in JSON format.");
            // يمكنك استخدام responseData بشكل طبيعي هنا
            return await handleSunoRequest(msg, { responseData });
          } catch (error) {
            console.log("Response is not in JSON format.");
            console.log("Response:", generatedText);
            return await handleSunoRequest(msg, { text: generatedText });
          }
        }
      } catch (error) {
        console.error('Error:', error);
      }
    }
  });
}

// Extract text from a message
function extractTextFromMessage(msg) {
  const { message } = msg;
  return message?.conversation || message?.extendedTextMessage?.text || "";
}

// Handle /suno request
async function handleSunoRequest(msg, { style, lyrics, text, responseData = {} }) {
  log("style=" + style, "lyrics=" + lyrics);
  try {
    let payload = {
      prompt: lyrics,
      tags: style,
      mv: 'chirp-v3-5',
      make_instrumental: false
    };
    if (responseData) payload = { ...payload, ...responseData };
    if (text) payload.prompt = text;

    log({ payload });
    await sendToGroup("payload=" + JSON.stringify(payload));

    let songInfo = await suno.generateSongs(payload);
    //sendToGroup("songInfo="+JSON.stringify(songInfo));
    // المتغيرات المدخلة

    //let songInfoList = songInfo ? songInfo.split(','):songInfo;

    // تهيئة النص الناتج
    let textOutput = `Input:\nStyle: ${style}\nLyrics:\n${lyrics}\n`;

    songInfo?.forEach(info => {
      textOutput += `link:  https://suno.com/song/${info}\n`;
      textOutput += `mp3: https://cdn1.suno.ai/${info}.mp3\n`;
      textOutput += `mp4: https://cdn1.suno.ai/${info}.mp4\n______\n`;
    });

    return await whatsapp.sendTextMessage({
      sessionId: msg.sessionId,
      to: msg.key.remoteJid,
      text: textOutput,
      // isGroup: true,
      answering: msg
    });
    songInfo = await suno.getMetadata(songInfo);

    if (songInfo && songInfo.length > 0) {
      const song = songInfo[0];
      const buffer = await suno.getSongBuffer(song.audio_url);
      const outputMp3 = `./temp/${song.title}.mp3`;
      const outputOgg = `./temp/${song.title}.ogg`;

      fs.writeFileSync(outputMp3, buffer);
      convertToOgg(outputMp3, outputOgg, msg, lyrics, style);
    } else {
      return await sendToGroup("Failed to generate song", { sessionId: msg.sessionId, to: msg.key.remoteJid });
    }
  } catch (error) {
    log('Error generating song:', error);
    return await sendToGroup("Error generating song", { sessionId: msg.sessionId, to: msg.key.remoteJid });
  }
}

// Convert MP3 to OGG
function convertToOgg(inputMp3, outputOgg, msg, lyrics, style) {
  ffmpeg(inputMp3)
    .toFormat('ogg')
    .audioCodec('libopus')
    .on('end', async () => {
      const send = await whatsapp.sendVoiceNote({
        sessionId: msg.sessionId,
        to: msg.key.remoteJid,
        //isGroup: true,
        answering: msg,
        media: fs.readFileSync(outputOgg)
      });
      return;

      await sleep(10000);
      whatsapp.sendTextMessage({
        sessionId: msg.sessionId,
        to: msg.key.remoteJid,
        text: `Input:\nStyle: ${style}\nLyrics:\n${lyrics}\n`,
        isGroup: true,
        answering: msg
      });
    })
    .on('error', (err) => {
      console.error('Error converting audio:', err);
    })
    .save(outputOgg);
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getGpt({ store, text, prompt }) {
  log("stargpt fn");
  if (states.inactiveGpt) return;

  const data = JSON.stringify({
    text,
    prompt,
    system: states.system || SYSTEM_PROMPT
  });
  log({ data });


  const config = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body:data
  };

  try {
    const response = await fetch(`${BASE_URL_MOJOLAND}/api/gptino`, config);
    const data = await response.json();
    return data.text || "not text in data return";
  } catch (error) {
    console.log(error);
  }
}

app.listen(port, () => {
  log(`Server is running on http://localhost:${port}`);
});


initSuno();
WhatsappGlitchStart();