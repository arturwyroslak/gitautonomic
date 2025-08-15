import express from 'express';
import pino from 'pino';
import { webhooks } from './webhook.js';
import { scheduleActiveAgents } from './services/loopScheduler.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

app.use(express.json({ limit:'2mb' }));

app.post('/webhook', (req,res) => {
  webhooks.verifyAndReceive({ id: req.headers['x-github-delivery'] as string, name: req.headers['x-github-event'] as string, payload: req.body, signature: req.headers['x-hub-signature-256'] as string })
    .then(()=> res.status(200).send('OK'))
    .catch(err => { log.error({ err }, 'Webhook verification failed'); res.status(400).send('Bad signature'); });
});

app.get('/healthz', (_req,res)=> res.json({ ok:true }));

app.post('/maintenance/sweep', async (_req,res)=>{
  await scheduleActiveAgents();
  res.json({ status:'queued' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, ()=> log.info({ port }, 'Server started'));

setInterval(()=> {
  scheduleActiveAgents().catch(e=>log.error(e));
}, 60_000);
