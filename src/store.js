export const STORAGE_KEY = 'stocksense-v1';

export const seedState = {
  products: [
    { id: 'p1', name: 'Steel Rods', sku: 'STL-1001', category: 'Raw Materials', unit: 'kg', reorderLevel: 40 },
    { id: 'p2', name: 'Ergonomic Chair', sku: 'CHR-2040', category: 'Finished Goods', unit: 'units', reorderLevel: 15 },
    { id: 'p3', name: 'Oak Desk Panel', sku: 'ODP-3200', category: 'Components', unit: 'units', reorderLevel: 20 },
    { id: 'p4', name: 'Packing Carton L', sku: 'PKG-1048', category: 'Packaging', unit: 'units', reorderLevel: 100 },
    { id: 'p5', name: 'Safety Gloves', sku: 'SFT-0082', category: 'Supplies', unit: 'pairs', reorderLevel: 25 },
  ],
  warehouses: [
    { id: 'w1', name: 'Main Warehouse', code: 'MAIN', address: '12 Industrial Avenue', active: true },
    { id: 'w2', name: 'Production Floor', code: 'PROD', address: 'Building B', active: true },
    { id: 'w3', name: 'Distribution Hub', code: 'DIST', address: 'East Logistics Park', active: true },
  ],
  locations: [
    { id: 'l1', warehouseId: 'w1', name: 'Rack A' },
    { id: 'l2', warehouseId: 'w1', name: 'Rack B' },
    { id: 'l3', warehouseId: 'w2', name: 'Production Rack' },
    { id: 'l4', warehouseId: 'w3', name: 'Dispatch Zone' },
  ],
  balances: [
    { productId: 'p1', locationId: 'l1', quantity: 77 },
    { productId: 'p1', locationId: 'l3', quantity: 30 },
    { productId: 'p2', locationId: 'l2', quantity: 12 },
    { productId: 'p3', locationId: 'l2', quantity: 64 },
    { productId: 'p4', locationId: 'l4', quantity: 80 },
    { productId: 'p5', locationId: 'l1', quantity: 0 },
  ],
  operations: [
    { id: 'REC-2401', type: 'receipt', status: 'Done', partner: 'Metro Steel Co.', productId: 'p1', quantity: 100, destinationId: 'l1', date: '2026-09-24', note: 'Monthly raw material delivery' },
    { id: 'TRF-1831', type: 'transfer', status: 'Done', productId: 'p1', quantity: 30, sourceId: 'l1', destinationId: 'l3', date: '2026-09-25', note: 'Production allocation' },
    { id: 'DEL-0934', type: 'delivery', status: 'Ready', partner: 'Northstar Interiors', productId: 'p2', quantity: 8, sourceId: 'l2', date: '2026-09-27', note: 'SO-4392', picked: true, packed: true },
    { id: 'REC-2408', type: 'receipt', status: 'Waiting', partner: 'PackRight Ltd.', productId: 'p4', quantity: 250, destinationId: 'l4', date: '2026-09-28', note: 'PO-8821' },
    { id: 'ADJ-0517', type: 'adjustment', status: 'Draft', productId: 'p5', quantity: 18, sourceId: 'l1', date: '2026-09-26', note: 'Cycle count' },
  ],
  movements: [
    { id: 'm1', operationId: 'REC-2401', type: 'receipt', productId: 'p1', quantity: 100, toId: 'l1', date: '2026-09-24T09:14:00', user: 'Maya Chen' },
    { id: 'm2', operationId: 'TRF-1831', type: 'transfer', productId: 'p1', quantity: 30, fromId: 'l1', toId: 'l3', date: '2026-09-25T14:30:00', user: 'Maya Chen' },
    { id: 'm3', operationId: 'ADJ-0498', type: 'adjustment', productId: 'p1', quantity: -3, fromId: 'l1', date: '2026-09-25T16:42:00', user: 'Arun Patel' },
  ],
  notifications: [
    { id: 'n1', title: 'Safety Gloves are out of stock', body: 'Main Warehouse · Rack A', read: false },
    { id: 'n2', title: 'Packing Carton L is below reorder level', body: '80 units available · threshold 100', read: false },
    { id: 'n3', title: 'Receipt REC-2408 is due tomorrow', body: '250 cartons from PackRight Ltd.', read: true },
  ],
};

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...seedState, ...JSON.parse(saved) } : structuredClone(seedState);
  } catch {
    return structuredClone(seedState);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function productTotal(state, productId) {
  return state.balances.filter((b) => b.productId === productId).reduce((sum, b) => sum + Number(b.quantity), 0);
}

export function balanceAt(state, productId, locationId) {
  return state.balances.find((b) => b.productId === productId && b.locationId === locationId)?.quantity || 0;
}

export function locationLabel(state, locationId) {
  const location = state.locations.find((item) => item.id === locationId);
  if (!location) return '—';
  const warehouse = state.warehouses.find((item) => item.id === location.warehouseId);
  return `${warehouse?.name || 'Warehouse'} · ${location.name}`;
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}
