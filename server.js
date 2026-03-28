const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// POST: Create or Update Data in ANY Collection
app.post('/api/v1/sync/:collection', async (req, res) => {
    try {
        if (!mongoose.connection.db) {
            return res.status(503).json({ error: "Database not ready" });
        }

        const collectionName = req.params.collection;
        const data = req.body;

        if (!data.uid) {
            return res.status(400).json({ error: "Missing 'uid' in JSON payload" });
        }

        const db = mongoose.connection.db;

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

// GET: Retrieve Data
app.get('/api/v1/sync/:collection/:uid', async (req, res) => {
    try {
        if (!mongoose.connection.db) {
            return res.status(503).json({ error: "Database not ready" });
        }

        const db = mongoose.connection.db;

        const result = await db
            .collection(req.params.collection)
            .findOne({ uid: req.params.uid });

        if (!result) {
            return res.status(404).json({ error: "Data not found" });
        }

        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Fallback
app.use((req, res) => {
    res.status(404).json({ error: "Nueralab API endpoint not found. Check your URL." });
});

// IGNITION (Render-safe)
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
