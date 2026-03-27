const { default: makeWASocket, useMultiFileAuthState, delay, Browsers, DisconnectReason } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8000;

// MongoDB Connection String (Directly Added)
const mongoURI = "mongodb+srv://nethmadhu01_db_user:ItHcjbTkGzQQssCw@cluster0.vfvc2mo.mongodb.net/?appName=Cluster0";

// DB Schema
const Session = mongoose.models.Session || mongoose.model('Session', new mongoose.Schema({
    sessionId: String,
    sessionData: Object,
    createdAt: { type: Date, default: Date.now, expires: '30d' }
}));

// MongoDB Connect
mongoose.connect(mongoURI).then(() => console.log("MongoDB Connected ✔️")).catch(err => console.log(err));

app.get('/', (req, res) => {
    res.send(`
        <div style="font-family:sans-serif; text-align:center; margin-top:50px; background:#0f172a; color:white; padding:50px; border-radius:15px;">
            <h2>Frozen MD Pairing Panel</h2>
            <p>Enter your number with country code (e.g. 94762898541)</p>
            <input type="text" id="num" placeholder="947xxxxxxxx" style="padding:12px; border-radius:8px; border:none; width:250px;">
            <button onclick="getCode()" style="padding:12px 25px; border-radius:8px; border:none; background:#3b82f6; color:white; cursor:pointer; font-weight:bold;">Get Pairing Code</button>
            <h1 id="code" style="color:#10b981; margin-top:30px; letter-spacing:5px;"></h1>
            <script>
                async function getCode() {
                    const n = document.getElementById('num').value;
                    if(!n) return alert('Please enter a number!');
                    document.getElementById('code').innerText = 'GENERATING...';
                    try {
                        const r = await fetch('/pair?number=' + n);
                        const d = await r.json();
                        document.getElementById('code').innerText = d.code || 'ERROR';
                    } catch { document.getElementById('code').innerText = 'FAILED'; }
                }
            </script>
        </div>
    `);
});

app.get("/pair", async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).json({ error: "No Number" });

    try {
        const { state, saveCreds } = await useMultiFileAuthState("./temp_session");
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        if (!sock.authState.creds.registered) {
            await delay(2500);
            const code = await sock.requestPairingCode(number.replace(/[^0-9]/g, ''));
            
            sock.ev.on("creds.update", saveCreds);
            sock.ev.on("connection.update", async (up) => {
                const { connection } = up;
                if (connection === "open") {
                    const id = Math.random().toString(36).substring(2, 12);
                    await Session.create({ sessionId: id, sessionData: sock.authState.creds });
                    await sock.sendMessage(sock.user.id, { text: `FROZEN-MD~${id}` });
                    console.log("Session Saved: " + id);
                    process.exit(0); // Exit after pairing to clear memory
                }
            });
            return res.json({ code });
        }
    } catch (e) { res.status(500).json({ error: "Try Again" }); }
});

app.get("/api/session", async (req, res) => {
    const { id } = req.query;
    const data = await Session.findOne({ sessionId: id });
    if (!data) return res.status(404).send("Not Found");
    res.json(data.sessionData);
});

app.listen(PORT, () => console.log("Server online on " + PORT));
