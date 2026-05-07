import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { createMoneyTransfer, deleteMoneyTransfer, updateRecord } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { computeLedgerSummary, formatCurrency, formatDate } from "../utils/format";
import Autocomplete from "../components/Autocomplete";

const blankTransfer = {
  customerName: "",
  customerPhone: "",
  aadharNo: "",
  transferType: "cash_to_bank",
  transferAmount: "",
  commission: "",
  note: "",
};

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export default function MoneyTransferPage() {
  const { user } = useAuth();
  const transfers = useFirestoreCollection("money_transfers", { orderBy: { field: "createdAt", direction: "desc" } });
  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  const cash = useFirestoreCollection("cash_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const account = useFirestoreCollection("account_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankTransfer);
  const [editingId, setEditingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const filteredTransfers = useMemo(() => {
    if (!search) return transfers.data;
    const s = search.toLowerCase();
    return transfers.data.filter(t => 
      t.transferNo?.toLowerCase().includes(s) ||
      t.customerName?.toLowerCase().includes(s) ||
      t.customerPhone?.toLowerCase().includes(s) ||
      t.aadharNo?.toLowerCase().includes(s)
    );
  }, [transfers.data, search]);
  const totalReceived = Number(form.transferAmount || 0) + Number(form.commission || 0);
  const totalReceivedDisplay = form.transferAmount === "" && form.commission === "" ? "" : totalReceived;
  const matchedCustomer = customers.data.find((customer) => {
    const typedPhone = normalizePhone(form.customerPhone);
    return typedPhone.length >= 5 && normalizePhone(customer.phone) === typedPhone;
  });

  useEffect(() => {
    if (!matchedCustomer) {
      return;
    }

    setForm((current) => ({
      ...current,
      customerName: matchedCustomer.name || current.customerName,
      aadharNo: matchedCustomer.aadharNo || current.aadharNo,
    }));
  }, [matchedCustomer?.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      if (editingId) {
        await updateRecord("money_transfers", editingId, form);
        setMessage("Transfer record updated. (Note: Ledger balances were not modified)");
      } else {
        const saved = await createMoneyTransfer(form, user);
        setMessage(`Money transfer saved: ${saved.transferNo}`);
      }
      setForm(blankTransfer);
      setEditingId("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure? This will also remove the associated ledger entries and restore balances.")) return;
    setSubmitting(true);
    try {
      await deleteMoneyTransfer(id);
      setMessage("Transfer and ledger entries deleted.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      customerName: row.customerName || "",
      customerPhone: row.customerPhone || "",
      aadharNo: row.aadharNo || "",
      transferType: row.transferType,
      transferAmount: row.transferAmount,
      commission: row.commission,
      note: row.note || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (transfers.loading || customers.loading || cash.loading || account.loading) {
    return <Loader text="Loading customer money transfers..." />;
  }

  const cashSummary = computeLedgerSummary(cash.data);
  const accountSummary = computeLedgerSummary(account.data);

  return (
    <div className="list-stack" style={{ zoom: '95%', paddingRight: '24px' }}>
      <div className="dashboard-overview-grid">
        <div className="overview-card overview-card-success">
          <div className="overview-card-label">Cash in Hand</div>
          <div className="overview-card-value">{formatCurrency(cashSummary.closing)}</div>
          <div className="overview-card-note">Available cash for customer payouts</div>
        </div>
        <div className="overview-card overview-card-neutral">
          <div className="overview-card-label">Bank Balance</div>
          <div className="overview-card-value">{formatCurrency(accountSummary.closing)}</div>
          <div className="overview-card-note">Available bank/account balance</div>
        </div>
      </div>

      <PageSection title="Customer Money Transfer" subtitle="Record customer cash-to-bank or bank-to-cash service with commission profit">
        {transfers.error ? <div className="badge danger">{transfers.error}</div> : null}
        <form className="list-stack" onSubmit={handleSubmit}>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <Autocomplete
              label="Customer Name"
              placeholder="Customer full name"
              value={form.customerName}
              suggestions={customers.data.map(c => c.name)}
              onChange={(e) => setForm(curr => ({ ...curr, customerName: e.target.value }))}
              onSelect={(name) => {
                const found = customers.data.find(c => c.name === name);
                if (found) {
                  setForm(curr => ({
                    ...curr,
                    customerName: found.name,
                    customerPhone: found.phone || "",
                    aadharNo: found.aadharNo || ""
                  }));
                }
              }}
            />
            <Autocomplete
              label="Customer Phone"
              placeholder="Enter phone to auto-fill"
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
                    customerPhone: found.phone,
                    aadharNo: found.aadharNo || ""
                  }));
                }
              }}
            />
            <div className="field">
              <label>Aadhaar No</label>
              <input value={form.aadharNo} onChange={(event) => setForm((current) => ({ ...current, aadharNo: event.target.value }))} placeholder="Aadhaar number optional" />
            </div>
            <div className="field">
              <label>Customer Transfer Amount</label>
              <input type="number" min="0" value={form.transferAmount} onChange={(event) => setForm((current) => ({ ...current, transferAmount: event.target.value }))} placeholder="Amount to transfer" required />
            </div>
            <div className="field">
              <label>Shop Commission</label>
              <input type="number" min="0" value={form.commission} onChange={(event) => setForm((current) => ({ ...current, commission: event.target.value }))} placeholder="Commission earned" />
            </div>
            <div className="field">
              <label>Total Customer Pays</label>
              <input value={totalReceivedDisplay} readOnly placeholder="Auto calculated total" style={{ color: "#10b981", fontWeight: "800", backgroundColor: "#f0fdf4", border: "1px solid #10b981" }} />
            </div>
          </div>
          <div className="field">
            <label>Note</label>
            <input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="UPI ID, bank name, receiver details..." />
          </div>
          <div className="field">
            <label>Transfer Type</label>
            <div className="transfer-type-buttons">
              <button
                type="button"
                className={`transfer-type-button ${form.transferType === "cash_to_bank" ? "active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, transferType: "cash_to_bank" }))}
              >
                Cash -&gt; Bank
                <span>Customer gives cash, shop sends bank</span>
              </button>
              <button
                type="button"
                className={`transfer-type-button ${form.transferType === "bank_to_cash" ? "active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, transferType: "bank_to_cash" }))}
              >
                Bank -&gt; Cash
                <span>Customer sends bank, shop pays cash</span>
              </button>
            </div>
          </div>
          {message ? <div className="badge success">{message}</div> : null}
          <div className="topbar-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Processing..." : editingId ? "Update Transfer Record" : "Save Customer Transfer"}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={() => { setForm(blankTransfer); setEditingId(""); }}>
                Cancel Edit
              </Button>
            )}
          </div>
        </form>
      </PageSection>

      <PageSection title="Customer Transfer History" subtitle="Customer transfer records and commission earned">
        <div className="field" style={{ marginBottom: '16px', maxWidth: '400px' }}>
          <input 
            placeholder="Search by TXN No, Name, Phone or Aadhaar..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <DataTable
          rows={filteredTransfers}
          columns={[
            { 
              key: "transferNo", 
              label: "TXN No", 
              render: (row) => <code style={{ fontSize: '0.8rem', color: 'var(--primary-dark)', fontWeight: 700 }}>{row.transferNo}</code> 
            },
            { key: "customerName", label: "Customer" },
            { key: "aadharNo", label: "Aadhaar" },
            { 
              key: "transferType", 
              label: "Type", 
              render: (row) => (
                <span className={`badge ${row.transferType === 'cash_to_bank' ? 'success' : 'info'}`} style={{ whiteSpace: 'nowrap' }}>
                  {row.transferType === "cash_to_bank" ? "Cash ⮕ Bank" : "Bank ⮕ Cash"}
                </span>
              ) 
            },
            { key: "transferAmount", label: "Transfer", render: (row) => <strong>{formatCurrency(row.transferAmount)}</strong> },
            { key: "commission", label: "Profit", render: (row) => <span style={{ color: 'var(--success)', fontWeight: 700 }}>{formatCurrency(row.commission)}</span> },
            { key: "totalReceived", label: "Total Paid", render: (row) => <strong>{formatCurrency(row.totalReceived)}</strong> },
            { 
              key: "createdAt", 
              label: "Date", 
              render: (row) => (
                <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  {new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  <br />
                  <small className="muted">{new Date(row.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
              )
            },
            ...(user.role === "admin"
              ? [{
                key: "actions",
                label: "Action",
                render: (row) => (
                  <div className="topbar-actions" style={{ flexWrap: 'nowrap' }}>
                    <Button type="button" variant="secondary" onClick={() => startEdit(row)}>Edit</Button>
                    <Button type="button" variant="danger" onClick={() => handleDelete(row.id)}>Delete</Button>
                  </div>
                ),
              }]
              : []),
          ]}
        />
      </PageSection>
    </div>
  );
}
