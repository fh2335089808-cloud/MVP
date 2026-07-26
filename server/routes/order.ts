import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createRecord, ensureIdempotencyField, FeishuApiError, findRecordByIdempotencyKey, IDEMPOTENCY_FIELD_NAME } from '../services/feishu.js';
import { createOrderSubmitSuccessResponse } from '../../shared/order-response.js';

const router = Router();
const optionalText = (maxLength: number) => z.string().trim().max(maxLength).optional().transform((value) => value || undefined);
const submitSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(50, '姓名过长'),
  phone: z.string().trim().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  wechat: optionalText(100),
  mushrooms: z.array(z.string().trim().min(1).max(50)).min(1, '请至少选择一种野生菌').max(10),
  quantity: z.string().trim().min(1, '请选择购买数量').max(50),
  otherQuantity: optionalText(100),
  deliveryType: z.string().trim().min(1, '请选择配送方式').max(50),
  deliveryAddress: optionalText(500),
  deliveryTime: z.string().trim().min(1, '请选择期望送达时间').max(50),
  appointmentDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '预约日期格式不正确').optional(),
  remarks: optionalText(1_000),
  src: optionalText(100),
}).strict().superRefine((data, context) => {
  if (data.quantity === '其他数量' && !data.otherQuantity) context.addIssue({ code: 'custom', path: ['otherQuantity'], message: '请填写其他数量' });
  if (data.deliveryType === '官渡区同城配送' && !data.deliveryAddress) context.addIssue({ code: 'custom', path: ['deliveryAddress'], message: '请填写配送地址' });
  if (data.deliveryTime === '预约其他日期' && !data.appointmentDate) context.addIssue({ code: 'custom', path: ['appointmentDate'], message: '请选择预约日期' });
});

type SubmitData = z.infer<typeof submitSchema>;
type SubmissionResult = { recordId: string; duplicate: boolean };

function getIdempotencyKey(req: Request, data: SubmitData): string {
  const suppliedKey = req.get('Idempotency-Key')?.trim();
  const source = suppliedKey && /^[A-Za-z0-9._:-]{8,128}$/.test(suppliedKey) ? suppliedKey : JSON.stringify({ ip: req.ip, data });
  const digest = createHash('sha256').update(source).digest('hex');
  const variant = ((Number.parseInt(digest[16], 16) & 0x3) | 0x8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function getBitableConfig(): { appToken: string; tableId: string } {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID;
  if (!appToken || !tableId) throw new Error('Missing required Feishu Bitable configuration');
  return { appToken, tableId };
}

function mapSource(source?: string): string | undefined {
  if (!source) return undefined;
  const sourceMap: Record<string, string> = { web: '网页访问', wechat: '微信推荐', douyin: '抖音', offline: '线下', 网页访问: '网页访问', 微信推荐: '微信推荐', 抖音: '抖音', 线下: '线下' };
  return sourceMap[source] ?? '其他';
}

function buildFields(data: SubmitData, idempotencyKey: string): Record<string, unknown> {
  const fields: Record<string, unknown> = { 姓名: data.name, 联系电话: data.phone, 需要的野生菌: data.mushrooms, 购买数量: data.quantity, 配送方式: data.deliveryType, 期望送达时间: data.deliveryTime, 订单状态: '待确认', [IDEMPOTENCY_FIELD_NAME]: idempotencyKey };
  if (data.wechat) fields.微信号 = data.wechat;
  if (data.otherQuantity) fields.其他数量 = data.otherQuantity;
  if (data.deliveryAddress) fields.配送地址 = data.deliveryAddress;
  if (data.remarks) fields.其他需求 = data.remarks;
  const customerSource = mapSource(data.src);
  if (customerSource) fields.客户来源 = customerSource;
  if (data.deliveryTime === '预约其他日期' && data.appointmentDate) {
    const appointment = new Date(`${data.appointmentDate}T12:00:00+08:00`);
    if (!Number.isNaN(appointment.getTime())) fields.预约日期 = appointment.getTime();
  }
  return fields;
}

async function submitToFeishu(data: SubmitData, idempotencyKey: string): Promise<SubmissionResult> {
  const { appToken, tableId } = getBitableConfig();
  await ensureIdempotencyField(appToken, tableId);
  const existing = await findRecordByIdempotencyKey(appToken, tableId, idempotencyKey);
  if (existing) return { recordId: existing.record_id, duplicate: true };
  const record = await createRecord(appToken, tableId, buildFields(data, idempotencyKey), idempotencyKey);
  return { recordId: record.record_id, duplicate: false };
}

router.post('/submit', async (req: Request, res: Response) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? '提交信息格式不正确', code: 'INVALID_ORDER' }); return; }
  const requestId = randomUUID();
  const idempotencyKey = getIdempotencyKey(req, parsed.data);
  try {
    const result = await submitToFeishu(parsed.data, idempotencyKey);
    console.info('[order] submission completed', { requestId, recordId: result.recordId, duplicate: result.duplicate });
    res.json(createOrderSubmitSuccessResponse(result.recordId, result.duplicate));
  } catch (error) {
    console.error('[order] submission failed', { requestId, errorName: error instanceof Error ? error.name : 'UnknownError', operation: error instanceof FeishuApiError ? error.operation : undefined, httpStatus: error instanceof FeishuApiError ? error.httpStatus : undefined, feishuCode: error instanceof FeishuApiError ? error.feishuCode : undefined });
    const isConfigurationError = error instanceof Error && error.message.startsWith('Missing required');
    res.status(isConfigurationError ? 503 : 502).json({ success: false, error: '订单暂时无法提交，请稍后重试或联系工作人员', code: isConfigurationError ? 'ORDER_SERVICE_NOT_CONFIGURED' : 'ORDER_UPSTREAM_ERROR' });
  }
});

export default router;
