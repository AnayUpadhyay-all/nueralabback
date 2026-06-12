require('dotenv').config(); // Required for MONGO_URI and GEMINI_API_KEY
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// 1. SECURE CORS: Accepts requests ONLY from authorized Nuera Lab domains
app.use(cors({ 
    origin: [
        'https://anayupadhyay-all.github.io', // Live Nuera Lab Deployment
        'http://127.0.0.1:5500',              // Local VS Code Live Server
        'http://localhost:5500'               // Localhost fallback
    ] 
}));
app.use(express.json({ limit: '50mb' })); 

// ==========================================
// HELPER: DECODE FIREBASE TOKEN
// Extracts the UID from the frontend's Bearer token
// ==========================================
const getUidFromToken = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.split(' ')[1];
        // Decode base64 JWT payload safely
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
        return payload.user_id || payload.sub;
    } catch (error) {
        return null;
    }
};

// ==========================================
// HEALTH CHECK ROUTE 
// ==========================================
app.get('/', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'Connected 泙' : (dbState === 2 ? 'Connecting 泯' : 'Disconnected 閥');
    
    res.status(200).json({
        server: "Online 泙",
        database: dbStatus,
        message: "Nuera Lab API is running successfully."
    });
});

// ==========================================
// USER STATUS (For Frontend Wallet & Marketplace UI)
// ==========================================
app.get('/api/user/status', async (req, res) => {
    try {
        const uid = getUidFromToken(req);
        if (!uid) return res.status(401).json({ error: "Unauthorized. Missing or invalid token." });

        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "DB not ready" });

        const user = await mongoose.connection.db.collection('user-profiles').findOne({ uid: uid });
        
        if (!user) {
            return res.json({ balance: 0, purchasedItems: [], isPremium: false });
        }

        res.status(200).json({
            balance: user.balance || 0,
            purchasedItems: user.purchasedItems || [],
            isPremium: user.isPremium || false
        });
    } catch (error) {
        console.error("User Status Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// CONFIRM CREDENTIALS (Saves unique ID to DB)
// ==========================================
app.post('/api/user/confirm-credential', async (req, res) => {
    try {
        const uid = getUidFromToken(req);
        if (!uid) return res.status(401).json({ success: false, message: "Unauthorized. Missing or invalid token." });

        if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "DB not ready" });

        const { credentialId, verifiedAt } = req.body;
        
        if (!credentialId) {
            return res.status(400).json({ success: false, message: "Credential ID is required." });
        }

        const db = mongoose.connection.db;
        
        // Update the user profile with the generated credential ID
        await db.collection('user-profiles').updateOne(
            { uid: uid }, 
            { 
                $set: { 
                    baseCredential: credentialId, 
                    baseVerifiedAt: verifiedAt || new Date().toISOString()
                } 
            },
            { upsert: true }
        );

        res.status(200).json({ success: true, message: "Credential written to MongoDB successfully." });
    } catch (error) {
        console.error("Confirm Credential Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// ==========================================
// MARKETPLACE PURCHASE ROUTE
// ==========================================
app.post('/api/marketplace/purchase', async (req, res) => {
    try {
        const uid = getUidFromToken(req);
        if (!uid) return res.status(401).json({ success: false, message: "Please log in to purchase." });

        const { item, cost } = req.body;
        const db = mongoose.connection.db;

        const user = await db.collection('user-profiles').findOne({ uid: uid });
        if (!user) return res.status(404).json({ success: false, message: "User profile not found." });

        const currentBalance = user.balance || 0;
        const purchasedItems = user.purchasedItems || [];

        // Check if already purchased
        if (purchasedItems.includes(item)) {
            return res.json({ success: true, message: "Item already owned.", newBalance: currentBalance });
        }

        // Check balance
        if (currentBalance < cost) {
            return res.status(400).json({ success: false, message: "Transaction rejected: Insufficient NUX." });
        }

        // Deduct NUX and add item
        await db.collection('user-profiles').updateOne(
            { uid: uid },
            { 
                $inc: { balance: -cost },
                $push: { purchasedItems: item }
            }
        );

        res.status(200).json({ 
            success: true, 
            message: "Purchase successful", 
            newBalance: currentBalance - cost 
        });

    } catch (error) {
        console.error("Marketplace Error:", error);
        res.status(500).json({ success: false, message: "Internal server error during transaction." });
    }
});

// ==========================================
// CHECKOUT/PRO REDIRECT ROUTE
// ==========================================
app.get('/api/checkout/pro', async (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>Secure Payment Gateway</h2>
            <p>Stripe checkout integration goes here.</p>
            <button onclick="window.history.back()">Go Back</button>
        </div>
    `);
});

// ==========================================
// POST: Sync Data
// ==========================================
app.post('/api/v1/sync/:collection', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database not ready" });
        }

        const collectionName = req.params.collection;
        let data = req.body; 

        const uniqueId = data.uid || data.userId;
        if (!uniqueId) {
            return res.status(400).json({ error: "Missing 'uid' or 'userId' in JSON payload" });
        }
        
        data.uid = uniqueId; 

        const db = mongoose.connection.db;
        
        // AUTO-INITIALIZE NEURAL DATA FOR NEW USERS
        if (collectionName === 'user-profiles') {
            const existingUser = await db.collection(collectionName).findOne({ uid: data.uid });
            
            if (!existingUser) {
                const totalUsers = await db.collection(collectionName).countDocuments();
                const assignedPremium = totalUsers < 10;

                data = {
                    ...data,
                    isPremium: assignedPremium,
                    balance: 1500, // <--- GIVING 1500 NUX TO NEW USERS SO THEY CAN BUY THINGS
                    purchasedItems: [], // <--- Initialize empty items array
                    overallProgress: 0,
                    nodesUnlocked: 1,
                    moduleProgress: { web: 0, js: 0, react: 0, node: 0, db: 0 },
                    activityData: [5, 12, 8, 20, 15, 30, 25, 45, 35, 55, 50, 75],
                    registeredAt: new Date().toISOString()
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
            isPremium: data.isPremium || false,
            result 
        });

    } catch (error) {
        console.error(`Sync Error [${req.params.collection}]:`, error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// GET: Retrieve Data
// ==========================================
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
        console.error("Retrieve Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==========================================
// SECURE AI CHAT ROUTE
// ==========================================
app.post('/api/v1/ai/chat', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error("Gemini API Key is missing in environment variables.");
            return res.status(500).json({ error: "AI configuration error on server." });
        }

        const { systemInstruction, contents } = req.body;

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

// ==========================================
// FALLBACK ROUTE
// ==========================================
app.use((req, res) => {
    res.status(404).json({ error: "Nueralab API endpoint not found." });
});

// ==========================================
// IGNITION
// ==========================================
const PORT = process.env.PORT || 10000;

if (!process.env.MONGO_URI) {
    console.error("CRITICAL ERROR: MONGO_URI is not defined in environment variables.");
    process.exit(1); 
}

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected for Nuera Lab");
        app.listen(PORT, () => {
            console.log(`Neural Core API running on port ${PORT}`);
            console.log(`\n=========================================`);
            console.log(`泙 HEALTH CHECK URL: http://localhost:${PORT} `);
            console.log(`=========================================\n`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });
