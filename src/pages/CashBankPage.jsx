import { useState } from "react";
import Button from "../components/Button";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { adjustLedgerBalance, transferBetweenLedgers } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { computeLedgerSummary, formatCurrency, formatDate } from "../utils/format";

export default function CashBankPage() {
  const { user } = useAuth();
  const cash = useFirestoreCollection("cash_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const account = useFirestoreCollection("account_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const [targets, setTargets] = useState({ cash: "", account: "" });
  const [transfer, setTransfer] = useState({ from: "account", to: "cash", amount: "", note: "" });

  if (cash.loading || account.loading) {
    return <Loader text="Loading cash and bank..." />;
  }

  const cashSummary = computeLedgerSummary(cash.data);
  const accountSummary = computeLedgerSummary(account.data);
  const recent = [...cash.data.map((entry) => ({ ...entry, source: "Cash" })), ...account.data.map((entry) => ({ ...entry, source: "Bank" }))]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, 8);

  return (
    <div className="list-stack">
      <div className="dashboard-overview-grid">
        <div className="overview-card overview-card-success"><div className="overview-card-label">Cash Balance</div><div className="overview-card-value">{formatCurrency(cashSummary.closing)}</div><div className="overview-card-note">Income {formatCurrency(cashSummary.income)} • Expense {formatCurrency(cashSummary.expense)}</div></div>
        <div className="overview-card overview-card-neutral"><div className="overview-card-label">Bank Balance</div><div className="overview-card-value">{formatCurrency(accountSummary.closing)}</div><div className="overview-card-note">Income {formatCurrency(accountSummary.income)} • Expense {formatCurrency(accountSummary.expense)}</div></div>
        <div className="overview-card overview-card-danger"><div className="overview-card-label">Total Balance</div><div className="overview-card-value">{formatCurrency(cashSummary.closing + accountSummary.closing)}</div><div className="overview-card-note">Combined shop liquidity</div></div>
      </div>

      <PageSection title="Balance Controls" subtitle="Internal shop cash-flow controls for setting balances and moving money between cash and bank">
        <div className="form-grid" style={{ marginBottom: 32 }}>
          <form className="billing-block" style={{ marginBottom: 0 }} onSubmit={async (event) => { event.preventDefault(); await adjustLedgerBalance("cash", targets.cash, user); }}>
            <div className="billing-block-header">
              <h3>Update Cash In Hand</h3>
              <span className="muted">Current {formatCurrency(cashSummary.closing)}</span>
            </div>
            <div className="field">
              <label>Target Cash Balance</label>
              <input type="number" min="0" value={targets.cash} onChange={(event) => setTargets((current) => ({ ...current, cash: event.target.value }))} placeholder="New cash in hand" />
            </div>
            <div style={{ marginTop: 16 }}>
              <Button type="submit">Update Cash</Button>
            </div>
          </form>

          <form className="billing-block" style={{ marginBottom: 0 }} onSubmit={async (event) => { event.preventDefault(); await adjustLedgerBalance("account", targets.account, user); }}>
            <div className="billing-block-header">
              <h3>Update Cash In Bank</h3>
              <span className="muted">Current {formatCurrency(accountSummary.closing)}</span>
            </div>
            <div className="field">
              <label>Target Bank Balance</label>
              <input type="number" min="0" value={targets.account} onChange={(event) => setTargets((current) => ({ ...current, account: event.target.value }))} placeholder="New bank balance" />
            </div>
            <div style={{ marginTop: 16 }}>
              <Button type="submit">Update Bank</Button>
            </div>
          </form>
        </div>

        <div className="panel" style={{ borderTopColor: 'var(--primary)' }}>
          <div className="panel-header">
            <h3>Move Shop Money</h3>
            <span className="muted">Transfer funds between cash drawer and bank account</span>
          </div>
          <form className="form-grid" onSubmit={async (event) => { event.preventDefault(); await transferBetweenLedgers(transfer, user); setTransfer({ from: "account", to: "cash", amount: "", note: "" }); }}>
            <div className="field">
              <label>From</label>
              <select value={transfer.from} onChange={(event) => setTransfer((current) => ({ ...current, from: event.target.value, to: current.to === event.target.value ? (event.target.value === "cash" ? "account" : "cash") : current.to }))}>
                <option value="cash">Cash Drawer</option>
                <option value="account">Bank Account</option>
              </select>
            </div>
            <div className="field">
              <label>To</label>
              <select value={transfer.to} onChange={(event) => setTransfer((current) => ({ ...current, to: event.target.value }))}>
                <option value="cash">Cash Drawer</option>
                <option value="account">Bank Account</option>
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" min="0" value={transfer.amount} onChange={(event) => setTransfer((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount to move" required />
            </div>
            <div className="field">
              <label>Note / Reference</label>
              <input value={transfer.note} onChange={(event) => setTransfer((current) => ({ ...current, note: event.target.value }))} placeholder="Reason for transfer..." />
            </div>
          </form>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" onClick={async (e) => { 
              const form = e.target.closest('.panel').querySelector('form');
              if (form.checkValidity()) {
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
              } else {
                form.reportValidity();
              }
            }}>
              Confirm Transfer
            </Button>
          </div>
        </div>
      </PageSection>

      <PageSection title="Recent Cash & Bank Activity" subtitle="Latest movement across both ledgers">
        <div className="dashboard-mini-table">
          {recent.map((entry) => (
            <div key={`${entry.source}-${entry.id}`} className="dashboard-mini-row">
              <div>
                <strong>{entry.source} • {entry.category}</strong>
                <p>{entry.note || entry.type}</p>
              </div>
              <div className="dashboard-mini-values">
                <span>{formatCurrency(entry.amount)}</span>
                <small>{formatDate(entry.createdAt)}</small>
              </div>
            </div>
          ))}
        </div>
      </PageSection>
    </div>
  );
}
