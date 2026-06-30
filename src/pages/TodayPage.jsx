import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatCard from "../components/StatCard";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { saveDailyClosing } from "../supabase/database";
import { computeLedgerSummary, formatCurrency, formatDate, formatInputDate, isSameDay, toDateObject } from "../utils/format";
import { hasPermission } from "../utils/permissions";

function normalizePhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

function openWhatsapp(phone, message) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank");
}

function buildReadyMessage(job) {
  return `Hi ${job.customerName}, your ${[job.brand, job.model].filter(Boolean).join(" ")} service job ${job.jobNo} is ready for delivery at Velan Mobiles. Balance: ${formatCurrency(Math.max(0, Number(job.estimate || 0) - Number(job.advance || 0)))}.`;
}

function buildPaymentReminder(job) {
  return `Hi ${job.customerName}, reminder from Velan Mobiles for service job ${job.jobNo}. Pending balance: ${formatCurrency(Math.max(0, Number(job.estimate || 0) - Number(job.advance || 0)))}.`;
}

function buildWarrantyMessage(bill) {
  return `Hi ${bill.customerName}, thank you for shopping at Velan Mobiles. Your bill ${bill.billNo} is saved for ${formatCurrency(bill.total)}. Please keep this message for warranty/support reference.`;
}

export default function TodayPage() {
  const { user } = useAuth();
  const canCloseDay = hasPermission(user, "today", "update");
  const navigate = useNavigate();
  const rolePath = user.role === "admin" ? "/admin" : "/staff";
  const today = formatInputDate(new Date());
  const [closingForm, setClosingForm] = useState({ closingDate: today, countedCash: "", countedAccount: "", note: "" });
  const [message, setMessage] = useState("");
  const [closingError, setClosingError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const bills = useFirestoreCollection("bills", { orderBy: { field: "createdAt", direction: "desc" } });
  const inventory = useFirestoreCollection("inventory", { orderBy: { field: "createdAt", direction: "desc" } });
  const services = useFirestoreCollection("service_jobs", { orderBy: { field: "receivedAt", direction: "desc" } });
  const cashLedger = useFirestoreCollection("cash_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const accountLedger = useFirestoreCollection("account_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const transfers = useFirestoreCollection("money_transfers", { orderBy: { field: "createdAt", direction: "desc" } });
  const closings = useFirestoreCollection("daily_closings", { orderBy: { field: "closingDate", direction: "desc" } });

  const loading = bills.loading || inventory.loading || services.loading || cashLedger.loading || accountLedger.loading || transfers.loading || closings.loading;

  const dashboard = useMemo(() => {
    const todayBills = bills.data.filter((bill) => isSameDay(bill.createdAt));
    const todayCashEntries = cashLedger.data.filter((entry) => isSameDay(entry.createdAt));
    const todayAccountEntries = accountLedger.data.filter((entry) => isSameDay(entry.createdAt));
    const todayExpenses = [...todayCashEntries, ...todayAccountEntries]
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const todayTransfers = transfers.data.filter((transfer) => isSameDay(transfer.createdAt));
    const cashSummary = computeLedgerSummary(cashLedger.data);
    const accountSummary = computeLedgerSummary(accountLedger.data);
    const activeJobs = services.data.filter((job) => job.status !== "delivered");
    const readyJobs = services.data.filter((job) => job.status === "ready");
    const pendingServiceAdvance = activeJobs.reduce((sum, job) => sum + Number(job.advance || 0), 0);
    const closedToday = closings.data.find((closing) => closing.closingDate === today);

    const lowStock = inventory.data
      .filter((item) => Number(item.minStock || 0) > 0 && Number(item.quantity || 0) <= Number(item.minStock || 0))
      .slice(0, 12);
    const oldMobileAged = inventory.data
      .filter((item) => item.category === "old_mobile" && item.status === "available")
      .filter((item) => {
        const created = toDateObject(item.createdAt);
        if (!created) return false;
        return Date.now() - created.getTime() > 30 * 24 * 60 * 60 * 1000;
      });
    const overdueServices = activeJobs.filter((job) => job.estimatedDeliveryAt && new Date(job.estimatedDeliveryAt) < new Date());
    const highDiscountBills = todayBills.filter((bill) => Number(bill.discount || 0) > 0 && Number(bill.discount || 0) / Math.max(Number(bill.subtotal || 0), 1) >= 0.1);

    const soldByItem = {};
    bills.data
      .filter((bill) => {
        const created = toDateObject(bill.createdAt);
        return created && Date.now() - created.getTime() <= 30 * 24 * 60 * 60 * 1000;
      })
      .forEach((bill) => {
        (bill.items || []).forEach((item) => {
          const key = item.inventoryId || item.inventory_id || item.itemName || item.item_name;
          if (!key) return;
          soldByItem[key] = (soldByItem[key] || 0) + Number(item.quantity || 0);
        });
      });

    const reorderSuggestions = lowStock.map((item) => {
      const sold30 = soldByItem[item.id] || soldByItem[item.itemName] || 0;
      const twoWeekNeed = Math.ceil((sold30 / 30) * 14);
      const target = Math.max(Number(item.minStock || 0) * 2, twoWeekNeed);
      return {
        ...item,
        sold30,
        suggestedQty: Math.max(target - Number(item.quantity || 0), Number(item.minStock || 0)),
      };
    });

    const alerts = [
      cashSummary.closing < 0 ? { id: "cash", type: "Negative cash", detail: `Cash balance is ${formatCurrency(cashSummary.closing)}` } : null,
      ...oldMobileAged.slice(0, 4).map((item) => ({ id: `old-${item.id}`, type: "Old mobile aging", detail: `${item.itemName} unsold since ${formatDate(item.createdAt)}` })),
      ...overdueServices.slice(0, 4).map((job) => ({ id: `service-${job.id}`, type: "Service overdue", detail: `${job.jobNo} promised ${formatDate(job.estimatedDeliveryAt)}` })),
      ...lowStock.slice(0, 4).map((item) => ({ id: `stock-${item.id}`, type: "Low stock", detail: `${item.itemName}: ${item.quantity}/${item.minStock}` })),
      ...highDiscountBills.slice(0, 4).map((bill) => ({ id: `discount-${bill.id}`, type: "High discount", detail: `${bill.billNo}: ${formatCurrency(bill.discount)} discount` })),
    ].filter(Boolean);

    return {
      todayBills,
      todaySales: todayBills.reduce((sum, bill) => sum + Number(bill.total || 0), 0),
      todayExpenses,
      todayTransfers,
      cashSummary,
      accountSummary,
      activeJobs,
      readyJobs,
      pendingServiceAdvance,
      closedToday,
      alerts,
      reorderSuggestions,
    };
  }, [accountLedger.data, bills.data, cashLedger.data, closings.data, inventory.data, services.data, today, transfers.data]);

  if (loading) {
    return <Loader text="Loading today's shop work..." />;
  }

  async function handleClosingSubmit(event) {
    event.preventDefault();
    if (!canCloseDay) return;
    setSubmitting(true);
    setMessage("");
    setClosingError("");
    try {
      const saved = await saveDailyClosing({
        ...closingForm,
        expectedCash: dashboard.cashSummary.closing,
        expectedAccount: dashboard.accountSummary.closing,
        expenses: dashboard.todayExpenses,
        pendingServiceAdvance: dashboard.pendingServiceAdvance,
      }, user);
      setMessage(`Day closed for ${saved.closingDate}. Cash mismatch ${formatCurrency(saved.mismatchCash)}, bank mismatch ${formatCurrency(saved.mismatchAccount)}.`);
    } catch (err) {
      setClosingError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const quickActions = [
    { label: "New Bill", path: `${rolePath}/billing`, module: "billing", operation: "create" },
    { label: "Service In", path: `${rolePath}/service-jobs`, module: "service_jobs", operation: "create" },
    { label: "Deliver Service", path: `${rolePath}/service-jobs`, module: "service_jobs", operation: "update" },
    { label: "Money Transfer", path: `${rolePath}/money-transfer`, module: "money_transfer", operation: "create" },
    { label: "Buy Old Mobile", path: user.role === "admin" ? "/admin/old-mobiles" : "/staff/old-mobiles", module: "old_mobiles", operation: "create" },
    { label: "Sell Old Mobile", path: user.role === "admin" ? "/admin/old-mobiles" : "/staff/old-mobiles", module: "old_mobiles", operation: "update" },
    { label: "Daily Closing", path: "#daily-closing", module: "today", operation: "update" },
  ].filter((action) => hasPermission(user, action.module, action.operation));
  const liveCashMismatch = Number(closingForm.countedCash || 0) - Number(dashboard.cashSummary.closing || 0);
  const liveAccountMismatch = Number(closingForm.countedAccount || 0) - Number(dashboard.accountSummary.closing || 0);

  return (
    <div className="list-stack">
      <PageSection title="Today Screen" subtitle="Daily shop actions, alerts, and closing in one place">
        <div className="today-action-grid">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant={action.label === "Daily Closing" ? "secondary" : "primary"}
              onClick={() => {
                if (action.path === "#daily-closing") {
                  document.getElementById("daily-closing")?.scrollIntoView({ behavior: "smooth" });
                  return;
                }
                navigate(action.path);
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </PageSection>

      <div className="card-grid">
        <StatCard label="Today Sales" value={formatCurrency(dashboard.todaySales)} hint={`${dashboard.todayBills.length} bills`} />
        <StatCard label="Cash In Hand" value={formatCurrency(dashboard.cashSummary.closing)} hint="Expected from ledger" />
        <StatCard label="Bank / UPI" value={formatCurrency(dashboard.accountSummary.closing)} hint="Expected from ledger" />
        <StatCard label="Service Ready" value={dashboard.readyJobs.length} hint={`${dashboard.activeJobs.length} active jobs`} />
      </div>

      <PageSection title="Alerts" subtitle="Things that need attention before closing">
        <DataTable
          rows={dashboard.alerts}
          columns={[
            { key: "type", label: "Alert" },
            { key: "detail", label: "Detail" },
          ]}
          emptyText="No urgent alerts right now."
        />
      </PageSection>

      <PageSection title="Ready Service Follow-up" subtitle="Send delivery or payment messages quickly">
        <DataTable
          rows={dashboard.readyJobs.slice(0, 8)}
          columns={[
            { key: "jobNo", label: "Job No" },
            { key: "customerName", label: "Customer" },
            { key: "model", label: "Model" },
            { key: "estimate", label: "Balance", render: (row) => formatCurrency(Math.max(0, Number(row.estimate || 0) - Number(row.advance || 0))) },
            {
              key: "actions",
              label: "WhatsApp",
              render: (row) => (
                <div className="topbar-actions">
                  <Button type="button" variant="secondary" onClick={() => openWhatsapp(row.customerPhone, buildReadyMessage(row))}>Ready</Button>
                  <Button type="button" variant="secondary" onClick={() => openWhatsapp(row.customerPhone, buildPaymentReminder(row))}>Payment</Button>
                </div>
              ),
            },
          ]}
          emptyText="No service jobs are ready for delivery."
        />
      </PageSection>

      <PageSection title="Reorder Suggestions" subtitle="Based on minimum stock and last 30 days sales speed">
        <DataTable
          rows={dashboard.reorderSuggestions}
          columns={[
            { key: "itemName", label: "Item" },
            { key: "quantity", label: "Current Qty" },
            { key: "minStock", label: "Min Stock" },
            { key: "sold30", label: "Sold 30 Days" },
            { key: "suggestedQty", label: "Suggested Purchase" },
          ]}
          emptyText="No reorder suggestions right now."
        />
      </PageSection>

      <PageSection title="Warranty Messages" subtitle="Send a post-sale support message for recent bills">
        <DataTable
          rows={dashboard.todayBills.slice(0, 8)}
          columns={[
            { key: "billNo", label: "Bill No" },
            { key: "customerName", label: "Customer" },
            { key: "total", label: "Total", render: (row) => formatCurrency(row.total) },
            {
              key: "whatsapp",
              label: "WhatsApp",
              render: (row) => <Button type="button" variant="secondary" onClick={() => openWhatsapp(row.customerPhone, buildWarrantyMessage(row))}>Warranty</Button>,
            },
          ]}
          emptyText="No bills created today."
        />
      </PageSection>

      <PageSection
        title="Daily Closing"
        subtitle={dashboard.closedToday ? `Closed today by ${dashboard.closedToday.closedByName || "admin"}` : "Count cash and bank/UPI, then compare with system expected balance"}
      >
        <div id="daily-closing" />
        <div className="card-grid" style={{ marginBottom: 16 }}>
          <StatCard label="Expected Cash" value={formatCurrency(dashboard.cashSummary.closing)} hint="Ledger closing" />
          <StatCard label="Expected Bank / UPI" value={formatCurrency(dashboard.accountSummary.closing)} hint="Ledger closing" />
          <StatCard label="Today Expenses" value={formatCurrency(dashboard.todayExpenses)} hint="Cash and bank expenses" />
          <StatCard label="Pending Service Advances" value={formatCurrency(dashboard.pendingServiceAdvance)} hint="Open service jobs" />
          {canCloseDay ? <StatCard label="Cash Mismatch" value={formatCurrency(liveCashMismatch)} hint="Counted minus expected" /> : null}
          {canCloseDay ? <StatCard label="Bank / UPI Mismatch" value={formatCurrency(liveAccountMismatch)} hint="Counted minus expected" /> : null}
        </div>

        {canCloseDay ? (
          <form className="form-grid" onSubmit={handleClosingSubmit}>
            <div className="field">
              <label>Closing Date</label>
              <input type="date" value={closingForm.closingDate} onChange={(event) => setClosingForm((current) => ({ ...current, closingDate: event.target.value }))} required />
            </div>
            <div className="field">
              <label>Counted Cash</label>
              <input type="number" min="0" value={closingForm.countedCash} onChange={(event) => setClosingForm((current) => ({ ...current, countedCash: event.target.value }))} placeholder="Actual cash count" required />
            </div>
            <div className="field">
              <label>Counted Bank / UPI</label>
              <input type="number" min="0" value={closingForm.countedAccount} onChange={(event) => setClosingForm((current) => ({ ...current, countedAccount: event.target.value }))} placeholder="Actual bank/UPI total" required />
            </div>
            <div className="field">
              <label>Closing Note</label>
              <input value={closingForm.note} onChange={(event) => setClosingForm((current) => ({ ...current, note: event.target.value }))} placeholder="Mismatch reason or handover note" />
            </div>
            {message ? <div className="badge success" style={{ gridColumn: "1 / -1" }}>{message}</div> : null}
            {closingError ? <div className="badge danger" style={{ gridColumn: "1 / -1" }}>{closingError}</div> : null}
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <label>&nbsp;</label>
              <Button type="submit" disabled={submitting}>{submitting ? "Closing..." : "Save Daily Closing"}</Button>
            </div>
          </form>
        ) : (
          <div className="badge warning">You have read-only access to daily closing.</div>
        )}
      </PageSection>
    </div>
  );
}
