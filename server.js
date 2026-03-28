const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. OMNI-CORS: Accepts requests from ANY origin (Fixes your Github Codespace issues)
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); // Allows large payloads just in case


// 3. THE MAGIC ROUTES (Dynamic Schema-less CRUD)

// POST: Create or Update Data in ANY Collection
app.post('/api/v1/sync/:collection', async (req, res) => {
    try {
        const collectionName = req.params.collection;
        const data = req.body;
        
        // We require a 'uid' so we know who the data belongs to
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
        
        res.status(200).json({ success: true, message: `Data synced to ${collectionName}`, result });
    } catch (error) {
        console.error(`Sync Error [${req.params.collection}]:`, error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET: Retrieve Data from ANY Collection by UID
app.get('/api/v1/sync/:collection/:uid', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const result = await db.collection(req.params.collection).findOne({ uid: req.params.uid });
        
        if (!result) return res.status(404).json({ error: "Data not found" });
        
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 4. FALLBACK ROUTE
app.use((req, res) => {
    res.status(404).json({ error: "Nueralab API endpoint not found. Check your URL." });
});

// 5. IGNITION (FIXED FOR RENDER)
const PORT = process.env.PORT || 10000;

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('✅ Nueralab Database Connected');

    app.listen(PORT, () => {
        console.log(`🚀 Nueralab Core online on port ${PORT}`);
    });
})
.catch(err => {
    console.error('❌ DB Connection Error:', err);
});
