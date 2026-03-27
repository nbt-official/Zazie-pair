const express = require('express');
const fs = require('fs-extra');
const mongoose = require("mongoose");
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 8000;

// MongoDB Connection
const mongoURI = "mongodb+srv://nethmadhu01_db_user:ItHcjbTkGzQQssCw@cluster0.vfvc2mo.mongodb.net/?appName=Cluster0";
mongoose.connect(mongoURI).then(() => console.log("DB Connected ✔️"));

// DB Schema
const Session = mongoose.models.Session || mongoose.model('Session', new mongoose.Schema({
    sessionId: String,
    sessionData: Object,
    createdAt: { type: Date, default: Date.now, expires: '30d' }
}));

app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.send({ error: "Number Required" });

    // Session folder එක හැමතිස්සෙම අලුතින් ගන්නවා
    const sessionDir = `./temp_session_${Date.now()}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    try {
        let conn = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: Browsers.macOS("Safari"),
        });

        if (!conn.authState.creds.registered) {
            await delay(1500);
            num = num.replace(/[^0-9]/g, '');
            const code = await conn.requestPairingCode(num);
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on("connection.update", async (s) => {
            const { connection } = s;
            if (connection === "open") {
                await delay(5000); // Creds සේරම ලියවෙනකම් පොඩ්ඩක් ඉන්න
                
                const id = Math.random().toString(36).substring(2, 12);
                const user_jid = jidNormalizedUser(conn.user.id);

                // MongoDB වලට Save කරනවා
                await Session.create({
                    sessionId: id,
                    sessionData: conn.authState.creds
                });

                // User ගේ Inbox එකට ID එක යවනවා
                await conn.sendMessage(user_jid, { text: `FROZEN-MD~${id}` });

                console.log("Session Saved ID: " + id);
                
                // Cleanup
                await delay(2000);
                fs.removeSync(sessionDir);
                // process.exit(0); // Vercel වලට මේක එපා, Render නම් දාන්න
            }
        });

    } catch (err) {
        console.log(err);
        if (!res.headersSent) res.send({ error: "Service Error" });
    }
});

// Bot එකට Session එක දෙන API එක
app.get("/api/session", async (req, res) => {
    const { id } = req.query;
    const data = await Session.findOne({ sessionId: id });
    if (!data) return res.status(404).send("Not Found");
    res.json(data.sessionData);
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
