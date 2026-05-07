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
        <div className="dashboard-main-grid">
          <form className="billing-block" onSubmit={async (event) => { event.preventDefault(); await adjustLedgerBalance("cash", targets.cash, user); }}>
            <div className="billing-block-header"><h3>Update Cash In Hand</h3><span className="muted">Current {formatCurrency(cashSummary.closing)}</span></div>
            <div className="field"><label>Target Cash Balance</label><input type="number" min="0" value={targets.cash} onChange={(event) => setTargets((current) => ({ ...current, cash: event.target.value }))} placeholder="New cash in hand" /></div>
            <Button type="submit">Update Cash</Button>
          </form>

          <form className="billing-block" onSubmit={async (event) => { event.preventDefault(); await adjustLedgerBalance("account", targets.account, user); }}>
            <div className="billing-block-header"><h3>Update Cash In Bank</h3><span className="muted">Current {formatCurrency(accountSummary.closing)}</span></div>
            <div className="field"><label>Target Bank Balance</label><input type="number" min="0" value={targets.account} onChange={(event) => setTargets((current) => ({ ...current, account: event.target.value }))} placeholder="New bank balance" /></div>
            <Button type="submit">Update Bank</Button>
          </form>
        </div>

        <form className="form-grid" style={{ marginTop: 18 }} onSubmit={async (event) => { event.preventDefault(); await transferBetweenLedgers(transfer, user); setTransfer({ from: "account", to: "cash", amount: "", note: "" }); }}>
          <div className="field"><label>From</label><select value={transfer.from} onChange={(event) => setTransfer((current) => ({ ...current, from: event.target.value, to: current.to === event.target.value ? (event.target.value === "cash" ? "account" : "cash") : current.to }))}><option value="cash">cash</option><option value="account">account</option></select></div>
          <div className="field"><label>To</label><select value={transfer.to} onChange={(event) => setTransfer((current) => ({ ...current, to: event.target.value }))}><option value="cash">cash</option><option value="account">account</option></select></div>
          <div className="field"><label>Amount</label><input type="number" min="0" value={transfer.amount} onChange={(event) => setTransfer((current) => ({ ...current, amount: event.target.value }))} placeholder="Amount to move" /></div>
          <div className="field"><label>Note</label><input value={transfer.note} onChange={(event) => setTransfer((current) => ({ ...current, note: event.target.value }))} placeholder="Move shop cash to bank, withdraw bank cash..." /></div>
          <div className="field" style={{ justifyContent: "flex-end" }}><label>&nbsp;</label><Button type="submit">Move Shop Money</Button></div>
        </form>
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
