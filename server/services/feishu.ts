// 飞书开放平台 API 封装：tenant_access_token 获取 + 多维表格写入
// 使用应用身份（tenant_access_token）调用，不依赖用户登录

const log = console;

const FEISHU_OPEN_API = 'https://open.feishu.cn/open-apis';

interface TokenCache {
  token: string;
  expireAt: number; // 毫秒时间戳
}

let tokenCache: TokenCache | null = null;

/**
 * 获取 tenant_access_token（应用身份）
 * 带缓存，提前 5 分钟刷新
 */
export async function getTenantAccessToken(): Promise<string> {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('缺少飞书应用配置：FEISHU_APP_ID 或 FEISHU_APP_SECRET 未设置');
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expireAt > now + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  try {
    const resp = await fetch(`${FEISHU_OPEN_API}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    });

    const data = (await resp.json()) as {
      code: number;
      msg: string;
      tenant_access_token?: string;
      expire?: number;
    };

    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`获取 tenant_access_token 失败: code=${data.code}, msg=${data.msg}`);
    }

    tokenCache = {
      token: data.tenant_access_token,
      expireAt: now + (data.expire || 7200) * 1000,
    };

    log.info('[feishu] tenant_access_token 获取成功，有效期:', data.expire, '秒');
    return tokenCache.token;
  } catch (err) {
    log.error('[feishu] 获取 tenant_access_token 异常:', err);
    throw err;
  }
}

/**
 * 批量新增多维表格记录
 * 文档：https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/batch_create
 */
export async function batchCreateRecords(
  appToken: string,
  tableId: string,
  records: Array<{ fields: Record<string, unknown> }>,
): Promise<{
  records: Array<{ record_id: string; fields: Record<string, unknown> }>;
}> {
  const token = await getTenantAccessToken();

  const url = `${FEISHU_OPEN_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ records }),
  });

  const data = (await resp.json()) as {
    code: number;
    msg: string;
    data?: {
      records: Array<{ record_id: string; fields: Record<string, unknown> }>;
    };
  };

  if (data.code !== 0) {
    throw new Error(`多维表格写入失败: code=${data.code}, msg=${data.msg}`);
  }

  return { records: data.data?.records || [] };
}
