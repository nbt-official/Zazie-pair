const { default: makeWASocket, useMultiFileAuthState, delay, Browsers } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8000;

// MongoDB Schema
const Session = mongoose.models.Session || mongoose.model('Session', new mongoose.Schema({
    sessionId: String,
    sessionData: Object,
    createdAt: { type: Date, default: Date.now, expires: '30d' }
}));

// Home Page (Simple UI)
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
            <h2>Frozen MD Pairing</h2>
            <input type="text" id="num" placeholder="94762898541" style="padding:10px; border-radius:5px;">
            <button onclick="getCode()" style="padding:10px; cursor:pointer;">Get Code</button>
            <h1 id="code" style="color:green;"></h1>
            <script>
                async function getCode() {
                    const n = document.getElementById('num').value;
                    document.getElementById('code').innerText = 'Connecting...';
                    const r = await fetch('/pair?number=' + n);
                    const d = await r.json();
                    document.getElementById('code').innerText = d.code || 'Error!';
                }
            </script>
        </div>
    `);
});

// Route: Get Pairing Code
app.get("/pair", async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).json({ error: "No Number" });

    try {
        if (mongoose.connection.readyState !== 1) await mongoose.connect("mongodb+srv://nethmadhu01_db_user:ItHcjbTkGzQQssCw@cluster0.vfvc2mo.mongodb.net/?appName=Cluster0");
        const { state, saveCreds } = await useMultiFileAuthState("./temp_session");
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Desktop")
        });

        if (!sock.authState.creds.registered) {
            await delay(2000);
            const code = await sock.requestPairingCode(number.replace(/[^0-9]/g, ''));
            
            sock.ev.on("creds.update", saveCreds);
            sock.ev.on("connection.update", async (up) => {
                if (up.connection === "open") {
                    const id = Math.random().toString(36).substring(2, 12);
                    await Session.create({ sessionId: id, sessionData: sock.authState.creds });
                    await sock.sendMessage(sock.user.id, { text: `FROZEN-MD~${id}` });
                    // වැදගත්: Session එක save වුණාම temp එක මකන්න ඕනේ නැත්නම් ඊළඟ පාර ප්‍රශ්න එනවා
                }
            });
            return res.json({ code });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route: Bot Fetching Session
app.get("/session/:id", async (req, res) => {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(process.env.MONGODB_URL);
    const data = await Session.findOne({ sessionId: req.params.id });
    if (!data) return res.status(404).send("Not Found");
    res.json(data.sessionData);
});

app.listen(PORT, () => console.log("Server started on port " + PORT));
