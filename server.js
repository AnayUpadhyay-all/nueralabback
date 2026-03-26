const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5500;

// --- 1. CORE MIDDLEWARE ---
app.use(helmet()); 
app.use(cors({ origin: '*' })); // Allows connection from GitHub Pages, Vercel, or Localhost
app.use(morgan('dev')); 
app.use(express.json());

// --- 2. THE FLEXIBLE DATABASE BRIDGE ---
const connectDB = async () => {
    const dbUri = process.env.MONGO_URI;
    if (!dbUri) {
        console.log("⚠️  Notice: MONGO_URI variable not set. Running in API-only mode.");
        return;
    }
    try {
        await mongoose.connect(dbUri);
        console.log("🧬 Neural Database: STABLE & CONNECTED");
    } catch (err) {
        console.error("❌ Database Connection Failed:", err.message);
    }
};
connectDB();

// --- 3. THE "UNIVERSAL" ROUTES ---

// Health Check (Check this in your browser)
app.get('/', (req, res) => {
    res.status(200).json({
        status: "Online",
        bridge: "NueraLab Universal v2.0",
        db_status: mongoose.connection.readyState === 1 ? "Connected" : "Not Linked",
        timestamp: new Date().toISOString()
    });
});

// Universal Data Receiver (Handles Login, Lab Research, or AI Prompts)
// You can use any category name: /api/v1/sync/login or /api/v1/sync/research
app.post('/api/v1/sync/:category', async (req, res) => {
    const { category } = req.params;
    const data = req.body;

    console.log(`📥 Received [${category}] Data:`, data);

    // This is where you can later add logic to save to specific Collections
    res.status(200).json({
        success: true,
        node: "Render-Cloud-SG",
        received_as: category,
        message: "Neural Bridge sync complete.",
        data_echo: data
    });
});

// --- 4. SAFETY NET ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Bridge Interruption", details: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 NueraLab Bridge Active on Port ${PORT}`);
});
