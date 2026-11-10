import React from 'react';

export default function LandingPage({ onTry }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="edgar-landing">
      {/* Top Header */}
      <header className="edgar-header">
        <div className="edgar-header-inner">
          <div className="edgar-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="edgar-logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="4" stroke="#00e5ff" strokeWidth="2.2" />
                <path d="M12 7V17M7 12H17" stroke="#3dec63" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="edgar-logo-text">
              <span className="brand-name">BALANCEVAULT</span>
              <span className="brand-sub">LEDGER ENGINE</span>
            </div>
          </div>

          <nav className="edgar-nav">
            <button className="nav-item" onClick={() => scrollTo('engine')}>The Engine</button>
            <button className="nav-item" onClick={() => scrollTo('features')}>How We Deliver</button>
            <button className="nav-item" onClick={() => scrollTo('demo-access')}>Instant Access</button>
            <button className="nav-item" onClick={() => scrollTo('security')}>Security</button>
          </nav>

          {/* Top-Right Try Button */}
          <div className="edgar-header-cta">
            <button className="link-btn green" onClick={() => onTry('login')} aria-label="Try BalanceVault">
              <span className="link-btn-text">Try BalanceVault</span>
              <span className="hover-link-btn-text-container">
                <span className="hover-link-btn-text">Try BalanceVault</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Intro Section (Cobalt Blue #002070) */}
      <section className="edgar-intro-section" id="hero">
        <div className="edgar-intro-glow" />
        <div className="edgar-container">
          <div className="edgar-intro-content">
            <div className="edgar-pill-tag">
              <span className="live-pulse" />
              AUDITABLE DOUBLE-ENTRY FINTECH PLATFORM
            </div>

            <h1 className="edgar-intro-title">
              <span className="intro-top-title-text">BALANCEVAULT IS THE</span>
              <span className="intro-middle-title-text">
                #1 AUDITABLE <br />
                DOUBLE-ENTRY LEDGER
              </span>
              <span className="intro-bottom-title-text">
                among fintech systems where every cent must be cryptographically proven
              </span>
            </h1>

            <p className="edgar-intro-desc">
              Engineered with PostgreSQL deterministic row locks, balanced debit/credit triggers, and an append-only
              immutability layer. Zero balance discrepancies. Zero retroactive edits. Complete audit trail.
            </p>

            <div className="edgar-intro-actions">
              <button className="link-btn green large" onClick={() => onTry('login')}>
                <span className="link-btn-text">SEE FOR YOURSELF, FOR FREE*</span>
                <span className="hover-link-btn-text-container">
                  <span className="hover-link-btn-text">SEE FOR YOURSELF, FOR FREE*</span>
                </span>
              </button>

              <button className="link-btn black large" onClick={() => scrollTo('engine')}>
                <span className="link-btn-text">EXPLORE THE ARCHITECTURE</span>
                <span className="hover-link-btn-text-container">
                  <span className="hover-link-btn-text">EXPLORE THE ARCHITECTURE</span>
                </span>
              </button>
            </div>

            {/* Metric ribbon */}
            <div className="edgar-metrics-ribbon">
              <div className="metric-box">
                <div className="metric-val">$0.00</div>
                <div className="metric-lbl">Ledger Discrepancy Tolerance</div>
              </div>
              <div className="metric-divider" />
              <div className="metric-box">
                <div className="metric-val">100%</div>
                <div className="metric-lbl">Equal Debit &amp; Credit Match</div>
              </div>
              <div className="metric-divider" />
              <div className="metric-box">
                <div className="metric-val">ACID</div>
                <div className="metric-lbl">Deterministic Row-Locked Transfers</div>
              </div>
              <div className="metric-divider" />
              <div className="metric-box">
                <div className="metric-val">0</div>
                <div className="metric-lbl">Modifications or Deletions Allowed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Instant Demo Access / Callout Section (Deep Charcoal #07162b) */}
      <section className="edgar-offer-section" id="demo-access">
        <div className="edgar-container">
          <div className="section-head-center">
            <span className="edgar-eyebrow">READY-TO-TEST ENVIRONMENT</span>
            <h2 className="edgar-section-title light">SEE FOR YOURSELF, FOR FREE*</h2>
            <p className="edgar-section-desc light">
              No credit card or payment rails required. Test the interactive application right now with pre-seeded
              synthetic accounts or register a brand new identity in seconds.
            </p>
          </div>

          <div className="demo-credentials-grid">
            <div className="demo-cred-card featured">
              <div className="cred-badge admin">FULL ADMIN ACCESS</div>
              <h3>Platform Administrator</h3>
              <p>Audit system-wide transfers, approve onboarding applications, inspect immutable audit logs, and trigger cryptographic ledger integrity verification.</p>
              <div className="cred-code-block">
                <div><span>Email:</span> <code>admin@example.test</code></div>
                <div><span>Password:</span> <code>rukus-admin-password</code></div>
              </div>
              <button className="link-btn green full" onClick={() => onTry('login')}>
                <span className="link-btn-text">Sign In As Admin →</span>
                <span className="hover-link-btn-text-container">
                  <span className="hover-link-btn-text">Sign In As Admin →</span>
                </span>
              </button>
            </div>

            <div className="demo-cred-card">
              <div className="cred-badge user">PRE-FUNDED SOURCE</div>
              <h3>Demo Account Holder</h3>
              <p>Funded with $1,000.00 synthetic balance. Execute real-time double-entry internal transfers, test idempotency replays, and inspect your personal ledger history.</p>
              <div className="cred-code-block">
                <div><span>Email:</span> <code>demo@example.test</code></div>
                <div><span>Password:</span> <code>demo-user-password-please-change</code></div>
              </div>
              <button className="link-btn black full" onClick={() => onTry('login')}>
                <span className="link-btn-text">Sign In As User →</span>
                <span className="hover-link-btn-text-container">
                  <span className="hover-link-btn-text">Sign In As User →</span>
                </span>
              </button>
            </div>

            <div className="demo-cred-card">
              <div className="cred-badge recipient">RECIPIENT ACCOUNT</div>
              <h3>Demo Recipient</h3>
              <p>Pre-configured recipient account (funded with $250.00). Use this account as the target for money movement experiments and verify balancing.</p>
              <div className="cred-code-block">
                <div><span>Account Number:</span> <code>BV-919B83C15A5940</code></div>
                <div><span>Email:</span> <code>recipient@example.test</code></div>
              </div>
              <button className="link-btn black full" onClick={() => onTry('register')}>
                <span className="link-btn-text">Create New Account →</span>
                <span className="hover-link-btn-text-container">
                  <span className="hover-link-btn-text">Create New Account →</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars: How We Deliver (White / Slate) */}
      <section className="edgar-features-section" id="features">
        <div className="edgar-container">
          <div className="section-head">
            <span className="edgar-eyebrow">PROVABLE COMPLIANCE ARCHITECTURE</span>
            <h3 className="edgar-section-title dark">HOW WE DELIVER FOR OUR CLIENTS</h3>
            <p className="edgar-section-desc dark">
              Conventional databases allow silent overwrites, balance drifts, and race conditions.
              BalanceVault guarantees ledger immutability and mathematical correctness at the database engine level.
            </p>
          </div>

          <div className="edgar-cards-grid">
            <div className="feature-card">
              <div className="card-number">01</div>
              <div className="card-icon cyan">⚖️</div>
              <h4>Provable Double-Entry Balancing</h4>
              <p>
                Every internal money movement generates two equal and opposite entries: one DEBIT to the source
                and one CREDIT to the destination. A PostgreSQL trigger mathematically verifies debit == credit
                before committing.
              </p>
              <div className="card-tag">PostgreSQL Triggers</div>
            </div>

            <div className="feature-card">
              <div className="card-number">02</div>
              <div className="card-icon green">🔒</div>
              <h4>Append-Only Ledger Immutability</h4>
              <p>
                Once posted, no ledger record or audit event can be edited or deleted. Database role privileges
                explicitly revoke UPDATE and DELETE commands, and custom triggers abort any tampering attempt.
              </p>
              <div className="card-tag">Revoked UPDATE/DELETE</div>
            </div>

            <div className="feature-card">
              <div className="card-number">03</div>
              <div className="card-icon cyan">⚡</div>
              <h4>Deterministic Row Locking &amp; Idempotency</h4>
              <p>
                Transfers lock source and destination account rows in deterministic ID order to mathematically
                prevent deadlocks under heavy concurrency. Client-supplied idempotency keys eliminate duplicate transfers.
              </p>
              <div className="card-tag">Serializable Isolation</div>
            </div>

            <div className="feature-card">
              <div className="card-number">04</div>
              <div className="card-icon green">🛡️</div>
              <h4>Separation of Duties &amp; Onboarding</h4>
              <p>
                Strict USER and ADMIN roles. Administrator status does not grant access to private account funds.
                New users submit onboarding applications that must be formally reviewed and approved before account activation.
              </p>
              <div className="card-tag">Enterprise RBAC</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Engine Workflow Section (Deep Cobalt #002070) */}
      <section className="edgar-workflow-section" id="engine">
        <div className="edgar-container">
          <div className="workflow-card">
            <div className="workflow-left">
              <span className="edgar-eyebrow cyan">ATOMIC TRANSACTION PIPELINE</span>
              <h2>How a Transfer is Guaranteed in &lt;15ms</h2>
              <p>
                When a user initiates an internal transfer, our engine executes an uninterrupted, serializable database pipeline:
              </p>
              <ul className="workflow-steps">
                <li>
                  <strong>1. Idempotency Check:</strong> Validates that the request has not been submitted previously.
                </li>
                <li>
                  <strong>2. Deterministic Row Lock:</strong> Locks both account rows in ascending UUID sequence to avoid deadlocks.
                </li>
                <li>
                  <strong>3. Balance Verification:</strong> Verifies sufficient cleared funds under the active lock.
                </li>
                <li>
                  <strong>4. Dual Balanced Journal:</strong> Simultaneously creates paired DEBIT and CREDIT ledger entries.
                </li>
                <li>
                  <strong>5. Trigger Enforcement:</strong> DB trigger asserts zero sum (total debits = total credits) and writes immutable audit record.
                </li>
              </ul>
            </div>
            <div className="workflow-right">
              <div className="terminal-window">
                <div className="terminal-header">
                  <span className="term-dot red" />
                  <span className="term-dot yellow" />
                  <span className="term-dot green" />
                  <span className="term-title">ledger_audit_pipeline.sql</span>
                </div>
                <pre className="terminal-body">
<code>{`-- Automated Balance Check Trigger
CREATE OR REPLACE FUNCTION verify_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT SUM(amount) FROM "LedgerEntry"
      WHERE "journalId" = NEW.id) != 0 THEN
    RAISE EXCEPTION 'UNBALANCED_JOURNAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Status: 100% Matched Debits and Credits
-- Ledger Result: POSTED (Immutable)`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Callout Banner */}
      <section className="edgar-cta-banner">
        <div className="edgar-container">
          <div className="cta-banner-content">
            <h2>Ready to inspect the ledger in action?</h2>
            <p>Launch the interactive platform now and experience mathematically provable accounting.</p>
            <button className="link-btn green large" onClick={() => onTry('login')}>
              <span className="link-btn-text">Try BalanceVault Now</span>
              <span className="hover-link-btn-text-container">
                <span className="hover-link-btn-text">Try BalanceVault Now</span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer (Dark #07162b) */}
      <footer className="edgar-footer" id="security">
        <div className="edgar-container">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="edgar-logo">
                <div className="edgar-logo-mark">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="4" stroke="#00e5ff" strokeWidth="2.2" />
                    <path d="M12 7V17M7 12H17" stroke="#3dec63" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="brand-name">BALANCEVAULT</span>
              </div>
              <p className="footer-tagline">
                Money movement with an auditable double-entry ledger you can prove.
              </p>
            </div>

            <div className="footer-links-grid">
              <div className="footer-col">
                <h5>PLATFORM</h5>
                <a href="#hero">Overview</a>
                <a href="#features">Double-Entry Engine</a>
                <a href="#demo-access">Instant Access</a>
              </div>
              <div className="footer-col">
                <h5>SECURITY</h5>
                <span>PostgreSQL 16 Triggers</span>
                <span>Bcrypt Password Hashing</span>
                <span>SHA-256 Token Storage</span>
                <span>HTTP-Only Cookies</span>
              </div>
              <div className="footer-col">
                <h5>SYNTHETIC DEMO</h5>
                <span>Hackathon Reference</span>
                <span>No Real Funds Rail</span>
                <span>Demonstration Only</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} BalanceVault Reference Implementation. Synthetic data only.</p>
            <div className="footer-disclaimer">
              * “This deployment is intended as an evaluator demonstration using synthetic data, not as a production financial service.”
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

