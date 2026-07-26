import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Info, Loader2, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { logger, scopedStorage, axiosForBackend } from '@lark-apaas/client-toolkit-lite';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MOCK_FORM_OPTIONS } from '@/data/formoptions';

const DRAFT_KEY = 'order_form_draft';
const IDEMPOTENCY_KEY = 'order_form_idempotency_key';
const SUBMISSION_RECEIPT_KEY = 'order_form_submission_receipt';
const SUBMIT_API_PATH = '/api/order/submit';
const SUBMIT_TIMEOUT_MS = 12_000;

const formSchema = z.object({
  name: z.string().min(1, '请填写姓名'),
  phone: z
    .string()
    .min(1, '请填写联系电话')
    .regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号'),
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

type FormData = z.infer<typeof formSchema>;

interface OrderFormSectionProps {
  initialSrc?: string;
  onSubmitSuccess?: () => void;
}

export default function OrderFormSection({ initialSrc, onSubmitSuccess }: OrderFormSectionProps) {
  const options = MOCK_FORM_OPTIONS;
  const idempotencyKeyRef = useRef<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(() => {
    try {
      return Boolean(scopedStorage.getItem(SUBMISSION_RECEIPT_KEY));
    } catch {
      return false;
    }
  });

  const defaultValues = useMemo<FormData>(() => {
    let draft: Partial<FormData> = {};
    try {
      const saved = scopedStorage.getItem(DRAFT_KEY);
      if (saved) {
        draft = JSON.parse(saved) as Partial<FormData>;
      }
    } catch (err) {
      logger.warn('读取草稿失败:', String(err));
    }
    return {
      name: '',
    phone: '',
    wechat: '',
    mushrooms: [],
    quantity: '',
    otherQuantity: '',
    deliveryType: '',
    deliveryAddress: '',
    deliveryTime: '',
    appointmentDate: '',
    remarks: '',
    src: initialSrc ?? draft.src ?? '',
      ...draft,
    };
  }, [initialSrc]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const watchQuantity = form.watch('quantity');
  const watchDeliveryType = form.watch('deliveryType');
  const watchDeliveryTime = form.watch('deliveryTime');

  const showOtherQuantity = watchQuantity === '其他数量';
  const showDeliveryAddress = watchDeliveryType === '官渡区同城配送';
  const showAppointmentDate = watchDeliveryTime === '预约其他日期';

  const isSubmitting = form.formState.isSubmitting;

  // 自动保存草稿
  const allValues = form.watch();

  useEffect(() => {
    if (isSubmitted) return;

    const timer = setTimeout(() => {
      try {
        scopedStorage.setItem(DRAFT_KEY, JSON.stringify(allValues));
      } catch (err) {
        logger.warn('保存草稿失败:', String(err));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [allValues, isSubmitted]);

  const getIdempotencyKey = () => {
    if (idempotencyKeyRef.current) return idempotencyKeyRef.current;

    try {
      const savedKey = scopedStorage.getItem(IDEMPOTENCY_KEY);
      if (savedKey) {
        idempotencyKeyRef.current = savedKey;
        return savedKey;
      }
    } catch (err) {
      logger.warn('读取提交标识失败:', String(err));
    }

    const newKey = globalThis.crypto.randomUUID();
    idempotencyKeyRef.current = newKey;
    try {
      scopedStorage.setItem(IDEMPOTENCY_KEY, newKey);
    } catch (err) {
      logger.warn('保存提交标识失败:', String(err));
    }
    return newKey;
  };

  const onSubmit = async (data: FormData) => {
    // 预约日期：转换为 Unix 时间戳（毫秒），仅当选择了预约其他日期且填写了日期时写入
    let appointmentTimestamp: number | null = null;
    if (data.deliveryTime === '预约其他日期' && data.appointmentDate) {
      const d = new Date(data.appointmentDate);
      d.setHours(12, 0, 0, 0);
      appointmentTimestamp = d.getTime();
    }

    // 构建提交数据
    const payload: Record<string, unknown> = {
      name: data.name,
      phone: data.phone,
      mushrooms: data.mushrooms,
      quantity: data.quantity,
      deliveryType: data.deliveryType,
      deliveryTime: data.deliveryTime,
    };

    if (data.wechat) payload.wechat = data.wechat;
    if (data.otherQuantity) payload.otherQuantity = data.otherQuantity;
    if (data.deliveryAddress) payload.deliveryAddress = data.deliveryAddress;
    if (appointmentTimestamp !== null) payload.appointmentDate = data.appointmentDate;
    if (data.remarks) payload.remarks = data.remarks;
    if (data.src) payload.src = data.src;

    try {
      const resp = await axiosForBackend.post(SUBMIT_API_PATH, payload, {
        timeout: SUBMIT_TIMEOUT_MS,
        headers: { 'Idempotency-Key': getIdempotencyKey() },
      });
      const result = resp.data as {
        success?: boolean;
        recordId?: string;
        error?: string;
        code?: string;
      };

      if (!result.success) {
        throw new Error(result.error || '提交失败');
      }

      logger.info('[订单] 提交成功', { recordId: result.recordId });

      try {
        scopedStorage.removeItem(DRAFT_KEY);
        scopedStorage.setItem(
          SUBMISSION_RECEIPT_KEY,
          JSON.stringify({ recordId: result.recordId ?? null }),
        );
      } catch (storageError) {
        logger.warn('保存提交结果失败:', String(storageError));
      }

      setIsSubmitted(true);
      toast.success('登记已收到', {
        description: '工作人员会通过微信或电话联系您确认品相、价格、配送费用和送达时间。',
        duration: 8_000,
      });
      try {
        onSubmitSuccess?.();
      } catch (callbackError) {
        logger.error('[订单] 成功回调执行失败', {
          error: callbackError instanceof Error ? callbackError.message : String(callbackError),
        });
      }
    } catch (err) {
      const requestError = err as {
        code?: string;
        response?: { status?: number; data?: { error?: string; code?: string } };
      };
      logger.error('[订单] 提交失败', {
        status: requestError.response?.status,
        code: requestError.response?.data?.code ?? requestError.code,
      });
      toast.error(requestError.response?.data?.error || '提交失败，请稍后重试');
      return;
    }
  };

  const handleReset = () => {
    try {
      scopedStorage.removeItem(DRAFT_KEY);
      scopedStorage.removeItem(IDEMPOTENCY_KEY);
      scopedStorage.removeItem(SUBMISSION_RECEIPT_KEY);
    } catch (err) {
      logger.warn('清除草稿失败:', String(err));
    }
    idempotencyKeyRef.current = null;
    form.reset();
    setIsSubmitted(false);
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border border-[#D4D8CD] bg-white p-8 md:p-10 text-center"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#4A5D42]/10">
          <Check className="h-8 w-8 text-[#4A5D42]" />
        </div>
        <h2 className="mt-6 text-2xl font-medium text-[#171611]">登记已收到</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#6B7280] md:text-base">
          {options.successMessage}
        </p>
        <Button
          variant="outline"
          className="mt-8 border-[#D4D8CD] text-[#4A5D42] hover:bg-[#4A5D42]/5 hover:text-[#4A5D42]"
          onClick={handleReset}
        >
          再登记一份
        </Button>
      </motion.div>
    );
  }

  return (
    <Card className="border-[#D4D8CD] bg-white shadow-sm">
      <CardContent className="p-6 md:p-8">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8"
            noValidate
          >
            {/* 第一组：联系信息 */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4A5D42]">
                联系信息
              </h3>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#171611]">
                      姓名 <span className="text-[#C0392B">*</span>
                    </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入姓名"
                          className="border-[#D4D8CD] focus-visible:ring-[#4A5D42]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#171611]">
                      联系电话 <span className="text-[#C0392B]">*</span>
                    </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="请输入11位手机号"
                          className="border-[#D4D8CD] focus-visible:ring-[#4A5D42]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="wechat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#171611]">微信号</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入微信号"
                        className="border-[#D4D8CD] focus-visible:ring-[#4A5D42]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-[#6B7280]">
                      方便工作人员联系并发送当天鲜菌图片。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 分隔线 */}
            <div className="border-t border-[#E8E6DF]" />

            {/* 第二组：选购信息 */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4A5D42]">
                选购信息
              </h3>
              <FormField
                control={form.control}
                name="mushrooms"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-[#171611]">
                      需要的野生菌 <span className="text-[#C0392B]">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {options.mushrooms.map((m) => (
                          <FormField
                            key={m}
                            control={form.control}
                            name="mushrooms"
                            render={({ field }) => {
                              const checked = field.value?.includes(m);
                              return (
                                <FormItem
                                  key={m}
                                  className="flex flex-row items-start space-x-2 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        const next = checked
                                          ? [...current, m]
                                          : current.filter((v) => v !== m);
                                        field.onChange(next);
                                      }}
                                      className="border-[#D4D8CD] data-[state=checked]:bg-[#4A5D42] data-[state=checked]:border-[#4A5D42]"
                                    />
                                  </FormControl>
                                  <FormLabel className="cursor-pointer font-normal text-[#171611]">
                                    {m}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[#171611]">
                      购买数量 <span className="text-[#C0392B]">*</span>
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-2 gap-3 md:grid-cols-4"
                      >
                        {options.quantities.map((q) => (
                          <FormItem key={q} className="relative">
                            <FormControl>
                              <RadioGroupItem
                                value={q}
                                id={`quantity-${q}`}
                                className="peer sr-only"
                              />
                            </FormControl>
                            <FormLabel
                              htmlFor={`quantity-${q}`}
                              className="flex cursor-pointer items-center justify-center rounded-md border border-[#D4D8CD] px-4 py-2.5 text-sm text-[#171611] transition-all peer-data-[state=checked]:border-[#4A5D42] peer-data-[state=checked]:bg-[#4A5D42]/5 peer-data-[state=checked]:font-medium peer-data-[state=checked]:text-[#4A5D42] hover:border-[#6F7F63]"
                            >
                              {q}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AnimatePresence initial={false}>
                {showOtherQuantity && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <FormField
                      control={form.control}
                      name="otherQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#171611]">其他数量</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="请填写具体数量"
                              className="border-[#D4D8CD] focus-visible:ring-[#4A5D42]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-[#6B7280]">
                            选择"其他数量"时填写。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 分隔线 */}
            <div className="border-t border-[#E8E6DF]" />

            {/* 第三组：配送信息 */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4A5D42]">
                配送信息
              </h3>
              <FormField
                control={form.control}
                name="deliveryType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[#171611]">
                      配送方式 <span className="text-[#C0392B]">*</span>
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-1 gap-3 md:grid-cols-3"
                      >
                        {options.deliveryTypes.map((d) => (
                          <FormItem key={d} className="relative">
                            <FormControl>
                              <RadioGroupItem
                                value={d}
                                id={`delivery-${d}`}
                                className="peer sr-only"
                              />
                            </FormControl>
                            <FormLabel
                              htmlFor={`delivery-${d}`}
                              className="flex cursor-pointer items-center justify-center rounded-md border border-[#D4D8CD] px-4 py-3 text-sm text-[#171611] transition-all peer-data-[state=checked]:border-[#4A5D42] peer-data-[state=checked]:bg-[#4A5D42]/5 peer-data-[state=checked]:font-medium peer-data-[state=checked]:text-[#4A5D42] hover:border-[#6F7F63]"
                            >
                              {d}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AnimatePresence initial={false}>
                {showDeliveryAddress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#171611]">
                            官渡区配送地址
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="请填写街道、小区、楼栋和门牌号"
                              rows={3}
                              className="border-[#D4D8CD] focus-visible:ring-[#4A5D42] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-[#6B7280]">
                            选择"官渡区同城配送"时，请填写街道、小区、楼栋和门牌号。当前同城配送范围暂限昆明市官渡区，具体范围和配送费用由工作人员确认。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField
                control={form.control}
                name="deliveryTime"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[#171611]">
                      期望送达时间 <span className="text-[#C0392B]">*</span>
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-3 gap-3"
                      >
                        {options.deliveryTimes.map((t) => (
                          <FormItem key={t} className="relative">
                            <FormControl>
                              <RadioGroupItem
                                value={t}
                                id={`time-${t}`}
                                className="peer sr-only"
                              />
                            </FormControl>
                            <FormLabel
                              htmlFor={`time-${t}`}
                              className="flex cursor-pointer items-center justify-center rounded-md border border-[#D4D8CD] px-4 py-2.5 text-sm text-[#171611] transition-all peer-data-[state=checked]:border-[#4A5D42] peer-data-[state=checked]:bg-[#4A5D42]/5 peer-data-[state=checked]:font-medium peer-data-[state=checked]:text-[#4A5D42] hover:border-[#6F7F63]"
                            >
                              {t}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AnimatePresence initial={false}>
                {showAppointmentDate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <FormField
                      control={form.control}
                      name="appointmentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#171611]">预约日期</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="border-[#D4D8CD] focus-visible:ring-[#4A5D42]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-[#6B7280]">
                            选择"预约其他日期"时填写。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 分隔线 */}
            <div className="border-t border-[#E8E6DF]" />

            {/* 第四组：补充信息 */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#4A5D42]">
              补充信息
            </h3>
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#171611]">其他需求</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="可填写是否需要处理干净、烹饪建议、送礼包装等需求。"
                      rows={3}
                      className="border-[#D4D8CD] focus-visible:ring-[#4A5D42] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-[#6B7280]">
                    可填写是否需要处理干净、烹饪建议、送礼包装等需求。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 渠道来源 - 隐藏但保留功能 */}
            <FormField
              control={form.control}
              name="src"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input type="hidden" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            </div>

            {/* 底部提示 */}
            <div className="rounded-md bg-[#FAF8F3] p-4 text-xs leading-relaxed text-[#6B7280]">
              <div className="mb-2 flex items-center gap-2 font-medium text-[#4A5D42]">
                <Info className="h-4 w-4" />
                <span>温馨提示</span>
              </div>
              <ul className="space-y-1.5 pl-6 list-disc">
                {options.footerTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#4A5D42] hover:bg-[#3A4D32] text-white py-6 text-base font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Leaf className="mr-2 h-4 w-4" />
                  提交登记
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
