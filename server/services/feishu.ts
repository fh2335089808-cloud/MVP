const FEISHU_OPEN_API = 'https://open.feishu.cn/open-apis';
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
export const IDEMPOTENCY_FIELD_NAME = '幂等键';

type FeishuOperation = 'tenant_access_token' | 'create_record' | 'search_records' | 'list_fields' | 'create_field';
interface TokenCache { token: string; expiresAt: number }
interface FeishuResponse<T> { code?: number; msg?: string; data?: T; tenant_access_token?: string; expire?: number }
interface BitableField { field_id: string; field_name: string; type: number }
export interface CreatedRecord { record_id: string; fields?: Record<string, unknown> }

export class FeishuApiError extends Error {
  constructor(message: string, readonly operation: FeishuOperation, readonly httpStatus?: number, readonly feishuCode?: number) {
    super(message);
    this.name = 'FeishuApiError';
  }
}

let tokenCache: TokenCache | null = null;
let idempotencyFieldReady = false;

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/bitable\/v1\/apps\/[^/]+\/tables\/[^/]+/, '/bitable/v1/apps/[redacted]/tables/[redacted]');
    if (parsed.searchParams.has('client_token')) parsed.searchParams.set('client_token', '[redacted]');
    return parsed.toString();
  } catch {
    return '[invalid-url]';
  }
}

async function requestWithTimeout(url: string, init: RequestInit, operation: FeishuOperation): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[feishu] request timed out', { operation, url: sanitizeUrl(url) });
      throw new FeishuApiError('Feishu request timed out', operation);
    }
    console.error('[feishu] network request failed', { operation, url: sanitizeUrl(url), errorName: error instanceof Error ? error.name : 'UnknownError' });
    throw new FeishuApiError('Feishu network request failed', operation);
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson<T>(response: Response): Promise<FeishuResponse<T>> {
  try { return (await response.json()) as FeishuResponse<T>; } catch { return {}; }
}

function throwForFeishuError<T>(operation: FeishuOperation, url: string, response: Response, payload: FeishuResponse<T>): never {
  console.error('[feishu] API request failed', { operation, url: sanitizeUrl(url), httpStatus: response.status, feishuCode: payload.code, feishuMessage: payload.msg });
  throw new FeishuApiError(`Feishu ${operation} failed`, operation, response.status, payload.code);
}

async function feishuRequest<T>(url: string, init: RequestInit, operation: FeishuOperation): Promise<FeishuResponse<T>> {
  const tenantAccessToken = await getTenantAccessToken();
  const response = await requestWithTimeout(url, { ...init, headers: { Authorization: `Bearer ${tenantAccessToken}`, 'Content-Type': 'application/json; charset=utf-8', ...init.headers } }, operation);
  const payload = await readJson<T>(response);
  if (!response.ok || payload.code !== 0) throwForFeishuError(operation, url, response, payload);
  return payload;
}

function tableBaseUrl(appToken: string, tableId: string): string {
  return `${FEISHU_OPEN_API}/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}`;
}

export async function getTenantAccessToken(): Promise<string> {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Missing required Feishu application credentials');
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + TOKEN_REFRESH_BUFFER_MS) return tokenCache.token;
  const url = `${FEISHU_OPEN_API}/auth/v3/tenant_access_token/internal`;
  const response = await requestWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ app_id: appId, app_secret: appSecret }) }, 'tenant_access_token');
  const payload = await readJson<never>(response);
  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) throwForFeishuError('tenant_access_token', url, response, payload);
  tokenCache = { token: payload.tenant_access_token, expiresAt: now + (payload.expire ?? 7200) * 1000 };
  return tokenCache.token;
}

async function listFields(appToken: string, tableId: string): Promise<BitableField[]> {
  const url = `${tableBaseUrl(appToken, tableId)}/fields?page_size=100`;
  const payload = await feishuRequest<{ items?: BitableField[] }>(url, { method: 'GET' }, 'list_fields');
  return payload.data?.items ?? [];
}

export async function ensureIdempotencyField(appToken: string, tableId: string): Promise<void> {
  if (idempotencyFieldReady) return;
  const fields = await listFields(appToken, tableId);
  if (fields.some((field) => field.field_name === IDEMPOTENCY_FIELD_NAME)) { idempotencyFieldReady = true; return; }
  const url = `${tableBaseUrl(appToken, tableId)}/fields`;
  try {
    await feishuRequest<{ field?: BitableField }>(url, { method: 'POST', body: JSON.stringify({ field_name: IDEMPOTENCY_FIELD_NAME, type: 1 }) }, 'create_field');
  } catch (error) {
    const fieldsAfterFailure = await listFields(appToken, tableId);
    if (!fieldsAfterFailure.some((field) => field.field_name === IDEMPOTENCY_FIELD_NAME)) throw error;
  }
  idempotencyFieldReady = true;
}

export async function findRecordByIdempotencyKey(appToken: string, tableId: string, idempotencyKey: string): Promise<CreatedRecord | null> {
  const url = `${tableBaseUrl(appToken, tableId)}/records/search?page_size=1`;
  const payload = await feishuRequest<{ items?: CreatedRecord[] }>(url, { method: 'POST', body: JSON.stringify({ filter: { conjunction: 'and', conditions: [{ field_name: IDEMPOTENCY_FIELD_NAME, operator: 'is', value: [idempotencyKey] }] } }) }, 'search_records');
  return payload.data?.items?.[0] ?? null;
}

export async function createRecord(appToken: string, tableId: string, fields: Record<string, unknown>, clientToken: string): Promise<CreatedRecord> {
  const url = new URL(`${tableBaseUrl(appToken, tableId)}/records`);
  url.searchParams.set('client_token', clientToken);
  const payload = await feishuRequest<{ record?: CreatedRecord }>(url.toString(), { method: 'POST', body: JSON.stringify({ fields }) }, 'create_record');
  if (!payload.data?.record?.record_id) throw new FeishuApiError('Feishu create_record returned no record', 'create_record');
  return payload.data.record;
}
