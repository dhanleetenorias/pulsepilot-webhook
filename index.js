const express = require("express");
const axios = require("axios");

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
  }

  res.sendStatus(403);
});

// ==========================
// RECEIVE MESSAGE
// ==========================
app.post("/webhook", async (req, res) => {
  console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));

  const entry = req.body.entry?.[0];
  const messaging = entry?.messaging?.[0];

  if (messaging?.sender?.id && messaging?.message?.text) {
    const senderId = messaging.sender.id;
    const userMessage = messaging.message.text;

    console.log("User said:", userMessage);

    await sendMessage(senderId, `You said: ${userMessage}`);
  }

  res.sendStatus(200);
});

// ==========================
// SEND MESSAGE
// ==========================
async function sendMessage(recipientId, messageText) {
  try {
    await axios.post(
      "https://graph.facebook.com/v21.0/me/messages",
      {
        recipient: { id: recipientId },
        message: { text: messageText }
      },
      {
        headers: {
          Authorization: `Bearer ${PAGE_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Message sent!");
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error.message);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log("Webhook running");
});
