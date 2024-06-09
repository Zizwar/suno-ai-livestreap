import fs from 'fs';
import OpenAI from 'openai';
import FormData from 'form-data';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { API_KEY_OPENAI} from "../../env.js";
const openai = new OpenAI({
  apiKey:API_KEY_OPENAI
});

async function audioToText(msg) {
  try {
    // تنزيل ملف الصوت من الرسالة كـ Buffer
    const buffer = await downloadMediaMessage(msg, "buffer", {});

    // حفظ الـ Buffer إلى ملف مؤقت
    const filePath = 'audio.ogg';
    fs.writeFileSync(filePath, buffer);

    // إرسال الملف إلى Whisper لتحويله إلى نص
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });

    // حذف الملف المؤقت بعد التحويل
    fs.unlinkSync(filePath);

    return transcription.text;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

export default audioToText;
/*
const fs = require('fs');
const OpenAI = require('openai');
const formData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const apiKey = 'sk-proj-PPDWO01c00w0wri7nin0T3BlbkFJUkmWyrO3lutulFyOBkyF';
const openai = new OpenAI({
  apiKey
});

async function audioToText(msg) {
  try {
    // تنزيل ملف الصوت من الرسالة كـ Buffer
    const buffer = await downloadMediaMessage(msg, "buffer", {});

    // حفظ الـ Buffer إلى ملف مؤقت
    const filePath = 'audio.ogg';
    fs.writeFileSync(filePath, buffer);

    // إرسال الملف إلى Whisper لتحويله إلى نص
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });

    // حذف الملف المؤقت بعد التحويل
    fs.unlinkSync(filePath);

    return transcription.text;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

module.exports = audioToText;
*/