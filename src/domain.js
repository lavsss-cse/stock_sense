import { z } from 'zod';

// Product Schema
export const ProductSchema = z.object({
  id: z.string().min(1).max(64),
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  category: z.string().min(1).max(64),
  unit: z.string().min(1).max(32).default('pcs'),
  reorderLevel: z.number().nonnegative().default(10),
  costPrice: z.number().nonnegative().optional().default(0),
  sellingPrice: z.number().nonnegative().optional().default(0),
  description: z.string().max(500).optional().default(''),
});

// Warehouse Schema
export const WarehouseSchema = z.object({
  id: z.string().min(1).max(64),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  address: z.string().max(256).optional().default(''),
  active: z.boolean().default(true),
});

// Storage Location Schema
export const LocationSchema = z.object({
  id: z.string().min(1).max(64),
  warehouseId: z.string().min(1).max(64),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  type: z.enum(['Rack', 'Bin', 'Shelf', 'Floor', 'Dock', 'Cold Zone', 'Staging']).default('Rack'),
  active: z.boolean().default(true),
});

// Stock Balance Schema (Unique pair: productId, locationId)
export const BalanceSchema = z.object({
  id: z.string().min(1).max(64),
  productId: z.string().min(1).max(64),
  locationId: z.string().min(1).max(64),
  quantity: z.number().nonnegative(),
  updatedAt: z.string().datetime().optional(),
});

// Operation Status and Type Enums
export const OperationTypeEnum = z.enum(['Receipt', 'Delivery', 'Internal Transfer', 'Physical Count']);
export const OperationStatusEnum = z.enum(['Draft', 'Waiting', 'Ready', 'Done', 'Cancelled']);

// Operation Schema
export const OperationSchema = z.object({
  id: z.string().min(1).max(64),
  reference: z.string().min(1).max(64),
  type: OperationTypeEnum,
  status: OperationStatusEnum.default('Draft'),
  productId: z.string().min(1).max(64),
  quantity: z.number().nonnegative(),
  sourceId: z.string().min(1).max(64).nullable().optional(),
  destinationId: z.string().min(1).max(64).nullable().optional(),
  partner: z.string().max(128).nullable().optional().default(''),
  picked: z.boolean().optional().default(false),
  packed: z.boolean().optional().default(false),
  notes: z.string().max(500).optional().default(''),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  actor: z.string().max(64).optional().default('System'),
});

// Immutable Movement Audit Log Schema
export const MovementSchema = z.object({
  id: z.string().min(1).max(64),
  operationId: z.string().min(1).max(64).nullable().optional(),
  productId: z.string().min(1).max(64),
  type: OperationTypeEnum,
  quantity: z.number(), // Signed delta: positive (inflow/gain), negative (outflow/reduction)
  fromId: z.string().min(1).max(64).nullable().optional(),
  toId: z.string().min(1).max(64).nullable().optional(),
  timestamp: z.string().datetime(),
  actor: z.string().max(64).default('System'),
  notes: z.string().max(500).optional().default(''),
});

// Notification Schema
export const NotificationSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(128),
  message: z.string().min(1).max(512),
  type: z.enum(['info', 'warning', 'success', 'error']).default('info'),
  read: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

// App State Schema with strict Invariants
export const AppStateSchema = z.object({
  products: z.array(ProductSchema),
  warehouses: z.array(WarehouseSchema),
  locations: z.array(LocationSchema),
  balances: z.array(BalanceSchema),
  operations: z.array(OperationSchema),
  movements: z.array(MovementSchema),
  notifications: z.array(NotificationSchema),
}).superRefine((data, ctx) => {
  // 1. Unique Product SKUs and IDs
  const productIds = new Set();
  const productSkus = new Set();
  data.products.forEach((p, index) => {
    if (productIds.has(p.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate product ID: ${p.id}`, path: ['products', index, 'id'] });
    }
    productIds.add(p.id);

    const lowerSku = p.sku.toLowerCase().trim();
    if (productSkus.has(lowerSku)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate product SKU: ${p.sku}`, path: ['products', index, 'sku'] });
    }
    productSkus.add(lowerSku);
  });

  // 2. Unique Warehouse Codes and IDs
  const warehouseIds = new Set();
  const warehouseCodes = new Set();
  data.warehouses.forEach((w, index) => {
    if (warehouseIds.has(w.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate warehouse ID: ${w.id}`, path: ['warehouses', index, 'id'] });
    }
    warehouseIds.add(w.id);

    const lowerCode = w.code.toLowerCase().trim();
    if (warehouseCodes.has(lowerCode)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate warehouse code: ${w.code}`, path: ['warehouses', index, 'code'] });
    }
    warehouseCodes.add(lowerCode);
  });

  // 3. Location Invariants
  const locationIds = new Set();
  data.locations.forEach((loc, index) => {
    if (locationIds.has(loc.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate location ID: ${loc.id}`, path: ['locations', index, 'id'] });
    }
    locationIds.add(loc.id);

    if (!warehouseIds.has(loc.warehouseId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Location belongs to non-existent warehouse: ${loc.warehouseId}`, path: ['locations', index, 'warehouseId'] });
    }
  });

  // 4. Balances: unique (productId, locationId) and existence checks
  const balancePairs = new Set();
  data.balances.forEach((bal, index) => {
    const pairKey = `${bal.productId}::${bal.locationId}`;
    if (balancePairs.has(pairKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate balance for product ${bal.productId} at location ${bal.locationId}`, path: ['balances', index] });
    }
    balancePairs.add(pairKey);

    if (!productIds.has(bal.productId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Balance references non-existent product: ${bal.productId}`, path: ['balances', index, 'productId'] });
    }
    if (!locationIds.has(bal.locationId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Balance references non-existent location: ${bal.locationId}`, path: ['balances', index, 'locationId'] });
    }
  });

  // 5. Operations: reference product and location validity
  const operationRefs = new Set();
  data.operations.forEach((op, index) => {
    const refKey = op.reference.toLowerCase().trim();
    if (operationRefs.has(refKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate operation reference: ${op.reference}`, path: ['operations', index, 'reference'] });
    }
    operationRefs.add(refKey);

    if (!productIds.has(op.productId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Operation references non-existent product: ${op.productId}`, path: ['operations', index, 'productId'] });
    }
    if (op.sourceId && !locationIds.has(op.sourceId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Operation source location does not exist: ${op.sourceId}`, path: ['operations', index, 'sourceId'] });
    }
    if (op.destinationId && !locationIds.has(op.destinationId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Operation destination location does not exist: ${op.destinationId}`, path: ['operations', index, 'destinationId'] });
    }
  });
});

// Auth & API Request/Response Schemas
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const SignupSchema = z.object({
  name: z.string().min(1),
  workspace: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export const OtpRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  password: z.string().min(6),
});

export const StatePayloadSchema = z.object({
  state: AppStateSchema,
  expectedRevision: z.number().int().nonnegative().optional(),
});

export const OperationPayloadSchema = z.object({
  state: AppStateSchema,
  operation: OperationSchema,
  validate: z.boolean().default(true),
  expectedRevision: z.number().int().nonnegative().optional(),
});

export const ResetPayloadSchema = z.object({
  expectedRevision: z.number().int().nonnegative().optional(),
});
