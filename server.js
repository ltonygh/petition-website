import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runSubmission } from './services/submissionService.js';
import { readCounter, Counter } from './models/Counter.js';
import StudentInfo from './models/StudentInfo.js';
import { SUBMISSION_DEADLINE, DEADLINE_LABEL, isPastDeadline } from './config/deadline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));

function renderSpa() {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  const siteKey = process.env.TURNSTILE_SITEKEY || '';
  const conf = JSON.stringify({
    sitekey: siteKey,
    deadline: SUBMISSION_DEADLINE,
    deadlineLabel: DEADLINE_LABEL,
  });

  if (html.includes('window.__APP_CONFIG__')) {
    html = html.replace(
      'window.__APP_CONFIG__',
      `window.__APP_CONFIG__ = ${conf};`
    );
  }
  return html;
}



app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderSpa());
});

app.use(express.static(path.join(__dirname, 'public')));



app.get('/api/status', (_req, res) => {
  res.json({
    open: !isPastDeadline(),
    deadline: SUBMISSION_DEADLINE,
    deadlineLabel: DEADLINE_LABEL,
  });
});

app.get('/api/count', async (_req, res) => {
  try {
    const count = await readCounter();
    res.json({ count });
  } catch (err) {
    console.error('[count] failed:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/signatures', async (_req, res) => {
  try {
    const total = await StudentInfo.countDocuments();
    res.json({ total });
  } catch (err) {
    console.error('[signatures] failed:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/submit', async (req, res) => {
  const ip = req.ip || '';

  try {
    const result = await runSubmission(req.body || {}, { remoteIp: ip });

    if (result.ok) {
      return res.status(201).json({
        ok: true,
        message: 'Signature recorded. Thank you!',
      });
    }

    const statusMap = {
      turnstile: 400,
      late: 403,
      constraints: 400,
      duplicate: 409,
    };
    return res
      .status(statusMap[result.reason] || 400)
      .json({ ok: false, reason: result.reason });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ ok: false, reason: 'duplicate' });
    }
    console.error('[submit] unexpected:', err);
    return res.status(500).json({ ok: false, reason: 'server' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI;


async function start() {
  if (!MONGO_URI) {
    console.error(
      'MONGO_URI is missing. Copy env-template.txt to .env and fill it in.'
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected.');

    await Counter.updateOne(
      { _id: 'petition' },
      { $setOnInsert: { value: 0 } },
      { upsert: true }
    );

    app.listen(PORT, () => {
      console.log(`Petition SPA running at http://localhost:${PORT}`);
      console.log('Submissions close:', new Date(SUBMISSION_DEADLINE).toISOString());
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

const isMainRun =
  process.argv[1] &&
  import.meta.url.startsWith(pathToFileURL(process.argv[1]).href);

if (isMainRun) {
  start();
}

export { app, renderSpa };
export default app;