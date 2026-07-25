// ---- plugin:feishu_bitable_junxiandao_order_submit_1 ----
// ============================================================
// 插件 feishu_bitable_junxiandao_order_submit_1 (菌鲜到野生菌订购数据写入多维表格) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface FeishuBitableJunxiandaoOrderSubmitOneInput {
  /** [object Object] */
  records: {
    record: {
      '确认人': number[];
      '需要的野生菌': string[];
      '其他数量': string;
      '期望送达时间': string;
      '确认备注': string;
      '客户来源': string;
      '确认时间': number;
      '备注': string;
      '联系电话': string;
      '购买数量': string;
      '配送地址': string;
      '预约日期': number;
      '其他需求': string;
      '姓名': string;
      '微信号': string;
      '配送方式': string;
      '订单状态': string;
    };
  }[];
}

/**
 * capabilityClient.load('feishu_bitable_junxiandao_order_submit_1').call<FeishuBitableJunxiandaoOrderSubmitOneOutput>('batchAddRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 */
export interface FeishuBitableJunxiandaoOrderSubmitOneOutput {
  /** [object Object] */
  records: {
    id: string;
  }[];
}
// ---- end:feishu_bitable_junxiandao_order_submit_1 ----