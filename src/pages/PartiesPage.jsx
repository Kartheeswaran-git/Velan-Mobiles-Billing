import { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { addRecord, deleteRecord, updateRecord } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatDate } from "../utils/format";

const blankParty = {
  name: "",
  phone: "",
  aadharNo: "",
  address: "",
};

export default function PartiesPage() {
  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankParty);
  const [editingId, setEditingId] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  if (customers.loading) {
    return <Loader text="Loading parties..." />;
  }

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
        <DataTable
          rows={customers.data}
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
                  <Button type="button" variant="secondary" onClick={() => { setEditingId(row.id); setForm({ name: row.name || "", phone: row.phone || "", aadharNo: row.aadharNo || "", address: row.address || "" }); }}>Edit</Button>
                  <Button type="button" variant="danger" onClick={async () => { await deleteRecord("customers", row.id); if (editingId === row.id) { setForm(blankParty); setEditingId(""); } }}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      </PageSection>
    </div>
  );
}
