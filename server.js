require('dotenv').config(); // Required to read your MONGO_URI and OPENAI_API_KEY
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// 1. OMNI-CORS: Accepts requests from ANY origin
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); 

// 2. POST: Create or Update Data in ANY Collection
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
        
        res.status(200).json({
            success: true,
            message: `Data synced to ${collectionName}`,
            result
        });

    } catch (error) {
        console.error(`Sync Error [${req.params.collection}]:`, error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 3. GET: Retrieve Data from ANY Collection by UID
app.get('/api/v1/sync/:collection/:uid', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database not ready" });
        }

        const db = mongoose.connection.db;
        const result = await db.collection(req.params.collection).findOne({ uid: req.params.uid });
        
        if (!result) {
            return res.status(404).json({ error: "Data not found" });
        }

        res.status(200).json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- 4. SECURE AI CHAT ROUTE (OpenAI Proxy) ---
app.post('/api/v1/ai/chat', async (req, res) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            console.error("OpenAI API Key is missing in environment variables.");
            return res.status(500).json({ error: "AI configuration error on server." });
        }

        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Invalid messages format." });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // You can use "gpt-4o" or "gpt-3.5-turbo"
                messages: messages,
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("OpenAI API Error:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        // Return just the text reply to the frontend
        res.status(200).json({
            reply: data.choices[0].message.content
        });

    } catch (error) {
        console.error("AI Proxy Route Error:", error);
        res.status(500).json({ error: "Internal Server Error during AI processing" });
    }
});

// 5. FALLBACK ROUTE
app.use((req, res) => {
    res.status(404).json({ error: "Nueralab API endpoint not found. Check your URL." });
});

// 6. IGNITION
const PORT = process.env.PORT || 10000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully for Nuera Lab");
        app.listen(PORT, () => {
            console.log(`Neural Core API (Sync + AI) running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });
