import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DUPLICATE_ORDER_MESSAGE,
  NEW_ORDER_MESSAGE,
  createOrderSubmitSuccessResponse,
  getOrderSubmitErrorMessage,
  normalizeOrderSubmitSuccessResponse,
} from '../shared/order-response.js';

test('new record creation returns the normalized success contract', () => {
  const response = createOrderSubmitSuccessResponse('rec_new', false);
  assert.deepEqual(response, {
    success: true,
    duplicate: false,
    recordId: 'rec_new',
    message: NEW_ORDER_MESSAGE,
  });
  assert.deepEqual(normalizeOrderSubmitSuccessResponse(response), response);
});

test('duplicate record returns success without changing the record id', () => {
  const response = createOrderSubmitSuccessResponse('rec_existing', true);
  assert.deepEqual(response, {
    success: true,
    duplicate: true,
    recordId: 'rec_existing',
    message: DUPLICATE_ORDER_MESSAGE,
  });
  assert.deepEqual(normalizeOrderSubmitSuccessResponse(response), response);
});

test('API failure preserves its safe user-facing error', () => {
  assert.equal(
    getOrderSubmitErrorMessage(
      { success: false, error: '订单暂时无法提交', code: 'ORDER_UPSTREAM_ERROR' },
      'fallback',
    ),
    '订单暂时无法提交',
  );
  assert.equal(normalizeOrderSubmitSuccessResponse({ success: false }), null);
});

test('missing response fields never throw or become a false success', () => {
  assert.doesNotThrow(() => normalizeOrderSubmitSuccessResponse(undefined));
  assert.deepEqual(
    normalizeOrderSubmitSuccessResponse({ success: true, duplicate: false }),
    { success: true, duplicate: false, recordId: '', message: NEW_ORDER_MESSAGE },
  );
  assert.deepEqual(
    normalizeOrderSubmitSuccessResponse({ success: true, recordId: 'rec_missing_duplicate' }),
    {
      success: true,
      duplicate: false,
      recordId: 'rec_missing_duplicate',
      message: NEW_ORDER_MESSAGE,
    },
  );
});