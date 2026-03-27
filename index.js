import express from "express"
import mongoose from "mongoose"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { v4 as uuidv4 } from "uuid"
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from "@whiskeysockets/baileys"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// ===== MongoDB =====
mongoose.connect("mongodb+srv://nethmadhu01_db_user:ItHcjbTkGzQQssCw@cluster0.vfvc2mo.mongodb.net/?appName=Cluster0")
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("DB Error:", err))

const SessionSchema = new mongoose.Schema({
    sessionId: String,
    creds: Object
})

const Session = mongoose.model("Session", SessionSchema)

// ===== Pair Function =====
async function startPairing(number) {
    const sessionId = uuidv4()
    const sessionPath = path.join(__dirname, "sessions", sessionId)

    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    const sock = makeWASocket({
        auth: state
    })

    sock.ev.on("creds.update", saveCreds)

    return new Promise((resolve, reject) => {

        let codeSent = false

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update

            try {
                // 🔑 generate pairing code once
                if (!codeSent && connection === "connecting") {
                    codeSent = true

                    const code = await sock.requestPairingCode(number)

                    console.log("🔐 Pair Code:", code)

                    resolve({
                        sessionId,
                        code
                    })
                }

                // ✅ connected
                if (connection === "open") {
                    console.log("✅ Connected:", sessionId)

                    const creds = JSON.parse(
                        fs.readFileSync(path.join(sessionPath, "creds.json"))
                    )

                    await Session.findOneAndUpdate(
                        { sessionId },
                        { creds },
                        { upsert: true }
                    )

                    console.log("💾 Saved to MongoDB")

                    await sock.sendMessage(
                        number + "@s.whatsapp.net",
                        { text: `✅ Session ID: ${sessionId}` }
                    )
                }

                // ❌ reconnect logic
                if (connection === "close") {
                    const reason = lastDisconnect?.error?.output?.statusCode

                    if (reason !== DisconnectReason.loggedOut) {
                        console.log("🔄 Reconnecting...")
                    } else {
                        console.log("❌ Logged out")
                    }
                }

            } catch (err) {
                console.log("❌ Pair Error:", err)
                reject(err)
            }
        })
    })
}

// ===== ROUTES =====

// 👉 GET pairing
app.get("/pair", async (req, res) => {
    try {
        let number = req.query.number

        if (!number) {
            return res.send("Use: /pair?number=947XXXXXXXX")
        }

        number = number.replace(/[^0-9]/g, "")

        const data = await startPairing(number)

        res.json({
            status: "success",
            sessionId: data.sessionId,
            code: data.code
        })

    } catch (err) {
        console.log("FULL ERROR:", err)

        res.status(500).json({
            error: err.message || err
        })
    }
})

// 👉 download session
app.get("/session/:id", async (req, res) => {
    const session = await Session.findOne({ sessionId: req.params.id })

    if (!session) return res.status(404).send("Session not found")

    res.setHeader("Content-Disposition", "attachment; filename=creds.json")
    res.json(session.creds)
})

// 👉 serve HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT)
})
