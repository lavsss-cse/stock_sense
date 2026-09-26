import { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, Boxes,
  Building2, Check, CheckCircle2, ChevronDown, ChevronRight, CircleUserRound,
  ClipboardCheck, Clock3, Database, Eye, EyeOff, FileText, Filter, History,
  LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, MoreHorizontal, Package,
  PackageCheck, PackageOpen, Plus, RefreshCw, Search, Settings, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, Truck, Warehouse, X, XCircle,
} from 'lucide-react';
import {
  balanceAt, formatDate, loadState, locationLabel, productTotal, saveState, uid,
} from './store.js';
import { api, ApiError } from './api.js';
import { AppStateSchema } from './domain.js';

const PAGE_META = {
  dashboard: ['Overview', 'Dashboard', 'A clear view of your inventory, movements, and the work that needs attention.'],
  products: ['Inventory catalogue', 'Products', 'Create products, monitor availability by location, and keep replenishment rules current.'],
  operations: ['Stock workflows', 'Operations', 'Receive, deliver, transfer, and reconcile stock through controlled inventory documents.'],
  history: ['Audit trail', 'Move history', 'Every validated stock movement, preserved as a clear and searchable ledger.'],
  settings: ['Workspace controls', 'Warehouses & settings', 'Manage warehouse locations and the foundations of your StockSense workspace.'],
  profile: ['Account', 'My profile', 'Your role, preferences, and secure session details.'],
};

const OPERATION_META = {
  receipt: { label: 'Receipts', singular: 'Receipt', icon: ArrowDownLeft, tone: 'green', prefix: 'REC' },
  delivery: { label: 'Deliveries', singular: 'Delivery', icon: ArrowUpRight, tone: 'amber', prefix: 'DEL' },
  transfer: { label: 'Internal transfers', singular: 'Transfer', icon: RefreshCw, tone: 'blue', prefix: 'TRF' },
  adjustment: { label: 'Adjustments', singular: 'Adjustment', icon: SlidersHorizontal, tone: 'violet', prefix: 'ADJ' },
};

const STATUS_TONE = { Done: 'success', Ready: 'info', Waiting: 'warning', Draft: 'neutral', Cancelled: 'danger' };

function Logo({ compact = false }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}>
    <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
    {!compact && <span><strong>StockSense</strong><small>Inventory, clearly.</small></span>}
  </div>;
}

function Badge({ children, tone = 'neutral', dot = false }) {
  return <span className={`badge ${tone}`}>{dot && <i />}{children}</span>;
}

function BrandedLoader({ message = 'Preparing your workspace' }) {
  return <div className="loader-screen" role="status" aria-live="polite">
    <div className="loader-orbit"><div className="loader-logo"><Logo compact /></div><i /><i /><i /></div>
    <h1>{message}</h1>
    <p>Syncing inventory, movements, and workspace preferences.</p>
    <div className="loader-line"><span /></div>
  </div>;
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span className="eyebrow">StockSense workflow</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

function Toast({ toast, clear }) {
  useEffect(() => { const timer = setTimeout(clear, 3600); return () => clearTimeout(timer); }, [toast, clear]);
  return <div className={`toast ${toast.tone || 'success'}`} role="status">
    {toast.tone === 'danger' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
    <div><strong>{toast.title}</strong><span>{toast.message}</span></div>
    <button aria-label="Dismiss" onClick={clear}><X size={17} /></button>
  </div>;
}

function Login({ onLogin, theme, toggleTheme }) {
  const [email, setEmail] = useState('manager@stocksense.demo');
  const [password, setPassword] = useState('demo1234');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authModal, setAuthModal] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!email.includes('@') || password.length < 6) { setError('Enter a valid email and a password of at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try { await onLogin(email, password); }
    catch (requestError) { setError(requestError.message || 'Unable to sign in. Check that the StockSense server is running.'); setLoading(false); }
  }
  return <main className="login-page">
    <section className="login-brand-panel">
      <Logo />
      <div className="brand-copy">
        <Badge tone="glass" dot>Systems operational</Badge>
        <h1>Know what you have.<br /><em>Move with confidence.</em></h1>
        <p>One calm workspace for every product, warehouse, receipt, delivery, transfer, and stock decision.</p>
        <ul>
          <li><span><PackageCheck size={18} /></span><div><strong>Live stock clarity</strong><small>Availability across every warehouse and location.</small></div></li>
          <li><span><History size={18} /></span><div><strong>A dependable ledger</strong><small>Every validated movement, automatically recorded.</small></div></li>
          <li><span><AlertTriangle size={18} /></span><div><strong>Act before stock runs out</strong><small>Reordering thresholds and visible exceptions.</small></div></li>
        </ul>
      </div>
      <div className="brand-footer"><Database size={15} /><span>Encrypted demo workspace</span><i /><span>Live sync</span></div>
    </section>
    <section className="login-form-panel">
      <button className="theme-float" onClick={toggleTheme} aria-label="Toggle color theme">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">Welcome to StockSense</span>
        <h2>Sign in to your workspace</h2>
        <p>Use the prepared demo account or your team credentials.</p>
        {error && <div className="form-alert danger"><AlertTriangle size={17} />{error}</div>}
        <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" /></label>
        <label>Password<div className="password-field"><input type={visible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <div className="login-options"><label className="checkbox"><input type="checkbox" defaultChecked />Keep me signed in</label><button type="button" className="text-btn" onClick={() => setAuthModal('reset')}>Forgot password?</button></div>
        <button className="btn primary full" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} />Authenticating…</> : <>Sign in securely<ArrowRight size={18} /></>}</button>
        <div className="demo-account"><div><CircleUserRound size={19} /><span><strong>Inventory Manager demo</strong><small>manager@stocksense.demo · demo1234</small></span></div><button type="button" onClick={() => { setEmail('manager@stocksense.demo'); setPassword('demo1234'); }}>Use</button></div>
        <p className="signup-copy">New to StockSense? <button type="button" className="text-btn" onClick={() => setAuthModal('signup')}>Create an account</button></p>
        <div className="security-note"><ShieldCheck size={16} />Protected session · No real credentials are transmitted in this prototype.</div>
      </form>
    </section>
    {authModal && <AuthMiniModal type={authModal} onClose={() => setAuthModal(null)} />}
  </main>;
}

function AuthMiniModal({ type, onClose }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isReset = type === 'reset';
  async function submit(event) {
    event.preventDefault();
    const value = email.trim();
    if (!value.includes('@')) { setError('Enter a valid work email.'); return; }
    setError(''); setLoading(true);
    try { await api.requestOtp(value); setSent(true); }
    catch (requestError) { setError(requestError.message || 'We could not send the verification code.'); }
    finally { setLoading(false); }
  }
  return <Modal title={sent ? 'Check your inbox' : isReset ? 'Reset your password' : 'Create your account'} subtitle={sent ? 'A six-digit verification code has been generated for this prototype.' : isReset ? 'We will send a one-time password to your email.' : 'Set up a secure Inventory Manager profile.'} onClose={onClose}>
    {sent ? <div className="success-state"><span><Check size={24} /></span><h3>Verification code: 482 913</h3><p>Use this demo OTP to continue. In production, this would be delivered securely.</p><button className="btn primary" onClick={onClose}>Return to sign in</button></div> : <form onSubmit={submit} className="form-stack">
      {!isReset && <label>Full name<input required placeholder="e.g. Maya Chen" /></label>}
      <label>Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
      {!isReset && <label>Company name<input required placeholder="Your organization" /></label>}
      {error && <div className="form-alert danger"><AlertTriangle size={17} />{error}</div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} />Sending…</> : isReset ? 'Send OTP' : 'Create account'}</button></div>
    </form>}
  </Modal>;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('stocksense-session') === 'active' && Boolean(sessionStorage.getItem('stocksense-token')));
  const [user, setUser] = useState(() => { try { return JSON.parse(sessionStorage.getItem('stocksense-user')) || { name: 'Maya Chen', email: 'manager@stocksense.demo', role: 'Inventory Manager', workspace: 'Arbor & Co.' }; } catch { return { name: 'Maya Chen', email: 'manager@stocksense.demo', role: 'Inventory Manager', workspace: 'Arbor & Co.' }; } });
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState('dashboard');
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [backendOnline, setBackendOnline] = useState(false);
  const hydrated = useRef(false);
  const revision = useRef(1);
  const suppressSave = useRef(false);
  const saveTimer = useRef(null);
  const pendingSave = useRef(Promise.resolve());

  useEffect(() => {
    if (!authenticated) {
      hydrated.current = false;
      setBackendOnline(false);
      setBooting(false);
      return undefined;
    }
    let active = true;
    setBooting(true);
    api.getState().then((snapshot) => {
      if (active) {
        revision.current = snapshot.revision;
        suppressSave.current = true;
        setState(snapshot.state);
        setBackendOnline(true);
      }
    }).catch((error) => {
      setBackendOnline(false);
      if (error instanceof ApiError && error.status === 401) {
        sessionStorage.removeItem('stocksense-session');
        sessionStorage.removeItem('stocksense-token');
        setAuthenticated(false);
      } else if (active) setToast({ title: 'Backend unavailable', message: error.message, tone: 'danger' });
    }).finally(() => {
      hydrated.current = true;
      setTimeout(() => active && setBooting(false), 350);
    });
    return () => { active = false; };
  }, [authenticated]);
  useEffect(() => {
    saveState(state);
    if (!hydrated.current || !authenticated) return undefined;
    if (suppressSave.current) { suppressSave.current = false; return undefined; }
    const parsed = AppStateSchema.safeParse(state);
    if (!parsed.success) {
      setBackendOnline(false);
      setToast({ title: 'Validation stopped an unsafe change', message: parsed.error.issues[0]?.message || 'Inventory data is invalid.', tone: 'danger' });
      return undefined;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      pendingSave.current = pendingSave.current.then(() => api.saveState(parsed.data, revision.current)).then((snapshot) => {
        revision.current = snapshot.revision;
        setBackendOnline(true);
      }).catch(async (error) => {
        setBackendOnline(false);
        if (error instanceof ApiError && error.status === 409) {
          const latest = await api.getState();
          revision.current = latest.revision;
          suppressSave.current = true;
          setState(latest.state);
          setToast({ title: 'Inventory refreshed', message: 'Another session saved first, so the latest server copy was loaded.', tone: 'danger' });
        } else setToast({ title: 'Save failed', message: error.message, tone: 'danger' });
      });
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [state, authenticated]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || !authenticated) return;
    const lifecycle = new AbortController();
    const report = () => {};
    try {
      void Promise.resolve(context.registerTool({
        name: 'get_inventory_summary',
        title: 'Get inventory summary',
        description: 'Read current StockSense product totals, low-stock count, pending operations, and warehouse count.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute() {
          return {
            products: state.products.length,
            unitsInStock: state.balances.reduce((sum, item) => sum + Number(item.quantity), 0),
            lowOrOutOfStock: state.products.filter((product) => productTotal(state, product.id) <= Number(product.reorderLevel)).length,
            pendingOperations: state.operations.filter((item) => !['Done', 'Cancelled'].includes(item.status)).length,
            warehouses: state.warehouses.length,
          };
        },
      }, { signal: lifecycle.signal })).catch(report);
      void Promise.resolve(context.registerTool({
        name: 'start_stock_operation',
        title: 'Start stock operation',
        description: 'Open the visible StockSense form for a receipt, delivery, internal transfer, or inventory adjustment.',
        inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['receipt', 'delivery', 'transfer', 'adjustment'] } }, required: ['type'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!OPERATION_META[input?.type]) throw new Error('Unsupported operation type.');
          setPage('operations'); setModal({ type: 'operation', operationType: input.type });
          return { opened: true, operationType: input.type };
        },
      }, { signal: lifecycle.signal })).catch(report);
    } catch { /* WebMCP is optional in unsupported browsers. */ }
    return () => lifecycle.abort();
  }, [authenticated, state]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem('stocksense-theme', next);
  }
  async function login(email, password) {
    const data = await api.login(email, password);
    sessionStorage.setItem('stocksense-token', data.token);
    sessionStorage.setItem('stocksense-user', JSON.stringify(data.user));
    setUser(data.user);
    setBackendOnline(true);
    sessionStorage.setItem('stocksense-session', 'active'); setAuthenticated(true); setBooting(true); setTimeout(() => setBooting(false), 700);
  }
  function logout() { void api.logout(); sessionStorage.removeItem('stocksense-session'); sessionStorage.removeItem('stocksense-token'); sessionStorage.removeItem('stocksense-user'); setAuthenticated(false); setPage('dashboard'); }
  function navigate(next) { setPage(next); setMobileNav(false); setQuickSearch(''); setNotificationsOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function notify(title, message, tone = 'success') { setToast({ title, message, tone }); }
  function applySnapshot(snapshot) {
    revision.current = snapshot.revision;
    suppressSave.current = true;
    setState(snapshot.state);
    setBackendOnline(true);
  }
  async function submitOperation(operation, validate) {
    clearTimeout(saveTimer.current);
    await pendingSave.current;
    const snapshot = await api.saveOperation(state, operation, validate, revision.current);
    applySnapshot(snapshot);
    return snapshot.state;
  }
  async function resetWorkspace() {
    clearTimeout(saveTimer.current);
    await pendingSave.current;
    applySnapshot(await api.reset(revision.current));
  }

  if (booting) return <BrandedLoader />;
  if (!authenticated) return <Login onLogin={login} theme={theme} toggleTheme={toggleTheme} />;

  const meta = PAGE_META[page];
  const unread = state.notifications.filter((item) => !item.read).length;
  const pendingOperations = state.operations.filter((item) => !['Done', 'Cancelled'].includes(item.status)).length;
  const quickResults = quickSearch ? [
    ...state.products.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(quickSearch.toLowerCase())).map((item) => ({ label: item.name, sub: item.sku, page: 'products' })),
    ...state.operations.filter((item) => `${item.id} ${item.partner || ''}`.toLowerCase().includes(quickSearch.toLowerCase())).map((item) => ({ label: item.id, sub: OPERATION_META[item.type].singular, page: 'operations' })),
  ].slice(0, 6) : [];

  const common = { state, setState, setModal, notify, submitOperation };
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <Sidebar page={page} navigate={navigate} mobileNav={mobileNav} logout={logout} backendOnline={backendOnline} user={user} pendingOperations={pendingOperations} />
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <div className="app-main">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb"><span>StockSense</span><ChevronRight size={14} /><strong>{meta[1]}</strong></div></div>
        <div className="topbar-actions">
          <div className="quick-find"><Search size={17} /><input value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)} placeholder="Quick find…" aria-label="Quick find" />{quickSearch && <button onClick={() => setQuickSearch('')} aria-label="Clear search"><X size={15} /></button>}
            {quickSearch && <div className="quick-results">{quickResults.length ? quickResults.map((result, index) => <button key={`${result.label}-${index}`} onClick={() => navigate(result.page)}><Search size={15} /><span><strong>{result.label}</strong><small>{result.sub}</small></span><ArrowRight size={15} /></button>) : <div className="no-results">No matching records</div>}</div>}
          </div>
          <Badge tone="environment">DEMO</Badge>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle color theme">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
          <div className="notification-wrap"><button className="icon-btn" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label={`${unread} unread notifications`}><Bell size={19} />{unread > 0 && <span className="notification-count">{unread}</span>}</button>{notificationsOpen && <NotificationPanel state={state} setState={setState} close={() => setNotificationsOpen(false)} navigate={navigate} />}</div>
        </div>
      </header>
      <main id="main-content" className="content">
        {page === 'dashboard' && <Dashboard {...common} navigate={navigate} user={user} />}
        {page === 'products' && <Products {...common} />}
        {page === 'operations' && <Operations {...common} />}
        {page === 'history' && <MoveHistory {...common} />}
        {page === 'settings' && <SettingsPage {...common} theme={theme} toggleTheme={toggleTheme} resetWorkspace={resetWorkspace} />}
        {page === 'profile' && <ProfilePage logout={logout} theme={theme} toggleTheme={toggleTheme} notify={notify} user={user} setUser={setUser} />}
      </main>
      <footer className="app-footer"><span><i className={`status-dot ${backendOnline ? '' : 'offline'}`} />{backendOnline ? 'Cloud database connected · Synced just now' : 'Backend disconnected · Changes are not synced'}</span><span>INR · Asia/Kolkata · Production demo</span></footer>
    </div>
    {modal?.type === 'product' && <ProductModal state={state} setState={setState} product={modal.product} onClose={() => setModal(null)} notify={notify} />}
    {modal?.type === 'operation' && <OperationModal state={state} submitOperation={submitOperation} operationType={modal.operationType} operation={modal.operation} onClose={() => setModal(null)} notify={notify} />}
    {modal?.type === 'operationDetail' && <OperationDetail state={state} submitOperation={submitOperation} operation={modal.operation} onClose={() => setModal(null)} notify={notify} />}
    {modal?.type === 'warehouse' && <WarehouseModal state={state} setState={setState} warehouse={modal.warehouse} onClose={() => setModal(null)} notify={notify} />}
    {toast && <Toast toast={toast} clear={() => setToast(null)} />}
  </div>;
}

function Sidebar({ page, navigate, mobileNav, logout, backendOnline, user, pendingOperations }) {
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'operations', label: 'Operations', icon: ClipboardCheck },
    { id: 'history', label: 'Move history', icon: History },
  ];
  return <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
    <div className="sidebar-head"><Logo /><button className="sidebar-close" onClick={() => navigate(page)} aria-label="Close navigation"><X size={19} /></button></div>
    <button className="workspace-selector"><span>AC</span><div><small>Workspace</small><strong>{user.workspace || 'Arbor & Co.'}</strong></div><ChevronDown size={16} /></button>
    <nav aria-label="Main navigation"><span className="nav-label">Workspace</span>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{id === 'operations' && pendingOperations > 0 && <Badge tone="sidebar">{pendingOperations}</Badge>}</button>)}<span className="nav-label spaced">Manage</span><button className={page === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings size={19} /><span>Settings</span></button></nav>
    <div className="sidebar-status"><div><Database size={17} /><span><strong>{backendOnline ? 'Database live' : 'Backend offline'}</strong><small>{backendOnline ? 'D1 · synced moments ago' : 'Reconnect to save changes'}</small></span></div><span className={`pulse ${backendOnline ? '' : 'offline'}`} /></div>
    <div className="sidebar-profile"><button onClick={() => navigate('profile')}><span className="avatar">{(user.name || 'M C').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span><strong>{user.name || 'Maya Chen'}</strong><small>{user.role || 'Inventory Manager'}</small></span><MoreHorizontal size={18} /></button><button className="logout-btn" onClick={logout}><LogOut size={17} /><span>Sign out</span></button></div>
  </aside>;
}

function NotificationPanel({ state, setState, close, navigate }) {
  function markAll() { setState((prev) => ({ ...prev, notifications: prev.notifications.map((item) => ({ ...item, read: true })) })); }
  return <div className="notification-panel"><header><div><span className="eyebrow">Updates</span><h3>Notifications</h3></div><button className="text-btn" onClick={markAll}>Mark all read</button></header><div className="notification-list">{state.notifications.map((item) => <button key={item.id} className={!item.read ? 'unread' : ''} onClick={() => { setState((prev) => ({ ...prev, notifications: prev.notifications.map((n) => n.id === item.id ? { ...n, read: true } : n) })); close(); navigate('products'); }}><i /><span><strong>{item.title}</strong><small>{item.body}</small></span></button>)}</div><footer><button className="text-btn" onClick={() => { close(); navigate('history'); }}>View activity ledger <ArrowRight size={15} /></button></footer></div>;
}

function EditorialHeader({ category, title, description, children, accent = 'green' }) {
  return <section className={`editorial-header ${accent}`}><div className="orb" /><div className="editorial-copy"><span className="eyebrow">{category}</span><h1>{title}</h1><p>{description}</p></div>{children && <div className="editorial-actions">{children}</div>}</section>;
}

function MetricCard({ label, value, detail, icon: Icon, tone = 'green', onClick }) {
  const content = <><div className={`metric-icon ${tone}`}><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></>;
  return onClick ? <button className="metric-card actionable" onClick={onClick}>{content}<ChevronRight size={18} /></button> : <article className="metric-card">{content}</article>;
}

function EmptyState({ icon: Icon = PackageOpen, title, body, action }) {
  return <div className="empty-state"><span><Icon size={26} /></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function Dashboard({ state, setModal, navigate, user }) {
  const totalUnits = state.balances.reduce((sum, item) => sum + Number(item.quantity), 0);
  const stockedProducts = state.products.filter((product) => productTotal(state, product.id) > 0).length;
  const lowStock = state.products.filter((product) => productTotal(state, product.id) <= Number(product.reorderLevel));
  const pendingReceipts = state.operations.filter((item) => item.type === 'receipt' && !['Done', 'Cancelled'].includes(item.status)).length;
  const pendingDeliveries = state.operations.filter((item) => item.type === 'delivery' && !['Done', 'Cancelled'].includes(item.status)).length;
  const transfers = state.operations.filter((item) => item.type === 'transfer' && !['Done', 'Cancelled'].includes(item.status)).length;
  const done = state.operations.filter((item) => item.status === 'Done').length;
  const completion = Math.round((done / Math.max(state.operations.length, 1)) * 100);
  const recent = [...state.operations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return <>
    <EditorialHeader category={dateLabel} title={`Good morning, ${(user.name || 'Maya').split(' ')[0]}.`} description={lowStock.length ? `${lowStock.length} ${lowStock.length === 1 ? 'item needs' : 'items need'} attention. ${state.operations.length - done} ${state.operations.length - done === 1 ? 'operation is' : 'operations are'} still moving through the workspace.` : 'Your inventory is in good shape. Keep the flow moving with a quick action below.'}>
      <button className="btn secondary" onClick={() => navigate('history')}><History size={18} />View ledger</button><button className="btn primary" onClick={() => setModal({ type: 'operation', operationType: 'receipt' })}><Plus size={18} />New receipt</button>
    </EditorialHeader>
    <section className="metrics-grid" aria-label="Inventory metrics">
      <MetricCard label="Products in stock" value={`${stockedProducts}/${state.products.length}`} detail={`${totalUnits.toLocaleString('en-IN')} units across locations`} icon={Boxes} onClick={() => navigate('products')} />
      <MetricCard label="Low / out of stock" value={lowStock.length} detail={lowStock.length ? 'Requires replenishment' : 'All levels healthy'} icon={AlertTriangle} tone="red" onClick={() => navigate('products')} />
      <MetricCard label="Pending receipts" value={pendingReceipts} detail="Incoming goods" icon={ArrowDownLeft} tone="blue" onClick={() => navigate('operations')} />
      <MetricCard label="Pending deliveries" value={pendingDeliveries} detail="Awaiting dispatch" icon={Truck} tone="amber" onClick={() => navigate('operations')} />
      <MetricCard label="Transfers scheduled" value={transfers} detail="Between locations" icon={RefreshCw} tone="violet" onClick={() => navigate('operations')} />
    </section>
    <div className="dashboard-grid">
      <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">Today’s flow</span><h2>Recent operations</h2></div><button className="text-btn" onClick={() => navigate('operations')}>View all <ArrowRight size={15} /></button></div>
        <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Type</th><th>Partner / route</th><th>Status</th><th>Date</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id} onClick={() => setModal({ type: 'operationDetail', operation: item })}><td><strong className="mono">{item.id}</strong></td><td>{OPERATION_META[item.type].singular}</td><td>{item.partner || `${locationLabel(state, item.sourceId)} → ${locationLabel(state, item.destinationId)}`}</td><td><Badge tone={STATUS_TONE[item.status]} dot>{item.status}</Badge></td><td>{formatDate(item.date)}</td></tr>)}</tbody></table></div>
      </section>
      <aside className="dashboard-side">
        <section className="panel progress-panel"><div className="panel-heading"><div><span className="eyebrow">Operations</span><h2>Completion health</h2></div><Badge tone="success" dot>On track</Badge></div><div className="progress-content"><div className="progress-ring" style={{ '--value': `${completion * 3.6}deg` }}><div><strong>{completion}%</strong><span>complete</span></div></div><div className="progress-legend"><p><span className="legend-dot done" />Validated<strong>{done}</strong></p><p><span className="legend-dot ready" />In progress<strong>{state.operations.length - done}</strong></p><p><span className="legend-dot draft" />Total documents<strong>{state.operations.length}</strong></p></div></div></section>
        <section className="panel quick-actions"><div className="panel-heading"><div><span className="eyebrow">Shortcuts</span><h2>Quick actions</h2></div></div><div>{Object.entries(OPERATION_META).map(([key, info]) => { const Icon = info.icon; return <button key={key} onClick={() => setModal({ type: 'operation', operationType: key })}><span className={info.tone}><Icon size={18} /></span><div><strong>New {info.singular.toLowerCase()}</strong><small>{key === 'receipt' ? 'Record incoming goods' : key === 'delivery' ? 'Prepare outgoing stock' : key === 'transfer' ? 'Move between locations' : 'Reconcile a physical count'}</small></div><ChevronRight size={17} /></button>; })}</div></section>
      </aside>
    </div>
    <section className="panel attention-panel"><div className="panel-heading"><div><span className="eyebrow">Business health</span><h2>Stock requiring attention</h2></div><button className="text-btn" onClick={() => navigate('products')}>Open products <ArrowRight size={15} /></button></div><div className="attention-grid">{lowStock.map((product) => { const quantity = productTotal(state, product.id); return <article key={product.id}><span className={quantity === 0 ? 'danger' : 'warning'}>{quantity === 0 ? <XCircle size={20} /> : <AlertTriangle size={20} />}</span><div><strong>{product.name}</strong><small>{product.sku} · Reorder at {product.reorderLevel} {product.unit}</small></div><div><strong>{quantity}</strong><small>{product.unit} available</small></div></article>; })}</div></section>
  </>;
}

function Products({ state, setState, setModal, notify }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [availability, setAvailability] = useState('All');
  const [sort, setSort] = useState('name');
  const categories = ['All', ...new Set(state.products.map((item) => item.category))];
  const filtered = state.products.filter((product) => {
    const total = productTotal(state, product.id);
    const matchesQuery = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'All' || product.category === category;
    const matchesAvailability = availability === 'All' || (availability === 'In stock' && total > product.reorderLevel) || (availability === 'Low stock' && total > 0 && total <= product.reorderLevel) || (availability === 'Out of stock' && total === 0);
    return matchesQuery && matchesCategory && matchesAvailability;
  }).sort((a, b) => sort === 'stock' ? productTotal(state, b.id) - productTotal(state, a.id) : sort === 'sku' ? a.sku.localeCompare(b.sku) : a.name.localeCompare(b.name));

  function removeProduct(product) {
    if (productTotal(state, product.id) !== 0) { notify('Product cannot be archived', 'Move or adjust its remaining stock to zero first.', 'danger'); return; }
    if (state.operations.some((item) => item.productId === product.id) || state.movements.some((item) => item.productId === product.id)) { notify('Product cannot be archived', 'Its operation and movement history must remain linked for audit integrity.', 'danger'); return; }
    if (!window.confirm(`Archive ${product.name}? This removes it from the active catalogue.`)) return;
    setState((prev) => ({ ...prev, products: prev.products.filter((item) => item.id !== product.id), balances: prev.balances.filter((item) => item.productId !== product.id) }));
    notify('Product archived', `${product.name} was removed from the active catalogue.`);
  }
  return <>
    <EditorialHeader category="Inventory catalogue" title="Products" description="Create products, review availability across every location, and keep reordering rules current.">
      <button className="btn primary" onClick={() => setModal({ type: 'product' })}><Plus size={18} />Create product</button>
    </EditorialHeader>
    <section className="panel page-panel">
      <div className="toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, SKU, or category…" aria-label="Search products" /></div><div className="filter-group"><label><Filter size={16} /><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label><select value={availability} onChange={(e) => setAvailability(e.target.value)} aria-label="Filter by availability"><option>All</option><option>In stock</option><option>Low stock</option><option>Out of stock</option></select></label><label><span className="sr-only">Sort products</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Sort: Name</option><option value="sku">Sort: SKU</option><option value="stock">Sort: Stock</option></select></label></div></div>
      <div className="results-summary"><span>{filtered.length} products</span><span>Stock is aggregated across active locations</span></div>
      {filtered.length ? <div className="product-grid">{filtered.map((product) => {
        const total = productTotal(state, product.id); const low = total <= product.reorderLevel; const out = total === 0;
        const locationBalances = state.balances.filter((item) => item.productId === product.id && item.quantity > 0);
        return <article className="product-card" key={product.id}><header><div className="product-symbol">{product.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><Badge tone={out ? 'danger' : low ? 'warning' : 'success'} dot>{out ? 'Out of stock' : low ? 'Low stock' : 'In stock'}</Badge></header><div className="product-title"><span>{product.category}</span><h3>{product.name}</h3><code>{product.sku}</code></div><div className="stock-total"><strong>{total.toLocaleString('en-IN')}</strong><span>{product.unit} available</span><small>Reorder at {product.reorderLevel} {product.unit}</small></div><div className="location-list">{locationBalances.length ? locationBalances.slice(0, 3).map((balance) => <div key={balance.locationId}><span>{locationLabel(state, balance.locationId)}</span><strong>{balance.quantity} {product.unit}</strong></div>) : <p>No stock at any location</p>}</div><footer><button className="btn subtle" onClick={() => setModal({ type: 'product', product })}>View & edit</button><button className="icon-btn danger-hover" onClick={() => removeProduct(product)} aria-label={`Archive ${product.name}`}><X size={17} /></button></footer></article>;
      })}</div> : <EmptyState title="No products found" body="Try changing your search or filters, or create a new catalogue item." action={<button className="btn primary" onClick={() => setModal({ type: 'product' })}><Plus size={17} />Create product</button>} />}
    </section>
  </>;
}

function Operations({ state, setState, setModal, notify }) {
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('All');
  const [warehouse, setWarehouse] = useState('All');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const filtered = state.operations.filter((item) => {
    const product = state.products.find((p) => p.id === item.productId);
    const locationIds = state.locations.filter((l) => warehouse === 'All' || l.warehouseId === warehouse).map((l) => l.id);
    return (type === 'all' || item.type === type) && (status === 'All' || item.status === status) && (category === 'All' || product?.category === category) && (warehouse === 'All' || locationIds.includes(item.sourceId) || locationIds.includes(item.destinationId)) && `${item.id} ${item.partner || ''} ${product?.name || ''}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => b.date.localeCompare(a.date));
  function createForActive() { setModal({ type: 'operation', operationType: type === 'all' ? 'receipt' : type }); }
  return <>
    <EditorialHeader category="Stock workflows" title="Operations" description="Control incoming goods, customer deliveries, internal transfers, and inventory adjustments from one workspace.">
      <button className="btn primary" onClick={createForActive}><Plus size={18} />New operation</button>
    </EditorialHeader>
    <section className="operation-types">{Object.entries(OPERATION_META).map(([key, info]) => { const Icon = info.icon; const pending = state.operations.filter((item) => item.type === key && !['Done', 'Cancelled'].includes(item.status)).length; return <button key={key} className={type === key ? 'active' : ''} onClick={() => setType(type === key ? 'all' : key)}><span className={info.tone}><Icon size={20} /></span><div><strong>{info.label}</strong><small>{pending} pending</small></div><ChevronRight size={18} /></button>; })}</section>
    <section className="panel page-panel">
      <div className="toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, product, or partner…" /></div><div className="filter-group"><label><Filter size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Draft</option><option>Waiting</option><option>Ready</option><option>Done</option><option>Cancelled</option></select></label><label><select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}><option value="All">All warehouses</option>{state.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><select value={category} onChange={(e) => setCategory(e.target.value)}><option>All</option>{[...new Set(state.products.map((p) => p.category))].map((item) => <option key={item}>{item}</option>)}</select></label></div></div>
      <div className="results-summary"><span>{filtered.length} operations</span><button className="text-btn" onClick={() => { setStatus('All'); setWarehouse('All'); setCategory('All'); setQuery(''); setType('all'); }}>Clear filters</button></div>
      {filtered.length ? <div className="table-wrap responsive-table"><table><thead><tr><th>Reference</th><th>Document type</th><th>Product</th><th>Quantity</th><th>Route / partner</th><th>Status</th><th>Scheduled</th><th aria-label="Actions" /></tr></thead><tbody>{filtered.map((item) => { const product = state.products.find((p) => p.id === item.productId); const Icon = OPERATION_META[item.type].icon; return <tr key={item.id}><td data-label="Reference"><strong className="mono">{item.id}</strong></td><td data-label="Type"><span className="type-cell"><i className={OPERATION_META[item.type].tone}><Icon size={16} /></i>{OPERATION_META[item.type].singular}</span></td><td data-label="Product"><strong>{product?.name}</strong><small>{product?.sku}</small></td><td data-label="Quantity" className="numeric"><strong>{item.quantity}</strong> {product?.unit}</td><td data-label="Route / partner"><span className="route-cell">{item.partner || <>{locationLabel(state, item.sourceId)}<ArrowRight size={14} />{locationLabel(state, item.destinationId)}</>}</span></td><td data-label="Status"><Badge tone={STATUS_TONE[item.status]} dot>{item.status}</Badge></td><td data-label="Scheduled">{formatDate(item.date)}</td><td><button className="btn subtle small" onClick={() => setModal({ type: 'operationDetail', operation: item })}>Open</button></td></tr>; })}</tbody></table></div> : <EmptyState icon={ClipboardCheck} title="No operations match" body="Change your filters or create a new inventory operation." action={<button className="btn primary" onClick={createForActive}><Plus size={17} />New operation</button>} />}
    </section>
  </>;
}

function MoveHistory({ state }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All');
  const [warehouse, setWarehouse] = useState('All');
  const [sort, setSort] = useState('newest');
  const movements = state.movements.filter((movement) => {
    const product = state.products.find((p) => p.id === movement.productId);
    const locationIds = state.locations.filter((l) => warehouse === 'All' || l.warehouseId === warehouse).map((l) => l.id);
    return (type === 'All' || movement.type === type) && (warehouse === 'All' || locationIds.includes(movement.fromId) || locationIds.includes(movement.toId)) && `${movement.operationId} ${product?.name || ''} ${product?.sku || ''}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  return <>
    <EditorialHeader category="Audit trail" title="Move history" description="A permanent ledger of receipts, deliveries, transfers, and stock adjustments validated by your team.">
      <Badge tone="success" dot>Ledger healthy</Badge>
    </EditorialHeader>
    <section className="panel page-panel"><div className="toolbar"><div className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, product, or SKU…" /></div><div className="filter-group"><label><Filter size={16} /><select value={type} onChange={(e) => setType(e.target.value)}><option>All</option>{Object.entries(OPERATION_META).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><label><select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}><option value="All">All warehouses</option>{state.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div></div>
      {movements.length ? <div className="timeline">{movements.map((movement) => { const product = state.products.find((p) => p.id === movement.productId); const Icon = OPERATION_META[movement.type].icon; return <article key={movement.id}><div className={`timeline-icon ${OPERATION_META[movement.type].tone}`}><Icon size={18} /></div><div className="timeline-body"><header><div><Badge tone={STATUS_TONE.Done}>{OPERATION_META[movement.type].singular}</Badge><strong className="mono">{movement.operationId}</strong></div><time>{formatDate(movement.date, true)}</time></header><h3>{product?.name} <code>{product?.sku}</code></h3><p>{movement.type === 'receipt' ? <>Received into <strong>{locationLabel(state, movement.toId)}</strong></> : movement.type === 'delivery' ? <>Delivered from <strong>{locationLabel(state, movement.fromId)}</strong></> : movement.type === 'transfer' ? <>Moved from <strong>{locationLabel(state, movement.fromId)}</strong> to <strong>{locationLabel(state, movement.toId)}</strong></> : <>Adjusted at <strong>{locationLabel(state, movement.fromId || movement.toId)}</strong></>}</p><footer><span>Validated by {movement.user}</span><strong className={movement.type === 'delivery' || movement.quantity < 0 ? 'negative' : movement.type === 'receipt' ? 'positive' : ''}>{movement.type === 'delivery' ? '−' : movement.quantity > 0 && movement.type !== 'transfer' ? '+' : ''}{Math.abs(movement.quantity)} {product?.unit}</strong></footer></div></article>; })}</div> : <EmptyState icon={History} title="No movements found" body="Validated operations will appear here as immutable ledger entries." />}
    </section>
  </>;
}

function SettingsPage({ state, setModal, notify, theme, toggleTheme, resetWorkspace }) {
  async function resetDemo() {
    if (!window.confirm('Reset all prototype data to the original demo records? Your changes will be replaced.')) return;
    try {
      await resetWorkspace();
      notify('Demo data restored', 'The workspace has been reset to its original sample records.');
    } catch (error) { notify('Reset failed', error.message, 'danger'); }
  }
  return <>
    <EditorialHeader category="Workspace controls" title="Warehouses & settings" description="Manage stock locations, workspace preferences, and the foundations of your inventory environment.">
      <button className="btn primary" onClick={() => setModal({ type: 'warehouse' })}><Plus size={18} />Add warehouse</button>
    </EditorialHeader>
    <div className="settings-layout">
      <section className="panel page-panel"><div className="panel-heading"><div><span className="eyebrow">Multi-warehouse support</span><h2>Active warehouses</h2></div><Badge tone="success" dot>{state.warehouses.filter((w) => w.active).length} connected</Badge></div><div className="warehouse-grid">{state.warehouses.map((warehouse) => { const locations = state.locations.filter((l) => l.warehouseId === warehouse.id); const units = state.balances.filter((b) => locations.some((l) => l.id === b.locationId)).reduce((sum, b) => sum + Number(b.quantity), 0); return <article key={warehouse.id}><header><span><Warehouse size={21} /></span><Badge tone={warehouse.active ? 'success' : 'neutral'} dot>{warehouse.active ? 'Active' : 'Paused'}</Badge></header><h3>{warehouse.name}</h3><code>{warehouse.code}</code><p>{warehouse.address}</p><div className="warehouse-stats"><span><strong>{locations.length}</strong> locations</span><span><strong>{units.toLocaleString('en-IN')}</strong> units</span></div><div className="warehouse-locations">{locations.map((location) => <span key={location.id}>{location.name}</span>)}</div><footer><button className="btn subtle" onClick={() => setModal({ type: 'warehouse', warehouse })}>Edit warehouse</button></footer></article>; })}</div></section>
      <aside className="settings-side"><section className="panel preference-card"><span className="eyebrow">Appearance</span><h2>Theme preference</h2><p>Use the interface that suits your environment.</p><button className="theme-choice" onClick={toggleTheme}>{theme === 'dark' ? <Moon size={19} /> : <Sun size={19} />}<span><strong>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</strong><small>Saved on this device</small></span><Badge tone="success">Active</Badge></button></section><section className="panel preference-card"><span className="eyebrow">Regional</span><h2>Workspace format</h2><div className="definition-list"><div><span>Currency</span><strong>INR (₹)</strong></div><div><span>Timezone</span><strong>Asia/Kolkata</strong></div><div><span>Date format</span><strong>DD MMM YYYY</strong></div><div><span>Environment</span><Badge tone="environment">DEMO</Badge></div></div></section><section className="panel danger-card"><span className="eyebrow">Prototype data</span><h2>Reset workspace</h2><p>Restore every product, balance, operation, and ledger entry to the prepared demo state.</p><button className="btn danger" onClick={resetDemo}><RefreshCw size={17} />Reset demo data</button></section></aside>
    </div>
  </>;
}

function ProfilePage({ logout, theme, toggleTheme, notify, user, setUser }) {
  const [name, setName] = useState(user.name || 'Maya Chen');
  const [email, setEmail] = useState(user.email || 'manager@stocksense.demo');
  function saveProfile(event) {
    event.preventDefault();
    const next = { ...user, name: name.trim() || user.name, email: email.trim() || user.email };
    setUser(next);
    sessionStorage.setItem('stocksense-user', JSON.stringify(next));
    notify('Profile updated', 'Your name and work email are saved for this workspace.');
  }
  return <>
    <EditorialHeader category="Account" title="My profile" description="Manage your identity, role, and local workspace preferences." />
    <div className="profile-layout"><section className="panel profile-summary"><div className="profile-avatar">{(user.name || 'M C').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><h2>{user.name}</h2><p>{user.role || 'Inventory Manager'}</p><Badge tone="success" dot>Active session</Badge><div className="profile-facts"><div><Building2 size={18} /><span><small>Workspace</small><strong>{user.workspace || 'Arbor & Co.'}</strong></span></div><div><ShieldCheck size={18} /><span><small>Access</small><strong>Full inventory control</strong></span></div><div><Clock3 size={18} /><span><small>Session</small><strong>Signed in securely</strong></span></div></div><button className="btn secondary full" onClick={logout}><LogOut size={17} />Sign out securely</button></section><section className="panel profile-form"><div className="panel-heading"><div><span className="eyebrow">Personal details</span><h2>Profile information</h2></div></div><form onSubmit={saveProfile} className="form-stack"><div className="form-grid"><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Work email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Role<input value={user.role || 'Inventory Manager'} disabled /></label><label>Default warehouse<select defaultValue="w1"><option value="w1">Main Warehouse</option><option value="w2">Production Floor</option><option value="w3">Distribution Hub</option></select></label></div><div className="setting-row"><div><strong>Interface theme</strong><small>Currently using {theme} mode</small></div><button type="button" className="btn subtle" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}Switch theme</button></div><div className="setting-row"><div><strong>Low-stock notifications</strong><small>Receive alerts when a product reaches its reorder level</small></div><label className="switch"><input type="checkbox" defaultChecked /><span /></label></div><div className="setting-row"><div><strong>Operation reminders</strong><small>Notify me about waiting receipts and deliveries</small></div><label className="switch"><input type="checkbox" defaultChecked /><span /></label></div><div className="modal-actions"><button className="btn primary">Save profile</button></div></form></section></div>
  </>;
}

function ProductModal({ state, setState, product, onClose, notify }) {
  const [form, setForm] = useState(product || { name: '', sku: '', category: '', unit: 'units', reorderLevel: 10, initialStock: 0, locationId: state.locations[0]?.id || '' });
  const [error, setError] = useState('');
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.sku.trim() || !form.category.trim()) { setError('Name, SKU, and category are required.'); return; }
    const duplicate = state.products.some((item) => item.sku.toLowerCase() === form.sku.trim().toLowerCase() && item.id !== product?.id);
    if (duplicate) { setError('This SKU is already in use. Choose a unique code.'); return; }
    if (Number(form.reorderLevel) < 0 || Number(form.initialStock || 0) < 0) { setError('Stock quantities cannot be negative.'); return; }
    const id = product?.id || uid('p');
    const record = { id, name: form.name.trim(), sku: form.sku.trim().toUpperCase(), category: form.category.trim(), unit: form.unit, reorderLevel: Number(form.reorderLevel) };
    setState((prev) => {
      const next = { ...prev, products: product ? prev.products.map((item) => item.id === id ? record : item) : [...prev.products, record] };
      if (!product && Number(form.initialStock) > 0) {
        next.balances = [...prev.balances, { productId: id, locationId: form.locationId, quantity: Number(form.initialStock) }];
        const ref = uid('OPEN');
        next.movements = [{ id: uid('m'), operationId: ref, type: 'receipt', productId: id, quantity: Number(form.initialStock), toId: form.locationId, date: new Date().toISOString(), user: 'Maya Chen' }, ...prev.movements];
      }
      return next;
    });
    notify(product ? 'Product updated' : 'Product created', `${record.name} is ready in the catalogue.`); onClose();
  }
  return <Modal title={product ? 'Edit product' : 'Create a product'} subtitle="Keep catalogue details and replenishment rules consistent." onClose={onClose} wide>
    <form className="form-stack" onSubmit={submit}>{error && <div className="form-alert danger"><AlertTriangle size={17} />{error}</div>}<div className="form-section"><div><span>01</span><h3>Product identity</h3></div><div className="form-grid"><label>Product name<input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Steel Rods" autoFocus /></label><label>SKU / code<input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="e.g. STL-1001" /></label><label>Category<input list="categories" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Select or enter category" /><datalist id="categories">{[...new Set(state.products.map((p) => p.category))].map((item) => <option key={item}>{item}</option>)}</datalist></label><label>Unit of measure<select value={form.unit} onChange={(e) => set('unit', e.target.value)}><option>units</option><option>kg</option><option>litres</option><option>metres</option><option>pairs</option><option>boxes</option></select></label></div></div><div className="form-section"><div><span>02</span><h3>Stock rules</h3></div><div className="form-grid"><label>Reorder level<input type="number" min="0" value={form.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value)} /></label>{!product && <><label>Initial stock <small>(optional)</small><input type="number" min="0" value={form.initialStock} onChange={(e) => set('initialStock', e.target.value)} /></label><label className="span-2">Initial stock location<select value={form.locationId} onChange={(e) => set('locationId', e.target.value)} disabled={!Number(form.initialStock)}>{state.locations.map((item) => <option key={item.id} value={item.id}>{locationLabel(state, item.id)}</option>)}</select></label></>}</div></div><div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">{product ? 'Save changes' : 'Create product'}</button></div></form>
  </Modal>;
}

function WarehouseModal({ state, setState, warehouse, onClose, notify }) {
  const existingLocations = warehouse ? state.locations.filter((l) => l.warehouseId === warehouse.id).map((l) => l.name).join(', ') : '';
  const [form, setForm] = useState(warehouse ? { ...warehouse, locations: existingLocations } : { name: '', code: '', address: '', locations: 'Main Stock' });
  function submit(event) {
    event.preventDefault(); const id = warehouse?.id || uid('w');
    const record = { id, name: form.name.trim(), code: form.code.trim().toUpperCase(), address: form.address.trim(), active: true };
    const names = form.locations.split(',').map((name) => name.trim()).filter(Boolean);
    if (state.warehouses.some((item) => item.code.toLowerCase() === record.code.toLowerCase() && item.id !== id)) { notify('Warehouse not saved', 'This warehouse code is already in use.', 'danger'); return; }
    const oldLocations = state.locations.filter((item) => item.warehouseId === id);
    const removedLocations = oldLocations.slice(names.length);
    if (removedLocations.some((location) => state.balances.some((balance) => balance.locationId === location.id) || state.operations.some((operationItem) => operationItem.sourceId === location.id || operationItem.destinationId === location.id))) { notify('Warehouse not saved', 'A location with stock or operation history cannot be removed. Rename it instead.', 'danger'); return; }
    setState((prev) => ({ ...prev, warehouses: warehouse ? prev.warehouses.map((item) => item.id === id ? record : item) : [...prev.warehouses, record], locations: [...prev.locations.filter((item) => item.warehouseId !== id), ...names.map((name, index) => ({ id: warehouse && state.locations.filter((l) => l.warehouseId === id)[index]?.id || uid('l'), warehouseId: id, name }))] }));
    notify(warehouse ? 'Warehouse updated' : 'Warehouse added', `${record.name} and its locations are ready.`); onClose();
  }
  return <Modal title={warehouse ? 'Edit warehouse' : 'Add a warehouse'} subtitle="Warehouses contain the locations where product stock is stored." onClose={onClose}><form className="form-stack" onSubmit={submit}><label>Warehouse name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. South Distribution Hub" autoFocus /></label><label>Short code<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SOUTH" /></label><label>Address or description<input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, building, or area" /></label><label>Locations <small>(comma-separated)</small><textarea required rows="3" value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder="Rack A, Rack B, Dispatch Zone" /></label><div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">Save warehouse</button></div></form></Modal>;
}

function OperationModal({ state, submitOperation, operationType, operation, onClose, notify }) {
  const meta = OPERATION_META[operationType];
  const defaultLocation = state.locations[0]?.id || '';
  const [form, setForm] = useState(operation || { productId: state.products[0]?.id || '', quantity: '', partner: '', sourceId: defaultLocation, destinationId: state.locations[1]?.id || defaultLocation, date: new Date().toISOString().slice(0, 10), note: '', picked: false, packed: false });
  const [error, setError] = useState('');
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const product = state.products.find((item) => item.id === form.productId);
  const currentAtSource = balanceAt(state, form.productId, form.sourceId);
  const currentAtDestination = balanceAt(state, form.productId, form.destinationId);
  const adjustmentDelta = operationType === 'adjustment' && form.quantity !== '' ? Number(form.quantity) - currentAtSource : 0;
  async function record(status) {
    setError('');
    if (!form.productId || form.quantity === '' || Number(form.quantity) < 0 || (operationType !== 'adjustment' && Number(form.quantity) === 0)) { setError(operationType === 'adjustment' ? 'Choose a product and enter a physical count of zero or more.' : 'Choose a product and enter a quantity greater than zero.'); return; }
    if (operationType === 'receipt' && !form.partner.trim()) { setError('Supplier is required for a receipt.'); return; }
    if (operationType === 'delivery' && !form.partner.trim()) { setError('Customer is required for a delivery.'); return; }
    if (operationType === 'delivery' && status === 'Done' && (!form.picked || !form.packed)) { setError('Confirm that the items are both picked and packed before validation.'); return; }
    const recordData = { ...form, id: operation?.id || uid(meta.prefix), type: operationType, quantity: Number(form.quantity), status, partner: form.partner?.trim(), note: form.note?.trim() };
    try {
      await submitOperation(recordData, status === 'Done');
      notify(status === 'Done' ? `${meta.singular} validated` : `${meta.singular} saved`, status === 'Done' ? `${recordData.id} updated stock and was added to the ledger.` : `${recordData.id} is ${status.toLowerCase()} and has not changed stock.`);
      onClose();
    } catch (requestError) { setError(requestError.message || 'The operation could not be saved.'); }
  }
  return <Modal title={operation ? `Edit ${operation.id}` : `New ${meta.singular.toLowerCase()}`} subtitle={operationType === 'receipt' ? 'Record goods arriving from a supplier.' : operationType === 'delivery' ? 'Prepare stock leaving for a customer.' : operationType === 'transfer' ? 'Move stock between internal locations.' : 'Reconcile recorded stock with a physical count.'} onClose={onClose} wide>
    <div className="operation-form">{error && <div className="form-alert danger"><AlertTriangle size={17} />{error}</div>}<div className="workflow-steps"><div className="active"><span>1</span><strong>Document details</strong></div><i /><div><span>2</span><strong>Review stock</strong></div><i /><div><span>3</span><strong>Validate</strong></div></div><div className="form-section"><div><span>01</span><h3>Document details</h3></div><div className="form-grid"><label>Product<select value={form.productId} onChange={(e) => set('productId', e.target.value)}>{state.products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></label><label>{operationType === 'adjustment' ? 'Physical counted quantity' : 'Quantity'}<div className="quantity-input"><input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="0" /><span>{product?.unit}</span></div></label>{operationType === 'receipt' && <label>Supplier<input value={form.partner} onChange={(e) => set('partner', e.target.value)} placeholder="Supplier name" /></label>}{operationType === 'delivery' && <label>Customer<input value={form.partner} onChange={(e) => set('partner', e.target.value)} placeholder="Customer name" /></label>}<label>Scheduled date<input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></label></div></div>
      <div className="form-section"><div><span>02</span><h3>{operationType === 'receipt' ? 'Destination' : operationType === 'delivery' ? 'Picking location' : operationType === 'transfer' ? 'Transfer route' : 'Counted location'}</h3></div><div className="form-grid">{['delivery', 'transfer', 'adjustment'].includes(operationType) && <label>Source location<select value={form.sourceId} onChange={(e) => set('sourceId', e.target.value)}>{state.locations.map((item) => <option key={item.id} value={item.id}>{locationLabel(state, item.id)}</option>)}</select><small>{currentAtSource} {product?.unit} currently available</small></label>}{['receipt', 'transfer'].includes(operationType) && <label>Destination location<select value={form.destinationId} onChange={(e) => set('destinationId', e.target.value)}>{state.locations.map((item) => <option key={item.id} value={item.id}>{locationLabel(state, item.id)}</option>)}</select><small>{currentAtDestination} {product?.unit} currently stored</small></label>}<label className="span-2">Internal note<textarea rows="3" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Reference, reason, or handling instructions" /></label></div></div>
      {operationType === 'delivery' && <div className="validation-checks"><label className="check-card"><input type="checkbox" checked={form.picked} onChange={(e) => set('picked', e.target.checked)} /><span><Check size={17} /></span><div><strong>Items picked</strong><small>Products were collected from the source location.</small></div></label><label className="check-card"><input type="checkbox" checked={form.packed} onChange={(e) => set('packed', e.target.checked)} /><span><Check size={17} /></span><div><strong>Items packed</strong><small>The outgoing shipment is ready for dispatch.</small></div></label></div>}
      <div className="stock-impact"><div><Activity size={19} /><span><strong>Expected stock impact</strong><small>This change occurs only when the document is validated.</small></span></div><strong className={operationType === 'delivery' || adjustmentDelta < 0 ? 'negative' : operationType === 'transfer' ? '' : 'positive'}>{operationType === 'receipt' ? `+${form.quantity || 0}` : operationType === 'delivery' ? `−${form.quantity || 0}` : operationType === 'transfer' ? `${form.quantity || 0} moved · total unchanged` : `${adjustmentDelta > 0 ? '+' : ''}${adjustmentDelta} ${product?.unit}`}</strong></div>
      <div className="modal-actions split"><button className="btn secondary" onClick={onClose}>Cancel</button><div><button className="btn subtle" onClick={() => record('Draft')}>Save draft</button><button className="btn primary" onClick={() => record('Done')}><CheckCircle2 size={17} />Validate & update stock</button></div></div>
    </div>
  </Modal>;
}

function OperationDetail({ state, submitOperation, operation, onClose, notify }) {
  const [error, setError] = useState('');
  const current = state.operations.find((item) => item.id === operation.id) || operation;
  const product = state.products.find((item) => item.id === current.productId);
  async function setStatus(status) {
    try {
      await submitOperation({ ...current, status }, false);
      notify('Status updated', `${current.id} is now ${status.toLowerCase()}.`); onClose();
    } catch (requestError) { setError(requestError.message || 'The status could not be changed.'); }
  }
  async function validate() {
    try {
      await submitOperation({ ...current }, true);
      notify('Operation validated', `${current.id} changed stock and was added to Move History.`); onClose();
    } catch (requestError) { setError(requestError.message || 'The operation could not be validated.'); }
  }
  return <Modal title={current.id} subtitle={`${OPERATION_META[current.type].singular} · created for ${formatDate(current.date)}`} onClose={onClose} wide><div className="detail-header"><div className={`detail-symbol ${OPERATION_META[current.type].tone}`}>{(() => { const Icon = OPERATION_META[current.type].icon; return <Icon size={25} />; })()}</div><div><span>{OPERATION_META[current.type].singular}</span><h3>{product?.name}</h3><code>{product?.sku}</code></div><Badge tone={STATUS_TONE[current.status]} dot>{current.status}</Badge></div>{error && <div className="form-alert danger"><AlertTriangle size={17} />{error}</div>}<div className="detail-grid"><div><span>Quantity</span><strong>{current.quantity} {product?.unit}</strong></div><div><span>{current.type === 'receipt' ? 'Supplier' : current.type === 'delivery' ? 'Customer' : 'Scheduled date'}</span><strong>{current.partner || formatDate(current.date)}</strong></div><div><span>Source</span><strong>{current.sourceId ? locationLabel(state, current.sourceId) : 'External supplier'}</strong></div><div><span>Destination</span><strong>{current.destinationId ? locationLabel(state, current.destinationId) : 'Customer shipment'}</strong></div></div>{current.note && <div className="detail-note"><FileText size={17} /><div><span>Internal note</span><p>{current.note}</p></div></div>}<div className="activity-mini"><span className="eyebrow">Document timeline</span><div><i className="done"><Check size={13} /></i><span><strong>Document created</strong><small>{formatDate(current.date)} · Maya Chen</small></span></div><div><i className={current.status !== 'Draft' ? 'done' : ''}>{current.status !== 'Draft' ? <Check size={13} /> : <Clock3 size={13} />}</i><span><strong>Prepared for validation</strong><small>{current.status === 'Draft' ? 'Awaiting team action' : 'Stock checks completed'}</small></span></div><div><i className={current.status === 'Done' ? 'done' : ''}>{current.status === 'Done' ? <Check size={13} /> : <Clock3 size={13} />}</i><span><strong>Stock movement posted</strong><small>{current.status === 'Done' ? 'Recorded in Move History' : 'No stock change yet'}</small></span></div></div><div className="modal-actions split"><button className="btn secondary" onClick={onClose}>Close</button>{!['Done', 'Cancelled'].includes(current.status) && <div><button className="btn danger subtle-danger" onClick={() => { if (window.confirm(`Cancel ${current.id}? No stock will be changed.`)) setStatus('Cancelled'); }}>Cancel document</button>{current.status === 'Draft' && <button className="btn subtle" onClick={() => setStatus(current.type === 'receipt' ? 'Waiting' : 'Ready')}>Mark {current.type === 'receipt' ? 'waiting' : 'ready'}</button>}<button className="btn primary" onClick={validate}><CheckCircle2 size={17} />Validate operation</button></div>}</div></Modal>;
}
