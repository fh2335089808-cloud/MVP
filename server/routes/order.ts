import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { batchCreateRecords } from '../services/feishu.js';

const log = console;

const router = Router();

// 提交数据校验 schema
const submitSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  wechat: z.string().optional(),
  mushrooms: z.array(z.string()).min(1, '请至少选择一种野生菌'),
  quantity: z.string().min(1, '请选择购买数量'),
  otherQuantity: z.string().optional(),
  deliveryType: z.string().min(1, '请选择配送方式'),
  deliveryAddress: z.string().optional(),
  deliveryTime: z.string().min(1, '请选择期望送达时间'),
  appointmentDate: z.string().optional(),
  remarks: z.string().optional(),
  src: z.string().optional(),
});

/**
 * POST /api/order/submit
 * 提交订购信息到飞书多维表格
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      res.status(400).json({
        error: firstError?.message || '参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const data = parsed.data;

    const appToken = process.env.BITABLE_APP_TOKEN;
    const tableId = process.env.BITABLE_TABLE_ID;

    if (!appToken || !tableId) {
      log.error('[order] 缺少多维表格配置：BITABLE_APP_TOKEN 或 BITABLE_TABLE_ID 未设置');
      res.status(500).json({ error: '系统配置有误，请联系工作人员' });
      return;
    }

    // 渠道来源映射
    const srcEnumMap: Record<string, string> = {
      web: '网页访问',
      wechat: '微信推荐',
      douyin: '抖音',
      offline: '线下',
      网页访问: '网页访问',
      微信推荐: '微信推荐',
      抖音: '抖音',
      线下: '线下',
    };
    const customerSource = data.src ? srcEnumMap[data.src] || '其他' : '';

    // 预约日期转时间戳
    let appointmentTimestamp: number | null = null;
    if (data.deliveryTime === '预约其他日期' && data.appointmentDate) {
      const d = new Date(data.appointmentDate);
      d.setHours(12, 0, 0, 0);
      appointmentTimestamp = d.getTime();
    }

    // 构建 fields（飞书多维表格 API 用 fields 而非 record）
    const fields: Record<string, unknown> = {};

    fields['姓名'] = data.name;
    fields['联系电话'] = data.phone;
    if (data.wechat) fields['微信号'] = data.wechat;
    fields['需要的野生菌'] = data.mushrooms; // MultiSelect: string[]
    fields['购买数量'] = data.quantity;
    if (data.otherQuantity) fields['其他数量'] = data.otherQuantity;
    fields['配送方式'] = data.deliveryType;
    if (data.deliveryAddress) fields['配送地址'] = data.deliveryAddress;
    fields['期望送达时间'] = data.deliveryTime;
    if (appointmentTimestamp !== null) {
      fields['预约日期'] = appointmentTimestamp;
    }
    if (data.remarks) fields['其他需求'] = data.remarks;
    if (customerSource) fields['客户来源'] = customerSource;
    fields['订单状态'] = '待确认';

    log.info('[order] 提交数据:', {
      name: data.name,
      phone: data.phone,
      mushrooms: data.mushrooms,
      quantity: data.quantity,
      deliveryType: data.deliveryType,
    });

    const result = await batchCreateRecords(appToken, tableId, [{ fields }]);

    log.info('[order] 写入成功，记录ID:', result.records[0]?.record_id);

    res.json({
      success: true,
      recordId: result.records[0]?.record_id,
    });
  } catch (err) {
    log.error('[order] 提交失败:', err);
    const errMsg = String(err);

    if (errMsg.includes('无权限') || errMsg.includes('permission') || errMsg.includes('auth')) {
      res.status(500).json({ error: '系统权限配置有误，请联系工作人员' });
    } else {
      res.status(500).json({ error: '提交失败，请稍后重试' });
    }
  }
});

export default router;
