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

  async function handleSubmit(event) {
    event.preventDefault();
    await createOrUpdateUserProfile(form.uid, form);
    setMessage("Staff profile saved. Create the login user in Firebase Authentication if not already created.");
    setForm(blankUser);
  }

  if (users.loading) {
    return <Loader text="Loading staff users..." />;
  }

  return (
    <div className="list-stack">
      <PageSection title="Add or Update Staff" subtitle="Profiles are stored in the Supabase users table">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label>User UID</label><input value={form.uid} onChange={(event) => setForm((current) => ({ ...current, uid: event.target.value }))} placeholder="Supabase auth user UUID" required /></div>
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
            <Button type="submit">Save Staff</Button>
          </div>
        </form>
        {message ? <div className="badge success" style={{ marginTop: 16 }}>{message}</div> : null}
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
          ]}
        />
      </PageSection>
    </div>
  );
}
