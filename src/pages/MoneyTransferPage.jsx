import { useEffect, useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { createMoneyTransfer } from "../supabase/database";
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
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
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
      const saved = await createMoneyTransfer(form, user);
      setMessage(`Money transfer saved: ${saved.transferNo}`);
      setForm(blankTransfer);
    } finally {
      setSubmitting(false);
    }
  }

  if (transfers.loading || customers.loading || cash.loading || account.loading) {
    return <Loader text="Loading customer money transfers..." />;
  }

  const cashSummary = computeLedgerSummary(cash.data);
  const accountSummary = computeLedgerSummary(account.data);

  return (
    <div className="list-stack">
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
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Customer Transfer"}</Button>
        </form>
      </PageSection>

      <PageSection title="Customer Transfer History" subtitle="Customer transfer records and commission earned">
        <DataTable
          rows={transfers.data}
          columns={[
            { key: "transferNo", label: "Transfer No" },
            { key: "customerName", label: "Customer" },
            { key: "aadharNo", label: "Aadhaar No" },
            { key: "transferType", label: "Type", render: (row) => row.transferType === "cash_to_bank" ? "Cash to Bank" : "Bank to Cash" },
            { key: "transferAmount", label: "Transfer", render: (row) => formatCurrency(row.transferAmount) },
            { key: "commission", label: "Commission", render: (row) => formatCurrency(row.commission) },
            { key: "totalReceived", label: "Customer Paid", render: (row) => formatCurrency(row.totalReceived) },
            { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </PageSection>
    </div>
  );
}
