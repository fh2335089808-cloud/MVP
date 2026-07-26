export const NEW_ORDER_MESSAGE = '登记已收到，工作人员会尽快联系您确认。';
export const DUPLICATE_ORDER_MESSAGE = '订单已经登记，无需再次提交。';

export interface OrderSubmitSuccessResponse {
  success: true;
  duplicate: boolean;
  recordId: string;
  message: string;
}

export function createOrderSubmitSuccessResponse(
  recordId: string,
  duplicate: boolean,
): OrderSubmitSuccessResponse {
  return {
    success: true,
    duplicate,
    recordId,
    message: duplicate ? DUPLICATE_ORDER_MESSAGE : NEW_ORDER_MESSAGE,
  };
}

export function normalizeOrderSubmitSuccessResponse(
  value: unknown,
): OrderSubmitSuccessResponse | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (candidate.success !== true) return null;

  const duplicate = candidate.duplicate === true;
  const fallbackMessage = duplicate
    ? DUPLICATE_ORDER_MESSAGE
    : NEW_ORDER_MESSAGE;

  return {
    success: true,
    duplicate,
    recordId:
      typeof candidate.recordId === 'string'
        ? candidate.recordId.trim()
        : '',
    message:
      typeof candidate.message === 'string' && candidate.message.trim()
        ? candidate.message
        : fallbackMessage,
  };
}

export function getOrderSubmitErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.error === 'string' && candidate.error.trim()
    ? candidate.error
    : fallback;
}