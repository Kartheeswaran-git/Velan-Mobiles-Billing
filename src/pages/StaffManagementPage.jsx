import { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { createOrUpdateUserProfile } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatDate } from "../utils/format";

const blankUser = {
  uid: "",
  name: "",
  phone: "",
  role: "staff",
  active: true,
};

export default function StaffManagementPage() {
  const users = useFirestoreCollection("users", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankUser);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (!form.uid) throw new Error("User UID is required");
      await createOrUpdateUserProfile(form.uid, form);
      setMessage("Staff profile saved successfully. Ensure this UID matches the user in Supabase Authentication.");
      setForm(blankUser);
    } catch (err) {
      setError(err.message);
    }
  }

  if (users.loading) {
    return <Loader text="Loading staff users..." />;
  }

  return (
    <div className="list-stack">
      <PageSection title="Add or Update Staff" subtitle="Important: You must first create the user in Supabase Auth, then paste their UID here.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label>User UID</label>
            <input 
              value={form.uid} 
              onChange={(event) => setForm((current) => ({ ...current, uid: event.target.value }))} 
              placeholder="Supabase auth user UUID" 
              required 
            />
          </div>
          <div className="field"><label>Name</label><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Staff full name" required /></div>
          <div className="field"><label>Phone</label><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Staff mobile number" /></div>
          <div className="field">
            <label>Role</label>
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="admin">admin</option>
              <option value="staff">staff</option>
            </select>
          </div>
          <div className="field">
            <label>Active</label>
            <select value={String(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === "true" }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <div className="topbar-actions">
              <Button type="submit">Save Staff</Button>
              {form.uid ? (
                <Button type="button" variant="secondary" onClick={() => setForm(blankUser)}>Clear</Button>
              ) : null}
            </div>
          </div>
        </form>
        {message ? <div className="badge success" style={{ marginTop: 16 }}>{message}</div> : null}
        {error ? <div className="badge danger" style={{ marginTop: 16 }}>{error}</div> : null}
      </PageSection>

      <PageSection title="Staff List" subtitle="Admin can review current user profiles">
        <DataTable
          rows={users.data}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "role", label: "Role" },
            { key: "active", label: "Status", render: (row) => <StatusBadge value={row.active ? "active" : "inactive"} /> },
            { key: "uid", label: "UID" },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => {
                    setForm({
                      uid: row.id || row.uid || "",
                      name: row.name || "",
                      phone: row.phone || "",
                      role: row.role || "staff",
                      active: row.active ?? true
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Edit
                </Button>
              )
            }
          ]}
        />
      </PageSection>
    </div>
  );
}
