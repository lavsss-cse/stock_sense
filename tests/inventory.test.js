import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_STATE, calculateTotalStock, getLocationStock } from '../src/store.js';
import { AppStateSchema } from '../src/domain.js';
import { saveOperation, cloneState } from '../src/inventory.js';

test('1. Seed state strictly satisfies AppStateSchema contract', () => {
  const result = AppStateSchema.safeParse(SEED_STATE);
  assert.equal(result.success, true, 'Seed state must conform to schema');
});

test('2. Schema rejects duplicate Product SKUs', () => {
  const badState = cloneState(SEED_STATE);
  badState.products.push({
    id: 'prod-dup',
    sku: SEED_STATE.products[0].sku, // Duplicate SKU
    name: 'Duplicate SKU Product',
    category: 'Displays',
    unit: 'pcs',
    reorderLevel: 10,
    costPrice: 5,
    sellingPrice: 10,
    description: '',
  });

  const result = AppStateSchema.safeParse(badState);
  assert.equal(result.success, false, 'Duplicate SKU should be rejected');
});

test('3. Schema rejects balances with non-existent location or product', () => {
  const badState = cloneState(SEED_STATE);
  badState.balances.push({
    id: 'bal-orphan',
    productId: 'non-existent-product-id',
    locationId: SEED_STATE.locations[0].id,
    quantity: 10,
  });

  const result = AppStateSchema.safeParse(badState);
  assert.equal(result.success, false, 'Orphaned balance must be rejected');
});

test('4. Receipt increases destination balance, sets Done, and appends Movement', () => {
  const state = cloneState(SEED_STATE);
  const initialStock = getLocationStock('prod-stm32', 'loc-wh-main-b1', state.balances);

  const receiptOp = {
    id: 'op-test-rcpt-1',
    reference: 'TEST-RCPT-001',
    type: 'Receipt',
    status: 'Draft',
    productId: 'prod-stm32',
    quantity: 25,
    sourceId: null,
    destinationId: 'loc-wh-main-b1',
    partner: 'Direct Semiconductor Foundry',
    picked: false,
    packed: false,
    notes: 'Test incoming receipt',
    createdAt: new Date().toISOString(),
  };

  const nextState = saveOperation(state, receiptOp, true, 'Test Specialist');
  const newStock = getLocationStock('prod-stm32', 'loc-wh-main-b1', nextState.balances);

  assert.equal(newStock, initialStock + 25, 'Balance must increase by 25');

  const postedOp = nextState.operations.find((o) => o.id === receiptOp.id);
  assert.equal(postedOp.status, 'Done', 'Operation status should be Done');

  const mov = nextState.movements[0];
  assert.equal(mov.operationId, receiptOp.id);
  assert.equal(mov.quantity, 25);
  assert.equal(mov.toId, 'loc-wh-main-b1');
  assert.equal(mov.actor, 'Test Specialist');
});

test('5. Re-posting an already completed operation throws Conflict (409)', () => {
  const state = cloneState(SEED_STATE);
  const doneOp = state.operations.find((o) => o.status === 'Done');
  assert.ok(doneOp, 'Done operation should exist in seed state');

  assert.throws(
    () => {
      saveOperation(state, doneOp, true, 'Test User');
    },
    (err) => err.statusCode === 409 || err.code === 'ALREADY_COMPLETED'
  );
});

test('6. Delivery rejects insufficient stock with clear error', () => {
  const state = cloneState(SEED_STATE);
  const currentStock = getLocationStock('prod-oled-096', 'loc-wh-main-a1', state.balances);

  const excessiveDelivery = {
    id: 'op-test-delv-fail',
    reference: 'TEST-DELV-001',
    type: 'Delivery',
    status: 'Draft',
    productId: 'prod-oled-096',
    quantity: currentStock + 500, // Exceeds stock
    sourceId: 'loc-wh-main-a1',
    destinationId: null,
    partner: 'Test Client',
    picked: true,
    packed: true,
    createdAt: new Date().toISOString(),
  };

  assert.throws(
    () => {
      saveOperation(state, excessiveDelivery, true, 'Test Operator');
    },
    /Insufficient stock/
  );
});

test('7. Delivery requires both picked and packed flags', () => {
  const state = cloneState(SEED_STATE);
  const unpickedDelivery = {
    id: 'op-test-delv-flags',
    reference: 'TEST-DELV-002',
    type: 'Delivery',
    status: 'Draft',
    productId: 'prod-stm32',
    quantity: 1,
    sourceId: 'loc-wh-main-b1',
    destinationId: null,
    partner: 'Test Client',
    picked: false,
    packed: false,
    createdAt: new Date().toISOString(),
  };

  assert.throws(
    () => {
      saveOperation(state, unpickedDelivery, true, 'Test Operator');
    },
    /Picking confirmation/
  );
});

test('8. Internal Transfer moves stock from source to destination', () => {
  const state = cloneState(SEED_STATE);
  const srcLoc = 'loc-wh-main-b1';
  const destLoc = 'loc-wh-main-a1';
  const srcInitial = getLocationStock('prod-stm32', srcLoc, state.balances);
  const destInitial = getLocationStock('prod-stm32', destLoc, state.balances);

  const transferOp = {
    id: 'op-test-xfer-1',
    reference: 'TEST-XFER-001',
    type: 'Internal Transfer',
    status: 'Ready',
    productId: 'prod-stm32',
    quantity: 15,
    sourceId: srcLoc,
    destinationId: destLoc,
    picked: true,
    packed: false,
    createdAt: new Date().toISOString(),
  };

  const nextState = saveOperation(state, transferOp, true, 'Warehouse Runner');
  const srcAfter = getLocationStock('prod-stm32', srcLoc, nextState.balances);
  const destAfter = getLocationStock('prod-stm32', destLoc, nextState.balances);

  assert.equal(srcAfter, srcInitial - 15);
  assert.equal(destAfter, destInitial + 15);
  assert.equal(calculateTotalStock('prod-stm32', nextState.balances), calculateTotalStock('prod-stm32', state.balances));
});

test('9. Internal Transfer rejects identical source and destination', () => {
  const state = cloneState(SEED_STATE);
  const sameLocTransfer = {
    id: 'op-test-xfer-same',
    reference: 'TEST-XFER-SAME',
    type: 'Internal Transfer',
    status: 'Ready',
    productId: 'prod-stm32',
    quantity: 5,
    sourceId: 'loc-wh-main-b1',
    destinationId: 'loc-wh-main-b1',
    createdAt: new Date().toISOString(),
  };

  assert.throws(
    () => {
      saveOperation(state, sameLocTransfer, true, 'Test Runner');
    },
    /must be different/
  );
});

test('10. Physical Count adjustment updates stock to exact count and logs signed delta', () => {
  const state = cloneState(SEED_STATE);
  const loc = 'loc-wh-main-b1';
  const recorded = getLocationStock('prod-stm32', loc, state.balances);
  const auditedCount = 210; // delta = +30

  const countOp = {
    id: 'op-test-audit-1',
    reference: 'TEST-AUDIT-001',
    type: 'Physical Count',
    status: 'Draft',
    productId: 'prod-stm32',
    quantity: auditedCount,
    sourceId: loc,
    destinationId: loc,
    notes: 'Annual cyclic stock audit',
    createdAt: new Date().toISOString(),
  };

  const nextState = saveOperation(state, countOp, true, 'Lead Auditor');
  const actualAfter = getLocationStock('prod-stm32', loc, nextState.balances);

  assert.equal(actualAfter, auditedCount);
  const mov = nextState.movements[0];
  assert.equal(mov.type, 'Physical Count');
  assert.equal(mov.quantity, auditedCount - recorded);
});
