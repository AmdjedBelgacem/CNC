// Log a browser session in WITHOUT driving the login form.
//
// Driving the form via the CLI is the flakiest step in the sweep — it can hang
// indefinitely on a slow first paint. Authenticating against the API and injecting the
// resulting cookies over CDP is deterministic and instant.
//
// Usage: node cdp-login.mjs <cdpWsUrl> [appOrigin] [apiBase] [email] [password]
const [, , wsUrl, APP = 'http://localhost:3000', API = 'http://localhost:4000',
  EMAIL = 'admin@titansofmanufacturing.com', PASSWORD = 'Test1234!'] = process.argv;

if (!wsUrl) {
  console.error('usage: node cdp-login.mjs <cdpWsUrl> [appOrigin] [apiBase] [email] [password]');
  process.exit(2);
}

const TENANT = process.env.TENANT || 'cnc-fundamentals';

/** Parse set-cookie headers into [{name, value}]. */
function cookiesOf(res) {
  const out = [];
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i === -1) continue;
    out.push({ name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim() });
  }
  return out;
}
const header = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');

async function authenticate() {
  const csrfRes = await fetch(`${API}/auth/csrf-token`, { headers: { 'x-tenant-slug': TENANT } });
  if (!csrfRes.ok) throw new Error(`csrf-token -> ${csrfRes.status}`);
  const csrf = await csrfRes.json();
  const csrfCookies = cookiesOf(csrfRes);

  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': TENANT,
      'x-csrf-token': csrf.csrfToken,
      cookie: header(csrfCookies),
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`login -> ${loginRes.status}`);
  const body = await loginRes.json();
  if (body.twoFactorRequired) throw new Error('account has 2FA; use a plain admin for the sweep');

  return [...csrfCookies, ...cookiesOf(loginRes)];
}

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    setTimeout(() => reject(new Error(`timeout: ${method}`)), 10000);
  });
}
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});

ws.addEventListener('open', async () => {
  try {
    const cookies = await authenticate();
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page' && t.url.startsWith(APP))
      ?? targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });

    for (const c of cookies) {
      await send('Network.setCookie', {
        name: c.name, value: c.value, url: APP, path: '/', httpOnly: false, sameSite: 'Lax',
      }, sessionId);
    }
    console.log(`logged in as ${EMAIL}; injected ${cookies.length} cookies: ${cookies.map((c) => c.name).join(', ')}`);
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error('LOGIN ERROR', e.message);
    process.exit(2);
  }
});
ws.addEventListener('error', (e) => { console.error('WS ERROR', e.message ?? e); process.exit(2); });
