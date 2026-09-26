import { AppStateSchema, OperationSchema } from './domain.js';

export class InventoryError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = 'InventoryError';
    this.status = status;
  }
}

function balanceAt(state, productId, locationId) {
  return state.balances.find((item) => item.productId === productId && item.locationId === locationId)?.quantity ?? 0;
}

function applyBalance(balances, productId, locationId, amount, absolute = false) {
  const index = balances.findIndex((item) => item.productId === productId && item.locationId === locationId);
  if (index >= 0) balances[index] = { ...balances[index], quantity: absolute ? amount : balances[index].quantity + amount };
  else balances.push({ productId, locationId, quantity: amount });
}

function requireLocation(state, locationId, label) {
  if (!locationId || !state.locations.some((item) => item.id === locationId)) throw new InventoryError(`${label} location is required and must exist.`);
}

export function saveOperation(currentState, rawOperation, shouldValidate, userName = 'Inventory Manager') {
  const state = structuredClone(AppStateSchema.parse(currentState));
  const operation = OperationSchema.parse(rawOperation);
  if (!state.products.some((item) => item.id === operation.productId)) throw new InventoryError('The selected product does not exist.');

  const existing = state.operations.find((item) => item.id === operation.id);
  if (existing?.status === 'Done') throw new InventoryError(`${operation.id} has already been validated and cannot be posted twice.`, 409);
  if (existing?.status === 'Cancelled') throw new InventoryError(`${operation.id} is cancelled and cannot be changed.`, 409);

  if (!shouldValidate) {
    operation.status = operation.status === 'Done' ? 'Draft' : operation.status;
    state.operations = existing
      ? state.operations.map((item) => item.id === operation.id ? operation : item)
      : [operation, ...state.operations];
    return AppStateSchema.parse(state);
  }

  if (operation.type !== 'adjustment' && operation.quantity <= 0) throw new InventoryError('Quantity must be greater than zero.');
  if (operation.type === 'receipt') {
    requireLocation(state, operation.destinationId, 'Destination');
    if (!operation.partner) throw new InventoryError('Supplier is required for a receipt.');
    applyBalance(state.balances, operation.productId, operation.destinationId, operation.quantity);
  } else if (operation.type === 'delivery') {
    requireLocation(state, operation.sourceId, 'Source');
    if (!operation.partner) throw new InventoryError('Customer is required for a delivery.');
    if (!operation.picked || !operation.packed) throw new InventoryError('Confirm that the items are picked and packed before validation.');
    const available = balanceAt(state, operation.productId, operation.sourceId);
    if (available < operation.quantity) throw new InventoryError(`Only ${available} units are available at the selected source location.`);
    applyBalance(state.balances, operation.productId, operation.sourceId, -operation.quantity);
  } else if (operation.type === 'transfer') {
    requireLocation(state, operation.sourceId, 'Source');
    requireLocation(state, operation.destinationId, 'Destination');
    if (operation.sourceId === operation.destinationId) throw new InventoryError('Source and destination must be different.');
    const available = balanceAt(state, operation.productId, operation.sourceId);
    if (available < operation.quantity) throw new InventoryError(`Only ${available} units are available at the selected source location.`);
    applyBalance(state.balances, operation.productId, operation.sourceId, -operation.quantity);
    applyBalance(state.balances, operation.productId, operation.destinationId, operation.quantity);
  } else {
    requireLocation(state, operation.sourceId, 'Counted');
    const recorded = balanceAt(state, operation.productId, operation.sourceId);
    operation.adjustmentDelta = operation.quantity - recorded;
    applyBalance(state.balances, operation.productId, operation.sourceId, operation.quantity, true);
  }

  operation.status = 'Done';
  state.operations = existing
    ? state.operations.map((item) => item.id === operation.id ? operation : item)
    : [operation, ...state.operations];
  state.movements = [{
    id: `m-${crypto.randomUUID()}`,
    operationId: operation.id,
    type: operation.type,
    productId: operation.productId,
    quantity: operation.type === 'adjustment' ? operation.adjustmentDelta : operation.quantity,
    ...(operation.sourceId ? { fromId: operation.sourceId } : {}),
    ...(operation.destinationId ? { toId: operation.destinationId } : {}),
    date: new Date().toISOString(),
    user: userName,
  }, ...state.movements];
  return AppStateSchema.parse(state);
}
