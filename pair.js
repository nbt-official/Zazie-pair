// pair.js
import express from "express";
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
import pn from "awesome-phonenumber";
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
    let num = req.query.number;
    let dirs = "./" + (num || `session`);

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, "");

    const phone = pn("+" + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({
                code: "Invalid phone number. Please enter your full international number.",
            });
        }
        return;
    }
    num = phone.getNumber("e164").replace("+", "");

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            let KnightBot = makeWASocket({
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
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            KnightBot.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, isNewLogin, isOnline } = update;

                if (connection === "open") {
                    console.log("✅ Connected successfully!");
                    console.log("📱 Saving session to Database...");

                    try {
                        const credsPath = dirs + "/creds.json";
                        const credsData = fs.readFileSync(credsPath, "utf-8");
                        
                        // DB eke me number eka thiyenawada balamu
                        let sessionDoc = await Session.findOne({ phoneNumber: num });
                        let stableSessionId;

                        if (sessionDoc) {
                            // User kalin innawa nam creds tika witharak update karamu
                            sessionDoc.creds = credsData;
                            await sessionDoc.save();
                            stableSessionId = sessionDoc.sessionId;
                            console.log("✅ Existing Session Updated:", stableSessionId);
                        } else {
                            // Aluth user kenek nam stable ID ekak hadamu
                            stableSessionId = "KNIGHT_" + Math.random().toString(36).substring(2, 10).toUpperCase();
                            await Session.create({
                                phoneNumber: num,
                                sessionId: stableSessionId,
                                creds: credsData
                            });
                            console.log("✅ New Session Created:", stableSessionId);
                        }

                        const userJid = jidNormalizedUser(num + "@s.whatsapp.net");
                        const sentMsg = await KnightBot.sendMessage(userJid, {
                            text: `Your Session ID:\n\n*${stableSessionId}*`
                        });
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
                        console.log("🔁 Connection closed — restarting...");
                        initiateSession();
                    }
                }
            });

            if (!KnightBot.authState.creds.registered) {
                await delay(3000); 
                num = num.replace(/[^\d+]/g, "");
                if (num.startsWith("+")) num = num.substring(1);

                try {
                    let code = await KnightBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    if (!res.headersSent) {
                        res.status(503).send({ code: "Failed to get pairing code." });
                    }
                    setTimeout(() => process.exit(1), 2000);
                }
            }

            KnightBot.ev.on("creds.update", saveCreds);
        } catch (err) {
            console.error("Error initializing session:", err);
            if (!res.headersSent) {
                res.status(503).send({ code: "Service Unavailable" });
            }
            setTimeout(() => process.exit(1), 2000);
        }
    }

    await initiateSession();
});

export default router;
