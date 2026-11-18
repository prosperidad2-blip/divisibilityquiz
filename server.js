/**
 * ARAL Math Grade 6 - Divisibility Rules Interactive Game (Worksheet 4)
 * Production Express Server with Persistent Firebase Firestore Storage
 * Designed for GitHub -> Render.com continuous deployment
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const admin = require('firebase-admin');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_PIN = String(process.env.ADMIN_PIN || '1234').trim();
const COLLECTION_NAME = String(process.env.FIRESTORE_COLLECTION || 'aral_math_g6_w4_records').trim();

// ==================== FIREBASE ADMIN INITIALIZATION ====================
let db = null;
let storageMode = 'memory';
const memoryFallbackStore = new Map();

function initFirestore() {
  try {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } else {
      const localKeyPath = path.join(__dirname, 'serviceAccountKey.json');
      if (fs.existsSync(localKeyPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
      }
    }

    if (serviceAccount) {
      if (typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      storageMode = 'firestore';
      console.log('[Firestore] Connected to project:', serviceAccount.project_id);
    } else {
      console.warn('[Firestore] No Firebase credentials found in environment. Running with in-memory fallback.');
    }
  } catch (err) {
    console.error('[Firestore] Initialization error:', err.message);
    db = null;
    storageMode = 'memory';
  }
}

initFirestore();

// ==================== MIDDLEWARE ====================
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false // Allow Tailwind CDN, Tone.js CDN, and Google Fonts
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true
}));

// ==================== HELPERS & VALIDATION ====================
function sanitizeDocId(rawId) {
  return String(rawId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.]/g, '_')
    .slice(0, 140);
}

function validateAndNormalizeRecord(body) {
  if (!body || typeof body !== 'object') {
    const err = new Error('Request body must be a JSON object.');
    err.status = 400;
    throw err;
  }

  const fullName = String(body.fullName || '').trim().slice(0, 80);
  const section = String(body.section || '').trim().slice(0, 60);
  if (!fullName || !section) {
    const err = new Error('Both fullName and section are required.');
    err.status = 400;
    throw err;
  }

  const docId = sanitizeDocId(body.docId || `${fullName}__${section}`);
  const status = body.status === 'Completed' ? 'Completed' : 'In Progress';

  return {
    docId,
    fullName,
    section,
    deviceLabel: String(body.deviceLabel || 'Web Browser').trim().slice(0, 60),
    status,
    part1a: body.part1a && typeof body.part1a === 'object' ? body.part1a : {},
    part1bSel: body.part1bSel && typeof body.part1bSel === 'object' ? body.part1bSel : {},
    part2Sel: body.part2Sel && typeof body.part2Sel === 'object' ? body.part2Sel : {},
    score1A: Number.isFinite(Number(body.score1A)) ? Number(body.score1A) : 0,
    score1B: Number.isFinite(Number(body.score1B)) ? Number(body.score1B) : 0,
    score2: Number.isFinite(Number(body.score2)) ? Number(body.score2) : 0,
    totalScore: Number.isFinite(Number(body.totalScore)) ? Number(body.totalScore) : 0,
    updatedAt: new Date().toISOString()
  };
}

function requireAdminPin(req, res, next) {
  const provided = String(req.headers['x-admin-pin'] || req.body?.pin || '').trim();
  if (!provided || provided !== ADMIN_PIN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN.' });
  }
  next();
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ==================== API ROUTES ====================

// 1. Health check endpoint for Render & Frontend status pill
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ARAL Math Grade 6 - Divisibility Rules API',
    storage: storageMode,
    timestamp: new Date().toISOString()
  });
});

// 2. Verify Admin PIN
app.post('/api/admin/verify', (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ ok: false, error: 'Incorrect Admin PIN.' });
  }
  return res.json({ ok: true });
});

// 3. Get single learner record by docId (for resuming progress without exposing all students)
app.get('/api/records/:docId', asyncHandler(async (req, res) => {
  const docId = sanitizeDocId(req.params.docId);
  if (!docId) return res.status(400).json({ ok: false, error: 'Invalid record ID.' });

  if (db) {
    const snap = await db.collection(COLLECTION_NAME).doc(docId).get();
    if (!snap.exists) {
      return res.json({ ok: true, record: null });
    }
    return res.json({ ok: true, record: snap.data() });
  }

  return res.json({ ok: true, record: memoryFallbackStore.get(docId) || null });
}));

// 4. Create or update learner progress persistently in Firestore
app.post('/api/records', asyncHandler(async (req, res) => {
  const normalized = validateAndNormalizeRecord(req.body);

  if (db) {
    await db.collection(COLLECTION_NAME).doc(normalized.docId).set(normalized, { merge: true });
  } else {
    memoryFallbackStore.set(normalized.docId, normalized);
  }

  return res.status(200).json({ ok: true, storage: storageMode, record: normalized });
}));

// 5. List all learner records (Admin PIN protected)
app.get('/api/records', requireAdminPin, asyncHandler(async (req, res) => {
  let records = [];

  if (db) {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    snapshot.forEach(doc => records.push(doc.data()));
  } else {
    records = Array.from(memoryFallbackStore.values());
  }

  records.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return res.json({ ok: true, storage: storageMode, records });
}));

// 6. Delete a single learner record (Admin PIN protected)
app.delete('/api/records/:docId', requireAdminPin, asyncHandler(async (req, res) => {
  const docId = sanitizeDocId(req.params.docId);
  if (!docId) return res.status(400).json({ ok: false, error: 'Invalid record ID.' });

  if (db) {
    await db.collection(COLLECTION_NAME).doc(docId).delete();
  } else {
    memoryFallbackStore.delete(docId);
  }

  return res.json({ ok: true, deletedId: docId });
}));

// 7. Clear all learner records in batches (Admin PIN protected)
app.delete('/api/records', requireAdminPin, asyncHandler(async (req, res) => {
  if (db) {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    if (!snapshot.empty) {
      const chunks = [];
      for (let i = 0; i < snapshot.docs.length; i += 400) {
        chunks.push(snapshot.docs.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }
  } else {
    memoryFallbackStore.clear();
  }

  return res.json({ ok: true });
}));

// ==================== SPA FALLBACK & ERROR HANDLING ====================
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'API route not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(`[API Error ${status}] ${req.method} ${req.originalUrl}:`, err.message);
  res.status(status).json({
    ok: false,
    error: status === 500 ? 'Internal server error. Please try again.' : err.message
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ARAL Math Grade 6 server listening on port ${PORT} (Storage: ${storageMode})`);
});
