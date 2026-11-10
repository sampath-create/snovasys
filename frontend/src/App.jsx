import React, { useCallback, useEffect, useState } from 'react';
import { api, setAccessToken } from './api';

const money = (cents) => {
  const value = BigInt(cents ?? 0);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = new Intl.NumberFormat('en-US').format(absolute / 100n);
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}$${whole}.${fraction}`;
};
const date = (value) => value ? new Date(value).toLocaleString() : '—';

function ErrorLine({ children }) { return children ? <div className="notice error" role="alert">{children}</div> : null; }
function SuccessLine({ children }) { return children ? <div className="notice success" role="status">{children}</div> : null; }
function Field({ label, ...props }) { return <label className="field"><span>{label}</span><input {...props} /></label>; }

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('Dashboard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshSession = useCallback(async () => {
    try {
      const session = await api('/api/auth/refresh', { method: 'POST' });
      setAccessToken(session.accessToken);
      setUser(session.user);
    } catch {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  const run = useCallback(async (task, successMessage) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const value = await task();
      if (successMessage) setNotice(successMessage);
      return value;
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      return null;
    } finally { setBusy(false); }
  }, []);

  async function signOut() {
    await run(() => api('/api/auth/logout', { method: 'POST' }), 'Signed out.');
    setAccessToken(null); setUser(null); setPage('Dashboard');
  }

  if (!user) return <AuthScreen busy={busy} error={error} onAuth={async (mode, form) => {
    const result = await run(() => api(`/api/auth/${mode}`, { method: 'POST', body: form }));
    if (result) { setAccessToken(result.accessToken); setUser(result.user); setPage('Dashboard'); }
  }} />;

  const isAdmin = user.roles?.includes('ADMIN');
  const links = ['Dashboard', 'Onboarding', 'Account', 'Ledger', 'Transfer', ...(isAdmin ? ['Admin', 'Audit log'] : [])];
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">B</span><span>BalanceVault<small>ACCOUNT PLATFORM</small></span></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{links.map((label, i) => <button key={label} className={`nav-link ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setError(''); setNotice(''); }}><span className="nav-number">0{i + 1}</span>{label}</button>)}</nav>
      <div className="sidebar-foot"><span className="status-dot" /> Synthetic demo environment <small>No real funds or payment rails</small></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="eyebrow">BALANCEVAULT / {page.toUpperCase()}</span><h1>{page}</h1></div><div className="profile"><div className="avatar">{user.email?.[0]?.toUpperCase()}</div><div className="profile-text"><strong>{user.email}</strong><small>{isAdmin ? 'Administrator' : 'Account holder'}</small></div><button className="quiet-button" onClick={signOut}>Sign out</button></div></header>
      <section className="content"><ErrorLine>{error}</ErrorLine><SuccessLine>{notice}</SuccessLine>
        {page === 'Dashboard' && <Dashboard run={run} />}
        {page === 'Onboarding' && <Onboarding run={run} />}
        {page === 'Account' && <Account run={run} />}
        {page === 'Transfer' && <Transfer run={run} />}
        {page === 'Ledger' && <Ledger run={run} />}
        {page === 'Admin' && isAdmin && <Admin run={run} />}
        {page === 'Audit log' && isAdmin && <AuditLog run={run} />}
      </section>
    </main>
    {busy && <div className="busy-indicator" aria-live="polite">Processing…</div>}
  </div>;
}

function AuthScreen({ busy, error, onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return <div className="auth-page"><div className="auth-aside"><div className="brand light"><span className="brand-mark">B</span><span>BalanceVault<small>ACCOUNT PLATFORM</small></span></div><div className="hero-copy"><p className="eyebrow">MONEY MOVEMENT, MADE TRACEABLE</p><h1>Every movement<br />has a record.</h1><p>Account management with ownership checks, an auditable double-entry ledger, and clear operational controls.</p></div><div className="auth-disclaimer">HACKATHON DEMONSTRATION · SYNTHETIC DATA ONLY</div></div><div className="auth-panel"><div className="auth-card"><p className="eyebrow">WELCOME TO BALANCEVAULT</p><h2>{mode === 'login' ? 'Sign in to your account' : 'Create an account'}</h2><p className="muted">Use a demo account or register a new account holder.</p><ErrorLine>{error}</ErrorLine><form onSubmit={(event) => { event.preventDefault(); onAuth(mode, { email, password }); }}><Field label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Field label="Password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'login' ? 1 : 12} required /><button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><div className="auth-switch">{mode === 'login' ? 'New to BalanceVault?' : 'Already registered?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div><div className="security-note"><span>●</span> Protected session · HTTP-only refresh cookie</div></div></div></div>;
}

function Dashboard({ run }) {
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const load = () => run(async () => {
    const [a, l, o] = await Promise.all([api('/api/accounts/me'), api('/api/ledger/me?pageSize=5'), api('/api/onboarding/status')]);
    setAccounts(a.accounts); setEntries(l.entries); setOnboarding(o); return true;
  });
  useEffect(() => { load(); }, []);
  const total = accounts.filter((account) => account.status === 'ACTIVE').reduce((sum, account) => sum + BigInt(account.currentBalanceCents), 0n);
  return <><div className="welcome-row"><div><p className="eyebrow">ACCOUNT OVERVIEW</p><h2>Your money, accounted for.</h2><p className="muted">Balances are derived from the posted ledger and shown here as a cached snapshot.</p></div><button className="secondary" onClick={load}>Refresh data ↻</button></div><div className="metric-grid"><div className="metric-card hero-metric"><span>Total available balance</span><strong>{money(total)}</strong><small>{accounts.length} active or pending account(s)</small></div><div className="metric-card"><span>Account status</span><strong className="metric-state">{accounts.some((a) => a.status === 'ACTIVE') ? 'Active' : 'Pending'}</strong><small>{onboarding?.application?.state || 'Onboarding not submitted'}</small></div><div className="metric-card"><span>Ledger activity</span><strong>{entries.length}</strong><small>Recent posted entries</small></div></div><div className="panel"><div className="panel-head"><div><p className="eyebrow">YOUR ACCOUNTS</p><h3>Account register</h3></div></div>{accounts.length ? <div className="table-wrap"><table><thead><tr><th>Account number</th><th>Status</th><th>Current balance</th></tr></thead><tbody>{accounts.map((a) => <tr key={a.id}><td className="mono">{a.accountNumber}</td><td><span className={`pill ${a.status === 'ACTIVE' ? 'good' : 'pending'}`}>{a.status}</span></td><td>{money(a.currentBalanceCents)}</td></tr>)}</tbody></table></div> : <Empty>No account yet. Complete onboarding and wait for admin approval.</Empty>}</div><div className="panel"><div className="panel-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h3>Ledger entries</h3></div></div><LedgerTable entries={entries} /></div></>;
}

function Account({ run }) {
  const [accounts, setAccounts] = useState([]);
  const load = () => run(async () => { const data = await api('/api/accounts/me'); setAccounts(data.accounts); });
  useEffect(() => { load(); }, []);
  return <div className="panel">
    <div className="panel-head"><div><p className="eyebrow">OWNER-SCOPED ACCOUNT VIEW</p><h3>Your accounts</h3></div><button className="secondary" onClick={load}>Refresh</button></div>
    {accounts.length ? <div className="table-wrap"><table><thead><tr><th>Account number</th><th>Status</th><th>Current balance</th><th>Opened</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td className="mono">{account.accountNumber}</td><td><span className={`pill ${account.status === 'ACTIVE' ? 'good' : 'pending'}`}>{account.status}</span></td><td>{money(account.currentBalanceCents)}</td><td>{date(account.createdAt)}</td></tr>)}</tbody></table></div> : <Empty>No account yet. Complete onboarding and wait for admin approval.</Empty>}
    <p className="muted">Account balances are read from your own accounts only. All displayed amounts use integer minor units.</p>
  </div>;
}

function Onboarding({ run }) {
  const [status, setStatus] = useState(null);
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [purpose, setPurpose] = useState('STUDENT_DEMO');
  const load = () => run(async () => { setStatus(await api('/api/onboarding/status')); });
  useEffect(() => { load(); }, []);
  const submit = (event) => { event.preventDefault(); run(async () => { const result = await api('/api/onboarding', { method: 'POST', body: { fullName, city, purpose } }); setStatus({ application: result.application, accountActive: false }); }, 'Onboarding submitted for review.'); };
  return <div className="two-col"><div className="panel"><p className="eyebrow">ACCOUNT ACTIVATION</p><h3>Complete your demo profile</h3><p className="muted">Only synthetic information should be entered. Account creation is enabled after an administrator approves the application.</p><form onSubmit={submit}><Field label="Display name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Synthetic Demo User" required minLength={2} maxLength={80} /><Field label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Demo City" required minLength={2} maxLength={80} /><label className="field"><span>Demo purpose</span><select value={purpose} onChange={(e) => setPurpose(e.target.value)}><option value="STUDENT_DEMO">Student demonstration</option><option value="PERSONAL_DEMO">Personal demonstration</option><option value="OTHER">Other</option></select></label><button className="primary" disabled={status?.application && status.application.state !== 'REJECTED'}>Submit application</button></form></div><div className="panel status-panel"><p className="eyebrow">APPLICATION STATUS</p><h3>{status?.application?.state || 'Not started'}</h3><p className="muted">{status?.application?.state === 'APPROVED' ? 'Your demo account is active.' : status?.application?.state === 'REJECTED' ? `Rejected: ${status.application.reviewReason || 'Please review and resubmit.'}` : status?.application ? 'An administrator is reviewing your submitted details.' : 'Submit your demo profile to begin.'}</p><button className="secondary" onClick={load}>Refresh status</button>{status?.accountActive && <span className="pill good">Account active</span>}</div></div>;
}

function Transfer({ run }) {
  const [accounts, setAccounts] = useState([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [recipientAccountNumber, setRecipientAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [result, setResult] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  useEffect(() => { run(async () => { const data = await api('/api/accounts/me'); setAccounts(data.accounts); setFromAccountId(data.accounts.find((a) => a.status === 'ACTIVE')?.id || ''); }); }, []);
  const submit = (event) => { event.preventDefault(); if (!confirmation) return; run(async () => {
    const data = await api('/api/transfers', { method: 'POST', body: { fromAccountId, recipientAccountNumber, amount, idempotencyKey } });
    setResult(data.transfer); setAmount(''); setRecipientAccountNumber(''); setConfirmation(false); setIdempotencyKey(crypto.randomUUID());
  }, 'Transfer completed and posted to the ledger.'); };
  return <div className="transfer-layout"><div className="panel"><p className="eyebrow">INTERNAL TRANSFER</p><h3>Move demo funds</h3><p className="muted">This operation only moves synthetic balances between BalanceVault demo accounts. It does not call a bank or payment network.</p><form onSubmit={submit}><label className="field"><span>Source account</span><select value={fromAccountId} onChange={(e) => { setFromAccountId(e.target.value); setIdempotencyKey(crypto.randomUUID()); }} required><option value="">Select an active account</option>{accounts.filter((a) => a.status === 'ACTIVE').map((a) => <option key={a.id} value={a.id}>{a.accountNumber} · {money(a.currentBalanceCents)}</option>)}</select></label><Field label="Recipient account number" value={recipientAccountNumber} onChange={(e) => { setRecipientAccountNumber(e.target.value); setIdempotencyKey(crypto.randomUUID()); }} placeholder="BV-…" required /><Field label="Amount (USD)" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setIdempotencyKey(crypto.randomUUID()); }} placeholder="25.00" required pattern="[0-9]+(\.[0-9]{1,2})?" /><label className="check-field"><input type="checkbox" checked={confirmation} onChange={(e) => setConfirmation(e.target.checked)} /><span>I confirm this synthetic demo transfer.</span></label><button className="primary" disabled={!confirmation || !fromAccountId}>Review and transfer</button></form></div><div className="panel transfer-note"><div className="note-icon">↗</div><h3>Ledger-backed movement</h3><p>Each completed transfer creates one journal entry with matching debit and credit lines, a per-account sequence, and a resulting balance snapshot.</p><div className="rule-list"><span>01 · Ownership validated</span><span>02 · Accounts row-locked</span><span>03 · Idempotency enforced</span><span>04 · Balanced journal posted</span></div>{result && <div className="result-block"><span className="pill good">{result.status}</span><small>Transfer reference</small><code>{result.id}</code></div>}</div></div>;
}

function Ledger({ run }) {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const load = () => run(async () => { const data = await api(`/api/ledger/me?page=${page}&pageSize=25`); setEntries(data.entries); });
  useEffect(() => { load(); }, [page]);
  return <div className="panel"><div className="panel-head"><div><p className="eyebrow">IMMUTABLE POSTED RECORDS</p><h3>Account ledger</h3></div><button className="secondary" onClick={load}>Refresh</button></div><LedgerTable entries={entries} /><div className="pagination"><button className="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</button><span>Page {page}</span><button className="secondary" onClick={() => setPage(page + 1)} disabled={entries.length < 25}>Next</button></div></div>;
}

function LedgerTable({ entries = [] }) {
  if (!entries.length) return <Empty>No posted ledger entries yet.</Empty>;
  return <div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>Journal reference</th><th>Account</th><th>Side</th><th>Amount</th><th>Balance after</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{date(entry.createdAt)}</td><td className="mono">{entry.journalEntry?.reference || entry.journalEntryId}</td><td className="mono">{entry.account?.accountNumber || '—'}</td><td><span className={`pill ${entry.side === 'CREDIT' ? 'good' : 'neutral'}`}>{entry.side}</span></td><td>{money(entry.amountCents)}</td><td>{money(entry.balanceAfterCents)}</td></tr>)}</tbody></table></div>;
}

function Admin({ run }) {
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const auditPageSize = 25;

  const loadData = async () => {
    const query = new URLSearchParams({ pageSize: '50', search });
    if (userStatus) query.set('status', userStatus);
    const auditQuery = new URLSearchParams({ page: String(auditPage), pageSize: String(auditPageSize) });
    if (auditAction) auditQuery.set('action', auditAction);
    if (auditEntity) auditQuery.set('entityType', auditEntity);
    const [s, u, o, a] = await Promise.all([
      api('/api/admin/summary'),
      api(`/api/admin/users?${query}`),
      api('/api/admin/onboarding?pageSize=50'),
      api(`/api/admin/audit-logs?${auditQuery}`),
    ]);
    setSummary(s); setUsers(u.users); setApplications(o.applications); setLogs(a.logs); setAuditTotal(a.total);
  };
  const load = () => run(loadData);
  useEffect(() => { load(); }, []);
  const action = (task, message) => run(async () => { await task(); await loadData(); }, message);

  return <>
    <div className="admin-metrics">
      <div className="metric-card"><span>Total users</span><strong>{summary?.totalUsers ?? '—'}</strong></div>
      <div className="metric-card"><span>Pending applications</span><strong>{summary?.pendingOnboarding ?? '—'}</strong></div>
      <div className="metric-card"><span>Ledger integrity</span><strong className="metric-state">{summary ? (summary.ledgerIntegrity.ok ? 'PASS' : 'REVIEW') : '—'}</strong></div>
    </div>
    <div className="panel">
      <div className="panel-head"><div><p className="eyebrow">IDENTITY MANAGEMENT</p><h3>Users</h3></div><button className="secondary" onClick={load}>Refresh all</button></div>
      <div className="search-row"><input aria-label="Search users by email" placeholder="Search by email" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filter users by status" value={userStatus} onChange={(e) => setUserStatus(e.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select><button className="secondary" onClick={load}>Filter</button></div>
      <div className="table-wrap"><table><thead><tr><th>User</th><th>Status</th><th>Roles</th><th>Account(s)</th><th>Actions</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.email}</td><td><span className={`pill ${u.status === 'ACTIVE' ? 'good' : 'pending'}`}>{u.status}</span></td><td>{u.roles.join(', ')}</td><td>{u.accounts.length}</td><td className="action-cell"><button className="text-action" onClick={() => action(() => api(`/api/admin/users/${u.id}/status`, { method: 'PATCH', body: { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } }), 'User status updated.')}>{u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button><button className="text-action" onClick={() => action(() => api(`/api/admin/users/${u.id}/roles`, { method: 'PATCH', body: { roles: u.roles.includes('ADMIN') ? ['USER'] : ['USER', 'ADMIN'] } }), 'User roles updated.')}>{u.roles.includes('ADMIN') ? 'Remove admin' : 'Make admin'}</button></td></tr>)}</tbody></table></div>
    </div>
    <div className="panel"><p className="eyebrow">ACCOUNT ACTIVATION</p><h3>Onboarding applications</h3><div className="table-wrap"><table><thead><tr><th>Applicant</th><th>Submitted</th><th>State</th><th>Decision</th></tr></thead><tbody>{applications.map((a) => <tr key={a.id}><td>{a.user?.email}</td><td>{date(a.submittedAt)}</td><td><span className="pill pending">{a.state}</span></td><td className="action-cell">{['SUBMITTED', 'UNDER_REVIEW'].includes(a.state) && <><button className="text-action" onClick={() => action(() => api(`/api/admin/onboarding/${a.id}`, { method: 'PATCH', body: { status: 'APPROVED' } }), 'Application approved.')}>Approve</button><button className="text-action danger-text" onClick={() => { const reason = window.prompt('Reason for rejection (required):'); if (reason) action(() => api(`/api/admin/onboarding/${a.id}`, { method: 'PATCH', body: { status: 'REJECTED', reason } }), 'Application rejected.'); }}>Reject</button></>}</td></tr>)}</tbody></table></div></div>
    <div className="panel">
      <div className="panel-head"><div><p className="eyebrow">APPEND-ONLY AUDIT TRAIL</p><h3>Audit events</h3></div></div>
      <div className="search-row"><input aria-label="Filter audit action" placeholder="Action, e.g. TRANSFER_CREATED" value={auditAction} onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1); }} /><input aria-label="Filter audit entity type" placeholder="Entity type" value={auditEntity} onChange={(e) => { setAuditEntity(e.target.value); setAuditPage(1); }} /><button className="secondary" onClick={() => { setAuditPage(1); load(); }}>Apply</button></div>
      <div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{date(log.createdAt)}</td><td className="mono">{log.action}</td><td>{log.entityType || '—'} {log.entityId ? `· ${log.entityId.slice(0, 8)}` : ''}</td><td>{log.actor?.email || 'System'}</td></tr>)}</tbody></table></div>
      <div className="pagination"><button className="secondary" onClick={() => setAuditPage(Math.max(1, auditPage - 1))} disabled={auditPage === 1}>Previous</button><span>Page {auditPage} · {auditTotal} events</span><button className="secondary" onClick={() => setAuditPage(auditPage + 1)} disabled={auditPage * auditPageSize >= auditTotal}>Next</button><button className="secondary" onClick={load}>Refresh</button></div>
    </div>
  </>;
}

function AuditLog({ run }) {
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;
  const load = () => run(async () => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (action.trim()) query.set('action', action.trim());
    if (entityType.trim()) query.set('entityType', entityType.trim());
    const data = await api(`/api/admin/audit-logs?${query}`);
    setLogs(data.logs); setTotal(data.total);
  });
  useEffect(() => { load(); }, [page]);
  return <div className="panel">
    <div className="panel-head"><div><p className="eyebrow">APPEND-ONLY RECORD</p><h3>Audit log</h3></div><button className="secondary" onClick={load}>Refresh</button></div>
    <div className="search-row"><input aria-label="Filter by audit action" placeholder="Action, e.g. TRANSFER_CREATED" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} /><input aria-label="Filter by entity type" placeholder="Entity type" value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} /><button className="secondary" onClick={() => { setPage(1); load(); }}>Apply filters</button></div>
    <div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Request ID</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{date(log.createdAt)}</td><td className="mono">{log.action}</td><td>{log.entityType || '—'} {log.entityId ? `· ${log.entityId.slice(0, 8)}` : ''}</td><td>{log.actor?.email || 'System'}</td><td className="mono">{log.requestId || '—'}</td></tr>)}</tbody></table></div>
    {!logs.length && <Empty>No audit events match these filters.</Empty>}
    <div className="pagination"><button className="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</button><span>Page {page} · {total} events</span><button className="secondary" onClick={() => setPage(page + 1)} disabled={page * pageSize >= total}>Next</button></div>
  </div>;
}

function Empty({ children }) { return <div className="empty-state">{children}</div>; }
