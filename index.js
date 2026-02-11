const express = require("express");
const axios = require("axios");
const { upsertConversation, insertMessage } = require("./lib/revenueCore");

console.log("PP VERSION: REVENUE_CORE_2");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "pulsepilot_verify_123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ==========================
// VERIFY WEBHOOK
// ==========================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ==========================
// HANDLE INCOMING EVENTS
// ==========================
app.post("/webhook", async (req, res) => {
  console.log("WEBHOOK HIT");

  try {
    const body = req.body;

    if (body.object !== "page") {
      return res.sendStatus(200);
    }

    for (const entry of body.entry) {
      for (const event of entry.messaging) {

        // Only handle real text messages
        if (!event.message || !event.message.text) {
          continue;
        }

        console.log("TEXT MESSAGE RECEIVED");

        const senderId = event.sender.id;
        const messageText = event.message.text;

        // 1️⃣ UPSERT CONVERSATION
        const conversation = await upsertConversation({
          platform: "messenger",
          threadId: senderId,
          userPsid: senderId,
          isHot: true
        });

        console.log("Conversation ID:", conversation.id);

        // 2️⃣ STORE INBOUND MESSAGE
        await insertMessage({
          conversationId: conversation.id,
          platform: "messenger",
          direction: "INBOUND",
          text: messageText,
          metaMessageId: event.message.mid || null,
          metaTimestamp: event.timestamp
            ? new Date(event.timestamp).toISOString()
            : null,
          rawPayload: event
        });

        console.log("Inbound stored");

        // 3️⃣ SEND AUTO RESPONSE
        const replyText = "Thanks for your message. We'll get back to you shortly.";

        await axios.post(
          `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
          {
            recipient: { id: senderId },
            message: { text: replyText }
          }
        );

        console.log("Reply sent");

        // 4️⃣ STORE OUTBOUND MESSAGE
        await insertMessage({
          conversationId: conversation.id,
          platform: "messenger",
          direction: "OUTBOUND",
          text: replyText,
          metaMessageId: null,
          metaTimestamp: null,
          rawPayload: { auto: true }
        });

        console.log("Outbound stored");
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    res.sendStatus(500);
  }
});

// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

