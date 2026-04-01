// db.js
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, unique: true },
    creds: { type: String, required: true } // JSON eka string ekak widiyata thiyagamu
});

export const Session = mongoose.model("Session", sessionSchema);

export const connectDB = async (uri) => {
    try {
        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected Successfully!");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
    }
};

// db.js athule anthimata add karanna
export const resetAllSessions = async () => {
    try {
        await Session.deleteMany({});
        return true;
    } catch (error) {
        console.error("❌ Error resetting database:", error);
        return false;
    }
};
