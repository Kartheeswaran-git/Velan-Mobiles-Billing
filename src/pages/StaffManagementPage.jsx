import { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { createOrUpdateUserProfile, deleteUserProfile } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatDate } from "../utils/format";
import {
  CRUD_OPERATIONS,
  DEFAULT_STAFF_PERMISSIONS,
  normalizePermissions,
  PERMISSION_MODULES,
} from "../utils/permissions";

const createBlankUser = () => ({
  uid: "",
  name: "",
  phone: "",
  role: "staff",
  active: true,
  permissions: normalizePermissions(DEFAULT_STAFF_PERMISSIONS),
});

export default function StaffManagementPage() {
  const users = useFirestoreCollection("users", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(createBlankUser);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (!form.uid) throw new Error("User UID is required");
      await createOrUpdateUserProfile(form.uid, form);
      setMessage("Staff profile and permissions saved successfully.");
      setForm(createBlankUser());
    } catch (err) {
      setError(err.message);
    }
  }

  function togglePermission(module, operation) {
    setForm((current) => {
      const enabled = !current.permissions[module][operation];
      const modulePermissions = { ...current.permissions[module], [operation]: enabled };
      if (operation !== "read" && enabled) modulePermissions.read = true;
      if (operation === "read" && !enabled) {
        CRUD_OPERATIONS.forEach((item) => { modulePermissions[item] = false; });
      }
      return {
        ...current,
        permissions: { ...current.permissions, [module]: modulePermissions },
      };
    });
  }

  function setAllPermissions(enabled) {
    const permissions = normalizePermissions();
    PERMISSION_MODULES.forEach((module) => {
      (module.operations || CRUD_OPERATIONS).forEach((operation) => {
        permissions[module.key][operation] = enabled;
      });
    });
    setForm((current) => ({ ...current, permissions }));
  }

  async function handleDelete(row) {
    const uid = row.id || row.uid;
    if (!uid || !window.confirm(`Delete ${row.name || "this staff profile"}? Their Auth account will remain in Supabase.`)) return;
    setError("");
    setMessage("");
    try {
      await deleteUserProfile(uid);
      if (form.uid === uid) setForm(createBlankUser());
      setMessage("Staff profile deleted. The matching Supabase Auth account was not deleted.");
    } catch (err) {
      setError(err.message);
    }
  }

  function editUser(row) {
    setForm({
      uid: row.id || row.uid || "",
      name: row.name || "",
      phone: row.phone || "",
      role: row.role || "staff",
      active: row.active ?? true,
      permissions: normalizePermissions(row.permissions || DEFAULT_STAFF_PERMISSIONS),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (users.loading) return <Loader text="Loading staff users..." />;

  return (
    <div className="list-stack">
      <PageSection title="Add or Update Staff" subtitle="Create the user in Supabase Auth first, then paste their UID here.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label>User UID</label><input value={form.uid} onChange={(event) => setForm((current) => ({ ...current, uid: event.target.value }))} placeholder="Supabase auth user UUID" required /></div>
          <div className="field"><label>Name</label><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Staff full name" required /></div>
          <div className="field"><label>Phone</label><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Staff mobile number" /></div>
          <div className="field"><label>Role</label><select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}><option value="admin">admin</option><option value="staff">staff</option></select></div>
          <div className="field"><label>Active</label><select value={String(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === "true" }))}><option value="true">true</option><option value="false">false</option></select></div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <div className="topbar-actions">
              <Button type="submit">Save Staff</Button>
              {form.uid ? <Button type="button" variant="secondary" onClick={() => setForm(createBlankUser())}>Clear</Button> : null}
            </div>
          </div>
        </form>

        {form.role === "staff" ? (
          <div className="permission-editor">
            <div className="permission-editor-header">
              <div><h3>Staff Permissions</h3><p>Choose what this staff member can create, view, change, and delete.</p></div>
              <div className="topbar-actions">
                <Button type="button" variant="secondary" onClick={() => setAllPermissions(true)}>Allow All</Button>
                <Button type="button" variant="secondary" onClick={() => setAllPermissions(false)}>Clear All</Button>
              </div>
            </div>
            <div className="table-wrap permission-table-wrap">
              <table className="permission-table">
                <thead><tr><th>Module</th>{CRUD_OPERATIONS.map((operation) => <th key={operation}>{operation}</th>)}</tr></thead>
                <tbody>
                  {PERMISSION_MODULES.map((module) => {
                    const supported = module.operations || CRUD_OPERATIONS;
                    return (
                      <tr key={module.key}>
                        <td><strong>{module.label}</strong></td>
                        {CRUD_OPERATIONS.map((operation) => (
                          <td key={operation}>
                            {supported.includes(operation) ? (
                              <input className="permission-checkbox" type="checkbox" aria-label={`${module.label} ${operation}`} checked={Boolean(form.permissions[module.key]?.[operation])} onChange={() => togglePermission(module.key, operation)} />
                            ) : <span className="permission-unavailable">-</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {message ? <div className="badge success" style={{ marginTop: 16 }}>{message}</div> : null}
        {error ? <div className="badge danger" style={{ marginTop: 16 }}>{error}</div> : null}
      </PageSection>

      <PageSection title="Staff List" subtitle="Review profiles and adjust access at any time">
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
                <div className="topbar-actions">
                  <Button type="button" variant="secondary" onClick={() => editUser(row)}>Edit Rights</Button>
                  {row.role !== "admin" ? <Button type="button" variant="danger" onClick={() => handleDelete(row)}>Delete</Button> : null}
                </div>
              ),
            },
          ]}
        />
      </PageSection>
    </div>
  );
}
