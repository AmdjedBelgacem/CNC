// Drop the httpOnly `access-token` cookie over raw CDP. This reproduces the state a
// real user hits after 15 minutes idle — access token invalid, refresh token still
// valid — without waiting for the clock or weakening any guard.
//
// `get cdp-url` yields the BROWSER-level endpoint, which has no Network domain. We
// attach to the page target with flatten:true and address Network commands by
// sessionId.
const wsUrl = process.argv[2];
if (!wsUrl) {
  console.error('usage: node cdp-drop-access.mjs <cdp-ws-url>');
  process.exit(2);
}

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    setTimeout(() => reject(new Error(`timeout: ${method}`)), 8000);
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
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page' && /localhost:3000/.test(t.url))
      ?? targetInfos.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target found');
    console.log(`page target: ${page.url}`);

    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });

    const before = await send('Network.getCookies', {}, sessionId);
    console.log(`cookies before: ${before.cookies.map((c) => c.name).join(', ')}`);

    await send('Network.deleteCookies', { name: 'access-token', url: 'http://localhost:3000' }, sessionId);

    const after = await send('Network.getCookies', {}, sessionId);
    const namesAfter = after.cookies.map((c) => c.name);
    console.log(`cookies after:  ${namesAfter.join(', ')}`);

    const dropped = !namesAfter.includes('access-token');
    const keptRefresh = namesAfter.some((n) => n.includes('refresh'));
    console.log(`\n${dropped ? 'PASS' : 'FAIL'}  access-token removed`);
    console.log(`${keptRefresh ? 'PASS' : 'FAIL'}  refresh token retained`);
    ws.close();
    process.exit(dropped && keptRefresh ? 0 : 1);
  } catch (e) {
    console.error('CDP ERROR', e.message);
    ws.close();
    process.exit(2);
  }
});

ws.addEventListener('error', (e) => {
  console.error('WS ERROR', e.message ?? e);
  process.exit(2);
});
