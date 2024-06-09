const whatsapp = require("wa-multi-session");

const {
  toDataURL
} = require("qrcode");

//const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
//
import {  SYSTEM_PROMPT,  adminGroupJid } from "../../env.js";
const app = express();
app.use(express.json());
const port = 82;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
//
const {
  log,
  info,
  table
} = console;

const states = {
  stores: {},
  config: {}
}


async function sendToGroup(text, props={}) {
  const {
  answering = null,
  isGroup = true,
  sessionId = "admin",
  to = adminGroupJid
} = props;
  const options = {
    isGroup,
    sessionId,
    to,
    text
  };

  if (answering) {
    options.answering = answering;
  }

  return await whatsapp.sendTextMessage(options);
}
app.get('/all', async (req, res, next) => {
  try {
    const stores = whatsapp.getAllSession();
    sendToGroup("all stores: " + JSON.stringify(stores))

    res.status(200).json({
      stores
    });
  } catch (error) {
    next(error);
  }

})
app.get('/delete/:store', async (req, res, next) => {
  try {
    const {
      store
    } = req.params || "mujeeb";
    whatsapp.deleteSession(store);
    res
      .status(200)
      .send("Success Deleted " + store)
    if (states.stores[store])
      delete states.stores[store]
    sendToGroup("❌deleted store #" + store)
  } catch (error) {
    next(error);
  }

})
const answers = [];
app.post('/send-message', async (req, res, next) => {
  /*
const message = {
  text: "This is a template message",
  templateButtons: [
    { index: 1, urlButton: { displayText: "Visit website", url: "https://google.com" } },
    { index: 2, callButton: { displayText: "Call us", phoneNumber: "+1234567890" } },
  ],
};
//
await whatsapp.sendTextMessage({
        sessionId: "admin",
      to: adminGroupJid,
        text:message,
        isGroup: true,
      });
      */
  const {
    text,
    symbol,
    method
  } = req.body;
  const answering = method === "get" ? answers[symbol] : null;
  ///
  const reswats = await sendToGroup(
    text, {
      answering,
    });
  if (method === "set")
    answers[symbol] = reswats;
  res.json({
    answering: reswats
  })
  log("whtsrep", reswats)
  return;

})


app.get('/create/:store', async (req, res, next) => {
 // return;
  try {
    const {
      store
    } = req.params || "mujeeb";
    log('creaet,', store)

    whatsapp.onQRUpdated(async (data) => {

      log('onqrcode,', data)
      if (!states.stores[store]) {
        const qr = await toDataURL(data.qr);
        if (data.sessionId == store) {
          res.send(`<img width="50%" src="${qr}" alt="QR Code" />`);
        } else {
          res.status(200).json({
            qr: data.qr,
          });
        }
      }
    });
    await whatsapp.startSession(store, {
      printQR: true
    });
    sendToGroup("store created 🥳 #" + store)
  } catch (error) {
    next(error);
    sendToGroup("error created store : " + store)
  }
})

////
const tickers = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'LTCUSDT', 'DOTUSDT', 'TRXUSDT'];

let dataChart = []
const listPrevCandle = {}
const WhatsappGlitchStart = async () => {


  //whatsapp.loadSessionsFromStorage()
  log(" loadSessionsFromStorage")
  const save_session = whatsapp.getSession("admin");
  const sessions = whatsapp.getAllSession()
  states.stores = sessions;
  // returning session data
  //log({save_session})
  // create session with ID : mysessionid

  const session = save_session || await whatsapp.startSession("admin");
  log({
    session
  })
  // Then, scan QR on terminal
  //const sessions = whatsapp.getAllSession();
  //log({  sessions  })
  // returning all session ID that has been created
  //qrcode.generate(qr, {small: true});
  //
  const assistBot = async (msg = []) => {
    log("sudooo")
    const conversation = msg.message ? msg.message.conversation || msg.message.extendedTextMessage && msg.message.extendedTextMessage.text : null
    //    if (!conversation.includes("$sudo")) return null;
    log({
      conversation
    })


    if (conversation) {
      const {
        participant,
        sessionId
      } = msg;

      await sendToGroup(" Store: " + sessionId, {
        answering: msg
      })
    }
    return null;
  }

  whatsapp.onMessageReceived((msg) => {

    ///

    // log('====', JSON.stringify(msg.message.extendedTextMessage.text))
    /*  if (msg.sessionId === "admin") {
        assistBot(msg);
        return
      }
      */

    //
    
    const callback = async (text) => {
      log("cb", text)
      await sleep(5000);
      await whatsapp.sendTextMessage({
        sessionId: msg.sessionId,
        to: msg.key.remoteJid,
        text,
        //  isGroup: true,
        answering: msg, // for quoting message
      });
      // return;
      //log to admin
      const logz = (`
Session: ${msg.sessionId}
from: ${msg.key.remoteJid}
isfrom me: ${msg.key.fromMe} 
isgroup:${msg.key.isGroup} 

textOutputIa:${text} >
`);
      log(logz)
      await sleep(5000)
      sendToGroup(logz, {
        answering: msg
      });
    }
    // if (msg.message && msg.message.conversation.includes("$") || msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.text.includes("$"))
    const {
      message
    } = msg
    const textIn = message ? message.conversation ||
      message.extendedTextMessage &&
      message.extendedTextMessage.text : "";
  
    if (!msg.key.fromMe)
      getGpt({
        store: msg.sessionId,
        text: textIn
      }, callback)
  });
  /*
  whatsapp.onConnected((sessionId) => {
    //  states.stores[sessionId] && (states.stores[sessionId].exist = true)
    console.log("session connected :" + sessionId);

  });
  */
}
WhatsappGlitchStart();

//
function getGpt({
  store,
  text,
  prompt
}, callback) {
  log("stargpt fn");
  if (states.inactiveGpt) return;

  const data = JSON.stringify({
    text,
    prompt,
    system: (states.system || SYSTEM_PROMPT)
  });
  log({
    data
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${BASE_URL_MOJOLAND}/api/gptino`,
    headers: {
      'Content-Type': 'application/json'
    },
    data
  };

  axios.request(config)
    .then((response) => {
      console.log(JSON.stringify(response.data));
      const text = response.data.text || "لا يوجد نص في البيانات المرتجعة";

      callback(text);
    })
    .catch((error) => {
      console.log(error);
    });
}

//
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

