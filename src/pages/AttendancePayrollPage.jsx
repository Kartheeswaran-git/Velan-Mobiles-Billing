import { useMemo, useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { upsertStaffAttendance } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";

const blankEntry = {
  staffName: "",
  attendanceDate: "",
  status: "present",
  salaryAmount: "",
  paidAmount: "",
  note: "",
};

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePayrollPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const users = useFirestoreCollection("users", { orderBy: { field: "createdAt", direction: "desc" } });
  const attendance = useFirestoreCollection("staff_attendance", {
    where: [{ field: "attendanceDate", operator: "==", value: selectedDate }],
    orderBy: { field: "createdAt", direction: "desc" },
  });
  const [form, setForm] = useState(blankEntry);
  const [saving, setSaving] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    await upsertStaffAttendance({
      ...form,
      attendanceDate: form.attendanceDate || selectedDate,
      salaryAmount: Number(form.salaryAmount || 0),
      paidAmount: Number(form.paidAmount || 0),
    });
    setForm(blankEntry);
  }

  const activeStaff = useMemo(() => {
    return users.data.filter((u) => u.role === "staff" && u.active);
  }, [users.data]);

  const attendanceMap = useMemo(() => {
    return attendance.data.reduce((map, row) => {
      map[row.staffName] = row;
      return map;
    }, {});
  }, [attendance.data]);

  async function markAttendance(staff, status) {
    setSaving(staff.name);
    try {
      const existing = attendanceMap[staff.name];
      await upsertStaffAttendance({
        staffId: staff.uid || staff.id,
        staffName: staff.name,
        attendanceDate: selectedDate,
        status,
        salaryAmount: existing?.salaryAmount || 0,
        paidAmount: existing?.paidAmount || 0,
        note: existing?.note || "",
      });
    } finally {
      setSaving("");
    }
  }

  async function markAll(status) {
    for (const staff of activeStaff) {
      // eslint-disable-next-line no-await-in-loop
      await markAttendance(staff, status);
    }
  }

  if (attendance.loading || users.loading) return <Loader text="Loading attendance register..." />;

  return (
    <div className="list-stack">
      <PageSection title="Attendance Register" subtitle="Mark daily attendance quickly (tap once per staff)">
        <div className="panel">
          <div className="form-grid" style={{ alignItems: "end" }}>
            <div className="field">
              <label>Date</label>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </div>
            <div className="field">
              <label>Bulk Actions</label>
              <div className="topbar-actions" style={{ justifyContent: "flex-start" }}>
                <Button type="button" onClick={() => markAll("present")}>Mark All Present</Button>
                <Button type="button" variant="secondary" onClick={() => markAll("absent")}>Mark All Absent</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="card-grid">
          {activeStaff.map((staff) => {
            const row = attendanceMap[staff.name];
            const status = row?.status || "not_marked";
            return (
              <div key={staff.uid || staff.name} className="panel" style={{ padding: 16 }}>
                <div className="panel-header" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{staff.name}</h3>
                    <div className="muted" style={{ marginTop: 4 }}>{staff.phone || ""}</div>
                  </div>
                  <StatusBadge value={status === "not_marked" ? "pending" : status} />
                </div>
                <div className="topbar-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                  <Button type="button" disabled={saving === staff.name} onClick={() => markAttendance(staff, "present")}>Present</Button>
                  <Button type="button" variant="secondary" disabled={saving === staff.name} onClick={() => markAttendance(staff, "half_day")}>Half Day</Button>
                  <Button type="button" variant="danger" disabled={saving === staff.name} onClick={() => markAttendance(staff, "absent")}>Absent</Button>
                </div>
                {row?.note ? <div className="muted" style={{ marginTop: 10 }}>{row.note}</div> : null}
              </div>
            );
          })}
        </div>
      </PageSection>

      <PageSection title="Payroll Entry (Optional)" subtitle="Use this only when paying salary or adding notes">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field"><label>Staff Name</label><input value={form.staffName} onChange={(event) => setForm((current) => ({ ...current, staffName: event.target.value }))} placeholder="Staff full name" required /></div>
          <div className="field"><label>Date</label><input type="date" value={form.attendanceDate || selectedDate} onChange={(event) => setForm((current) => ({ ...current, attendanceDate: event.target.value }))} /></div>
          <div className="field"><label>Status</label><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="present">present</option><option value="absent">absent</option><option value="half_day">half_day</option></select></div>
          <div className="field"><label>Salary Amount</label><input type="number" min="0" value={form.salaryAmount} onChange={(event) => setForm((current) => ({ ...current, salaryAmount: event.target.value }))} placeholder="Monthly salary" /></div>
          <div className="field"><label>Paid Amount</label><input type="number" min="0" value={form.paidAmount} onChange={(event) => setForm((current) => ({ ...current, paidAmount: event.target.value }))} placeholder="Amount paid now" /></div>
          <div className="field"><label>Note</label><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Advance, leave, overtime note" /></div>
          <div className="field" style={{ justifyContent: "flex-end" }}><label>&nbsp;</label><Button type="submit">Save Payroll Record</Button></div>
        </form>
      </PageSection>

      <PageSection title="Saved Register (Selected Date)" subtitle="Attendance entries for the chosen date">
        <DataTable
          rows={attendance.data}
          columns={[
            { key: "staffName", label: "Staff" },
            { key: "attendanceDate", label: "Date" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "salaryAmount", label: "Salary", render: (row) => formatCurrency(row.salaryAmount) },
            { key: "paidAmount", label: "Paid", render: (row) => formatCurrency(row.paidAmount) },
            { key: "createdAt", label: "Saved", render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </PageSection>
    </div>
  );
}
