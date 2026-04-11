require('dotenv').config(); // Required for MONGO_URI and GEMINI_API_KEY
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// 1. OMNI-CORS: Accepts requests from ANY origin
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); 

// 2. POST: Sync Data
app.post('/api/v1/sync/:collection', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database not ready" });
        }

        const collectionName = req.params.collection;
        let data = req.body; 

        if (!data.uid) {
            return res.status(400).json({ error: "Missing 'uid' in JSON payload" });
        }

        const db = mongoose.connection.db;
        
        // --- AUTO-INITIALIZE NEURAL DATA FOR NEW USERS ---
        if (collectionName === 'user-profiles') {
            const existingUser = await db.collection(collectionName).findOne({ uid: data.uid });
            
            if (!existingUser) {
                data = {
                    ...data,
                    overallProgress: 0,
                    nodesUnlocked: 1,
                    moduleProgress: { web: 0, js: 0, react: 0, node: 0, db: 0 },
                    activityData: [5, 12, 8, 20, 15, 30, 25, 45, 35, 55, 50, 75] 
                };
            }
        }

        const result = await db.collection(collectionName).updateOne(
            { uid: data.uid }, 
            { $set: data }, 
            { upsert: true }
        );
        
        res.status(200).json({ success: true, message: `Data synced to ${collectionName}`, result });

    } catch (error) {
        console.error(`Sync Error [${req.params.collection}]:`, error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 3. GET: Retrieve Data
app.get('/api/v1/sync/:collection/:uid', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database not ready" });
        }

        const db = mongoose.connection.db;
        const result = await db.collection(req.params.collection).findOne({ uid: req.params.uid });
        
        if (!result) return res.status(404).json({ error: "Data not found" });

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- 4. SECURE AI CHAT ROUTE (Official Google Gemini Proxy) ---
app.post('/api/v1/ai/chat', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error("Gemini API Key is missing in environment variables.");
            return res.status(500).json({ error: "AI configuration error on server." });
        }

        const { systemInstruction, contents } = req.body;

        // Official Google Gemini Endpoint (Upgraded to 2.5 Flash)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: contents
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        res.status(200).json({
            reply: data.candidates[0].content.parts[0].text
        });

    } catch (error) {
        console.error("AI Proxy Route Error:", error);
        res.status(500).json({ error: "Internal Server Error during AI processing" });
    }
});

// 5. FALLBACK ROUTE
app.use((req, res) => {
    res.status(404).json({ error: "Nueralab API endpoint not found." });
});

// 6. IGNITION
const PORT = process.env.PORT || 10000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected for Nuera Lab");
        app.listen(PORT, () => {
            console.log(`Neural Core API running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });
