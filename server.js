/**
 * NUERALAB | NEURAL INTELLIGENCE LABORATORY
 * Backend Architecture: Express Node.js
 * Deployment Target: Render.com (Cloud)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5500;

// --- SECURITY & MIDDLEWARE ---

// Helmet helps secure your apps by setting various HTTP headers
app.use(helmet()); 

// CORS (Cross-Origin Resource Sharing)
// This allows your frontend (hosted elsewhere) to safely talk to this backend
app.use(cors({
    origin: '*', // Allows connection from any domain. Update to your frontend URL later for extra security.
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Morgan logs every request to your Render console so you can see if things are working
app.use(morgan('dev')); 

// Middleware to parse JSON bodies from incoming requests
app.use(express.json());

// --- MOCK DATABASE STATE ---
// This mimics data that would normally come from a database like MongoDB or PostgreSQL
const platformData = {
    status: "Active",
    computePower: "14.2 Petaflops",
    activeNodes: 1024,
    latency: "12ms",
    lastMaintenance: new Date().toLocaleDateString(),
    version: "2.5.0-cloud-bridge"
};

// --- API ROUTES ---

/**
 * @route   GET /
 * @desc    Health check to see if the server is live
 */
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: "NueraLab Neural Bridge is Online.",
        cloudNode: "Render-Cluster-SG",
        timestamp: new Date().toISOString()
    });
});

/**
 * @route   GET /api/v1/stats
 * @desc    Returns platform performance data for the index.html dashboard
 */
app.get('/api/v1/stats', (req, res) => {
    res.status(200).json(platformData);
});

/**
 * @route   POST /api/v1/intelligence/analyze
 * @desc    Mock AI analysis endpoint for your "Intelligence AI" module
 */
app.post('/api/v1/intelligence/analyze', (req, res) => {
    const { query, modelType } = req.body;

    if (!query) {
        return res.status(400).json({
            success: false,
            error: "Neural input required for analysis."
        });
    }

    // Simulate AI Processing Logic
    res.status(200).json({
        success: true,
        requestId: `nl-${Math.random().toString(36).substr(2, 9)}`,
        analysis: `Input "${query}" processed via ${modelType || 'Neural-Alpha-1'}. No anomalies detected.`,
        confidence: 0.982
    });
});

// --- ERROR HANDLING ---

// Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found in the Neural Registry." });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: "Internal Neural Disruption",
        details: err.message
    });
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`
    ===========================================
    NUERALAB BACKEND INITIALIZED
    Status: RUNNING
    Port: ${PORT}
    Target: Cloud Deployment
    ===========================================
    `);
});
