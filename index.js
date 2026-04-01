// Index.js
import express from "express";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import path from "path";

import pairRouter from "./pair.js";
import qrRouter from "./qr.js";
import { connectDB, Session, resetAllSessions } from "./db.js"; // DB eka import kara

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;
// OYAGE MONGODB URL EKA MEHENTA DANNA (nathnam .env eken ganna)
const MONGODB_URI = "mongodb+srv://nethmadhu01_db_user:ItHcjbTkGzQQssCw@cluster0.vfvc2mo.mongodb.net/?appName=Cluster0";

connectDB(MONGODB_URI);

import("events").then((events) => {
    events.EventEmitter.defaultMaxListeners = 500;
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "pair.html"));
});

// DIRECT DOWNLOAD ROUTE EKA MEKA THAMAI
app.get("/download/:sessionId", async (req, res) => {
    try {
        const session = await Session.findOne({ sessionId: req.params.sessionId });
        if (!session) {
            return res.status(404).send("Session not found or invalid!");
        }

        // Creds.json eka direct download wenna headers set karamu
        res.setHeader('Content-disposition', 'attachment; filename=creds.json');
        res.setHeader('Content-type', 'application/json');
        res.send(session.creds);
    } catch (error) {
        console.error("Error downloading session:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/api/admin/reset", async (req, res) => {
    const { apiKey } = req.body;

    // Security ekata podi key ekak check karamu (Oyata oni ekak danna)
    const ADMIN_PASSWORD = "NBT"; 

    if (apiKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ 
            success: false, 
            message: "Unauthorized: Invalid Admin API Key" 
        });
    }

    const success = await resetAllSessions();

    if (success) {
        console.log("🧹 Database cleared by Admin request.");
        res.status(200).json({ 
            success: true, 
            message: "All sessions and stable IDs have been wiped successfully!" 
        });
    } else {
        res.status(500).json({ 
            success: false, 
            message: "Failed to reset database." 
        });
    }
});

app.use("/pair", pairRouter);
app.use("/qr", qrRouter);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
