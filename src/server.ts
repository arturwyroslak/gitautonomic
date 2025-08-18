import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import { webhooks } from './webhook.js';
import { scheduleActiveAgents } from './services/loopScheduler.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

// Uwaga: globalny JSON parser OK, ale dla /webhook damy raw body parser per-route
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Static
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Landing
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

// Webhook – MUSI używać surowego body do weryfikacji podpisu
app.post('/webhook',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req, res) => {
    try {
      const id = req.headers['x-github-delivery'] as string;
      const name = req.headers['x-github-event'] as any;
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = (req.body as Buffer).toString('utf-8');

      await webhooks.verifyAndReceive({ id, name, payload, signature });
      res.status(200).send('OK');
    } catch (err) {
      log.error({ err }, 'Webhook verification failed');
      res.status(400).send('Bad signature');
    }
  }
);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/maintenance/sweep', async (_req, res) => {
  await scheduleActiveAgents();
  res.json({ status: 'queued' });
});

// Upewnij się, że PORT jest spójny z Docker/compose
const port = Number(process.env.PORT || 3000);
app.listen(port, () => log.info({ port }, 'Server started'));

setInterval(() => {
  scheduleActiveAgents().catch(e => log.error(e));
}, 60_000);
