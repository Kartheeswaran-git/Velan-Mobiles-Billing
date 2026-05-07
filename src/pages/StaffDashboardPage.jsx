import { useEffect, useState } from "react";
import Button from "../components/Button";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { upsertStaffAttendance } from "../supabase/database";
import { formatCurrency, formatDate, isSameDay } from "../utils/format";

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const bills = useFirestoreCollection("bills", {
    where: [{ field: "createdBy", operator: "==", value: user.uid }],
    orderBy: { field: "createdAt", direction: "desc" },
  });
  const jobs = useFirestoreCollection("service_jobs", {
    orderBy: { field: "receivedAt", direction: "desc" },
  });

  const [localChecked, setLocalChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const attendance = useFirestoreCollection("staff_attendance", {
    where: [
      { field: "staffId", operator: "==", value: user.uid || user.id },
      { field: "attendanceDate", operator: "==", value: today }
    ],
    limit: 1
  });

  const todayAttendance = attendance.data[0];
  const isOnline = todayAttendance?.status === "present";

  // Sync local state with database state
  useEffect(() => {
    if (!attendance.loading) {
      setLocalChecked(isOnline);
    }
  }, [isOnline, attendance.loading]);

  if (bills.loading || jobs.loading || attendance.loading) {
    return <Loader text="Loading staff dashboard..." />;
  }

  const todayBills = bills.data.filter((bill) => isSameDay(bill.createdAt));
  const todaySales = todayBills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);

  async function updateAttendance(checked) {
    setLocalChecked(checked);
    const status = checked ? "present" : "absent";
    
    setSubmitting(true);
    setError("");
    try {
      await upsertStaffAttendance({
        staffId: user.uid || user.id,
        staffName: user.name,
        attendanceDate: today,
        status: status
      });
    } catch (err) {
      setError(err.message);
      // Revert on error
      setLocalChecked(!checked);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="list-stack">
      <PageSection 
        title="Attendance Control" 
        subtitle="Your daily presence is tracked automatically"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {error && <span className="badge danger">{error}</span>}
            {todayAttendance ? (
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Last: {new Date(todayAttendance.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
            <label className="switch">
              <input 
                type="checkbox" 
                checked={localChecked} 
                disabled={submitting}
                onChange={(e) => updateAttendance(e.target.checked)} 
              />
              <span className="slider">
                <span className="label-online">ONLINE</span>
                <span className="label-offline">OFFLINE</span>
              </span>
            </label>
          </div>
        }
      />

      <div className="card-grid">
        <StatCard label="Today Sales" value={formatCurrency(todaySales)} hint={`${todayBills.length} bills created`} />
        <StatCard label="My Bills" value={bills.data.length} hint="Total saved bills" />
        <StatCard label="Open Service Jobs" value={jobs.data.filter((job) => job.status !== "delivered").length} hint="Active service queue" />
      </div>

      <PageSection title="Recent Bills" subtitle="Only your own billing records are shown">
        <DataTable
          rows={bills.data.slice(0, 8)}
          columns={[
            { key: "billNo", label: "Bill No" },
            { key: "customerName", label: "Customer" },
            { key: "total", label: "Total", render: (row) => formatCurrency(row.total) },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </PageSection>

      <PageSection title="Recent Service Jobs" subtitle="Track the most recent active device repairs">
        <DataTable
          rows={jobs.data.slice(0, 8)}
          columns={[
            { key: "jobNo", label: "Job No" },
            { key: "customerName", label: "Customer" },
            { key: "model", label: "Model" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "receivedAt", label: "Received", render: (row) => formatDate(row.receivedAt) },
          ]}
        />
      </PageSection>
    </div>
  );
}
