import assert from 'node:assert/strict';
import test from 'node:test';
import { AppStateSchema, warehouseStaffCanProgress } from '../src/domain.js';
import { InventoryError, saveOperation } from '../src/inventory.js';
import { seedState } from '../src/store.js';

function operation(overrides = {}) {
  return {
    id: `TEST-${crypto.randomUUID()}`,
    type: 'receipt',
    status: 'Draft',
    productId: 'p1',
    quantity: 5,
    destinationId: 'l1',
    partner: 'Test Supplier',
    date: '2026-09-26',
    note: '',
    ...overrides,
  };
}

test('seed data satisfies the shared Zod contract', () => {
  assert.equal(AppStateSchema.safeParse(seedState).success, true);
});

test('Zod rejects duplicate SKUs and orphaned balances', () => {
  const state = structuredClone(seedState);
  state.products[1].sku = state.products[0].sku;
  state.balances.push({ productId: 'missing', locationId: 'l1', quantity: 1 });
  const result = AppStateSchema.safeParse(state);
  assert.equal(result.success, false);
  assert.match(result.error.issues.map((item) => item.message).join(' '), /unique|does not exist/i);
});

test('receipt is posted once and creates a movement', () => {
  const before = seedState.balances.find((item) => item.productId === 'p1' && item.locationId === 'l1').quantity;
  const posted = saveOperation(seedState, operation(), true, 'Tester');
  assert.equal(posted.balances.find((item) => item.productId === 'p1' && item.locationId === 'l1').quantity, before + 5);
  assert.equal(posted.operations[0].status, 'Done');
  assert.equal(posted.movements[0].user, 'Tester');
  assert.throws(() => saveOperation(posted, posted.operations[0], true), (error) => error instanceof InventoryError && error.status === 409);
});

test('delivery cannot create negative stock', () => {
  assert.throws(() => saveOperation(seedState, operation({ type: 'delivery', productId: 'p2', quantity: 999, sourceId: 'l2', destinationId: undefined, partner: 'Customer', picked: true, packed: true }), true), /Only 12 units/);
});

test('transfer requires distinct locations', () => {
  assert.throws(() => saveOperation(seedState, operation({ type: 'transfer', sourceId: 'l1', destinationId: 'l1', partner: undefined }), true), /must be different/);
});

test('adjustment permits a physical count of zero', () => {
  const adjusted = saveOperation(seedState, operation({ type: 'adjustment', quantity: 0, sourceId: 'l1', destinationId: undefined, partner: undefined }), true);
  assert.equal(adjusted.balances.find((item) => item.productId === 'p1' && item.locationId === 'l1').quantity, 0);
  assert.equal(adjusted.movements[0].quantity, -77);
});

test('warehouse staff can mark delivery ready only after picked and packed are confirmed', () => {
  assert.equal(warehouseStaffCanProgress('Warehouse Staff', { type: 'delivery', picked: false, packed: false }, 'Ready'), false);
  assert.equal(warehouseStaffCanProgress('Warehouse Staff', { type: 'delivery', picked: true, packed: false }, 'Ready'), false);
  assert.equal(warehouseStaffCanProgress('Warehouse Staff', { type: 'delivery', picked: true, packed: true }, 'Ready'), true);
  assert.equal(warehouseStaffCanProgress('Warehouse Staff', { type: 'delivery', picked: true, packed: true }, 'Done'), false);
  assert.equal(warehouseStaffCanProgress('Inventory Manager', { type: 'delivery', picked: true, packed: true }, 'Done'), true);
});
