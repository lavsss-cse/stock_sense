import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Sparkles, ShieldCheck, Radio, Layers, Moon, Sun, Eye, EyeOff,
  ArrowRight, Package, LayoutDashboard, Boxes, ArrowLeftRight, History,
  Building2, Settings, Plus, Search, CheckCircle2, AlertTriangle,
  TrendingDown, TrendingUp, X, RefreshCw, FileDown, Info, LogOut,
  MapPin, Clock, Menu, ClipboardList, User, Bell, ChevronRight,
} from 'lucide-react';
import { api, getStoredUser, clearStoredSession } from './api.js';
import {
  SEED_STATE, loadLocalState, saveLocalState,
  calculateTotalStock, getLocationStock, getLowStockProducts,
  formatLocationName, computeDashboardStats,
} from './store.js';
import { generateId } from './inventory.js';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('stocksense-theme') || 'light');
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [authMode, setAuthMode] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupWorkspace, setSignupWorkspace] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  const [state, setState] = useState(() => SEED_STATE);
  const [revision, setRevision] = useState(1);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [operationModal, setOperationModal] = useState({ open: false, operation: null, defaultType: 'Receipt' });
  const [operationDetailModal, setOperationDetailModal] = useState(null);
  const [warehouseModal, setWarehouseModal] = useState({ open: false, warehouse: null });
  const [locationModal, setLocationModal] = useState({ open: false, location: null });
  const [resetConfirmModal, setResetConfirmModal] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const [productStockFilter, setProductStockFilter] = useState('All');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryWarehouseFilter, setInventoryWarehouseFilter] = useState('All');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('All');
  const [operationTypeFilter, setOperationTypeFilter] = useState('All');
  const [operationStatusFilter, setOperationStatusFilter] = useState('All');
  const [operationWarehouseFilter, setOperationWarehouseFilter] = useState('All');
  const [operationSearch, setOperationSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('All');
  const [movementWarehouseFilter, setMovementWarehouseFilter] = useState('All');
  const [movementSortOrder, setMovementSortOrder] = useState('newest');

  const saveTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stocksense-theme', theme);
  }, [theme]);

  const addToast = useCallback((message, type = 'info') => {
    const id = generateId('toast');
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  useEffect(() => {
    const handleKeyDown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowCommandPalette(p => !p); }
      if (e.key === 'Escape') { setShowCommandPalette(false); setNotifOpen(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchStateFromServer = useCallback(async () => {
    if (!currentUser) return;
    try {
      setSyncStatus('syncing');
      const data = await api.getState();
      setState(data.state); setRevision(data.revision);
      saveLocalState(data.state); setSyncStatus('synced');
    } catch (err) {
      if (err.status === 401) { clearStoredSession(); setCurrentUser(null); addToast('Session expired.', 'warning'); }
      else { setSyncStatus('offline'); }
    }
  }, [currentUser, addToast]);

  useEffect(() => { if (currentUser) fetchStateFromServer(); }, [currentUser, fetchStateFromServer]);

  useEffect(() => {
    if (!currentUser) return;
    const isWarehouse = currentUser.role === 'Warehouse Operator';
    const workspacePath = isWarehouse ? '/warehouse' : '/inventory';
    if (window.location.pathname !== workspacePath) window.history.replaceState({}, '', workspacePath);
    setActiveTab(isWarehouse ? 'inventory' : 'dashboard');
  }, [currentUser]);

  const openWorkspace = user => {
    const isWarehouse = user.role === 'Warehouse Operator';
    window.history.replaceState({}, '', isWarehouse ? '/warehouse' : '/inventory');
    setActiveTab(isWarehouse ? 'inventory' : 'dashboard');
  };

  const syncStateEdit = useCallback(newState => {
    setState(newState); saveLocalState(newState); setSyncStatus('syncing');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.putState(newState, revision);
        setRevision(res.revision); setSyncStatus('synced');
      } catch (err) {
        if (err.status === 409) { setSyncStatus('conflict'); fetchStateFromServer(); }
        else { setSyncStatus('offline'); }
      }
    }, 400);
  }, [revision, fetchStateFromServer]);

  const handleLogin = async e => {
    if (e) e.preventDefault();
    setAuthError(''); setIsAuthLoading(true);
    try {
      const res = await api.login(loginEmail, loginPassword);
      openWorkspace(res.user); setCurrentUser(res.user); addToast(`Welcome back, ${res.user.name}!`, 'success');
    } catch (err) { setAuthError(err.message || 'Login failed. Check your credentials.'); }
    finally { setIsAuthLoading(false); }
  };

  const handleQuickLogin = async (email, password = 'demo1234') => {
    setAuthError(''); setIsAuthLoading(true);
    try {
      const res = await api.login(email, password);
      openWorkspace(res.user); setCurrentUser(res.user);
    } catch (err) { setAuthError(err.message || 'Quick login failed.'); }
    finally { setIsAuthLoading(false); }
  };

  const handlePasswordReset = async e => {
    e.preventDefault(); setAuthError(''); setResetStatus(''); setIsAuthLoading(true);
    try {
      await api.resetPassword(resetEmail, resetCode, resetPassword);
      setLoginEmail(resetEmail); setLoginPassword(''); setResetOpen(false);
      setResetStatus('Password updated. Sign in with your new password.');
    } catch (err) { setAuthError(err.message || 'Password reset failed.'); }
    finally { setIsAuthLoading(false); }
  };

  const handleSignup = async e => {
    if (e) e.preventDefault();
    setAuthError(''); setIsAuthLoading(true);
    try {
      const res = await api.signup(signupName, signupWorkspace, signupEmail, signupPassword);
      setCurrentUser(res.user); addToast(`Welcome, ${res.user.name}! Start by creating a warehouse.`, 'success');
    } catch (err) { setAuthError(err.message || 'Registration failed.'); }
    finally { setIsAuthLoading(false); }
  };

  const handleLogout = async () => {
    await api.logout(); setCurrentUser(null); setState(SEED_STATE); setRevision(1);
    addToast('Signed out.', 'info');
  };

  const handleSaveOperation = async (operationData, validate = true) => {
    if (currentUser?.role === 'Warehouse Operator' && operationData.type === 'Receipt') {
      addToast('Only Inventory Managers can receive supplier stock.', 'warning');
      return;
    }
    try {
      setSyncStatus('syncing');
      const res = await api.postOperation(state, operationData, validate, revision);
      setState(res.state); setRevision(res.revision); saveLocalState(res.state); setSyncStatus('synced');
      addToast(validate ? `${operationData.reference} posted to ledger.` : `Draft ${operationData.reference} saved.`, validate ? 'success' : 'info');
      setOperationModal({ open: false, operation: null });
    } catch (err) {
      if (err.status === 409) { setSyncStatus('conflict'); fetchStateFromServer(); }
      addToast(err.message || 'Operation failed.', 'error');
    }
  };

  const handleResetWorkspace = async () => {
    try {
      setSyncStatus('syncing');
      const res = await api.reset(revision);
      setState(res.state); setRevision(res.revision); saveLocalState(res.state);
      setSyncStatus('synced'); setResetConfirmModal(false);
      addToast('Workspace cleared.', 'success');
    } catch (err) { addToast(err.message || 'Reset failed.', 'error'); }
  };

  const stats = useMemo(() => computeDashboardStats(state), [state]);
  const unreadCount = useMemo(() => (state.notifications || []).filter(n => !n.read).length, [state.notifications]);

  const markNotifRead = useCallback(id => {
    const next = (state.notifications || []).map(n => n.id === id ? { ...n, read: true } : n);
    syncStateEdit({ ...state, notifications: next });
  }, [state, syncStateEdit]);

  const categories = useMemo(() => {
    const s = new Set((state.products || []).map(p => p.category));
    return ['All', ...Array.from(s)];
  }, [state.products]);

  const filteredProducts = useMemo(() => (state.products || []).filter(p => {
    const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase());
    const total = calculateTotalStock(p.id, state.balances);
    let matchStock = true;
    if (productStockFilter === 'In Stock') matchStock = total > (p.reorderLevel || 0);
    else if (productStockFilter === 'Low Stock') matchStock = total > 0 && total <= (p.reorderLevel || 0);
    else if (productStockFilter === 'Out of Stock') matchStock = total === 0;
    return matchSearch && matchStock && (productCategoryFilter === 'All' || p.category === productCategoryFilter);
  }), [state.products, state.balances, productSearch, productStockFilter, productCategoryFilter]);

  const inventoryRows = useMemo(() => {
    const rows = [];
    (state.balances || []).forEach(bal => {
      const product = state.products.find(p => p.id === bal.productId);
      const location = state.locations.find(l => l.id === bal.locationId);
      const warehouse = location ? state.warehouses.find(w => w.id === location.warehouseId) : null;
      if (product && location) rows.push({ bal, product, location, warehouse });
    });
    return rows;
  }, [state.balances, state.products, state.locations, state.warehouses]);

  const filteredInventory = useMemo(() => inventoryRows.filter(({ product, location, warehouse }) => {
    const q = inventorySearch.toLowerCase();
    const matchSearch = !q || product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q) || product.category.toLowerCase().includes(q) || location.name.toLowerCase().includes(q) || location.code.toLowerCase().includes(q);
    const matchWh = inventoryWarehouseFilter === 'All' || (warehouse && warehouse.id === inventoryWarehouseFilter);
    return matchSearch && matchWh && (inventoryCategoryFilter === 'All' || product.category === inventoryCategoryFilter);
  }), [inventoryRows, inventorySearch, inventoryWarehouseFilter, inventoryCategoryFilter]);

  const filteredOperations = useMemo(() => (state.operations || []).filter(op => {
    const product = state.products.find(p => p.id === op.productId);
    const source = op.sourceId ? state.locations.find(l => l.id === op.sourceId) : null;
    const destination = op.destinationId ? state.locations.find(l => l.id === op.destinationId) : null;
    const sourceWarehouse = source ? state.warehouses.find(w => w.id === source.warehouseId) : null;
    const destinationWarehouse = destination ? state.warehouses.find(w => w.id === destination.warehouseId) : null;
    const q = operationSearch.toLowerCase();
    const matchSearch = op.reference.toLowerCase().includes(q) || (op.partner && op.partner.toLowerCase().includes(q)) || (product && (product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q))) || (source && `${source.name} ${source.code}`.toLowerCase().includes(q)) || (destination && `${destination.name} ${destination.code}`.toLowerCase().includes(q));
    const matchWarehouse = operationWarehouseFilter === 'All' || sourceWarehouse?.id === operationWarehouseFilter || destinationWarehouse?.id === operationWarehouseFilter;
    return matchSearch && matchWarehouse && (operationTypeFilter === 'All' || op.type === operationTypeFilter) && (operationStatusFilter === 'All' || op.status === operationStatusFilter);
  }), [state.operations, state.products, state.locations, state.warehouses, operationSearch, operationTypeFilter, operationStatusFilter, operationWarehouseFilter]);

  const filteredMovements = useMemo(() => {
    let movs = (state.movements || []).filter(mov => {
      const product = state.products.find(p => p.id === mov.productId);
      const fromLoc = mov.fromId ? state.locations.find(l => l.id === mov.fromId) : null;
      const toLoc = mov.toId ? state.locations.find(l => l.id === mov.toId) : null;
      const fromWh = fromLoc ? state.warehouses.find(w => w.id === fromLoc.warehouseId) : null;
      const toWh = toLoc ? state.warehouses.find(w => w.id === toLoc.warehouseId) : null;
      const q = movementSearch.toLowerCase();
      const matchSearch = !q || (product && (product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q))) || (mov.actor && mov.actor.toLowerCase().includes(q)) || (mov.notes && mov.notes.toLowerCase().includes(q));
      const matchWh = movementWarehouseFilter === 'All' || (fromWh && fromWh.id === movementWarehouseFilter) || (toWh && toWh.id === movementWarehouseFilter);
      return matchSearch && (movementTypeFilter === 'All' || mov.type === movementTypeFilter) && matchWh;
    });
    return movementSortOrder === 'oldest' ? [...movs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) : [...movs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [state.movements, state.products, state.locations, state.warehouses, movementSearch, movementTypeFilter, movementWarehouseFilter, movementSortOrder]);

  const commandResults = useMemo(() => {
    if (!commandQuery.trim()) return [];
    const q = commandQuery.toLowerCase();
    const results = [];
    (state.products || []).forEach(p => { if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) results.push({ label: p.name, sub: p.sku, action: () => { setActiveTab('products'); setShowCommandPalette(false); } }); });
    (state.warehouses || []).forEach(w => { if (w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q)) results.push({ label: w.name, sub: w.code, action: () => { setActiveTab('warehouses'); setShowCommandPalette(false); } }); });
    return results.slice(0, 8);
  }, [commandQuery, state.products, state.warehouses]);

  const exportProductsCSV = () => {
    const rows = state.products.map(p => {
      const stock = calculateTotalStock(p.id, state.balances);
      const status = stock === 0 ? 'Out of Stock' : stock <= (p.reorderLevel || 0) ? 'Low Stock' : 'Healthy';
      return [`"${p.sku}"`, `"${p.name}"`, `"${p.category}"`, `"${p.unit}"`, p.reorderLevel || 0, stock, status];
    });
    const csv = 'data:text/csv;charset=utf-8,' + [['SKU', 'Name', 'Category', 'Unit', 'Reorder', 'Stock', 'Status'].join(','), ...rows.map(r => r.join(','))].join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv); a.download = `StockSense_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    addToast('CSV exported.', 'success');
  };

  // ── AUTH SCREENS ──────────────────────────────────────────
  if (!currentUser) {
    return (
      <main className="next-login">
        <section className="login-panel">
          <span className="login-aurora login-aurora-one" />
          <span className="login-aurora login-aurora-two" />
          <div className="brand-lockup is-inverse">
            <span className="brand-symbol"><Package size={24} /></span>
            <span className="brand-copy"><strong>StockSense</strong><small>Inventory &amp; Business OS</small></span>
          </div>
          <div className="login-copy">
            <small><Sparkles size={12} /> THE BUSINESS OS FOR INVENTORY &amp; LOGISTICS</small>
            <h1>Master the flow<br /><em>behind every SKU.</em></h1>
            <p>Multi-location stock balances, receipts, transfers, and immutable audit trails in one focused workspace.</p>
            <div className="login-proof">
              <span><ShieldCheck size={16} /><b>Secure auth</b><small>scrypt password hashing</small></span>
              <span><Radio size={16} /><b>Live data</b><small>SQLite-backed API</small></span>
              <span><Layers size={16} /><b>One system</b><small>Receipts through audits</small></span>
            </div>
          </div>
          <div className="login-foot">
            <span className="login-live"><i></i> System online</span>
            <span>Audit-ready · SQLite powered</span>
          </div>
        </section>

        <section className="login-form">
          <button className="floating-theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <div className="login-form-inner">
            <div className="login-heading">
              <small>{authMode === 'login' ? 'SECURE SIGN IN' : 'CREATE ACCOUNT'}</small>
              <h2>{authMode === 'login' ? 'Welcome back.' : 'Get started.'}</h2>
              <p>{authMode === 'login' ? 'Continue to your StockSense workspace.' : 'Create your account and workspace.'}</p>
            </div>

            {authError && (
              <div role="alert" style={{ background:'var(--surface)', border:'1px solid #edc8bd', color:'#9e4739', padding:'10px 14px', borderRadius:'10px', fontSize:'11px', marginBottom:'16px', display:'flex', gap:'8px', alignItems:'center' }}>
                <AlertTriangle size={16} /><span>{authError}</span>
              </div>
            )}
            {resetStatus && <div role="status" style={{ background:'var(--surface-soft)', border:'1px solid var(--line)', color:'var(--green)', padding:'10px 14px', borderRadius:'10px', fontSize:'11px', marginBottom:'16px' }}>{resetStatus}</div>}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} noValidate>
                <label htmlFor="l-email">Email address<input id="l-email" type="email" autoComplete="username" placeholder="you@example.com" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></label>
                <label htmlFor="l-pass">Password
                  <span className="password-control">
                    <input id="l-pass" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </span>
                </label>
                <button className="login-submit" type="submit" disabled={isAuthLoading}>{isAuthLoading ? 'Authenticating…' : 'Sign in securely'}<ArrowRight size={16} /></button>
              </form>
            ) : (
              <form onSubmit={handleSignup} noValidate>
                <label htmlFor="s-name">Full Name<input id="s-name" type="text" autoComplete="name" placeholder="Your full name" required value={signupName} onChange={e => setSignupName(e.target.value)} /></label>
                <label htmlFor="s-workspace">Organisation / Workspace Name<input id="s-workspace" type="text" autoComplete="organization" placeholder="e.g. Acme Logistics Ltd" required value={signupWorkspace} onChange={e => setSignupWorkspace(e.target.value)} /></label>
                <label htmlFor="s-email">Email address<input id="s-email" type="email" autoComplete="username" placeholder="you@example.com" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} /></label>
                <label htmlFor="s-pass">Password (min 6 characters)
                  <span className="password-control">
                    <input id="s-pass" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a strong password" required minLength={6} value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </span>
                </label>
                <button className="login-submit" type="submit" disabled={isAuthLoading}>{isAuthLoading ? 'Creating account…' : 'Create account'}<ArrowRight size={16} /></button>
              </form>
            )}

            {authMode === 'login' && (
              <div style={{ marginTop:'14px' }} aria-label="Quick demo access">
                <button className="login-submit" type="button" disabled={isAuthLoading} onClick={() => handleQuickLogin('inventory@stocksense.demo')}>
                  Quick access: Inventory<ArrowRight size={16} />
                </button>
                <button className="login-submit" type="button" disabled={isAuthLoading} onClick={() => handleQuickLogin('warehouse@stocksense.demo')} style={{ marginTop:'8px' }}>
                  Quick access: Warehouse<ArrowRight size={16} />
                </button>
              </div>
            )}

            <div style={{ marginTop:'18px', textAlign:'center' }}>
              <button type="button" style={{ background:'none', border:'none', color:'var(--green)', fontSize:'11px', cursor:'pointer', textDecoration:'underline' }} onClick={() => { setAuthMode(m => m === 'login' ? 'signup' : 'login'); setAuthError(''); }}>
                {authMode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
              </button>
            </div>
            {authMode === 'login' && (
              <div style={{ marginTop:'14px', padding:'10px 14px', background:'var(--surface-soft)', borderRadius:'10px', fontSize:'10px', color:'var(--muted)', lineHeight:'1.6' }}>
                {!resetOpen ? <><strong style={{ display:'block', marginBottom:'4px', color:'var(--ink)' }}>Password reset</strong><button type="button" style={{ background:'none', border:'none', padding:0, color:'var(--green)', fontSize:'10px', cursor:'pointer', textDecoration:'underline' }} onClick={()=>{ setResetOpen(true); setResetEmail(loginEmail); setResetStatus(''); }}>Reset your password</button></> : (
                  <form onSubmit={handlePasswordReset} noValidate>
                    <strong style={{ display:'block', marginBottom:'6px', color:'var(--ink)' }}>Reset password</strong>
                    <label>Email address<input type="email" required value={resetEmail} onChange={e=>setResetEmail(e.target.value)} /></label>
                    <label>Reset code<input inputMode="numeric" required maxLength={6} value={resetCode} onChange={e=>setResetCode(e.target.value)} /></label>
                    <label>New password<input type="password" required minLength={6} value={resetPassword} onChange={e=>setResetPassword(e.target.value)} /></label>
                    <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}><button className="soft-button" type="button" onClick={()=>setResetOpen(false)}>Cancel</button><button className="soft-button" type="submit" disabled={isAuthLoading}>Update password</button></div>
                    <small style={{ display:'block', marginTop:'7px' }}>Demo reset code: 482913</small>
                  </form>
                )}
              </div>
            )}
            <p className="login-privacy"><ShieldCheck size={13} /><span>Protected session · Passwords hashed with scrypt · Encrypted in transit</span></p>
          </div>
        </section>
      </main>
    );
  }

  // ── WORKSPACE SHELL ───────────────────────────────────────
  const workspaceName = currentUser.workspace || 'My Workspace';
  const isWarehouseWorkspace = currentUser.role === 'Warehouse Operator';

  const navItems = (isWarehouseWorkspace ? [
    { id: 'inventory', label: 'Inventory', icon: <ClipboardList size={16} />, badge: inventoryRows.length || null },
    { id: 'operations',label: 'Operations', icon: <ArrowLeftRight size={16} />, badge: stats.pendingOperations.length > 0 ? stats.pendingOperations.length : null },
    { id: 'movements', label: 'Move History',icon: <History size={16} />, badge: state.movements.length || null },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'products',  label: 'Products',   icon: <Boxes size={16} />,        badge: state.products.length || null },
    { id: 'inventory', label: 'Inventory',  icon: <ClipboardList size={16} />, badge: inventoryRows.length || null },
    { id: 'operations',label: 'Operations', icon: <ArrowLeftRight size={16} />, badge: stats.pendingOperations.length > 0 ? stats.pendingOperations.length : null },
    { id: 'movements', label: 'Move History',icon: <History size={16} />,      badge: state.movements.length || null },
  ]);
  const infraItems = isWarehouseWorkspace ? [
    { id: 'warehouses', label: 'Warehouses', icon: <Building2 size={16} />, badge: state.warehouses.length || null },
    { id: 'profile',    label: 'Profile',    icon: <User size={16} /> },
  ] : [
    { id: 'warehouses', label: 'Warehouses', icon: <Building2 size={16} />, badge: state.warehouses.length || null },
    { id: 'settings',   label: 'Settings',   icon: <Settings size={16} /> },
    { id: 'profile',    label: 'Profile',    icon: <User size={16} /> },
  ];

  const pageTitles = { dashboard:'Dashboard Overview', products:'Product Catalogue', inventory:'Inventory Balances', operations:'Stock Operations', movements:'Move History Ledger', warehouses:'Warehouses & Locations', settings:'Workspace Settings', profile:'User Profile' };

  return (
    <div className="next-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`next-sidebar ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-brand">
          <div className="brand-lockup is-inverse">
            <span className="brand-symbol"><Package size={22} /></span>
            <span className="brand-copy"><strong>StockSense</strong><small>Business OS</small></span>
          </div>
        </div>
        <div className="next-workspace">
          <span className="workspace-monogram">{workspaceName.charAt(0).toUpperCase()}</span>
          <div><strong>{workspaceName}</strong><small>{state.warehouses.length} Warehouses · {state.locations.length} Zones</small></div>
        </div>

        <span className="next-nav-label">Core Workspace</span>
        <nav aria-label="Main navigation">
          {navItems.map(item => (
            <button key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} aria-current={activeTab === item.id ? 'page' : undefined}>
              {item.icon}<span>{item.label}</span>
              {item.badge != null && <b aria-label={`${item.badge} items`}>{item.badge}</b>}
            </button>
          ))}
        </nav>

        <span className="next-nav-label" style={{ marginTop:'22px' }}>Infrastructure</span>
        <nav aria-label="Infrastructure navigation">
          {infraItems.map(item => (
            <button key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} aria-current={activeTab === item.id ? 'page' : undefined}>
              {item.icon}<span>{item.label}</span>
              {item.badge != null && <b>{item.badge}</b>}
            </button>
          ))}
        </nav>

        <div className="next-sidebar-bottom">
          <div className="next-help">
            <span className={`connection-orbit ${syncStatus === 'offline' ? 'is-offline' : ''}`}><i></i></span>
            <div><strong>{syncStatus === 'synced' ? 'Live Connection' : syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'offline' ? 'Offline Mode' : 'Conflict'}</strong><p>Rev #{revision} · SQLite</p></div>
          </div>
          <div className="next-user">
            <span>{currentUser.name?.charAt(0) || 'U'}</span>
            <div><strong>{currentUser.name}</strong><small>{currentUser.role}</small></div>
            <button onClick={handleLogout} title="Sign Out" aria-label="Sign out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="next-main">
        <header className="next-topbar">
          <div className="topbar-title">
            <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div>
              <small><span>StockSense OS</span> › <span>{pageTitles[activeTab]}</span></small>
              <h1>{pageTitles[activeTab]}</h1>
            </div>
          </div>
          <div className="next-actions">
            <div className="topbar-search" onClick={() => setShowCommandPalette(true)} role="button" tabIndex={0} aria-label="Quick search (Ctrl+K)" onKeyDown={e => e.key === 'Enter' && setShowCommandPalette(true)}>
              <Search size={14} /><span>Jump or search…</span><kbd>Ctrl K</kbd>
            </div>
            <div className={`live-pill ${syncStatus === 'offline' ? 'is-offline' : ''}`} aria-label={`Database ${syncStatus}`}>
              <i></i><span>{syncStatus === 'synced' ? `Rev #${revision}` : syncStatus === 'syncing' ? 'Syncing…' : 'Offline'}</span>
            </div>

            {/* Notifications */}
            <div style={{ position:'relative' }}>
              <button className="theme-button" onClick={() => setNotifOpen(p => !p)} aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} aria-expanded={notifOpen}>
                <Bell size={15} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-panel" role="dialog" aria-label="Notifications">
                  <div className="notif-header"><span>Notifications</span>{unreadCount > 0 && <span className="status status-amber">{unreadCount} unread</span>}</div>
                  {(state.notifications || []).length === 0 ? (
                    <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:'11px' }}>No notifications</div>
                  ) : (
                    <div className="notif-list">
                      {[...(state.notifications || [])].reverse().map(n => (
                        <div key={n.id} className={`notif-item ${!n.read ? 'is-unread' : ''}`}>
                          <div style={{ flex:1 }}><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })}</small></div>
                          {!n.read && <button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={() => markNotifRead(n.id)}>Mark read</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="theme-button" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            {(activeTab === 'operations' || activeTab === 'dashboard') && (
              <button className="next-primary" onClick={() => setOperationModal({ open:true, operation:null, defaultType:isWarehouseWorkspace?'Internal Transfer':'Receipt' })}><Plus size={15} /><span>New Operation</span></button>
            )}
            {activeTab === 'products' && (
              <button className="next-primary" onClick={() => setProductModal({ open:true, product:{ id:generateId('prod'), sku:'', name:'', category: categories.filter(c=>c!=='All')[0]||'', unit:'units', reorderLevel:10, description:'' } })}><Plus size={15} /><span>Add Product</span></button>
            )}
            {activeTab === 'warehouses' && !isWarehouseWorkspace && (
              <button className="next-primary" onClick={() => setWarehouseModal({ open:true, warehouse:{ id:generateId('wh'), code:'', name:'', address:'', active:true } })}><Plus size={15} /><span>Add Warehouse</span></button>
            )}
          </div>
        </header>

        <div className="next-content" id="main-content" tabIndex={-1}>
          <div className="content-frame">
            {/* Hero */}
            <section className="role-hero" aria-label="Page summary">
              <div className="hero-glow" aria-hidden="true"></div>
              <div className="hero-copy">
                <small>STOCKSENSE INVENTORY OS</small>
                <h2>
                  {activeTab === 'dashboard' && 'Precision stock tracking across your warehouse network.'}
                  {activeTab === 'products' && 'Product catalogue, SKUs and reorder thresholds.'}
                  {activeTab === 'inventory' && 'Location-by-location stock balances.'}
                  {activeTab === 'operations' && 'Receipts, deliveries, transfers and physical counts.'}
                  {activeTab === 'movements' && 'Immutable movement audit trail.'}
                  {activeTab === 'warehouses' && 'Physical storage infrastructure and zones.'}
                  {activeTab === 'settings' && 'Database, reset and regional controls.'}
                  {activeTab === 'profile' && 'Account details and session info.'}
                </h2>
                <p>{state.products.length} products · {state.locations.length} locations · {state.warehouses.length} warehouses</p>
              </div>
              {activeTab === 'dashboard' && (
                <div className="hero-actions">
                  <button className="soft-button" onClick={() => setOperationModal({ open:true, operation:null, defaultType:'Receipt' })}><TrendingUp size={15} style={{ color:'var(--green-bright)' }} /><span>Receive Stock</span></button>
                  <button className="soft-button" onClick={() => setOperationModal({ open:true, operation:null, defaultType:'Delivery' })}><TrendingDown size={15} style={{ color:'#d48b5d' }} /><span>Dispatch Order</span></button>
                </div>
              )}
            </section>

            {/* ── DASHBOARD ── */}
            {activeTab === 'dashboard' && (<>
              <div className="next-metrics" role="list" aria-label="Key metrics">
                {[
                  { label:'TOTAL UNITS', value: stats.totalStockUnits.toLocaleString('en-IN'), sub:`${state.locations.length} locations`, icon:<Package size={16}/>, tab:'inventory' },
                  { label:'PRODUCTS', value: stats.activeProductsCount, sub:`${state.locations.length} zones`, icon:<Boxes size={16}/>, tab:'products', featured:true },
                  { label:'STOCK ALERTS', value:`${stats.lowStockCount}`, sub:`${stats.outOfStockCount} out of stock`, icon:<AlertTriangle size={16}/>, tab:'inventory', warn: stats.lowStockCount > 0 },
                  { label:'PENDING OPS', value: stats.pendingOperations.length, sub:`${stats.receiptsPending} receipts · ${stats.deliveriesPending} deliveries · ${stats.transfersPending} transfers`, icon:<Clock size={16}/>, tab:'operations' },
                ].map(({ label, value, sub, icon, tab, featured, warn }) => (
                  <article key={label} role="listitem" className={`metric-card-link${featured ? ' featured' : ''}`} onClick={() => setActiveTab(tab)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setActiveTab(tab)} aria-label={`${label}: ${value}. Go to ${tab}.`}>
                    <div className="metric-head"><span>{label}</span><i style={warn ? { background:'#f7e1df', color:'#94463d' } : {}}>{icon}</i></div>
                    <strong className="font-mono" style={warn ? { color:'#94463d' } : {}}>{value}</strong>
                    <small>{sub}</small>
                    <ChevronRight size={12} className="metric-chevron" />
                  </article>
                ))}
              </div>

              {state.warehouses.length === 0 ? (
                <div className="next-card" style={{ maxWidth:'600px', margin:'0 auto', textAlign:'center', padding:'48px 32px' }}>
                  <div style={{ marginBottom:'24px', color:'var(--green)' }}><Building2 size={48} /></div>
                  <h3 style={{ marginBottom:'12px' }}>Welcome to StockSense</h3>
                  <ol style={{ textAlign:'left', color:'var(--muted)', lineHeight:'2.2', paddingLeft:'20px', marginBottom:'28px', fontSize:'13px' }}>
                    <li><strong style={{ color:'var(--ink)' }}>Create a warehouse</strong> and add at least one storage location</li>
                    <li><strong style={{ color:'var(--ink)' }}>Add a product</strong> with a unique SKU and reorder level</li>
                    <li><strong style={{ color:'var(--ink)' }}>Record a receipt</strong> to log your opening stock</li>
                  </ol>
                  <button className="next-primary" onClick={() => setActiveTab('warehouses')} style={{ margin:'0 auto' }}><Building2 size={16} /><span>Create First Warehouse</span></button>
                </div>
              ) : (
                <div className="next-grid">
                  {/* Pending ops */}
                  <div className="next-card">
                    <div className="card-heading"><div><small>WORK ORDERS</small><h3>Pending Operations</h3></div><button className="soft-button" style={{ padding:'6px 10px', fontSize:'9px' }} onClick={() => setActiveTab('operations')}>View All</button></div>
                    {stats.pendingOperations.length === 0 ? (
                      <div className="next-empty"><span><CheckCircle2 size={24} /></span><strong>All Clear</strong><p>No pending operations.</p><button className="soft-button" onClick={() => setOperationModal({ open:true, operation:null, defaultType:'Receipt' })}><Plus size={14} /> New Operation</button></div>
                    ) : (
                      <div className="data-table-wrap"><table className="urban-table"><caption className="sr-only">Pending operations</caption><thead><tr><th>Reference</th><th>Type</th><th>Status</th><th>Product</th><th>Qty</th><th>Action</th></tr></thead>
                        <tbody>{stats.pendingOperations.slice(0,6).map(op => { const p = state.products.find(pr => pr.id === op.productId); return (
                          <tr key={op.id}>
                            <td className="font-mono" style={{ fontWeight:700 }}>{op.reference}</td>
                            <td><span className={`status ${op.type==='Receipt'?'status-green':op.type==='Delivery'?'status-red':'status-amber'}`}>{op.type}</span></td>
                            <td><span className={`status ${op.status==='Ready'?'status-green':'status-amber'}`}>{op.status}</span></td>
                            <td>{p?.name||op.productId}</td>
                            <td className="font-mono" style={{ fontWeight:700 }}>{op.quantity.toLocaleString('en-IN')} {p?.unit}</td>
                            <td><button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={() => setOperationModal({ open:true, operation:op })}>Execute</button></td>
                          </tr>); })}</tbody>
                      </table></div>
                    )}
                  </div>
                  {/* Recent movements */}
                  <div className="next-card">
                    <div className="card-heading"><div><small>AUDIT TRAIL</small><h3>Recent Movements</h3></div><button className="soft-button" style={{ padding:'6px 10px', fontSize:'9px' }} onClick={() => setActiveTab('movements')}>Full Stream</button></div>
                    {stats.recentMovements.length === 0 ? (
                      <div className="next-empty"><span><History size={24} /></span><strong>No Movements Yet</strong><p>Validated operations create movement records here.</p></div>
                    ) : (
                      <div className="timeline" role="list">{stats.recentMovements.slice(0,6).map(mov => { const p = state.products.find(pr => pr.id === mov.productId); const pos = mov.quantity > 0; return (
                        <article key={mov.id} role="listitem"><i></i>
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between' }}><strong>{p?.name||mov.productId}</strong>
                              <span className="font-mono" style={{ fontWeight:800, fontSize:'11px', color:pos?'var(--green)':mov.quantity<0?'#94463d':'var(--muted)' }}>{pos?`+${mov.quantity.toLocaleString('en-IN')}`:mov.quantity.toLocaleString('en-IN')} {p?.unit}</span>
                            </div>
                            <p>{mov.type} · {mov.actor}</p>
                            <small><time dateTime={mov.timestamp}>{new Date(mov.timestamp).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' })}</time></small>
                          </div>
                        </article>); })}</div>
                    )}
                  </div>
                  {/* Low stock */}
                  {stats.lowStockProducts.length > 0 && (
                    <div className="next-card" style={{ gridColumn:'1 / -1' }}>
                      <div className="card-heading"><div><small>REQUIRES ATTENTION</small><h3>Low Stock &amp; Out of Stock</h3></div><button className="soft-button" style={{ padding:'6px 10px', fontSize:'9px' }} onClick={() => setActiveTab('inventory')}>View Inventory</button></div>
                      <div className="data-table-wrap"><table className="urban-table"><thead><tr><th>SKU</th><th>Product</th><th>Stock</th><th>Reorder Level</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>{stats.lowStockProducts.map(p => { const stock = calculateTotalStock(p.id, state.balances); const isOut = stock === 0; return (
                          <tr key={p.id}>
                            <td className="font-mono" style={{ fontWeight:700, color:'var(--green)' }}>{p.sku}</td>
                            <td style={{ fontWeight:600 }}>{p.name}</td>
                            <td className="font-mono" style={{ fontWeight:800, color:isOut?'#94463d':'#d48b5d' }}>{stock.toLocaleString('en-IN')} {p.unit}</td>
                            <td className="font-mono">{p.reorderLevel} {p.unit}</td>
                            <td>{isOut?<span className="status status-red"><AlertTriangle size={10}/> Out of Stock</span>:<span className="status status-amber"><AlertTriangle size={10}/> Low Stock</span>}</td>
                            <td><button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={() => setOperationModal({ open:true, operation:null, defaultType:'Receipt' })}>Receive Stock</button></td>
                          </tr>); })}</tbody>
                      </table></div>
                    </div>
                  )}
                </div>
              )}
            </>)}

            {/* ── PRODUCTS ── */}
            {activeTab === 'products' && (
              <div className="next-card">
                <div className="card-heading"><div><small>CATALOGUE</small><h3>Product Inventory</h3></div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button className="soft-button" onClick={exportProductsCSV}><FileDown size={14}/><span>Export CSV</span></button>
                    <button className="next-primary" onClick={() => setProductModal({ open:true, product:{ id:generateId('prod'), sku:'', name:'', category:'', unit:'units', reorderLevel:10, description:'' } })}><Plus size={14}/><span>Add Product</span></button>
                  </div>
                </div>
                <div className="section-toolbar">
                  <div className="search-control"><Search size={14}/><input type="search" placeholder="Search SKU or name…" value={productSearch} onChange={e => setProductSearch(e.target.value)} aria-label="Search products"/></div>
                  <div className="section-tabs" role="group" aria-label="Stock filter">
                    {['All','In Stock','Low Stock','Out of Stock'].map(t => <button key={t} className={productStockFilter===t?'active':''} onClick={()=>setProductStockFilter(t)} aria-pressed={productStockFilter===t}>{t}</button>)}
                  </div>
                  <div className="section-tabs" role="group" aria-label="Product category filter">
                    {categories.map(t => <button key={t} className={productCategoryFilter===t?'active':''} onClick={()=>setProductCategoryFilter(t)} aria-pressed={productCategoryFilter===t}>{t}</button>)}
                  </div>
                </div>
                {state.products.length === 0 ? (
                  <div className="next-empty"><span><Boxes size={28}/></span><strong>No Products Yet</strong><p>Add your first product.{state.locations.length===0?' Create a warehouse location first.':''}</p>
                    {state.locations.length === 0 && <button className="soft-button" onClick={() => setActiveTab('warehouses')}><Building2 size={14}/> Create Warehouse First</button>}
                    <button className="next-primary" onClick={() => setProductModal({ open:true, product:{ id:generateId('prod'), sku:'', name:'', category:'', unit:'units', reorderLevel:10, description:'' } })}><Plus size={14}/> Add First Product</button>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="next-empty"><span><Search size={24}/></span><strong>No Results</strong><p>No products match your search or filter.</p></div>
                ) : (
                  <div className="data-table-wrap"><table className="urban-table"><caption className="sr-only">Products</caption>
                    <thead><tr><th>SKU</th><th>Product Name</th><th>Category</th><th>Unit</th><th>Reorder Level</th><th>Total Stock</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{filteredProducts.map(p => { const stock = calculateTotalStock(p.id, state.balances); const isOut = stock===0; const isLow = stock>0 && stock<=(p.reorderLevel||0); return (
                      <tr key={p.id}>
                        <td className="font-mono" style={{ fontWeight:700, color:'var(--green)' }}>{p.sku}</td>
                        <td><div style={{ fontWeight:600 }}>{p.name}</div>{p.description && <div style={{ fontSize:'10px', color:'var(--muted)' }}>{p.description}</div>}</td>
                        <td><span className="status status-neutral">{p.category}</span></td>
                        <td className="font-mono">{p.unit}</td>
                        <td className="font-mono">{(p.reorderLevel||0).toLocaleString('en-IN')}</td>
                        <td className="font-mono" style={{ fontWeight:800 }}>{stock.toLocaleString('en-IN')}</td>
                        <td>{isOut?<span className="status status-red"><AlertTriangle size={10}/> Out of Stock</span>:isLow?<span className="status status-amber"><AlertTriangle size={10}/> Low Stock</span>:<span className="status status-green"><CheckCircle2 size={10}/> Healthy</span>}</td>
                        <td><div style={{ display:'flex', gap:'6px' }}>
                          <button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={() => { setActiveTab('inventory'); setInventorySearch(p.sku); }}>Inventory</button>
                          <button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={() => setProductModal({ open:true, product:p })}>Edit</button>
                        </div></td>
                      </tr>); })}</tbody>
                  </table></div>
                )}
              </div>
            )}

            {/* ── INVENTORY ── */}
            {activeTab === 'inventory' && (
              <div className="next-card">
                <div className="card-heading"><div><small>LOCATION-BY-LOCATION BALANCES</small><h3>Inventory Register</h3></div>
                  <button className="next-primary" onClick={() => setOperationModal({ open:true, operation:null, defaultType:isWarehouseWorkspace?'Internal Transfer':'Receipt' })}><Plus size={14}/><span>{isWarehouseWorkspace?'Create Warehouse Task':'Receive Stock'}</span></button>
                </div>
                <div className="section-toolbar">
                  <div className="search-control"><Search size={14}/><input type="search" placeholder="Search product, SKU, location…" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} aria-label="Search inventory"/></div>
                  {state.warehouses.length > 0 && (
                    <div className="section-tabs" role="group" aria-label="Warehouse filter">
                      <button className={inventoryWarehouseFilter==='All'?'active':''} onClick={()=>setInventoryWarehouseFilter('All')} aria-pressed={inventoryWarehouseFilter==='All'}>All</button>
                      {state.warehouses.map(wh => <button key={wh.id} className={inventoryWarehouseFilter===wh.id?'active':''} onClick={()=>setInventoryWarehouseFilter(wh.id)} aria-pressed={inventoryWarehouseFilter===wh.id}>{wh.code}</button>)}
                    </div>
                  )}
                  <div className="section-tabs" role="group" aria-label="Inventory category filter">
                    {categories.map(t => <button key={t} className={inventoryCategoryFilter===t?'active':''} onClick={()=>setInventoryCategoryFilter(t)} aria-pressed={inventoryCategoryFilter===t}>{t}</button>)}
                  </div>
                </div>
                {state.warehouses.length === 0 ? (
                  <div className="next-empty"><span><Building2 size={28}/></span><strong>No Warehouses</strong><p>Create a warehouse and location first.</p><button className="next-primary" onClick={() => setActiveTab('warehouses')}><Building2 size={14}/> Create Warehouse</button></div>
                ) : inventoryRows.length === 0 ? (
                  <div className="next-empty"><span><ClipboardList size={28}/></span><strong>No Stock Recorded</strong><p>{state.products.length===0?'Add products first, then create a receipt to log opening stock.':'Create a receipt to add stock to a location.'}</p>
                    {state.products.length===0?<button className="soft-button" onClick={()=>setActiveTab('products')}><Boxes size={14}/> Add Products</button>:<button className="next-primary" onClick={()=>setOperationModal({open:true,operation:null,defaultType:'Receipt'})}><Plus size={14}/> Record Opening Stock</button>}
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div className="next-empty"><span><Search size={24}/></span><strong>No Results</strong><p>No inventory matches your filter.</p></div>
                ) : (
                  <div className="data-table-wrap"><table className="urban-table"><caption className="sr-only">Inventory by location</caption>
                    <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Warehouse</th><th>Location</th><th>Qty</th><th>Unit</th><th>Reorder</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{filteredInventory.map(({ bal, product, location, warehouse }) => { const isOut=bal.quantity===0; const isLow=bal.quantity>0&&bal.quantity<=(product.reorderLevel||0); return (
                      <tr key={bal.id}>
                        <td style={{ fontWeight:600 }}>{product.name}</td>
                        <td className="font-mono" style={{ fontWeight:700, color:'var(--green)' }}>{product.sku}</td>
                        <td><span className="status status-neutral">{product.category}</span></td>
                        <td><button className="soft-button" style={{ padding:'3px 8px', fontSize:'10px' }} onClick={()=>setActiveTab('warehouses')}>{warehouse?.name||'—'}</button></td>
                        <td className="font-mono" style={{ fontSize:'11px' }}>{location.name} <span style={{ color:'var(--muted)' }}>({location.code})</span></td>
                        <td className="font-mono" style={{ fontWeight:800 }}>{bal.quantity.toLocaleString('en-IN')}</td>
                        <td className="font-mono">{product.unit}</td>
                        <td className="font-mono">{(product.reorderLevel||0).toLocaleString('en-IN')}</td>
                        <td>{isOut?<span className="status status-red"><AlertTriangle size={10}/> Out</span>:isLow?<span className="status status-amber"><AlertTriangle size={10}/> Low</span>:<span className="status status-green"><CheckCircle2 size={10}/> Healthy</span>}</td>
                        <td><div style={{ display:'flex', gap:'6px' }}>
                          <button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={()=>setOperationModal({open:true,operation:{id:generateId('op'),type:'Physical Count',productId:product.id,sourceId:location.id,quantity:bal.quantity,reference:`AUDT-${new Date().getFullYear()}-${Math.floor(1000+Math.random()*9000)}`,status:'Draft',createdAt:new Date().toISOString()},defaultType:'Physical Count'})}>Count</button>
                          <button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={()=>setOperationModal({open:true,operation:null,defaultType:'Internal Transfer'})}>Move</button>
                        </div></td>
                      </tr>); })}</tbody>
                  </table></div>
                )}
              </div>
            )}

            {/* ── OPERATIONS ── */}
            {activeTab === 'operations' && (
              <div className="next-card">
                <div className="card-heading"><div><small>LOGISTICS &amp; POSTINGS</small><h3>Operations Registry</h3></div>
                  <button className="next-primary" onClick={()=>setOperationModal({open:true,operation:null,defaultType:isWarehouseWorkspace?'Internal Transfer':'Receipt'})}><Plus size={14}/><span>Create Operation</span></button>
                </div>
                <div className="section-toolbar">
                  <div className="search-control"><Search size={14}/><input type="search" placeholder="Search reference, partner, SKU…" value={operationSearch} onChange={e=>setOperationSearch(e.target.value)} aria-label="Search operations"/></div>
                  <div className="section-tabs" role="group" aria-label="Type filter">
                    {(isWarehouseWorkspace ? ['All','Delivery','Internal Transfer','Physical Count'] : ['All','Receipt','Delivery','Internal Transfer','Physical Count']).map(t=><button key={t} className={operationTypeFilter===t?'active':''} onClick={()=>setOperationTypeFilter(t)} aria-pressed={operationTypeFilter===t}>{t}</button>)}
                  </div>
                  <div className="section-tabs" role="group" aria-label="Status filter">
                    {['All','Draft','Waiting','Ready','Done','Cancelled'].map(s=><button key={s} className={operationStatusFilter===s?'active':''} onClick={()=>setOperationStatusFilter(s)} aria-pressed={operationStatusFilter===s}>{s}</button>)}
                  </div>
                  <div className="section-tabs" role="group" aria-label="Operation warehouse filter">
                    <button className={operationWarehouseFilter==='All'?'active':''} onClick={()=>setOperationWarehouseFilter('All')} aria-pressed={operationWarehouseFilter==='All'}>All warehouses</button>
                    {state.warehouses.map(wh=><button key={wh.id} className={operationWarehouseFilter===wh.id?'active':''} onClick={()=>setOperationWarehouseFilter(wh.id)} aria-pressed={operationWarehouseFilter===wh.id}>{wh.code}</button>)}
                  </div>
                </div>
                {(state.products.length===0||state.locations.length===0) ? (
                  <div className="next-empty"><span><ArrowLeftRight size={28}/></span><strong>Prerequisites Missing</strong><p>{state.warehouses.length===0?'Create a warehouse and location first.':state.locations.length===0?'Add a storage location to your warehouse.':'Add at least one product.'}</p>
                    <button className="soft-button" onClick={()=>setActiveTab(state.warehouses.length===0?'warehouses':'products')}>{state.warehouses.length===0?<><Building2 size={14}/> Create Warehouse</>:<><Boxes size={14}/> Add Product</>}</button>
                  </div>
                ) : state.operations.length===0 ? (
                  <div className="next-empty"><span><ArrowLeftRight size={28}/></span><strong>No Operations</strong><p>{isWarehouseWorkspace?'Create a warehouse task to start picking, moving, or counting stock.':'Create a receipt to record your first stock movement.'}</p><button className="next-primary" onClick={()=>setOperationModal({open:true,operation:null,defaultType:isWarehouseWorkspace?'Internal Transfer':'Receipt'})}><Plus size={14}/> {isWarehouseWorkspace?'Create First Task':'Create First Receipt'}</button></div>
                ) : filteredOperations.length===0 ? (
                  <div className="next-empty"><span><Search size={24}/></span><strong>No Results</strong><p>No operations match your filters.</p></div>
                ) : (
                  <div className="data-table-wrap"><table className="urban-table"><caption className="sr-only">Operations</caption>
                    <thead><tr><th>Reference</th><th>Type</th><th>Status</th><th>Product</th><th>Qty</th><th>Source</th><th>Destination</th><th>Partner</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>{filteredOperations.map(op => { const prod = state.products.find(p=>p.id===op.productId); return (
                      <tr key={op.id}>
                        <td className="font-mono" style={{ fontWeight:700, color:'var(--green)' }}>{op.reference}</td>
                        <td><span className={`status ${op.type==='Receipt'?'status-green':op.type==='Delivery'?'status-red':'status-amber'}`}>{op.type}</span></td>
                        <td><span className={`status ${op.status==='Done'?'status-green':op.status==='Cancelled'?'status-red':'status-amber'}`}>{op.status}</span></td>
                        <td><div style={{ fontWeight:600 }}>{prod?.name||op.productId}</div><div className="font-mono" style={{ fontSize:'10px', color:'var(--muted)' }}>{prod?.sku}</div></td>
                        <td className="font-mono" style={{ fontWeight:800 }}>{op.quantity.toLocaleString('en-IN')} {prod?.unit}</td>
                        <td style={{ fontSize:'10px' }}>{op.sourceId?formatLocationName(op.sourceId,state.locations,state.warehouses):'—'}</td>
                        <td style={{ fontSize:'10px' }}>{op.destinationId?formatLocationName(op.destinationId,state.locations,state.warehouses):'—'}</td>
                        <td style={{ fontSize:'10px', color:'var(--muted)' }}>{op.partner||'—'}</td>
                        <td style={{ fontSize:'10px', color:'var(--muted)' }}><time dateTime={op.createdAt}>{new Date(op.createdAt).toLocaleDateString('en-IN')}</time></td>
                        <td><div style={{ display:'flex', gap:'6px' }}>
                          <button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={()=>setOperationDetailModal(op)}>View</button>
                          {op.status!=='Done'&&op.status!=='Cancelled'&&(!isWarehouseWorkspace || op.type!=='Receipt')&&<button className="next-primary" style={{ padding:'4px 8px', fontSize:'9px', minHeight:'auto' }} onClick={()=>setOperationModal({open:true,operation:op})}>Execute</button>}
                        </div></td>
                      </tr>); })}</tbody>
                  </table></div>
                )}
              </div>
            )}

            {/* ── MOVEMENTS ── */}
            {activeTab === 'movements' && (
              <div className="next-card">
                <div className="card-heading"><div><small>IMMUTABLE AUDIT TRAIL</small><h3>Movement Ledger</h3></div>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                    <span style={{ fontSize:'10px', color:'var(--muted)' }}>Sort:</span>
                    {['newest','oldest'].map(s=><button key={s} className={`soft-button${movementSortOrder===s?' active':''}`} style={{ padding:'5px 10px', fontSize:'10px' }} onClick={()=>setMovementSortOrder(s)} aria-pressed={movementSortOrder===s}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>)}
                  </div>
                </div>
                <div className="section-toolbar">
                  <div className="search-control"><Search size={14}/><input type="search" placeholder="Search product, actor, notes…" value={movementSearch} onChange={e=>setMovementSearch(e.target.value)} aria-label="Search movements"/></div>
                  <div className="section-tabs" role="group" aria-label="Type filter">
                    {['All','Receipt','Delivery','Internal Transfer','Physical Count'].map(t=><button key={t} className={movementTypeFilter===t?'active':''} onClick={()=>setMovementTypeFilter(t)} aria-pressed={movementTypeFilter===t}>{t}</button>)}
                  </div>
                  {state.warehouses.length>0 && (
                    <div className="section-tabs" role="group" aria-label="Warehouse filter">
                      <button className={movementWarehouseFilter==='All'?'active':''} onClick={()=>setMovementWarehouseFilter('All')} aria-pressed={movementWarehouseFilter==='All'}>All</button>
                      {state.warehouses.map(wh=><button key={wh.id} className={movementWarehouseFilter===wh.id?'active':''} onClick={()=>setMovementWarehouseFilter(wh.id)} aria-pressed={movementWarehouseFilter===wh.id}>{wh.code}</button>)}
                    </div>
                  )}
                </div>
                {state.movements.length===0 ? (
                  <div className="next-empty"><span><History size={28}/></span><strong>No Movements</strong><p>Validated operations create immutable ledger entries here.</p><button className="soft-button" onClick={()=>setActiveTab('operations')}><ArrowLeftRight size={14}/> Go to Operations</button></div>
                ) : filteredMovements.length===0 ? (
                  <div className="next-empty"><span><Search size={24}/></span><strong>No Results</strong><p>No movements match your filters.</p></div>
                ) : (
                  <div className="data-table-wrap"><table className="urban-table"><caption className="sr-only">Audit ledger (read-only)</caption>
                    <thead><tr><th>Timestamp</th><th>Product</th><th>Type</th><th>Delta</th><th>From</th><th>To</th><th>Validated By</th><th>Notes</th></tr></thead>
                    <tbody>{filteredMovements.map(m => { const p = state.products.find(pr=>pr.id===m.productId); const pos=m.quantity>0; return (
                      <tr key={m.id}>
                        <td className="font-mono" style={{ fontSize:'10px', color:'var(--muted)' }}><time dateTime={m.timestamp}>{new Date(m.timestamp).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</time></td>
                        <td><div style={{ fontWeight:600 }}>{p?.name||m.productId}</div><div className="font-mono" style={{ fontSize:'10px', color:'var(--muted)' }}>{p?.sku}</div></td>
                        <td><span className={`status ${m.type==='Receipt'?'status-green':m.type==='Delivery'?'status-red':'status-amber'}`}>{m.type}</span></td>
                        <td className="font-mono" style={{ fontWeight:800, color:pos?'var(--green)':m.quantity<0?'#94463d':'inherit' }}>{pos?`+${m.quantity.toLocaleString('en-IN')}`:m.quantity.toLocaleString('en-IN')} {p?.unit}</td>
                        <td style={{ fontSize:'10px' }}>{m.fromId?formatLocationName(m.fromId,state.locations,state.warehouses):<span style={{ color:'var(--muted)' }}>External</span>}</td>
                        <td style={{ fontSize:'10px' }}>{m.toId?formatLocationName(m.toId,state.locations,state.warehouses):<span style={{ color:'var(--muted)' }}>External</span>}</td>
                        <td style={{ fontSize:'10px', fontWeight:600 }}>{m.actor}</td>
                        <td style={{ fontSize:'10px', color:'var(--muted)' }}>{m.notes||'—'}</td>
                      </tr>); })}</tbody>
                  </table></div>
                )}
              </div>
            )}

            {/* ── WAREHOUSES ── */}
            {activeTab === 'warehouses' && (
              <div style={{ display:'grid', gap:'20px' }}>
                <div className="next-card">
                  <div className="card-heading"><div><small>STORAGE INFRASTRUCTURE</small><h3>Warehouse Facilities</h3></div>
                    {!isWarehouseWorkspace&&<button className="next-primary" onClick={()=>setWarehouseModal({open:true,warehouse:{id:generateId('wh'),code:'',name:'',address:'',active:true}})}><Plus size={14}/><span>Add Facility</span></button>}
                  </div>
                  {state.warehouses.length===0 ? (
                    <div className="next-empty"><span><Building2 size={32}/></span><strong>No Warehouses Yet</strong><p>Create your first warehouse. Each needs at least one location before inventory can be received.</p>
                      {!isWarehouseWorkspace&&<button className="next-primary" onClick={()=>setWarehouseModal({open:true,warehouse:{id:generateId('wh'),code:'',name:'',address:'',active:true}})}><Plus size={14}/> Create First Warehouse</button>}
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'15px' }}>
                      {state.warehouses.map(wh => {
                        const whLocs = state.locations.filter(l=>l.warehouseId===wh.id);
                        const whUnits = state.balances.filter(b=>whLocs.some(l=>l.id===b.locationId)).reduce((s,b)=>s+(b.quantity||0),0);
                        return (
                          <div key={wh.id} className="warehouse-card">
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                              <div><span className="status status-neutral font-mono">{wh.code}</span><strong style={{ display:'block', fontSize:'13px', marginTop:'6px' }}>{wh.name}</strong></div>
                              <span className={`status ${wh.active?'status-green':'status-red'}`}>{wh.active?'Active':'Paused'}</span>
                            </div>
                            {wh.address&&<div style={{ fontSize:'10px', color:'var(--muted)', display:'flex', gap:'6px', marginTop:'8px' }}><MapPin size={12} style={{ flexShrink:0 }}/><span>{wh.address}</span></div>}
                            <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--line)', paddingTop:'10px', marginTop:'12px' }}>
                              <div><small style={{ color:'var(--muted)', fontSize:'8px', display:'block' }}>LOCATIONS</small><div style={{ fontWeight:700 }}>{whLocs.length}</div></div>
                              <div><small style={{ color:'var(--muted)', fontSize:'8px', display:'block' }}>TOTAL STOCK</small><div className="font-mono" style={{ fontWeight:800, color:'var(--green)' }}>{whUnits.toLocaleString('en-IN')} units</div></div>
                            </div>
                            {whLocs.length===0&&<div style={{ background:'var(--sand)', borderRadius:'8px', padding:'8px 12px', fontSize:'10px', color:'#7a5c35', marginTop:'8px' }}>⚠ Add at least one location before receiving inventory.</div>}
                            <div style={{ display:'flex', gap:'6px', marginTop:'12px' }}>
                              <button className="soft-button" style={{ flex:1, padding:'6px', fontSize:'9px', justifyContent:'center' }} onClick={()=>setLocationModal({open:true,location:{id:generateId('loc'),warehouseId:wh.id,code:'',name:'',type:'Rack',active:true}})}><Plus size={12}/> Add Location</button>
                              {!isWarehouseWorkspace&&<button className="soft-button" style={{ padding:'6px 12px', fontSize:'9px' }} onClick={()=>setWarehouseModal({open:true,warehouse:wh})}>Edit</button>}
                            </div>
                          </div>);
                      })}
                    </div>
                  )}
                </div>
                {state.locations.length>0&&(
                  <div className="next-card">
                    <div className="card-heading"><div><small>STORAGE ZONES</small><h3>Locations Registry</h3></div>
                      <button className="next-primary" onClick={()=>setLocationModal({open:true,location:{id:generateId('loc'),warehouseId:state.warehouses[0]?.id||'',code:'',name:'',type:'Rack',active:true}})} disabled={state.warehouses.length===0}><Plus size={14}/><span>Add Location</span></button>
                    </div>
                    <div className="data-table-wrap"><table className="urban-table"><caption className="sr-only">Locations</caption>
                      <thead><tr><th>Code</th><th>Name</th><th>Warehouse</th><th>Type</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>{state.locations.map(loc => { const wh=state.warehouses.find(w=>w.id===loc.warehouseId); const total=state.balances.filter(b=>b.locationId===loc.id).reduce((s,b)=>s+(b.quantity||0),0); return (
                        <tr key={loc.id}>
                          <td className="font-mono" style={{ fontWeight:700, color:'var(--green)' }}>{loc.code}</td>
                          <td style={{ fontWeight:600 }}>{loc.name}</td>
                          <td><button className="soft-button" style={{ padding:'3px 8px', fontSize:'10px' }} onClick={()=>setActiveTab('warehouses')}>{wh?.name||'—'}</button></td>
                          <td><span className="status status-neutral">{loc.type}</span></td>
                          <td className="font-mono" style={{ fontWeight:800 }}>{total.toLocaleString('en-IN')}</td>
                          <td><span className={`status ${loc.active?'status-green':'status-red'}`}>{loc.active?'Active':'Disabled'}</span></td>
                          <td><button className="soft-button" style={{ padding:'4px 8px', fontSize:'9px' }} onClick={()=>setLocationModal({open:true,location:loc})}>Edit</button></td>
                        </tr>);})}
                      </tbody>
                    </table></div>
                  </div>
                )}
              </div>
            )}

            {/* ── SETTINGS ── */}
            {activeTab === 'settings' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))', gap:'20px' }}>
                <div className="next-card">
                  <div className="card-heading"><div><small>DIAGNOSTICS</small><h3>Persistence Engine</h3></div></div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                    {[['Database','SQLite (Node.js DatabaseSync)'],['Path','data/stocksense.db'],['Revision',`#${revision}`],['Sync',syncStatus.toUpperCase()],['Currency','INR (₹) — en-IN'],['Timezone','Asia/Kolkata (IST)'],['User',`${currentUser.name} (${currentUser.role})`],['Workspace',workspaceName]].map(([k,v])=>(
                      <div key={k} className="insight-line"><span>{k}</span><strong className={k==='Revision'||k==='Path'?'font-mono':''}>{v}</strong></div>
                    ))}
                  </div>
                </div>
                <div className="next-card">
                  <div className="card-heading"><div><small>WORKSPACE</small><h3>State Maintenance</h3></div></div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                    <button className="soft-button" style={{ justifyContent:'flex-start', padding:'12px' }} onClick={()=>{ const d='data:text/json;charset=utf-8,'+encodeURIComponent(JSON.stringify({state,revision},null,2)); const a=document.createElement('a'); a.href=d; a.download=`stocksense-backup-rev${revision}-${new Date().toISOString().slice(0,10)}.json`; a.click(); addToast('Backup downloaded.','success'); }}><FileDown size={16}/><span>Download JSON Backup</span></button>
                    <button className="soft-button" style={{ justifyContent:'flex-start', padding:'12px' }} onClick={fetchStateFromServer}><RefreshCw size={16}/><span>Force Re-fetch from Server</span></button>
                    <button className="soft-button" style={{ justifyContent:'flex-start', padding:'12px', color:'#94463d', borderColor:'#f7e1df' }} onClick={()=>setResetConfirmModal(true)}><AlertTriangle size={16}/><span>Clear Workspace (Destructive)</span></button>
                  </div>
                  <div style={{ marginTop:'16px', padding:'12px', background:'var(--surface-soft)', borderRadius:'10px', fontSize:'10px', color:'var(--muted)', lineHeight:'1.7' }}>
                    <strong style={{ display:'block', color:'var(--ink)', marginBottom:'4px' }}>Password Reset</strong>
                    Email-based reset is not configured. Contact your workspace administrator.
                  </div>
                </div>
              </div>
            )}

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))', gap:'20px' }}>
                <div className="next-card">
                  <div className="card-heading"><div><small>ACCOUNT</small><h3>Your Profile</h3></div></div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'16px', padding:'16px', background:'var(--surface-soft)', borderRadius:'12px' }}>
                      <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'var(--sidebar)', color:'var(--green-bright)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', fontWeight:700, flexShrink:0 }}>{currentUser.name?.charAt(0).toUpperCase()||'U'}</div>
                      <div><strong style={{ display:'block', fontSize:'16px' }}>{currentUser.name}</strong><span style={{ fontSize:'11px', color:'var(--muted)' }}>{currentUser.email}</span><div style={{ marginTop:'4px' }}><span className="status status-green">{currentUser.role}</span></div></div>
                    </div>
                    {[['Full Name',currentUser.name],['Email',currentUser.email],['Role',currentUser.role],['Workspace',workspaceName],['User ID',currentUser.id],['Default Warehouse',state.warehouses.find(w=>w.active)?.name||state.warehouses[0]?.name||'None configured']].map(([k,v])=>(
                      <div key={k} className="insight-line"><span>{k}</span><strong className={k==='Email'||k==='User ID'?'font-mono':''}>{v}</strong></div>
                    ))}
                  </div>
                </div>
                <div className="next-card">
                  <div className="card-heading"><div><small>SESSION</small><h3>Session Info</h3></div></div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    {[['Session','Active'],['Auth Method','Password (scrypt-hashed)'],['Session Duration','12 hours'],['Sync Revision',`#${revision}`]].map(([k,v])=>(
                      <div key={k} className="insight-line"><span>{k}</span>{k==='Session'?<span className="status status-green">Active</span>:<strong>{v}</strong>}</div>
                    ))}
                    <div style={{ padding:'12px', background:'var(--surface-soft)', borderRadius:'10px', fontSize:'10px', color:'var(--muted)', lineHeight:'1.7' }}>
                      <strong style={{ display:'block', color:'var(--ink)', marginBottom:'4px' }}>Password Change</strong>Contact your workspace administrator to update credentials.
                    </div>
                    <button className="soft-button" style={{ justifyContent:'flex-start', padding:'12px', color:'#94463d', borderColor:'#f7e1df' }} onClick={handleLogout}><LogOut size={16}/><span>Sign Out</span></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="next-footer">
          <span>StockSense OS · SQLite · {syncStatus === 'synced' ? `Rev #${revision} synced` : syncStatus === 'offline' ? '⚠ Offline' : 'Syncing…'}</span>
          <span>{workspaceName} · {currentUser.name}</span>
        </footer>
      </div>

      {/* Modals */}
      {operationModal.open && <OperationFormDialog operation={operationModal.operation} defaultType={operationModal.defaultType} state={state} currentUser={currentUser} onClose={()=>setOperationModal({open:false,operation:null})} onSave={handleSaveOperation}/>}
      {productModal.open && <ProductFormDialog product={productModal.product} categories={categories.filter(c=>c!=='All')} state={state} onClose={()=>setProductModal({open:false,product:null})} onSave={prod=>{ const next=[...state.products]; const i=next.findIndex(p=>p.id===prod.id); if(i>=0) next[i]=prod; else next.push(prod); syncStateEdit({...state,products:next}); addToast(`Product ${prod.sku} saved.`,'success'); setProductModal({open:false,product:null}); }}/>}
      {operationDetailModal && (
        <div className="dialog-backdrop" onClick={()=>setOperationDetailModal(null)} role="dialog" aria-modal="true" aria-label="Operation details">
          <div className="next-dialog" onClick={e=>e.stopPropagation()}>
            <header><h2>Operation: {operationDetailModal.reference}</h2><button onClick={()=>setOperationDetailModal(null)} aria-label="Close"><X size={16}/></button></header>
            <div className="dialog-body">
              <div style={{ display:'grid', gap:'10px' }}>
                {[['Reference',operationDetailModal.reference],['Type',operationDetailModal.type],['Status',operationDetailModal.status],['Product',state.products.find(p=>p.id===operationDetailModal.productId)?.name||operationDetailModal.productId],['Quantity',`${operationDetailModal.quantity.toLocaleString('en-IN')} ${state.products.find(p=>p.id===operationDetailModal.productId)?.unit||''}`],['Source',operationDetailModal.sourceId?formatLocationName(operationDetailModal.sourceId,state.locations,state.warehouses):'—'],['Destination',operationDetailModal.destinationId?formatLocationName(operationDetailModal.destinationId,state.locations,state.warehouses):'—'],['Partner',operationDetailModal.partner||'—'],['Actor',operationDetailModal.actor||'—'],['Notes',operationDetailModal.notes||'—'],['Created',new Date(operationDetailModal.createdAt).toLocaleString('en-IN')]].map(([k,v])=>(
                  <div key={k} className="insight-line"><span>{k}</span><strong>{v}</strong></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {warehouseModal.open && <WarehouseFormDialog warehouse={warehouseModal.warehouse} state={state} onClose={()=>setWarehouseModal({open:false,warehouse:null})} onSave={wh=>{ const next=[...state.warehouses]; const i=next.findIndex(w=>w.id===wh.id); if(i>=0) next[i]=wh; else next.push(wh); syncStateEdit({...state,warehouses:next}); addToast(`${wh.name} saved.`,'success'); setWarehouseModal({open:false,warehouse:null}); }}/>}
      {locationModal.open && <LocationFormDialog location={locationModal.location} warehouses={state.warehouses} onClose={()=>setLocationModal({open:false,location:null})} onSave={loc=>{ const next=[...state.locations]; const i=next.findIndex(l=>l.id===loc.id); if(i>=0) next[i]=loc; else next.push(loc); syncStateEdit({...state,locations:next}); addToast(`${loc.code} saved.`,'success'); setLocationModal({open:false,location:null}); }}/>}
      {resetConfirmModal && (
        <div className="dialog-backdrop" onClick={()=>setResetConfirmModal(false)} role="dialog" aria-modal="true" aria-label="Clear workspace">
          <div className="next-dialog" onClick={e=>e.stopPropagation()} style={{ maxWidth:'460px' }}>
            <header><h2>Clear Entire Workspace?</h2><button onClick={()=>setResetConfirmModal(false)} aria-label="Cancel"><X size={16}/></button></header>
            <div className="dialog-body">
              <div style={{ background:'#fff3f3', border:'1px solid #f5c6c6', borderRadius:'10px', padding:'14px', marginBottom:'16px', color:'#7d2a25', fontSize:'11px', lineHeight:'1.7' }}>
                <strong style={{ display:'block', marginBottom:'6px' }}>⚠ This action is permanent and irreversible.</strong>
                Will delete: {state.products.length} products · {state.warehouses.length} warehouses · {state.locations.length} locations · {state.balances.length} balances · {state.operations.length} operations · {state.movements.length} movements<br/>
                <strong>User accounts will NOT be deleted.</strong>
              </div>
              <div className="dialog-actions"><button className="soft-button" onClick={()=>setResetConfirmModal(false)}>Cancel</button><button className="next-primary" style={{ background:'#94463d' }} onClick={handleResetWorkspace}>Clear Workspace</button></div>
            </div>
          </div>
        </div>
      )}
      {showCommandPalette && (
        <div className="dialog-backdrop" onClick={()=>setShowCommandPalette(false)} role="dialog" aria-modal="true" aria-label="Quick search">
          <div className="next-dialog" onClick={e=>e.stopPropagation()} style={{ maxWidth:'540px', marginTop:'10vh' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:'10px' }}>
              <Search size={16} style={{ color:'var(--muted)' }}/>
              <input type="search" autoFocus placeholder="Search products, warehouses, navigate…" style={{ background:'transparent', border:'none', outline:'none', width:'100%', color:'var(--ink)', fontSize:'14px' }} value={commandQuery} onChange={e=>setCommandQuery(e.target.value)} aria-label="Quick search"/>
            </div>
            <div style={{ padding:'10px', display:'grid', gap:'4px', maxHeight:'320px', overflowY:'auto' }}>
              {commandQuery.trim()==='' ? (
                [['dashboard','Dashboard',<LayoutDashboard size={14}/>],['products','Products',<Boxes size={14}/>],['inventory','Inventory',<ClipboardList size={14}/>],['operations','Operations',<ArrowLeftRight size={14}/>],['movements','Move History',<History size={14}/>],['warehouses','Warehouses',<Building2 size={14}/>],['settings','Settings',<Settings size={14}/>],['profile','Profile',<User size={14}/>]].map(([tab,label,icon])=>(
                  <button key={tab} className={`soft-button${activeTab===tab?' active':''}`} style={{ width:'100%', justifyContent:'flex-start' }} onClick={()=>{ setActiveTab(tab); setShowCommandPalette(false); }}>{icon} {label}</button>
                ))
              ) : commandResults.length===0 ? (
                <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:'11px' }}>No results for "{commandQuery}"</div>
              ) : commandResults.map((r,i)=>(
                <button key={i} className="soft-button" style={{ width:'100%', justifyContent:'flex-start' }} onClick={r.action}><span style={{ flex:1 }}>{r.label}</span><span style={{ fontSize:'9px', color:'var(--muted)' }}>{r.sub}</span></button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map(t=>(
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            {t.type==='success'&&<CheckCircle2 size={16} style={{ color:'var(--green)' }}/>}
            {t.type==='error'&&<AlertTriangle size={16} style={{ color:'#94463d' }}/>}
            {t.type==='warning'&&<AlertTriangle size={16} style={{ color:'#c4882a' }}/>}
            {t.type==='info'&&<Info size={16} style={{ color:'var(--green-bright)' }}/>}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OperationFormDialog ──────────────────────────────────────
function OperationFormDialog({ operation, defaultType, state, currentUser, onClose, onSave }) {
  const operationTypes = currentUser?.role === 'Warehouse Operator'
    ? ['Delivery', 'Internal Transfer', 'Physical Count']
    : ['Receipt', 'Delivery', 'Internal Transfer', 'Physical Count'];
  const [type, setType] = useState(operation?.type || (operationTypes.includes(defaultType) ? defaultType : operationTypes[0]));
  const [reference, setReference] = useState(operation?.reference || `${defaultType==='Receipt'?'RCPT':defaultType==='Delivery'?'DELV':defaultType==='Internal Transfer'?'XFER':'AUDT'}-${new Date().getFullYear()}-${Math.floor(1000+Math.random()*9000)}`);
  const [productId, setProductId] = useState(operation?.productId || state.products[0]?.id || '');
  const [quantity, setQuantity] = useState(operation?.quantity ?? 1);
  const [sourceId, setSourceId] = useState(operation?.sourceId || state.locations[0]?.id || '');
  const [destinationId, setDestinationId] = useState(operation?.destinationId || state.locations[1]?.id || state.locations[0]?.id || '');
  const [partner, setPartner] = useState(operation?.partner || '');
  const [picked, setPicked] = useState(operation?.picked || false);
  const [packed, setPacked] = useState(operation?.packed || false);
  const [notes, setNotes] = useState(operation?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedProduct = state.products.find(p => p.id === productId);
  const sourceStock = getLocationStock(productId, sourceId, state.balances);

  if (!state.products.length || !state.locations.length) return (
    <div className="dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Create operation">
      <div className="next-dialog" onClick={e=>e.stopPropagation()}>
        <header><h2>Create Operation</h2><button onClick={onClose} aria-label="Close"><X size={16}/></button></header>
        <div className="dialog-body"><div className="next-empty"><span><AlertTriangle size={28}/></span><strong>Prerequisites Missing</strong><p>{!state.products.length&&!state.locations.length?'Add at least one product and warehouse location first.':!state.products.length?'Add at least one product first.':'Add at least one warehouse location first.'}</p></div></div>
      </div>
    </div>
  );

  const buildPayload = (saveStatus) => ({
    id: operation?.id || generateId('op'), reference: reference.trim(), type, status: saveStatus, productId,
    quantity: Number(quantity),
    sourceId: type==='Receipt' ? null : sourceId||null,
    destinationId: type==='Delivery' ? null : type==='Physical Count' ? sourceId : destinationId||null,
    partner: (type==='Receipt'||type==='Delivery') ? (partner.trim()||null) : null,
    picked, packed, notes: notes.trim(),
    createdAt: operation?.createdAt || new Date().toISOString(),
    actor: currentUser?.name || 'System',
  });

  const handleValidate = async e => {
    e.preventDefault(); setFormError('');
    if (type==='Delivery' && Number(quantity)>sourceStock) { setFormError(`Insufficient stock: only ${sourceStock} ${selectedProduct?.unit||'units'} available.`); return; }
    if (type==='Internal Transfer' && sourceId===destinationId) { setFormError('Source and destination must be different.'); return; }
    setIsSaving(true); await onSave(buildPayload('Draft'), true); setIsSaving(false);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={operation ? 'Execute operation' : 'Create operation'}>
      <div className="next-dialog" onClick={e=>e.stopPropagation()}>
        <header><h2>{operation ? `Execute: ${operation.reference}` : `Create ${type}`}</h2><button onClick={onClose} aria-label="Close"><X size={16}/></button></header>
        <form onSubmit={handleValidate} noValidate>
          <div className="dialog-body">
            {!operation && (
              <div className="section-tabs" style={{ marginBottom:'16px' }} role="group" aria-label="Operation type">
                {operationTypes.map(t=>(
                  <button key={t} type="button" className={type===t?'active':''} aria-pressed={type===t} onClick={()=>{ setType(t); setReference(`${t==='Receipt'?'RCPT':t==='Delivery'?'DELV':t==='Internal Transfer'?'XFER':'AUDT'}-${new Date().getFullYear()}-${Math.floor(1000+Math.random()*9000)}`); setFormError(''); }}>{t}</button>
                ))}
              </div>
            )}
            {formError && <div role="alert" style={{ background:'#fff3f3', border:'1px solid #f5c6c6', borderRadius:'10px', padding:'12px', marginBottom:'16px', color:'#7d2a25', fontSize:'11px', display:'flex', gap:'8px' }}><AlertTriangle size={16}/><span>{formError}</span></div>}
            <div className="next-form-grid">
              <label htmlFor="op-ref">Reference #<input id="op-ref" required value={reference} onChange={e=>setReference(e.target.value)} className="font-mono"/></label>
              <label htmlFor="op-prod">Product<select id="op-prod" value={productId} onChange={e=>setProductId(e.target.value)} className="font-mono">{state.products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select></label>
              {(type==='Receipt'||type==='Delivery')&&<label className="full" htmlFor="op-partner">{type==='Receipt'?'Supplier / Vendor':'Customer / Consignee'}<input id="op-partner" placeholder="Entity name" value={partner} onChange={e=>setPartner(e.target.value)}/></label>}
              {(type==='Delivery'||type==='Internal Transfer'||type==='Physical Count')&&(
                <label htmlFor="op-src" className={type==='Physical Count'?'full':''}>
                  {type==='Physical Count'?'Audit Location':'Source Location'} {type!=='Physical Count'&&<span style={{ fontSize:'10px', color:sourceStock>0?'var(--green)':'#94463d', marginLeft:'4px' }}>({sourceStock.toLocaleString('en-IN')} {selectedProduct?.unit} available)</span>}
                  <select id="op-src" value={sourceId} onChange={e=>setSourceId(e.target.value)}>{state.locations.map(loc=>{ const st=getLocationStock(productId,loc.id,state.balances); return <option key={loc.id} value={loc.id}>{formatLocationName(loc.id,state.locations,state.warehouses)} ({st.toLocaleString('en-IN')} {selectedProduct?.unit})</option>; })}</select>
                </label>
              )}
              {(type==='Receipt'||type==='Internal Transfer')&&<label htmlFor="op-dest">Destination Location<select id="op-dest" value={destinationId} onChange={e=>setDestinationId(e.target.value)}>{state.locations.map(loc=><option key={loc.id} value={loc.id}>{formatLocationName(loc.id,state.locations,state.warehouses)}</option>)}</select></label>}
              <label className="full" htmlFor="op-qty">
                {type==='Physical Count'?'Physical Count (new absolute quantity)':'Movement Quantity'} ({selectedProduct?.unit||'units'})
                <input id="op-qty" type="number" min={type==='Physical Count'?'0':'1'} step="1" required className="font-mono" value={quantity} onChange={e=>setQuantity(e.target.value)}/>
                {type==='Delivery'&&<span style={{ fontSize:'10px', color:'var(--muted)', marginTop:'4px' }}>Available: {sourceStock.toLocaleString('en-IN')} {selectedProduct?.unit}</span>}
              </label>
              {type==='Delivery'&&(
                <div className="full" style={{ background:'var(--surface-soft)', border:'1px solid var(--line)', borderRadius:'10px', padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
                  <span style={{ fontSize:'9px', fontWeight:800, color:'var(--green)' }}>DISPATCH CHECKLIST</span>
                  <label style={{ flexDirection:'row', alignItems:'center', gap:'8px' }}><input type="checkbox" checked={picked} onChange={e=>setPicked(e.target.checked)} style={{ minHeight:'auto' }}/><span>Items picked from storage</span></label>
                  <label style={{ flexDirection:'row', alignItems:'center', gap:'8px' }}><input type="checkbox" checked={packed} onChange={e=>setPacked(e.target.checked)} style={{ minHeight:'auto' }}/><span>Parcel packed and verified</span></label>
                </div>
              )}
              <label className="full" htmlFor="op-notes">Notes / PO Reference<input id="op-notes" placeholder="e.g. PO-98144" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
            </div>
            <div className="dialog-actions">
              <button type="button" className="soft-button" onClick={onClose} disabled={isSaving}>Cancel</button>
              <button type="button" className="soft-button" disabled={isSaving} onClick={async()=>{ setIsSaving(true); await onSave(buildPayload('Draft'),false); setIsSaving(false); }}>Save as Draft</button>
              <button type="submit" className="next-primary" disabled={isSaving} aria-busy={isSaving}>{isSaving?'Posting…':'Validate & Post Stock'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ProductFormDialog ────────────────────────────────────────
function ProductFormDialog({ product, categories, state, onClose, onSave }) {
  const [sku, setSku] = useState(product?.sku||'');
  const [name, setName] = useState(product?.name||'');
  const [category, setCategory] = useState(product?.category||categories[0]||'');
  const [newCategory, setNewCategory] = useState('');
  const [useNew, setUseNew] = useState(!categories.length);
  const [unit, setUnit] = useState(product?.unit||'units');
  const [reorderLevel, setReorderLevel] = useState(product?.reorderLevel??10);
  const [description, setDescription] = useState(product?.description||'');
  const [formError, setFormError] = useState('');
  const validUnits = ['units','kilograms','litres','metres','pairs','boxes','pcs'];

  const handleSubmit = e => {
    e.preventDefault(); setFormError('');
    const finalCat = useNew ? newCategory.trim() : category;
    if (!finalCat) { setFormError('Please enter or select a category.'); return; }
    const finalSku = sku.trim().toUpperCase();
    const dup = state.products.find(p => p.sku.toLowerCase()===finalSku.toLowerCase() && p.id!==product?.id);
    if (dup) { setFormError(`SKU "${finalSku}" already exists.`); return; }
    onSave({ id:product?.id||generateId('prod'), sku:finalSku, name:name.trim(), category:finalCat, unit, reorderLevel:Number(reorderLevel), description:description.trim() });
  };

  return (
    <div className="dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Product form">
      <div className="next-dialog" onClick={e=>e.stopPropagation()}>
        <header><h2>{product?.sku?'Edit Product':'New Product'}</h2><button onClick={onClose} aria-label="Close"><X size={16}/></button></header>
        <form onSubmit={handleSubmit} noValidate>
          <div className="dialog-body">
            {formError&&<div role="alert" style={{ background:'#fff3f3', border:'1px solid #f5c6c6', borderRadius:'10px', padding:'12px', marginBottom:'16px', color:'#7d2a25', fontSize:'11px', display:'flex', gap:'8px' }}><AlertTriangle size={16}/><span>{formError}</span></div>}
            <div className="next-form-grid">
              <label htmlFor="p-sku">SKU (unique)<input id="p-sku" required value={sku} onChange={e=>setSku(e.target.value)} className="font-mono" placeholder="e.g. WIDGET-001"/></label>
              <label htmlFor="p-unit">Unit<select id="p-unit" value={unit} onChange={e=>setUnit(e.target.value)}>{validUnits.map(u=><option key={u} value={u}>{u}</option>)}</select></label>
              <label className="full" htmlFor="p-name">Product Name<input id="p-name" required value={name} onChange={e=>setName(e.target.value)} placeholder="Full product name"/></label>
              <label htmlFor="p-cat">
                Category
                {!useNew ? <select id="p-cat" value={category} onChange={e=>setCategory(e.target.value)}>{categories.length?categories.map(c=><option key={c} value={c}>{c}</option>):<option value="">Select</option>}</select> : <input id="p-cat" required value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="New category name"/>}
                <button type="button" style={{ fontSize:'10px', color:'var(--green)', background:'none', border:'none', padding:'4px 0', cursor:'pointer' }} onClick={()=>setUseNew(!useNew)}>{useNew?'← Use existing':'+ New category'}</button>
              </label>
              <label htmlFor="p-reorder">Reorder Threshold<input id="p-reorder" type="number" min="0" required value={reorderLevel} onChange={e=>setReorderLevel(e.target.value)} className="font-mono"/></label>
              <label className="full" htmlFor="p-desc">Description (optional)<textarea id="p-desc" rows="2" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Specs or notes"/></label>
            </div>
            <div className="dialog-actions"><button type="button" className="soft-button" onClick={onClose}>Cancel</button><button type="submit" className="next-primary">Save Product</button></div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── WarehouseFormDialog ──────────────────────────────────────
function WarehouseFormDialog({ warehouse, state, onClose, onSave }) {
  const [code, setCode] = useState(warehouse?.code||'');
  const [name, setName] = useState(warehouse?.name||'');
  const [address, setAddress] = useState(warehouse?.address||'');
  const [active, setActive] = useState(warehouse?.active??true);
  const [formError, setFormError] = useState('');

  const handleSubmit = e => {
    e.preventDefault(); setFormError('');
    const fc = code.trim().toUpperCase();
    const dup = state.warehouses.find(w => w.code.toLowerCase()===fc.toLowerCase() && w.id!==warehouse?.id);
    if (dup) { setFormError(`Warehouse code "${fc}" already exists.`); return; }
    onSave({ id:warehouse?.id||generateId('wh'), code:fc, name:name.trim(), address:address.trim(), active });
  };

  return (
    <div className="dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Warehouse form">
      <div className="next-dialog" onClick={e=>e.stopPropagation()}>
        <header><h2>{warehouse?.name?'Edit Warehouse':'Add Warehouse'}</h2><button onClick={onClose} aria-label="Close"><X size={16}/></button></header>
        <form onSubmit={handleSubmit} noValidate>
          <div className="dialog-body">
            {formError&&<div role="alert" style={{ background:'#fff3f3', border:'1px solid #f5c6c6', borderRadius:'10px', padding:'12px', marginBottom:'16px', color:'#7d2a25', fontSize:'11px', display:'flex', gap:'8px' }}><AlertTriangle size={16}/><span>{formError}</span></div>}
            <div className="next-form-grid">
              <label htmlFor="wh-code">Code (unique)<input id="wh-code" required value={code} onChange={e=>setCode(e.target.value)} className="font-mono" placeholder="e.g. WH-MAIN"/></label>
              <label htmlFor="wh-name">Name<input id="wh-name" required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Central Distribution Hub"/></label>
              <label className="full" htmlFor="wh-addr">Address / Description<input id="wh-addr" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street address or zone"/></label>
              <label className="full" style={{ flexDirection:'row', alignItems:'center', gap:'8px' }}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} style={{ minHeight:'auto' }}/><span>Facility is active</span></label>
            </div>
            <div className="dialog-actions"><button type="button" className="soft-button" onClick={onClose}>Cancel</button><button type="submit" className="next-primary">Save Warehouse</button></div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── LocationFormDialog ───────────────────────────────────────
function LocationFormDialog({ location, warehouses, onClose, onSave }) {
  const [warehouseId, setWarehouseId] = useState(location?.warehouseId||warehouses[0]?.id||'');
  const [code, setCode] = useState(location?.code||'');
  const [locName, setLocName] = useState(location?.name||'');
  const [type, setType] = useState(location?.type||'Rack');
  const [active, setActive] = useState(location?.active??true);

  if (!warehouses.length) return (
    <div className="dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add location">
      <div className="next-dialog" onClick={e=>e.stopPropagation()}>
        <header><h2>Add Location</h2><button onClick={onClose} aria-label="Close"><X size={16}/></button></header>
        <div className="dialog-body"><div className="next-empty"><span><Building2 size={28}/></span><strong>No Warehouses</strong><p>Create a warehouse first.</p></div></div>
      </div>
    </div>
  );

  return (
    <div className="dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Location form">
      <div className="next-dialog" onClick={e=>e.stopPropagation()}>
        <header><h2>{location?.name?'Edit Location':'Add Location'}</h2><button onClick={onClose} aria-label="Close"><X size={16}/></button></header>
        <form onSubmit={e=>{ e.preventDefault(); onSave({ id:location?.id||generateId('loc'), warehouseId, code:code.trim().toUpperCase(), name:locName.trim(), type, active }); }} noValidate>
          <div className="dialog-body">
            <div className="next-form-grid">
              <label htmlFor="loc-wh">Warehouse<select id="loc-wh" value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}>{warehouses.map(wh=><option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>)}</select></label>
              <label htmlFor="loc-type">Type<select id="loc-type" value={type} onChange={e=>setType(e.target.value)}>{['Rack','Bin','Shelf','Floor','Dock','Cold Zone','Staging'].map(t=><option key={t} value={t}>{t}</option>)}</select></label>
              <label htmlFor="loc-code">Code<input id="loc-code" required value={code} onChange={e=>setCode(e.target.value)} className="font-mono" placeholder="e.g. WH1-RACK-A01"/></label>
              <label className="full" htmlFor="loc-name">Location Name<input id="loc-name" required value={locName} onChange={e=>setLocName(e.target.value)} placeholder="e.g. High-Bay Rack A-01"/></label>
              <label className="full" style={{ flexDirection:'row', alignItems:'center', gap:'8px' }}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} style={{ minHeight:'auto' }}/><span>Location is active</span></label>
            </div>
            <div className="dialog-actions"><button type="button" className="soft-button" onClick={onClose}>Cancel</button><button type="submit" className="next-primary">Save Location</button></div>
          </div>
        </form>
      </div>
    </div>
  );
}
