import { useEffect, useMemo, useState } from "react";
import Autocomplete from "../components/Autocomplete";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import { createServiceJob, updateServiceJob, updateServiceStatus, deliverServiceJob } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { serviceStatuses } from "../utils/constants";
import { formatCurrency, formatDate, isClosedForDate, isSameDay } from "../utils/format";

const blankJob = {
  customerName: "",
  customerPhone: "",
  boxNo: "",
  brand: "",
  model: "",
  imei: "",
  problem: "",
  estimate: "",
  sparePartsCost: "",
  receivedAt: toDateTimeInputValue(new Date()),
  estimatedDeliveryAt: "",
  status: "received",
};

function toDateTimeInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function humanizeStatus(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizePhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

function buildWhatsappMessage(job) {
  return `Hi ${job.customerName},
Your mobile service job has been created.
Job Number: ${job.jobNo}
Box Number: ${job.boxNo}
Mobile: ${[job.brand, job.model].filter(Boolean).join(" ")}
Problem: ${job.problem}
Estimated Cost: ${formatCurrency(job.estimate)}
Status: ${humanizeStatus(job.status)}`;
}

function printServiceCard(job, shopSettings = {}) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  const shopName = shopSettings.shopName || "Velan Mobiles";
  const address = shopSettings.address || "";
  const phone = shopSettings.shopPhone || "";

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Service Card ${job.jobNo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
          .card { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; }
          .top { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 12px; }
          .brand { font-size: 24px; font-weight: 700; color: #b91c1c; }
          .muted { color: #475569; font-size: 13px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
          .item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
          .label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
          .value { font-size: 14px; font-weight: 600; color: #0f172a; }
          .problem { margin-top: 12px; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px; }
          @media print { body { padding: 0; } .card { border: none; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="top">
            <div>
              <div class="brand">${shopName}</div>
              <div class="muted">${address}</div>
              <div class="muted">${phone}</div>
            </div>
            <div>
              <div class="value">Service Card</div>
              <div class="muted">Received: ${formatDate(job.receivedAt)}</div>
            </div>
          </div>
          <div class="grid">
            <div class="item"><div class="label">Job Number</div><div class="value">${job.jobNo}</div></div>
            <div class="item"><div class="label">Box Number</div><div class="value">${job.boxNo}</div></div>
            <div class="item"><div class="label">Customer Name</div><div class="value">${job.customerName}</div></div>
            <div class="item"><div class="label">Customer Phone</div><div class="value">${job.customerPhone}</div></div>
            <div class="item"><div class="label">Mobile Model</div><div class="value">${[job.brand, job.model].filter(Boolean).join(" ") || "-"}</div></div>
            <div class="item"><div class="label">IMEI</div><div class="value">${job.imei || "-"}</div></div>
            <div class="item"><div class="label">Estimated Cost</div><div class="value">${formatCurrency(job.estimate)}</div></div>
            <div class="item"><div class="label">Estimated Delivery</div><div class="value">${job.estimatedDeliveryAt ? formatDate(job.estimatedDeliveryAt) : "-"}</div></div>
            <div class="item"><div class="label">Status</div><div class="value">${humanizeStatus(job.status)}</div></div>
          </div>
          <div class="problem">
            <div class="label">Problem</div>
            <div class="value">${job.problem || "-"}</div>
          </div>
        </div>
        <script>window.onload = function () { window.print(); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export default function ServiceJobsPage() {
  const { user } = useAuth();
  const jobs = useFirestoreCollection("service_jobs", {
    orderBy: { field: "receivedAt", direction: "asc" },
  });
  const settings = useFirestoreCollection("app_settings", { orderBy: { field: "createdAt", direction: "desc" } });
  const closings = useFirestoreCollection("daily_closings", { orderBy: { field: "closingDate", direction: "desc" } });
  const [form, setForm] = useState(blankJob);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastCreatedJob, setLastCreatedJob] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryJob, setDeliveryJob] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState({ finalAmount: 0, paymentType: 'cash', sparePartsCost: 0 });

  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  
  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
  const matchedCustomer = customers.data.find((c) => {
    const typedPhone = normalizePhone(form.customerPhone);
    if (typedPhone.length >= 5 && normalizePhone(c.phone) === typedPhone) return true;
    if (form.customerName.length >= 3 && c.name.toLowerCase().trim() === form.customerName.toLowerCase().trim()) return true;
    return false;
  });

  useEffect(() => {
    if (!matchedCustomer) return;
    setForm((current) => ({
      ...current,
      customerName: matchedCustomer.name || current.customerName,
      customerPhone: matchedCustomer.phone || current.customerPhone,
    }));
  }, [matchedCustomer?.id]);

  const currentSettings = settings.data[0] || {};
  const queueRows = useMemo(() => {
    return jobs.data
      .filter((job) => job.status !== "delivered")
      .filter((job) => (statusFilter === "all" ? true : job.status === statusFilter))
      .filter((job) => {
        const text = `${job.customerName} ${job.customerPhone} ${job.jobNo} ${job.boxNo}`.toLowerCase();
        return text.includes(search.toLowerCase());
      });
  }, [jobs.data, search, statusFilter]);

  const historyRows = useMemo(() => {
    return jobs.data
      .filter((job) => job.status === "delivered")
      .filter((job) => {
        const text = `${job.customerName} ${job.customerPhone} ${job.jobNo} ${job.boxNo}`.toLowerCase();
        return text.includes(search.toLowerCase());
      });
  }, [jobs.data, search]);

  const dashboard = useMemo(() => {
    const underRepairStatuses = ["checking", "waiting_approval", "repairing"];
    return {
      receivedToday: jobs.data.filter((job) => isSameDay(job.receivedAt)).length,
      underRepair: jobs.data.filter((job) => underRepairStatuses.includes(job.status)).length,
      ready: jobs.data.filter((job) => job.status === "ready").length,
      delivered: jobs.data.filter((job) => job.status === "delivered").length,
    };
  }, [jobs.data]);

  function startEdit(job) {
    setEditingId(job.id);
    setForm({
      customerName: job.customerName || "",
      customerPhone: job.customerPhone || "",
      boxNo: job.boxNo || "",
      brand: job.brand || "",
      model: job.model || "",
      imei: job.imei || "",
      problem: job.problem || "",
      estimate: job.estimate || "",
      advance: job.advance || "",
      sparePartsCost: job.sparePartsCost || "",
      receivedAt: job.receivedAt ? job.receivedAt.slice(0, 16) : toDateTimeInputValue(new Date()),
      estimatedDeliveryAt: job.estimatedDeliveryAt ? job.estimatedDeliveryAt.slice(0, 16) : "",
      status: job.status || "received",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm({ ...blankJob, receivedAt: toDateTimeInputValue(new Date()) });
    setEditingId("");
    setLastCreatedJob(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        sparePartsCost: Number(form.sparePartsCost || 0),
        boxNo: String(form.boxNo || "").trim(),
        receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : new Date().toISOString(),
        estimatedDeliveryAt: form.estimatedDeliveryAt ? new Date(form.estimatedDeliveryAt).toISOString() : null,
      };

      if (editingId) {
        const original = jobs.data.find((job) => job.id === editingId);
        if (original && isClosedForDate(original.receivedAt, closings.data)) {
          setError("This service job date is already closed. Create a correction entry instead of editing closed history.");
          return;
        }
        await updateServiceJob(editingId, payload);
        setMessage(`Service job ${payload.boxNo || "updated"} saved successfully.`);
        resetForm();
      } else {
        const createdJob = await createServiceJob(payload, user);
        setLastCreatedJob(createdJob);
        setForm({ ...blankJob, receivedAt: toDateTimeInputValue(new Date()) });
        const whatsappPhone = normalizePhoneNumber(createdJob.customerPhone);
        if (whatsappPhone) {
          const text = encodeURIComponent(buildWhatsappMessage(createdJob));
          window.open(`https://wa.me/${whatsappPhone}?text=${text}`, "_blank");
        }
        setMessage(`Service job created: ${createdJob.jobNo} • Box ${createdJob.boxNo}`);
      }
    } catch (submitError) {
      setError(submitError.message || "Failed to save service job.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id, status) {
    if (status === "delivered") {
      const job = jobs.data.find(j => j.id === id);
      if (job) openDeliveryModal(job);
      return;
    }
    try {
      const job = jobs.data.find(j => j.id === id);
      if (job && isClosedForDate(job.receivedAt, closings.data)) {
        alert("This service job date is already closed. Create a correction entry instead.");
        return;
      }
      await updateServiceStatus(id, status);
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  }

  function openDeliveryModal(job) {
    setDeliveryJob(job);
    setDeliveryForm({
      finalAmount: job.estimate || 0,
      paymentType: 'cash',
      sparePartsCost: job.sparePartsCost || 0
    });
  }

  async function handleDeliverSubmit() {
    try {
      setSubmitting(true);
      if (isClosedForDate(new Date(), closings.data)) {
        alert("Today is already closed. Reopen/correct the day before recording delivery.");
        return;
      }
      await deliverServiceJob({
        jobId: deliveryJob.id,
        finalAmount: deliveryForm.finalAmount,
        paymentType: deliveryForm.paymentType,
        sparePartsCost: deliveryForm.sparePartsCost
      });
      setDeliveryJob(null);
      setMessage(`Service job ${deliveryJob.jobNo} marked as delivered and payment recorded.`);
    } catch (err) {
      alert("Delivery failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExpenseChange(id, value) {
    try {
      const job = jobs.data.find(j => j.id === id);
      if (job && isClosedForDate(job.receivedAt, closings.data)) {
        alert("This service job date is already closed. Create a correction entry instead.");
        return;
      }
      await updateServiceJob(id, { sparePartsCost: Number(value || 0) });
    } catch (err) {
      alert("Failed to update spare cost: " + err.message);
    }
  }

  if (jobs.loading || closings.loading) {
    return <Loader text="Loading service jobs..." />;
  }

  return (
    <div className="compact-page">
      <div className="dashboard-shell">
      <div className="dashboard-overview-grid">
        <div className="overview-card overview-card-neutral">
          <div className="overview-card-label">Received Today</div>
          <div className="overview-card-value">{dashboard.receivedToday}</div>
          <div className="overview-card-note">New devices entered today</div>
        </div>
        <div className="overview-card overview-card-danger">
          <div className="overview-card-label">Under Repair</div>
          <div className="overview-card-value">{dashboard.underRepair}</div>
          <div className="overview-card-note">Checking, repairing, or waiting</div>
        </div>
        <div className="overview-card overview-card-success">
          <div className="overview-card-label">Ready For Delivery</div>
          <div className="overview-card-value">{dashboard.ready}</div>
          <div className="overview-card-note">Repairs completed</div>
        </div>
        <div className="overview-card overview-card-money">
          <div className="overview-card-label">Delivered Phones</div>
          <div className="overview-card-value">{dashboard.delivered}</div>
          <div className="overview-card-note">Total jobs completed and closed</div>
        </div>
      </div>

      <div className={lastCreatedJob || editingId ? "billing-grid" : "list-stack"}>
        <div className="billing-main">
          <PageSection 
            title={editingId ? "Edit Service Job" : "New Service Job"} 
            subtitle={editingId ? `Editing ${form.brand} ${form.model}` : "Receive phone service requests"}
            actions={editingId && <Button variant="secondary" onClick={resetForm}>Cancel Edit</Button>}
          >
            <form className="list-stack" onSubmit={handleSubmit}>
              <div className="form-grid">
                  <Autocomplete
                    label="Customer Name"
                    placeholder="Search by name..."
                    value={form.customerName}
                    suggestions={customers.data.map(c => c.name)}
                    onChange={(e) => setForm(curr => ({ ...curr, customerName: e.target.value }))}
                    onSelect={(name) => {
                      const found = customers.data.find(c => c.name === name);
                      if (found) {
                        setForm(curr => ({
                          ...curr,
                          customerName: found.name,
                          customerPhone: found.phone || ""
                        }));
                      }
                    }}
                    required
                  />
                  <Autocomplete
                    label="Customer Phone"
                    placeholder="Customer mobile number"
                    value={form.customerPhone}
                    suggestions={customers.data.map(c => c.phone).filter(Boolean)}
                    hint={matchedCustomer ? "✓ Profile Linked" : null}
                    onChange={(e) => setForm(curr => ({ ...curr, customerPhone: e.target.value }))}
                    onSelect={(phone) => {
                      const found = customers.data.find(c => normalizePhone(c.phone) === normalizePhone(phone));
                      if (found) {
                        setForm(curr => ({
                          ...curr,
                          customerName: found.name || "",
                          customerPhone: found.phone
                        }));
                      }
                    }}
                    required
                  />
                <div className="field">
                  <label>Box Number</label>
                  <input value={form.boxNo} onChange={(event) => setForm((current) => ({ ...current, boxNo: event.target.value }))} placeholder="BX-001 (Optional)" />
                </div>
                <div className="field">
                  <label>Brand</label>
                  <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} placeholder="Samsung, Redmi, Vivo..." required />
                </div>
                <div className="field">
                  <label>Model</label>
                  <input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="A15, Note 10, Y21..." required />
                </div>
                <div className="field">
                  <label>IMEI</label>
                  <input value={form.imei} onChange={(event) => setForm((current) => ({ ...current, imei: event.target.value }))} placeholder="IMEI optional" />
                </div>
                <div className="field">
                  <label>Estimated Cost</label>
                  <input type="number" min="0" value={form.estimate} onChange={(event) => setForm((current) => ({ ...current, estimate: event.target.value }))} placeholder="Estimated service charge" />
                </div>
                <div className="field">
                  <label>Advance Amount</label>
                  <input type="number" min="0" value={form.advance} onChange={(event) => setForm((current) => ({ ...current, advance: event.target.value }))} placeholder="Advance paid" />
                </div>
                <div className="field">
                  <label>Spare Parts Cost (Expense)</label>
                  <input type="number" min="0" value={form.sparePartsCost} onChange={(event) => setForm((current) => ({ ...current, sparePartsCost: event.target.value }))} placeholder="Cost of spares used" />
                </div>
                <div className="field">
                  <label>Received Date & Time</label>
                  <input type="datetime-local" value={form.receivedAt} onChange={(event) => setForm((current) => ({ ...current, receivedAt: event.target.value }))} required />
                </div>
                <div className="field">
                  <label>Estimated Delivery</label>
                  <input type="datetime-local" value={form.estimatedDeliveryAt} onChange={(event) => setForm((current) => ({ ...current, estimatedDeliveryAt: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Initial Status</label>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {serviceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeStatus(status)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Problem Description</label>
                <textarea value={form.problem} onChange={(event) => setForm((current) => ({ ...current, problem: event.target.value }))} placeholder="Display broken, charging issue, software problem..." required />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Update Service Job" : "Save Service Job"}
              </Button>
            </form>
          </PageSection>
        </div>

        {lastCreatedJob ? (
          <div className="billing-side">
            <PageSection title="Customer Service Card" subtitle="Share this with customer immediately">
              <div className="panel" style={{ borderTopColor: 'var(--success)' }}>
                <div className="summary-row"><span>Job Number</span><strong>{lastCreatedJob.jobNo}</strong></div>
                <div className="summary-row"><span>Box Number</span><strong>{lastCreatedJob.boxNo}</strong></div>
                <div className="summary-row"><span>Customer</span><strong>{lastCreatedJob.customerName}</strong></div>
                <div className="summary-row"><span>Mobile</span><strong>{[lastCreatedJob.brand, lastCreatedJob.model].filter(Boolean).join(" ") || "-"}</strong></div>
                <div className="summary-row"><span>Problem</span><strong>{lastCreatedJob.problem || "-"}</strong></div>
                <div className="summary-row"><span>Estimated Cost</span><strong>{formatCurrency(lastCreatedJob.estimate)}</strong></div>
                <div className="summary-row"><span>Advance Paid</span><strong>{formatCurrency(lastCreatedJob.advance)}</strong></div>
                <div className="summary-row"><span>Balance</span><strong>{formatCurrency(Math.max(0, Number(lastCreatedJob.estimate || 0) - Number(lastCreatedJob.advance || 0)))}</strong></div>
                <div className="topbar-actions" style={{ marginTop: 20 }}>
                  <Button type="button" onClick={() => printServiceCard(lastCreatedJob, currentSettings)}>Print Card</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const whatsappPhone = normalizePhoneNumber(lastCreatedJob.customerPhone);
                      if (!whatsappPhone) return;
                      const text = encodeURIComponent(buildWhatsappMessage(lastCreatedJob));
                      window.open(`https://wa.me/${whatsappPhone}?text=${text}`, "_blank");
                    }}
                  >
                    WhatsApp
                  </Button>
                </div>
              </div>
            </PageSection>
          </div>
        ) : null}
      </div>

      <PageSection title="Queue Management" subtitle="Active service jobs in queue order">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Search</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Customer, phone, job no, box no"
            />
          </div>
          <div className="field">
            <label>Filter By Status</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All Active</option>
              {serviceStatuses.filter((status) => status !== "delivered").map((status) => (
                <option key={status} value={status}>
                  {humanizeStatus(status)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DataTable
          rows={queueRows}
          columns={[
            { key: "jobNo", label: "Job / Box", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700 }}>{row.jobNo}</span>
                <span className="muted" style={{ fontSize: '0.8rem' }}>{row.boxNo}</span>
              </div>
            )},
            { key: "customerName", label: "Customer", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong>{row.customerName}</strong>
                <span className="muted" style={{ fontSize: '0.8rem' }}>{row.customerPhone}</span>
              </div>
            )},
            { key: "device", label: "Device & Problem", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '240px' }}>
                <strong>{row.model}</strong>
                <span className="muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.problem}
                </span>
              </div>
            )},
            { key: "estimate", label: "Estimate / Profit", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong title="Estimate Cost">{formatCurrency(row.estimate)}</strong>
                <span className="muted" style={{ fontSize: '0.75rem' }}>Exp: {formatCurrency(row.sparePartsCost)}</span>
                <span className="badge success" style={{ fontSize: '0.75rem', padding: '2px 6px', marginTop: '4px' }}>
                  Profit: {formatCurrency(Number(row.estimate || 0) - Number(row.sparePartsCost || 0))}
                </span>
              </div>
            )},
            {
              key: "expense_update",
              label: "Update Expense",
              render: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Spare Cost</label>
                  <input
                    key={`${row.id}-${row.sparePartsCost}`}
                    type="number"
                    className="table-input"
                    style={{ width: '100px', fontSize: '0.8rem', padding: '4px 8px' }}
                    defaultValue={row.sparePartsCost}
                    onBlur={(e) => handleExpenseChange(row.id, e.target.value)}
                  />
                </div>
              ),
            },
            {
              key: "status_update",
              label: "Current Status",
              render: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', minWidth: '130px' }}>
                  <StatusBadge value={row.status} />
                  <select
                    className="table-input"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                    value={row.status}
                    onChange={(event) => handleStatusChange(row.id, event.target.value)}
                  >
                    {serviceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeStatus(status)}
                      </option>
                    ))}
                  </select>
                </div>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div style={{ display: "flex", gap: "4px", justifyContent: 'center' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => printServiceCard(row, currentSettings)}
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    title="Print Receipt"
                  >
                    Print
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const whatsappPhone = normalizePhoneNumber(row.customerPhone);
                      if (!whatsappPhone) return;
                      const text = encodeURIComponent(buildWhatsappMessage(row));
                      window.open(`https://wa.me/${whatsappPhone}?text=${text}`, "_blank");
                    }}
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    title="WhatsApp Customer"
                  >
                    WA
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => startEdit(row)}
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    title="Edit Job"
                  >
                    Edit
                  </Button>
                  {row.status === 'ready' && (
                    <Button
                      type="button"
                      onClick={() => openDeliveryModal(row)}
                      style={{ padding: '6px 8px', fontSize: '0.8rem', background: 'var(--success)', color: 'white', borderColor: 'var(--success)' }}
                    >
                      Deliver
                    </Button>
                  )}
                </div>
              ),
            },
            { key: "receivedAt", label: "Received", render: (row) => (
              <span style={{ fontSize: '0.85rem' }}>{formatDate(row.receivedAt)}</span>
            )},
          ]}
          emptyText="No active service jobs in queue."
        />
      </PageSection>

      <PageSection title="Service History" subtitle="Completed and delivered service jobs">
        <DataTable
          rows={historyRows}
          columns={[
            { key: "jobNo", label: "Job / Box", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700 }}>{row.jobNo}</span>
                <span className="muted" style={{ fontSize: '0.8rem' }}>{row.boxNo}</span>
              </div>
            )},
            { key: "customerName", label: "Customer", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong>{row.customerName}</strong>
                <span className="muted" style={{ fontSize: '0.8rem' }}>{row.customerPhone}</span>
              </div>
            )},
            { key: "device", label: "Device & Problem", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '240px' }}>
                <strong>{row.model}</strong>
                <span className="muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.problem}
                </span>
              </div>
            )},
            { key: "financials", label: "Financials / Profit", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong>Paid: {formatCurrency(row.finalAmount || row.estimate)}</strong>
                <span className="muted" style={{ fontSize: '0.75rem' }}>Expense: {formatCurrency(row.sparePartsCost)}</span>
                <span className="badge success" style={{ fontSize: '0.75rem', padding: '2px 6px', marginTop: '4px' }}>
                  Profit: {formatCurrency(Number(row.finalAmount || row.estimate || 0) - Number(row.sparePartsCost || 0))}
                </span>
              </div>
            )},
            {
              key: "expense_update",
              label: "Update Expense",
              render: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Spare Cost</label>
                  <input
                    key={`${row.id}-${row.sparePartsCost}`}
                    type="number"
                    className="table-input"
                    style={{ width: '100px', fontSize: '0.8rem', padding: '4px 8px' }}
                    defaultValue={row.sparePartsCost}
                    onBlur={(e) => handleExpenseChange(row.id, e.target.value)}
                  />
                </div>
              ),
            },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "deliveredAt", label: "Delivered On", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem' }}>{formatDate(row.deliveredAt)}</span>
                <span className="muted" style={{ fontSize: '0.75rem' }}>Rec: {formatDate(row.receivedAt)}</span>
              </div>
            )},
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => printServiceCard(row, currentSettings)}
                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                  >
                    Reprint
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => startEdit(row)}
                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                  >
                    Edit
                  </Button>
                </div>
              ),
            },
          ]}
          emptyText="No delivered service jobs found."
        />
      </PageSection>

      <Modal
        isOpen={!!deliveryJob}
        onClose={() => setDeliveryJob(null)}
        title={`Deliver Job: ${deliveryJob?.jobNo}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeliveryJob(null)}>Cancel</Button>
            <Button onClick={handleDeliverSubmit} disabled={submitting}>Confirm Delivery & Payment</Button>
          </>
        }
      >
        {deliveryJob && (
          <div className="list-stack">
            <div className="overview-card" style={{ marginBottom: 16, background: '#f8fafc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="muted" style={{ fontSize: '0.8rem' }}>Customer</label>
                  <div style={{ fontWeight: 700 }}>{deliveryJob.customerName}</div>
                </div>
                <div>
                  <label className="muted" style={{ fontSize: '0.8rem' }}>Box No</label>
                  <div style={{ fontWeight: 700 }}>{deliveryJob.boxNo}</div>
                </div>
                <div>
                  <label className="muted" style={{ fontSize: '0.8rem' }}>Estimate</label>
                  <div style={{ fontWeight: 700 }}>{formatCurrency(deliveryJob.estimate)}</div>
                </div>
                <div>
                  <label className="muted" style={{ fontSize: '0.8rem' }}>Advance Paid</label>
                  <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(deliveryJob.advance)}</div>
                </div>
              </div>
            </div>

            <div className="field">
              <label>Final Service Charge</label>
              <input 
                type="number" 
                value={deliveryForm.finalAmount} 
                onChange={(e) => setDeliveryForm(f => ({ ...f, finalAmount: e.target.value }))}
              />
              <div style={{ fontSize: '0.9rem', marginTop: 4, fontWeight: 700, color: 'var(--primary)' }}>
                Balance to Collect: {formatCurrency(Math.max(0, Number(deliveryForm.finalAmount || 0) - Number(deliveryJob.advance || 0)))}
              </div>
            </div>

            <div className="field">
              <label>Final Spare Parts Cost (For Profit Calculation)</label>
              <input 
                type="number" 
                value={deliveryForm.sparePartsCost} 
                onChange={(e) => setDeliveryForm(f => ({ ...f, sparePartsCost: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>Payment Method for Balance</label>
              <select 
                value={deliveryForm.paymentType} 
                onChange={(e) => setDeliveryForm(f => ({ ...f, paymentType: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="account">Bank / UPI Account</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
    </div>
  );
}
