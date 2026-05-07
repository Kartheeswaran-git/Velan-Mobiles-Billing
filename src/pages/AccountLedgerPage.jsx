import { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { addLedgerEntry } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { computeLedgerSummary, formatCurrency, formatDate } from "../utils/format";

export default function AccountLedgerPage() {
  const { user } = useAuth();
  const ledger = useFirestoreCollection("account_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState({ type: "expense", category: "", amount: "", note: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    await addLedgerEntry("account", form, user);
    setForm({ type: "expense", category: "", amount: "", note: "" });
  }

  if (ledger.loading) {
    return <Loader text="Loading account ledger..." />;
  }

  const summary = computeLedgerSummary(ledger.data);

  return (
    <div className="list-stack">
      <div className="card-grid">
        <div className="stat-card"><div className="stat-label">Opening Account</div><div className="stat-value">{formatCurrency(summary.opening)}</div></div>
        <div className="stat-card"><div className="stat-label">Income</div><div className="stat-value">{formatCurrency(summary.income)}</div></div>
        <div className="stat-card"><div className="stat-label">Expense</div><div className="stat-value">{formatCurrency(summary.expense)}</div></div>
        <div className="stat-card"><div className="stat-label">Closing Account</div><div className="stat-value">{formatCurrency(summary.closing)}</div></div>
      </div>

      <PageSection title="Add Account Entry" subtitle="Record UPI or bank-side movements">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="UPI sale, bank charge, payout..." required />
          </div>
          <div className="field">
            <label>Amount</label>
            <input type="number" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Bank/UPI amount" required />
          </div>
          <div className="field">
            <label>Note</label>
            <input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Transaction ID or note" />
          </div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <Button type="submit">Save Entry</Button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Account Ledger" subtitle="Realtime account movement history">
        <DataTable
          rows={ledger.data}
          columns={[
            { key: "type", label: "Type", render: (row) => <StatusBadge value={row.type} /> },
            { key: "category", label: "Category" },
            { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
            { key: "note", label: "Note" },
            { key: "createdByName", label: "By" },
            { key: "createdAt", label: "Time", render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </PageSection>
    </div>
  );
}
