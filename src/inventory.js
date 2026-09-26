import { AppStateSchema } from './domain.js';

/**
 * Generates a unique ID with a prefix
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Deep clones any JSON-serializable object
 */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Central Inventory business logic engine.
 * Applies receipts, deliveries, internal transfers, and physical counts atomically.
 *
 * @param {object} currentState - Canonical AppState
 * @param {object} operation - Operation to save or post
 * @param {boolean} shouldValidate - If true, posts inventory changes & completes operation; if false, saves draft.
 * @param {string} actor - Name or email of the user executing the change
 * @returns {object} Validated new AppState
 */
export function saveOperation(currentState, operation, shouldValidate = true, actor = 'System') {
  // 1. Initial schema validation of the starting state
  const validatedCurrent = AppStateSchema.parse(currentState);
  const state = cloneState(validatedCurrent);

  const now = new Date().toISOString();
  const op = { ...operation, updatedAt: now };

  // Check if operation already exists
  const existingIndex = state.operations.findIndex((o) => o.id === op.id);
  const existingOp = existingIndex >= 0 ? state.operations[existingIndex] : null;

  if (existingOp) {
    if (existingOp.status === 'Done' && shouldValidate) {
      const err = new Error(`Operation "${existingOp.reference}" is already completed and cannot be re-posted.`);
      err.statusCode = 409;
      err.code = 'ALREADY_COMPLETED';
      throw err;
    }
    if (existingOp.status === 'Cancelled') {
      const err = new Error(`Operation "${existingOp.reference}" is cancelled and cannot be modified.`);
      err.statusCode = 400;
      err.code = 'OPERATION_CANCELLED';
      throw err;
    }
  }

  // 2. Draft Save Logic (No balance/ledger changes)
  if (!shouldValidate) {
    if (op.status === 'Done') {
      op.status = 'Draft';
    }
    if (!op.status) {
      op.status = 'Draft';
    }

    if (existingIndex >= 0) {
      state.operations[existingIndex] = op;
    } else {
      state.operations.unshift(op);
    }

    return AppStateSchema.parse(state);
  }

  // 3. Validation & Stock Movement Posting Logic
  const product = state.products.find((p) => p.id === op.productId);
  if (!product) {
    throw new Error(`Product not found: ${op.productId}`);
  }

  const helperGetBalance = (productId, locationId) => {
    let bal = state.balances.find((b) => b.productId === productId && b.locationId === locationId);
    if (!bal) {
      bal = {
        id: generateId('bal'),
        productId,
        locationId,
        quantity: 0,
        updatedAt: now,
      };
      state.balances.push(bal);
    }
    return bal;
  };

  const helperCheckLocation = (locationId, label = 'Location') => {
    const loc = state.locations.find((l) => l.id === locationId);
    if (!loc) {
      throw new Error(`${label} does not exist: ${locationId}`);
    }
    return loc;
  };

  let movementRecord = null;

  switch (op.type) {
    case 'Receipt': {
      if (!op.destinationId) {
        throw new Error('Destination location is required for a Receipt.');
      }
      helperCheckLocation(op.destinationId, 'Destination location');
      if (!op.partner || !op.partner.trim()) {
        throw new Error('Supplier / Partner name is required for a Receipt.');
      }
      if (typeof op.quantity !== 'number' || op.quantity <= 0) {
        throw new Error('Receipt quantity must be a positive number greater than 0.');
      }

      const destBalance = helperGetBalance(op.productId, op.destinationId);
      destBalance.quantity = Number((destBalance.quantity + op.quantity).toFixed(4));
      destBalance.updatedAt = now;

      op.status = 'Done';
      op.completedAt = now;
      op.actor = actor;

      movementRecord = {
        id: generateId('mov'),
        operationId: op.id,
        productId: op.productId,
        type: 'Receipt',
        quantity: op.quantity,
        fromId: null,
        toId: op.destinationId,
        timestamp: now,
        actor,
        notes: op.notes?.trim() || `Received from ${op.partner}`,
      };

      state.notifications.unshift({
        id: generateId('notif'),
        title: `Stock Received (${op.reference})`,
        message: `+${op.quantity} ${product.unit} of ${product.name} received into location.`,
        type: 'success',
        read: false,
        createdAt: now,
      });
      break;
    }

    case 'Delivery': {
      if (!op.sourceId) {
        throw new Error('Source location is required for a Delivery.');
      }
      helperCheckLocation(op.sourceId, 'Source location');
      if (!op.partner || !op.partner.trim()) {
        throw new Error('Customer / Partner name is required for a Delivery.');
      }
      if (typeof op.quantity !== 'number' || op.quantity <= 0) {
        throw new Error('Delivery quantity must be a positive number greater than 0.');
      }
      if (!op.picked) {
        throw new Error('Delivery cannot be posted without Picking confirmation.');
      }
      if (!op.packed) {
        throw new Error('Delivery cannot be posted without Packing confirmation.');
      }

      const sourceBalance = helperGetBalance(op.productId, op.sourceId);
      if (sourceBalance.quantity < op.quantity) {
        throw new Error(
          `Insufficient stock at source location. Available: ${sourceBalance.quantity} ${product.unit}, requested: ${op.quantity} ${product.unit}.`
        );
      }

      sourceBalance.quantity = Number((sourceBalance.quantity - op.quantity).toFixed(4));
      sourceBalance.updatedAt = now;

      op.status = 'Done';
      op.completedAt = now;
      op.actor = actor;

      movementRecord = {
        id: generateId('mov'),
        operationId: op.id,
        productId: op.productId,
        type: 'Delivery',
        quantity: -op.quantity,
        fromId: op.sourceId,
        toId: null,
        timestamp: now,
        actor,
        notes: op.notes?.trim() || `Delivered to ${op.partner}`,
      };

      state.notifications.unshift({
        id: generateId('notif'),
        title: `Stock Delivered (${op.reference})`,
        message: `-${op.quantity} ${product.unit} of ${product.name} dispatched to ${op.partner}.`,
        type: 'info',
        read: false,
        createdAt: now,
      });
      break;
    }

    case 'Internal Transfer': {
      if (!op.sourceId) {
        throw new Error('Source location is required for an Internal Transfer.');
      }
      if (!op.destinationId) {
        throw new Error('Destination location is required for an Internal Transfer.');
      }
      if (op.sourceId === op.destinationId) {
        throw new Error('Source and destination locations must be different.');
      }
      helperCheckLocation(op.sourceId, 'Source location');
      helperCheckLocation(op.destinationId, 'Destination location');

      if (typeof op.quantity !== 'number' || op.quantity <= 0) {
        throw new Error('Transfer quantity must be a positive number greater than 0.');
      }

      const sourceBalance = helperGetBalance(op.productId, op.sourceId);
      if (sourceBalance.quantity < op.quantity) {
        throw new Error(
          `Insufficient stock at source location. Available: ${sourceBalance.quantity} ${product.unit}, transfer requested: ${op.quantity} ${product.unit}.`
        );
      }

      const destBalance = helperGetBalance(op.productId, op.destinationId);
      sourceBalance.quantity = Number((sourceBalance.quantity - op.quantity).toFixed(4));
      sourceBalance.updatedAt = now;

      destBalance.quantity = Number((destBalance.quantity + op.quantity).toFixed(4));
      destBalance.updatedAt = now;

      op.status = 'Done';
      op.completedAt = now;
      op.actor = actor;

      movementRecord = {
        id: generateId('mov'),
        operationId: op.id,
        productId: op.productId,
        type: 'Internal Transfer',
        quantity: op.quantity,
        fromId: op.sourceId,
        toId: op.destinationId,
        timestamp: now,
        actor,
        notes: op.notes?.trim() || `Internal relocation of ${op.quantity} ${product.unit}`,
      };

      state.notifications.unshift({
        id: generateId('notif'),
        title: `Internal Transfer (${op.reference})`,
        message: `Relocated ${op.quantity} ${product.unit} of ${product.name}.`,
        type: 'info',
        read: false,
        createdAt: now,
      });
      break;
    }

    case 'Physical Count': {
      const targetLocId = op.destinationId || op.sourceId;
      if (!targetLocId) {
        throw new Error('Location is required for a Physical Count adjustment.');
      }
      helperCheckLocation(targetLocId, 'Count location');

      if (typeof op.quantity !== 'number' || op.quantity < 0) {
        throw new Error('Counted quantity cannot be negative.');
      }

      const currentBal = helperGetBalance(op.productId, targetLocId);
      const recordedQty = currentBal.quantity;
      const adjustmentDelta = Number((op.quantity - recordedQty).toFixed(4));

      currentBal.quantity = op.quantity;
      currentBal.updatedAt = now;

      op.sourceId = targetLocId;
      op.destinationId = targetLocId;
      op.status = 'Done';
      op.completedAt = now;
      op.actor = actor;

      movementRecord = {
        id: generateId('mov'),
        operationId: op.id,
        productId: op.productId,
        type: 'Physical Count',
        quantity: adjustmentDelta,
        fromId: adjustmentDelta < 0 ? targetLocId : null,
        toId: adjustmentDelta > 0 ? targetLocId : null,
        timestamp: now,
        actor,
        notes: op.notes?.trim() || `Stock count adjusted from ${recordedQty} to ${op.quantity} (delta: ${adjustmentDelta >= 0 ? '+' : ''}${adjustmentDelta})`,
      };

      state.notifications.unshift({
        id: generateId('notif'),
        title: `Physical Count Audited (${op.reference})`,
        message: `${product.name} count updated to ${op.quantity} ${product.unit} (delta: ${adjustmentDelta >= 0 ? '+' : ''}${adjustmentDelta}).`,
        type: adjustmentDelta === 0 ? 'info' : adjustmentDelta > 0 ? 'success' : 'warning',
        read: false,
        createdAt: now,
      });
      break;
    }

    default:
      throw new Error(`Unsupported operation type: ${op.type}`);
  }

  // Update operation in array
  if (existingIndex >= 0) {
    state.operations[existingIndex] = op;
  } else {
    state.operations.unshift(op);
  }

  // Prepend immutable movement audit record
  if (movementRecord) {
    state.movements.unshift(movementRecord);
  }

  // Limit notifications array to 50 items to keep state lean
  if (state.notifications.length > 50) {
    state.notifications = state.notifications.slice(0, 50);
  }

  // 4. Final invariant check and return
  return AppStateSchema.parse(state);
}
