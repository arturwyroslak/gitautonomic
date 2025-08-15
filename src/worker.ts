import pino from 'pino';
const log = pino({ level: process.env.LOG_LEVEL || 'info' });
log.info('Worker placeholder – advanced logic will be added in subsequent commits.');
