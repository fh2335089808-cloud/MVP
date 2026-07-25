// EXPORTS: IFormOptions, MOCK_FORM_OPTIONS
export interface IFormOptions {
  id: string
  mushrooms: string[]
  quantities: string[]
  deliveryTypes: string[]
  deliveryTimes: string[]
  successMessage: string
  footerTips: string[]
}

export const MOCK_FORM_OPTIONS: IFormOptions = {
  id: '1',
  mushrooms: [
    '鸡枞菌',
    '青头菌',
    '松茸',
    '牛肝菌',
    '其他当季野生菌',
  ],
  quantities: [
    '500g',
    '1kg',
    '2kg',
    '其他数量',
  ],
  deliveryTypes: [
    '官渡区同城配送',
    '到店自取',
    '外地寄送咨询',
  ],
  deliveryTimes: [
    '今天',
    '明天',
    '预约其他日期',
  ],
  successMessage: '登记已收到。野生菌价格和库存随当天市场变化，工作人员会尽快联系您确认品相、实际价格、配送费用和送达时间。提交表单不代表订单已经确认，请以工作人员最终回复为准。',
  footerTips: [
    '当前昆明同城配送范围暂限官渡区，具体街道和配送时效需要确认。',
    '野生菌请彻底加热后食用，食用期间及以后一段时间请避免饮酒。',
    '本表单仅用于订购需求登记，不直接收款。',
  ],
}