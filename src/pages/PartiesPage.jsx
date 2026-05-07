import { useState, useMemo } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { addRecord, deleteRecord, updateRecord } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";

const blankParty = {
  name: "",
  phone: "",
  aadharNo: "",
  address: "",
};

export default function PartiesPage() {
  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  const bills = useFirestoreCollection("bills", { orderBy: { field: "createdAt", direction: "desc" } });
  const services = useFirestoreCollection("service_jobs", { orderBy: { field: "createdAt", direction: "desc" } });
  const transfers = useFirestoreCollection("money_transfers", { orderBy: { field: "createdAt", direction: "desc" } });

  const [form, setForm] = useState(blankParty);
  const [editingId, setEditingId] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const filteredParties = useMemo(() => {
    if (!search) return customers.data;
    const s = search.toLowerCase();
    return customers.data.filter(c => 
      c.name?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s)
    );
  }, [customers.data, search]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updateRecord("customers", editingId, form);
      } else {
        await addRecord("customers", form);
      }
      setForm(blankParty);
      setEditingId("");
    } finally {
      setSubmitting(false);
    }
  }

  if (customers.loading || bills.loading || services.loading || transfers.loading) {
    return <Loader text="Loading parties and history..." />;
  }

  const selectedParty = customers.data.find(c => c.id === selectedPartyId);
  const partyHistory = selectedParty ? {
    bills: bills.data.filter(b => b.customerPhone === selectedParty.phone),
    services: services.data.filter(s => s.customerPhone === selectedParty.phone),
    transfers: transfers.data.filter(t => t.customerPhone === selectedParty.phone)
  } : null;

  return (
    <div className="list-stack">
      <PageSection title={editingId ? "Edit Party" : "Add Party"} subtitle="Manage customer and supplier contact details">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Customer or supplier name" required />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Mobile number" required />
          </div>
          <div className="field">
            <label>Aadhaar No</label>
            <input value={form.aadharNo} onChange={(event) => setForm((current) => ({ ...current, aadharNo: event.target.value }))} placeholder="Aadhaar number optional" />
          </div>
          <div className="field">
            <label>Address (Optional)</label>
            <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Street, area, city optional" />
          </div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <div className="topbar-actions">
              <Button type="submit" disabled={submitting}>{editingId ? "Update Party" : "Save Party"}</Button>
              {editingId ? <Button type="button" variant="secondary" onClick={() => { setForm(blankParty); setEditingId(""); }}>Cancel</Button> : null}
            </div>
          </div>
        </form>
      </PageSection>

      <PageSection title="All Parties" subtitle="Customers available for billing and follow-up">
        <div className="field" style={{ marginBottom: '16px', maxWidth: '400px' }}>
          <input 
            placeholder="Search by Name or Phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <DataTable
          rows={filteredParties}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "aadharNo", label: "Aadhaar No" },
            { key: "address", label: "Address" },
            { key: "createdAt", label: "Added", render: (row) => formatDate(row.createdAt) },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <div className="topbar-actions">
                  <Button type="button" variant="secondary" onClick={() => setSelectedPartyId(row.id)}>History</Button>
                  <Button type="button" variant="secondary" onClick={() => { setEditingId(row.id); setForm({ name: row.name || "", phone: row.phone || "", aadharNo: row.aadharNo || "", address: row.address || "" }); }}>Edit</Button>
                  <Button type="button" variant="danger" onClick={async () => { if(confirm("Delete this party?")) await deleteRecord("customers", row.id); if (editingId === row.id) { setForm(blankParty); setEditingId(""); } }}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      </PageSection>

      {selectedParty && (
        <PageSection 
          title={`History for ${selectedParty.name}`} 
          subtitle={`Transactions and records for ${selectedParty.phone}`}
          actions={<Button variant="secondary" onClick={() => setSelectedPartyId("")}>Close History</Button>}
        >
          <div className="dashboard-main-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <div className="billing-block">
              <div className="billing-block-header"><h3>Recent Bills</h3></div>
              {partyHistory.bills.length > 0 ? (
                <div className="list-stack">
                  {partyHistory.bills.map(b => (
                    <div key={b.id} className="summary-row">
                      <span>{b.billNo} • {formatDate(b.createdAt)}</span>
                      <strong>{formatCurrency(b.total)}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">No billing history found.</p>}
            </div>

            <div className="billing-block">
              <div className="billing-block-header"><h3>Service Jobs</h3></div>
              {partyHistory.services.length > 0 ? (
                <div className="list-stack">
                  {partyHistory.services.map(s => (
                    <div key={s.id} className="summary-row">
                      <span>{s.jobNo} • {s.model}</span>
                      <strong style={{ textTransform: 'capitalize' }}>{s.status.replace('_', ' ')}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">No service history found.</p>}
            </div>

            <div className="billing-block">
              <div className="billing-block-header"><h3>Money Transfers</h3></div>
              {partyHistory.transfers.length > 0 ? (
                <div className="list-stack">
                  {partyHistory.transfers.map(t => (
                    <div key={t.id} className="summary-row">
                      <span>{t.transferNo} • {formatDate(t.createdAt)}</span>
                      <strong>{formatCurrency(t.transferAmount)}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">No transfer history found.</p>}
            </div>
          </div>
        </PageSection>
      )}
    </div>
  );
}
