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
app.use(express.json())

const PORT = process.env.PORT || 3000

// ===== MongoDB =====
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err))

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

    // 🔑 request pairing code
    const code = await sock.requestPairingCode(number)

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update

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

            await sock.sendMessage(
                number + "@s.whatsapp.net",
                { text: `✅ Session ID: ${sessionId}` }
            )
        }
    })

    return { sessionId, code }
}

// ===== ROUTES =====

// pairing API
app.post("/pair", async (req, res) => {
    try {
        let { number } = req.body

        if (!number) return res.status(400).send("Number required")

        number = number.replace(/[^0-9]/g, "")

        const data = await startPairing(number)

        res.json(data)

    } catch (err) {
        console.log(err)
        res.status(500).send("Error pairing")
    }
})

// download session
app.get("/session/:id", async (req, res) => {
    const session = await Session.findOne({ sessionId: req.params.id })

    if (!session) return res.status(404).send("Not found")

    res.setHeader("Content-Disposition", "attachment; filename=creds.json")
    res.json(session.creds)
})

// serve HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.listen(PORT, () => {
    console.log("Server running:", PORT)
})
