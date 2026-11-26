import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { handleConfigSheetHttp } from './server/configSheetPublic.js';
import { handleSheetsHttp } from './server/googleSheetsProxy.js';
import { handlePushHttp } from './server/onesignalPush.js';

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || (process.env[key] != null && process.env[key] !== '')) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
};

loadEnvFile(join(process.cwd(), '.env'));

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const corsOrigin = String(process.env.CORS_ORIGIN || '*').trim() || '*';

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
};

const sendJson = (res, result) => {
  setCors(res);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json');
  if (result.status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(result.body ?? {}));
};

const requestPath = (req) => String(req.url || '/').split('?')[0];

const server = createServer(async (req, res) => {
  const path = requestPath(req);
  try {
    if (req.method === 'OPTIONS') {
      setCors(res);
      res.statusCode = 204;
      res.end();
      return;
    }
    if (path === '/health' || path === '/api/health') {
      sendJson(res, { status: 200, body: { ok: true } });
      return;
    }
    if (path === '/api/sheets' || path === '/api/calendar' || path === '/api/google') {
      sendJson(res, await handleSheetsHttp(req, process.env));
      return;
    }
    if (path === '/api/config-sheet') {
      sendJson(res, await handleConfigSheetHttp(req, process.env));
      return;
    }
    if (path === '/api/push') {
      sendJson(res, await handlePushHttp(req, process.env));
      return;
    }
    sendJson(res, { status: 404, body: { error: 'Not found.' } });
  } catch (error) {
    sendJson(res, { status: 500, body: { error: error.message || 'Server error' } });
  }
});

server.listen(port, host, () => {
  console.info(`CRM API listening on ${host}:${port}`);
});
