import { handleConfigSheetHttp } from './server/configSheetPublic.js';
import { handleSheetsHttp } from './server/googleSheetsProxy.js';
import { handlePushHttp } from './server/onesignalPush.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
};

const headerMap = (headers = {}) =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]));

const requestPath = (event) => {
  const raw = String(event.rawPath || event.path || '/');
  return raw.split('?')[0] || '/';
};

const requestMethod = (event) =>
  String(event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();

const requestBody = (event) => {
  if (event.body == null || event.body === '') return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const nodeRequest = (event) => ({
  method: requestMethod(event),
  url: requestPath(event),
  headers: headerMap(event.headers),
  body: requestBody(event),
});

const isHealthPath = (path) => {
  const normalized = String(path || '/').replace(/\/+$/, '') || '/';
  return normalized === '/' || normalized === '/health' || normalized === '/api/health' || normalized.endsWith('/health');
};

const routeRequest = async (event) => {
  const path = requestPath(event);
  if (isHealthPath(path)) {
    return { status: 200, body: { ok: true, service: 'crm-api', time: new Date().toISOString() } };
  }
  const req = nodeRequest(event);
  if (path.includes('config-sheet')) return handleConfigSheetHttp(req, process.env);
  if (path.includes('push')) return handlePushHttp(req, process.env);
  return handleSheetsHttp(req, process.env);
};

export const handler = async (event = {}) => {
  if (requestMethod(event) === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  const result = await routeRequest(event);
  return {
    statusCode: result.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: result.status === 204 ? '' : JSON.stringify(result.body ?? {}),
  };
};
