import { getPayload } from 'payload';
import payloadConfig from './payload.config';

async function start() {
  const payload = await getPayload({ config: payloadConfig });
  console.log(`Payload admin running on port ${payload.config.serverURL || 3000}`);
}

start().catch(console.error);
