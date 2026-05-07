import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { createOldMobilePurchase, sellOldMobile } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";

const blankPurchase = {
  customerName: "",
  customerPhone: "",
  brand: "",
  model: "",
  imei: "",
  serialNumber: "",
  buyPrice: "",
  expectedSellPrice: "",
  condition: "",
  note: "",
};

export default function OldMobilesPage() {
  const { user } = useAuth();
  const inventory = useFirestoreCollection("inventory", { orderBy: { field: "createdAt", direction: "desc" } });
  const history = useFirestoreCollection("old_mobile_transactions", { orderBy: { field: "createdAt", direction: "desc" } });
  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  const [purchase, setPurchase] = useState(blankPurchase);
  const [sale, setSale] = useState({ inventoryId: "", sellPrice: "", customerName: "", customerPhone: "" });

  const oldMobiles = useMemo(() => inventory.data.filter((item) => item.category === "old_mobile"), [inventory.data]);

  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
  
  const matchedPurchaseCustomer = customers.data.find((c) => {
    const typedPhone = normalizePhone(purchase.customerPhone);
    return typedPhone.length >= 5 && normalizePhone(c.phone) === typedPhone;
  });

  const matchedSaleCustomer = customers.data.find((c) => {
    const typedPhone = normalizePhone(sale.customerPhone);
    return typedPhone.length >= 5 && normalizePhone(c.phone) === typedPhone;
  });

  useEffect(() => {
    if (!matchedPurchaseCustomer) return;
    setPurchase((current) => ({
      ...current,
      customerName: matchedPurchaseCustomer.name || current.customerName,
    }));
  }, [matchedPurchaseCustomer?.id]);

  useEffect(() => {
    if (!matchedSaleCustomer) return;
    setSale((current) => ({
      ...current,
      customerName: matchedSaleCustomer.name || current.customerName,
    }));
  }, [matchedSaleCustomer?.id]);

  async function handlePurchase(event) {
    event.preventDefault();
    await createOldMobilePurchase(purchase, user);
    setPurchase(blankPurchase);
  }

  async function handleSale(event) {
    event.preventDefault();
    await sellOldMobile({ ...sale, currentUser: user });
    setSale({ inventoryId: "", sellPrice: "", customerName: "", customerPhone: "" });
  }

  if (inventory.loading || history.loading || customers.loading) {
    return <Loader text="Loading old mobiles..." />;
  }

  return (
    <div className="list-stack">
      <div className="two-column">
        <PageSection title="Buy Old Mobile" subtitle="Record a used phone purchase">
          <form className="form-grid" onSubmit={handlePurchase}>
            <div className="field">
              <label>Seller Phone</label>
              <input value={purchase.customerPhone} onChange={(event) => setPurchase((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="Seller mobile number" required />
              {matchedPurchaseCustomer ? <span className="field-hint">Details auto-filled.</span> : null}
            </div>
            <div className="field">
              <label>Seller Name</label>
              <input value={purchase.customerName} onChange={(event) => setPurchase((current) => ({ ...current, customerName: event.target.value }))} placeholder="Seller full name" required />
            </div>
            <div className="field"><label>Brand</label><input value={purchase.brand} onChange={(event) => setPurchase((current) => ({ ...current, brand: event.target.value }))} placeholder="Apple, Samsung, Redmi..." required /></div>
            <div className="field"><label>Model</label><input value={purchase.model} onChange={(event) => setPurchase((current) => ({ ...current, model: event.target.value }))} placeholder="iPhone 11, A12, Note 9..." required /></div>
            <div className="field"><label>IMEI</label><input value={purchase.imei} onChange={(event) => setPurchase((current) => ({ ...current, imei: event.target.value }))} placeholder="Device IMEI number" required /></div>
            <div className="field"><label>Buy Price</label><input type="number" min="0" value={purchase.buyPrice} onChange={(event) => setPurchase((current) => ({ ...current, buyPrice: event.target.value }))} placeholder="Purchase amount" required /></div>
            <div className="field"><label>Expected Sale</label><input type="number" min="0" value={purchase.expectedSellPrice} onChange={(event) => setPurchase((current) => ({ ...current, expectedSellPrice: event.target.value }))} placeholder="Expected selling price" /></div>
            <div className="field"><label>Condition</label><input value={purchase.condition} onChange={(event) => setPurchase((current) => ({ ...current, condition: event.target.value }))} placeholder="Good, display issue, battery weak..." /></div>
            <div className="field"><label>Serial Number</label><input value={purchase.serialNumber} onChange={(event) => setPurchase((current) => ({ ...current, serialNumber: event.target.value }))} placeholder="Serial number optional" /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Note</label><input value={purchase.note} onChange={(event) => setPurchase((current) => ({ ...current, note: event.target.value }))} placeholder="Accessories, box, charger, proof details..." /></div>
            <Button type="submit">Save Purchase</Button>
          </form>
        </PageSection>

        <PageSection title="Sell Old Mobile" subtitle="Mark used phone as sold and calculate profit">
          <form className="list-stack" onSubmit={handleSale}>
            <div className="field">
              <label>Available Mobile</label>
              <select value={sale.inventoryId} onChange={(event) => setSale((current) => ({ ...current, inventoryId: event.target.value }))} required>
                <option value="">Select old mobile</option>
                {oldMobiles.filter((item) => item.status === "available").map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemName} - {item.imei}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Buyer Phone</label>
              <input value={sale.customerPhone} onChange={(event) => setSale((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="Buyer mobile number" required />
              {matchedSaleCustomer ? <span className="field-hint">Details auto-filled.</span> : null}
            </div>
            <div className="field">
              <label>Buyer Name</label>
              <input value={sale.customerName} onChange={(event) => setSale((current) => ({ ...current, customerName: event.target.value }))} placeholder="Buyer full name" required />
            </div>
            <div className="field">
              <label>Sale Price</label>
              <input type="number" min="0" value={sale.sellPrice} onChange={(event) => setSale((current) => ({ ...current, sellPrice: event.target.value }))} placeholder="Final sale amount" required />
            </div>
            <Button type="submit">Complete Sale</Button>
          </form>
        </PageSection>
      </div>

      <PageSection title="Old Mobile Inventory" subtitle="Bought and resale stock">
        <DataTable
          rows={oldMobiles}
          columns={[
            { key: "itemName", label: "Phone" },
            { key: "imei", label: "IMEI" },
            { key: "buyingPrice", label: "Buy Price", render: (row) => formatCurrency(row.buyingPrice) },
            { key: "sellingPrice", label: "Sale Price", render: (row) => formatCurrency(row.sellingPrice) },
            { key: "condition", label: "Condition" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "createdAt", label: "Added", render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </PageSection>

      <PageSection title="Old Mobile Profit History" subtitle="Purchase and sales log">
        <DataTable
          rows={history.data}
          columns={[
            { key: "mobileId", label: "Mobile ID" },
            { key: "customerName", label: "Customer" },
            { key: "buyPrice", label: "Buy", render: (row) => formatCurrency(row.buyPrice) },
            { key: "sellPrice", label: "Sell", render: (row) => formatCurrency(row.sellPrice) },
            { key: "profit", label: "Profit", render: (row) => formatCurrency(row.profit) },
            { key: "stage", label: "Stage" },
            { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </PageSection>
    </div>
  );
}
