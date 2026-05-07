import { useState } from "react";
import Button from "../components/Button";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { addLedgerEntry } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";

export default function ExpensesPage() {
  const { user } = useAuth();
  const cash = useFirestoreCollection("cash_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const account = useFirestoreCollection("account_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState({ source: "cash", category: "", amount: "", note: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    await addLedgerEntry(form.source, { type: "expense", category: form.category, amount: Number(form.amount || 0), note: form.note }, user);
    setForm({ source: "cash", category: "", amount: "", note: "" });
  }

  if (cash.loading || account.loading) return <Loader text="Loading expenses..." />;

  const expenses = [...cash.data.filter((entry) => entry.type === "expense").map((entry) => ({ ...entry, source: "cash" })), ...account.data.filter((entry) => entry.type === "expense").map((entry) => ({ ...entry, source: "account" }))]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  return (
    <div className="list-stack">
      <PageSection title="Add Expense" subtitle="Record rent, electricity, salary, transport, and stock-related expenses">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label>Source</label><select value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}><option value="cash">cash</option><option value="account">account</option></select></div>
          <div className="field"><label>Category</label><input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="rent, electricity, salary..." required /></div>
          <div className="field"><label>Amount</label><input type="number" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Expense amount" required /></div>
          <div className="field"><label>Note</label><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Bill no, month, or reason" /></div>
          <div className="field" style={{ justifyContent: "flex-end" }}><label>&nbsp;</label><Button type="submit">Save Expense</Button></div>
        </form>
      </PageSection>
      <PageSection title="Expense History" subtitle="Recent outflow across cash and bank">
        <div className="dashboard-mini-table">
          {expenses.map((entry) => (
            <div key={`${entry.source}-${entry.id}`} className="dashboard-mini-row">
              <div><strong>{entry.category}</strong><p>{entry.note || entry.createdByName}</p></div>
              <div className="dashboard-mini-values"><span>{formatCurrency(entry.amount)}</span><small>{entry.source} • {formatDate(entry.createdAt)}</small></div>
            </div>
          ))}
        </div>
      </PageSection>
    </div>
  );
}
