require('dotenv').config(); // Required to read your MONGO_URI
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
        // Use readyState to check if DB is connected (1 = connected)
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: "Database not ready" });
        }

        const collectionName = req.params.collection;
        const data = req.body;

        if (!data.uid) {
            return res.status(400).json({ error: "Missing 'uid' in JSON payload" });
        }

        // Access the raw MongoDB driver to bypass strict Mongoose schemas
        const db = mongoose.connection.db;
        
        // UPSERT LOGIC: Find document by uid. If exists, update it. If not, create it.
        const result = await db.collection(collectionName).updateOne(
            { uid: data.uid }, 
            { $set: data }, 
            { upsert: true }
        );
        
        // Single response
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

// 4. FALLBACK ROUTE
app.use((req, res) => {
    res.status(404).json({ error: "Nueralab API endpoint not found. Check your URL." });
});

// 5. IGNITION (Fixed for Render)
const PORT = process.env.PORT || 10000;

// Connect to MongoDB first, THEN start listening for requests
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully for Nuera Lab");
        app.listen(PORT, () => {
            console.log(`Neural Core API running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });
