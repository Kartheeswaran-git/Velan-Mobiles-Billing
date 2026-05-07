import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { createServiceJob, updateServiceStatus } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { serviceStatuses } from "../utils/constants";
import { formatCurrency, formatDate, isSameDay } from "../utils/format";

const blankJob = {
  customerName: "",
  customerPhone: "",
  boxNo: "",
  brand: "",
  model: "",
  imei: "",
  problem: "",
  estimate: "",
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
  const [form, setForm] = useState(blankJob);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastCreatedJob, setLastCreatedJob] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  
  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
  const matchedCustomer = customers.data.find((c) => {
    const typedPhone = normalizePhone(form.customerPhone);
    return typedPhone.length >= 5 && normalizePhone(c.phone) === typedPhone;
  });

  useEffect(() => {
    if (!matchedCustomer) return;
    setForm((current) => ({
      ...current,
      customerName: matchedCustomer.name || current.customerName,
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

  const dashboard = useMemo(() => {
    const underRepairStatuses = ["checking", "waiting_approval", "repairing"];
    return {
      receivedToday: jobs.data.filter((job) => isSameDay(job.receivedAt)).length,
      underRepair: jobs.data.filter((job) => underRepairStatuses.includes(job.status)).length,
      ready: jobs.data.filter((job) => job.status === "ready").length,
      delivered: jobs.data.filter((job) => job.status === "delivered").length,
    };
  }, [jobs.data]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        boxNo: String(form.boxNo || "").trim(),
        receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : new Date().toISOString(),
        estimatedDeliveryAt: form.estimatedDeliveryAt ? new Date(form.estimatedDeliveryAt).toISOString() : null,
      };
      const createdJob = await createServiceJob(payload, user);
      setLastCreatedJob(createdJob);
      setForm({ ...blankJob, receivedAt: toDateTimeInputValue(new Date()) });
      const whatsappPhone = normalizePhoneNumber(createdJob.customerPhone);
      if (whatsappPhone) {
        const text = encodeURIComponent(buildWhatsappMessage(createdJob));
        window.open(`https://wa.me/${whatsappPhone}?text=${text}`, "_blank");
      }
      setMessage(`Service job created: ${createdJob.jobNo} • Box ${createdJob.boxNo}`);
    } catch (submitError) {
      setError(submitError.message || "Failed to save service job.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id, status) {
    await updateServiceStatus(id, status);
  }

  if (jobs.loading) {
    return <Loader text="Loading service jobs..." />;
  }

  return (
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

      <div className={lastCreatedJob ? "billing-grid" : "list-stack"}>
        <div className="billing-main">
          <PageSection title="New Service Job" subtitle="Receive phone service requests">
            <form className="list-stack" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label>Customer Name</label>
                  <input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Customer full name" required />
                </div>
                <div className="field">
                  <label>Customer Phone</label>
                  <input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="Customer mobile number" required />
                  {matchedCustomer ? <span className="field-hint">Customer details auto-filled.</span> : null}
                </div>
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
                {submitting ? "Saving..." : "Save Service Job"}
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
            { key: "estimate", label: "Estimate", render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong>{formatCurrency(row.estimate)}</strong>
                {row.advance > 0 && <span className="badge success" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Adv: {formatCurrency(row.advance)}</span>}
              </div>
            )},
            {
              key: "status_update",
              label: "Status & Update",
              render: (row) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <StatusBadge value={row.status} />
                  <select
                    className="table-input"
                    style={{ width: '130px', fontSize: '0.8rem', padding: '4px 8px' }}
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
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => printServiceCard(row, currentSettings)}
                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
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
                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                  >
                    WA
                  </Button>
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
    </div>
  );
}
