import { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { addRecord, updateRecord } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate, formatDateKey } from "../utils/format";

const blankOrder = {
  customerName: "",
  customerPhone: "",
  platform: "whatsapp",
  itemName: "",
  amount: "",
  status: "new",
  note: "",
};

export default function OnlineOrdersPage() {
  const orders = useFirestoreCollection("online_orders", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankOrder);

  async function handleSubmit(event) {
    event.preventDefault();
    await addRecord("online_orders", {
      ...form,
      orderNo: `ORD-${formatDateKey(new Date())}-${Math.floor(Date.now() / 1000).toString().slice(-4)}`,
      amount: Number(form.amount || 0),
    });
    setForm(blankOrder);
  }

  if (orders.loading) return <Loader text="Loading online orders..." />;

  return (
    <div className="list-stack">
      <PageSection title="Online Orders" subtitle="Track WhatsApp, Instagram, and website order leads">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label>Customer Name</label><input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Customer full name" required /></div>
          <div className="field"><label>Customer Phone</label><input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="WhatsApp/mobile number" required /></div>
          <div className="field"><label>Platform</label><select value={form.platform} onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value }))}><option value="whatsapp">whatsapp</option><option value="instagram">instagram</option><option value="website">website</option><option value="call">call</option></select></div>
          <div className="field"><label>Item Name</label><input value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Requested phone or accessory" required /></div>
          <div className="field"><label>Amount</label><input type="number" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Expected order value" /></div>
          <div className="field"><label>Status</label><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="new">new</option><option value="confirmed">confirmed</option><option value="packed">packed</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option></select></div>
          <div className="field"><label>Note</label><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Delivery, color, or follow-up note" /></div>
          <div className="field" style={{ justifyContent: "flex-end" }}><label>&nbsp;</label><Button type="submit">Save Order</Button></div>
        </form>
      </PageSection>
      <PageSection title="Order List" subtitle="All online order entries">
        <DataTable
          rows={orders.data}
          columns={[
            { key: "orderNo", label: "Order No" },
            { key: "customerName", label: "Customer" },
            { key: "platform", label: "Platform" },
            { key: "itemName", label: "Item" },
            { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
            { key: "status", label: "Status" },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            { key: "update", label: "Action", render: (row) => <Button type="button" variant="secondary" onClick={() => updateRecord("online_orders", row.id, { status: row.status === "new" ? "confirmed" : row.status === "confirmed" ? "packed" : row.status === "packed" ? "delivered" : row.status })}>Advance Status</Button> },
          ]}
        />
      </PageSection>
    </div>
  );
}
