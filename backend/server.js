// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (replace with DB in production)
let reports = [];

/**
 * Geocode a location using OpenStreetMap Nominatim API
 * @param {string} loc - Location string (address or place name)
 * @returns {Promise<{lat:number, lng:number}|null>}
 */
async function geocodeLocation(loc) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc)}&limit=1&addressdetails=1`;

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'DisasterReliefDashboard/1.0' }
        });

        const data = await res.json();

        if (data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (err) {
        console.error('Geocoding failed:', err);
    }

    return null;
}


// Router for reports
const router = express.Router();

// GET all reports
router.get('/', (req, res) => {
  res.json({ items: reports });
});

// POST a new report
router.post('/', async (req, res) => {
  const { location, urgency, population, items, notes } = req.body;

  // Basic validation
  if (!location || !urgency || !population) {
    return res.status(400).json({ error: 'Missing required fields: location, urgency, population' });
  }

  let resolvedLocation = location;
  let latLng = null;

  // If location is "lat,lng", parse directly
  if (location.includes(',')) {
    const [lat, lng] = location.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      latLng = { lat, lng };
    }
  } else {
    // Otherwise, geocode the location string
    latLng = await geocodeLocation(location);
    if (latLng) {
      resolvedLocation = `${latLng.lat},${latLng.lng}`;
    } 
  }

  // Create new report object
  const newReport = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    location: resolvedLocation,
    originalLocation: location,
    urgency,
    population: parseInt(population, 10),
    items: items || '',
    notes: notes || '',
    latLng
  };

  // Add to reports (recent first)
  reports.unshift(newReport);

  // Limit to 100 reports
  if (reports.length > 100) {
    reports = reports.slice(0, 100);
  }

  res.status(201).json(newReport);
});

// Mount router
app.use('/reports', router);

// Add predictive analytics route here
app.post('/predict', (req, res) => {
  const { population } = req.body;
  if (!population) {
    return res.status(400).json({ error: 'Population is required' });
  }
  const predictedRequests = Math.round(population * 0.05);
  res.json({ predicted_requests: predictedRequests });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Disaster Relief Dashboard running at http://localhost:${port}`);
  console.log(`📱 Frontend available at http://localhost:${port}/index.html`);
});