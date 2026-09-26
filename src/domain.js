import { z } from 'zod';

const id = z.string().trim().min(1).max(80);
const text = z.string().trim().max(500);
const quantity = z.number().finite().nonnegative();

export const ProductSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(80),
  unit: z.enum(['units', 'kg', 'litres', 'metres', 'pairs', 'boxes']),
  reorderLevel: quantity,
});

export const WarehouseSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(24),
  address: z.string().trim().min(1).max(240),
  active: z.boolean(),
});

export const LocationSchema = z.object({
  id,
  warehouseId: id,
  name: z.string().trim().min(1).max(120),
});

export const BalanceSchema = z.object({
  productId: id,
  locationId: id,
  quantity,
});

export const OperationTypeSchema = z.enum(['receipt', 'delivery', 'transfer', 'adjustment']);
export const OperationStatusSchema = z.enum(['Draft', 'Waiting', 'Ready', 'Done', 'Cancelled']);

export const OperationSchema = z.object({
  id,
  type: OperationTypeSchema,
  status: OperationStatusSchema,
  productId: id,
  quantity,
  partner: text.optional(),
  sourceId: id.optional(),
  destinationId: id.optional(),
  date: z.iso.date(),
  note: text.optional(),
  picked: z.boolean().optional(),
  packed: z.boolean().optional(),
  adjustmentDelta: z.number().finite().optional(),
});

export const MovementSchema = z.object({
  id,
  operationId: id,
  type: OperationTypeSchema,
  productId: id,
  quantity: z.number().finite(),
  fromId: id.optional(),
  toId: id.optional(),
  date: z.iso.datetime({ local: true }),
  user: z.string().trim().min(1).max(120),
});

export const NotificationSchema = z.object({
  id,
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().max(300),
  read: z.boolean(),
});

function reportDuplicates(values, key, context, path, label) {
  const seen = new Set();
  values.forEach((value, index) => {
    const normalized = String(value[key]).toLowerCase();
    if (seen.has(normalized)) context.addIssue({ code: 'custom', path: [path, index, key], message: `${label} must be unique.` });
    seen.add(normalized);
  });
}

export const AppStateSchema = z.object({
  products: z.array(ProductSchema).max(10000),
  warehouses: z.array(WarehouseSchema).max(1000),
  locations: z.array(LocationSchema).max(10000),
  balances: z.array(BalanceSchema).max(100000),
  operations: z.array(OperationSchema).max(100000),
  movements: z.array(MovementSchema).max(200000),
  notifications: z.array(NotificationSchema).max(10000),
}).superRefine((state, context) => {
  reportDuplicates(state.products, 'id', context, 'products', 'Product ID');
  reportDuplicates(state.products, 'sku', context, 'products', 'SKU');
  reportDuplicates(state.warehouses, 'id', context, 'warehouses', 'Warehouse ID');
  reportDuplicates(state.warehouses, 'code', context, 'warehouses', 'Warehouse code');
  reportDuplicates(state.locations, 'id', context, 'locations', 'Location ID');
  reportDuplicates(state.operations, 'id', context, 'operations', 'Operation reference');
  reportDuplicates(state.movements, 'id', context, 'movements', 'Movement ID');

  const productIds = new Set(state.products.map((item) => item.id));
  const warehouseIds = new Set(state.warehouses.map((item) => item.id));
  const locationIds = new Set(state.locations.map((item) => item.id));
  state.locations.forEach((item, index) => {
    if (!warehouseIds.has(item.warehouseId)) context.addIssue({ code: 'custom', path: ['locations', index, 'warehouseId'], message: 'Warehouse does not exist.' });
  });
  state.balances.forEach((item, index) => {
    if (!productIds.has(item.productId)) context.addIssue({ code: 'custom', path: ['balances', index, 'productId'], message: 'Product does not exist.' });
    if (!locationIds.has(item.locationId)) context.addIssue({ code: 'custom', path: ['balances', index, 'locationId'], message: 'Location does not exist.' });
  });
  const balanceKeys = new Set();
  state.balances.forEach((item, index) => {
    const key = `${item.productId}:${item.locationId}`;
    if (balanceKeys.has(key)) context.addIssue({ code: 'custom', path: ['balances', index], message: 'Only one balance is allowed per product and location.' });
    balanceKeys.add(key);
  });
  state.operations.forEach((item, index) => {
    if (!productIds.has(item.productId)) context.addIssue({ code: 'custom', path: ['operations', index, 'productId'], message: 'Product does not exist.' });
    if (item.sourceId && !locationIds.has(item.sourceId)) context.addIssue({ code: 'custom', path: ['operations', index, 'sourceId'], message: 'Source location does not exist.' });
    if (item.destinationId && !locationIds.has(item.destinationId)) context.addIssue({ code: 'custom', path: ['operations', index, 'destinationId'], message: 'Destination location does not exist.' });
  });
});

export const LoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(6).max(200),
});

export const OtpRequestSchema = z.object({ email: z.email().max(254) });

export const StateEnvelopeSchema = z.object({
  state: AppStateSchema,
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime({ local: true }),
});

export const StateWriteSchema = z.object({
  state: AppStateSchema,
  expectedRevision: z.number().int().positive(),
});

export const OperationWriteSchema = z.object({
  state: AppStateSchema,
  operation: OperationSchema,
  validate: z.boolean(),
  expectedRevision: z.number().int().positive(),
});

export function zodMessage(error) {
  const first = error?.issues?.[0];
  return first ? `${first.path.join('.') || 'request'}: ${first.message}` : 'The request is invalid.';
}
