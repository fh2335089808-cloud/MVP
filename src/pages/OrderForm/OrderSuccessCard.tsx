import {
  DUPLICATE_ORDER_MESSAGE,
  NEW_ORDER_MESSAGE,
  type OrderSubmitSuccessResponse,
} from '@shared/order-response';

const OFFICIAL_STOREFRONT_URL = 'https://www.kunming-mushroom.asia';
const VERCEL_STOREFRONT_URL = 'https://kunming-mushroom-mvp.vercel.app';

interface OrderSuccessCardProps {
  result: OrderSubmitSuccessResponse;
  returnHref?: string;
  onReset: () => void;
}

export function OrderSuccessCard({
  result,
  returnHref,
  onReset,
}: OrderSuccessCardProps) {
  const duplicate = result?.duplicate === true;
  const message =
    typeof result?.message === 'string' && result.message.trim()
      ? result.message
      : duplicate
        ? DUPLICATE_ORDER_MESSAGE
        : NEW_ORDER_MESSAGE;
  const safeReturnHref =
    returnHref === VERCEL_STOREFRONT_URL
      ? VERCEL_STOREFRONT_URL
      : OFFICIAL_STOREFRONT_URL;

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-[#D4D8CD] bg-white p-8 text-center md:p-10"
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#4A5D42]/10 text-3xl text-[#4A5D42]"
      >
        ✓
      </div>
      <h2 className="mt-6 text-2xl font-medium text-[#171611]">
        {duplicate ? '订单已经登记' : '登记已收到'}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#6B7280] md:text-base">
        {message}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          className="min-h-9 w-full rounded-md border border-[#D4D8CD] px-4 py-2 text-sm font-medium text-[#4A5D42] hover:bg-[#4A5D42]/5 sm:w-auto"
          onClick={onReset}
        >
          再登记一份
        </button>
        <a
          href={safeReturnHref}
          className="inline-flex min-h-9 w-full items-center justify-center rounded-md border border-[#3A4D32] bg-[#4A5D42] px-4 py-2 text-sm font-medium text-white hover:bg-[#3E5038] sm:w-auto"
        >
          返回首页
        </a>
      </div>
    </section>
  );
}