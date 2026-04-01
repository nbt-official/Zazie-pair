// qr.js
import express from "express";
// මේ විදියට මුළු module එකම default එකක් විදියට ගන්න
import gifted from 'gifted-btns';

// ඒක ඇතුළෙන් අපිට ඕන කරන function එක extract කරගන්න
const { sendInteractiveMessage } = gifted;
import fs from "fs";
import pino from "pino";
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { Session } from "./db.js"; // DB Session eka import kara

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error("Error removing file:", e);
    }
}

router.get("/", async (req, res) => {
    const tempDirId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const dirs = `./qr_sessions/session_${tempDirId}`;

    if (!fs.existsSync("./qr_sessions")) {
        fs.mkdirSync("./qr_sessions", { recursive: true });
    }

    await removeFile(dirs);

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            let responseSent = false;

            const KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" }).child({ level: "fatal" }),
                    ),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows("Chrome"),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
            });

            KnightBot.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr && !responseSent) {
                    console.log("🟢 QR Code Generated!");
                    try {
                        const qrDataURL = await QRCode.toDataURL(qr);
                        if (!responseSent) {
                            responseSent = true;
                            res.send({
                                qr: qrDataURL,
                                message: "QR Code Generated! Scan it with your WhatsApp app."
                            });
                        }
                    } catch (qrError) {
                        if (!responseSent) {
                            responseSent = true;
                            res.status(500).send({ code: "Failed to generate QR code" });
                        }
                    }
                }

                if (connection === "open") {
                    console.log("✅ Connected successfully!");
                    console.log("📱 Saving session to Database...");

                    try {
                        const credsPath = dirs + "/creds.json";
                        const credsData = fs.readFileSync(credsPath, "utf-8");
                        
                        // JID eken userge phone number eka gamu
                        const userJid = jidNormalizedUser(KnightBot.authState.creds.me?.id || "");
                        const num = userJid.split('@')[0];

                        let sessionDoc = await Session.findOne({ phoneNumber: num });
                        let stableSessionId;

                        if (sessionDoc) {
                            sessionDoc.creds = credsData;
                            await sessionDoc.save();
                            stableSessionId = sessionDoc.sessionId;
                        } else {
                            stableSessionId = "ZAZIE-MVDL~" + Math.random().toString(36).substring(2, 10).toUpperCase();
                            await Session.create({
                                phoneNumber: num,
                                sessionId: stableSessionId,
                                creds: credsData
                            });
                        }

                        if (userJid) {
                         const sentMsg = await KnightBot.sendMessage(userJid, {
                                text: `${stableSessionId}`
                            });
                        }

                        console.log("📄 Session ID sent successfully");

                        let btnMsgText = `╭┉┉乙AZιҽ-MʋDL-V5┉┉◈
╰ ┉┉┉┉┉┉┉┉┉┉┉┉┉┉◈
╭┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉◈
> Qᴜᴇᴇɴ-ᴢᴀᴢɪᴇ-ᴍᴏᴠɪᴇᴅʟ 
> ꜱᴇꜱꜱɪᴏɴ ɪᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ 
> *ᴄᴏɴɴᴇᴄᴛᴇᴅ 🚀💞*
╰┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉◈

ᴘʟᴇᴀꜱᴇ ᴅᴏɴ'ᴛ ꜱʜᴀʀᴇ ᴛʜɪꜱ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ 💫🎯\n`;

try {
    await sendInteractiveMessage(KnightBot, userJid, {
        image: { url: 'https://raw.githubusercontent.com/nbt-official/db-zazie/refs/heads/main/20260328_083931.jpg' },
        text: btnMsgText,
        footer: "</> 𝗤𝘂ҽҽ𝙣-𝙕𝗮ȥιҽ-𝕄𝙪𝗹ƚι𝗗ҽʋιƈҽ-𝙑5 🫟",
        interactiveButtons: [
            {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: "Follow Us :)",
                    url: "https://whatsapp.com/channel/0029Vb7j9vW3WHTQ0jJrnK3x"
                })
            }
        ]
    }, { quoted: sentMsg }); // මෙතන තමයි කලින් මැසේජ් එකට රිප්ලයි එකක් වෙන්නෙ

    console.log("📄 Interactive Button reply sent successfully");
} catch (btnErr) {
    console.error("❌ Error sending button reply:", btnErr);
}

                        console.log("🧹 Cleaning up session...");
                        await delay(1000);
                        removeFile(dirs);
                        
                        console.log("🛑 Shutting down application...");
                        await delay(2000);
                        process.exit(0);
                    } catch (error) {
                        console.error("❌ Error saving to Database:", error);
                        removeFile(dirs);
                        await delay(2000);
                        process.exit(1);
                    }
                }

                if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === 401) {
                        console.log("❌ Logged out from WhatsApp.");
                    } else {
                        initiateSession();
                    }
                }
            });

            KnightBot.ev.on("creds.update", saveCreds);
        } catch (err) {
            removeFile(dirs);
            setTimeout(() => process.exit(1), 2000);
        }
    }

    await initiateSession();
});

export default router;
