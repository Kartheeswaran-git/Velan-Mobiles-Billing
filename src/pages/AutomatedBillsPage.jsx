import { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { addRecord, deleteRecord, updateRecord } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";

const blankTemplate = {
  customerName: "",
  customerPhone: "",
  itemName: "",
  amount: "",
  frequency: "monthly",
  nextBillDate: "",
  status: "active",
  note: "",
};

export default function AutomatedBillsPage() {
  const templates = useFirestoreCollection("automated_bills", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankTemplate);

  async function handleSubmit(event) {
    event.preventDefault();
    await addRecord("automated_bills", { ...form, amount: Number(form.amount || 0) });
    setForm(blankTemplate);
  }

  if (templates.loading) return <Loader text="Loading automated bills..." />;

  return (
    <div className="list-stack">
      <PageSection title="Add Automated Bill" subtitle="Save repeat billing templates and next due dates">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label>Customer Name</label><input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Customer full name" required /></div>
          <div className="field"><label>Customer Phone</label><input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="Customer mobile number" /></div>
          <div className="field"><label>Item Name</label><input value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Monthly recharge, EMI, rental..." required /></div>
          <div className="field"><label>Amount</label><input type="number" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Recurring bill amount" /></div>
          <div className="field"><label>Frequency</label><select value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="custom">custom</option></select></div>
          <div className="field"><label>Next Bill Date</label><input type="date" value={form.nextBillDate} onChange={(event) => setForm((current) => ({ ...current, nextBillDate: event.target.value }))} /></div>
          <div className="field"><label>Status</label><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">active</option><option value="paused">paused</option></select></div>
          <div className="field"><label>Note</label><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Reminder or billing note" /></div>
          <div className="field" style={{ justifyContent: "flex-end" }}><label>&nbsp;</label><Button type="submit">Save Template</Button></div>
        </form>
      </PageSection>
      <PageSection title="Saved Templates" subtitle="Manage recurring bill reminders">
        <DataTable
          rows={templates.data}
          columns={[
            { key: "customerName", label: "Customer" },
            { key: "itemName", label: "Item" },
            { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
            { key: "frequency", label: "Frequency" },
            { key: "nextBillDate", label: "Next Bill", render: (row) => row.nextBillDate || "-" },
            { key: "status", label: "Status" },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            { key: "actions", label: "Action", render: (row) => <div className="topbar-actions"><Button type="button" variant="secondary" onClick={() => updateRecord("automated_bills", row.id, { status: row.status === "active" ? "paused" : "active" })}>{row.status === "active" ? "Pause" : "Resume"}</Button><Button type="button" variant="danger" onClick={() => deleteRecord("automated_bills", row.id)}>Delete</Button></div> },
          ]}
        />
      </PageSection>
    </div>
  );
}
