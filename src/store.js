import { AppStateSchema } from './domain.js';

export const SEED_STATE = {
  warehouses: [],
  locations: [],
  products: [],
  balances: [],
  operations: [],
  movements: [],
  notifications: [],
};


const STORAGE_KEY = 'stocksense-v1';

/**
 * Loads cached workspace state from localStorage fallback or initial seed.
 */
export function loadLocalState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return SEED_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validated = AppStateSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
    }
  } catch (err) {
    console.warn('Failed to load local state from storage, falling back to seed:', err);
  }
  return SEED_STATE;
}

/**
 * Saves workspace state to localStorage
 */
export function saveLocalState(state) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to persist local state:', err);
  }
}

/**
 * Calculates aggregate stock for a product across all locations
 */
export function calculateTotalStock(productId, balances = []) {
  return balances
    .filter((b) => b.productId === productId)
    .reduce((sum, b) => sum + (b.quantity || 0), 0);
}

/**
 * Calculates stock balance for a product at a specific location
 */
export function getLocationStock(productId, locationId, balances = []) {
  const bal = balances.find((b) => b.productId === productId && b.locationId === locationId);
  return bal ? bal.quantity : 0;
}

/**
 * Finds all products where total stock is at or below reorderLevel
 */
export function getLowStockProducts(products = [], balances = []) {
  return products.filter((p) => {
    const total = calculateTotalStock(p.id, balances);
    return total <= (p.reorderLevel || 0);
  });
}

/**
 * Formats location display name with warehouse code
 */
export function formatLocationName(locationId, locations = [], warehouses = []) {
  const loc = locations.find((l) => l.id === locationId);
  if (!loc) return locationId || 'N/A';
  const wh = warehouses.find((w) => w.id === loc.warehouseId);
  return wh ? `${wh.code} › ${loc.name} (${loc.code})` : `${loc.name} (${loc.code})`;
}

/**
 * Aggregates statistics for dashboard overview
 */
export function computeDashboardStats(state) {
  const products = state.products || [];
  const balances = state.balances || [];
  const operations = state.operations || [];
  const locations = state.locations || [];
  const warehouses = state.warehouses || [];

  const totalStockUnits = balances.reduce((acc, b) => acc + (b.quantity || 0), 0);
  const totalInventoryValue = products.reduce((acc, p) => {
    const qty = calculateTotalStock(p.id, balances);
    return acc + qty * (p.costPrice || 0);
  }, 0);

  const lowStockProducts = getLowStockProducts(products, balances);
  const outOfStockProducts = products.filter((p) => calculateTotalStock(p.id, balances) === 0);

  const pendingOperations = operations.filter((o) => o.status !== 'Done' && o.status !== 'Cancelled');
  const receiptsPending = operations.filter((o) => o.type === 'Receipt' && o.status !== 'Done' && o.status !== 'Cancelled').length;
  const deliveriesPending = operations.filter((o) => o.type === 'Delivery' && o.status !== 'Done' && o.status !== 'Cancelled').length;
  const transfersPending = operations.filter((o) => o.type === 'Internal Transfer' && o.status !== 'Done' && o.status !== 'Cancelled').length;

  return {
    totalStockUnits,
    totalInventoryValue,
    activeProductsCount: products.length,
    warehousesCount: warehouses.length,
    locationsCount: locations.length,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    lowStockProducts,
    outOfStockProducts,
    pendingOperations,
    receiptsPending,
    deliveriesPending,
    transfersPending,
    recentMovements: (state.movements || []).slice(0, 10),
  };
}
