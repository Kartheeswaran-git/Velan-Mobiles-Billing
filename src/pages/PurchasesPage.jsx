import { useEffect, useState } from "react";
import Autocomplete from "../components/Autocomplete";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { createPurchaseEntry, updatePurchaseEntry } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { inventoryCategories } from "../utils/constants";
import { formatCurrency, formatDate } from "../utils/format";

const blankPurchase = {
  supplierName: "",
  supplierPhone: "",
  category: "accessory",
  type: "",
  brand: "",
  model: "",
  itemName: "",
  quantity: 1,
  buyingPrice: "",
  sellingPrice: "",
  paymentSource: "cash",
  note: "",
  minStock: "",
};

export default function PurchasesPage() {
  const { user } = useAuth();
  const purchases = useFirestoreCollection("purchase_entries", { orderBy: { field: "createdAt", direction: "desc" } });
  const inventory = useFirestoreCollection("inventory", { orderBy: { field: "createdAt", direction: "desc" } });
  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankPurchase);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");

  const matchedSupplier = customers.data.find((c) => 
    form.supplierName.length >= 3 && 
    c.name.toLowerCase().trim() === form.supplierName.toLowerCase().trim()
  );

  useEffect(() => {
    if (!matchedSupplier || editingId) return;
    setForm((current) => ({
      ...current,
      supplierPhone: matchedSupplier.phone || current.supplierPhone,
    }));
  }, [matchedSupplier?.id, editingId]);

  const typeSuggestions = [...new Set(inventory.data.map((item) => item.type).filter(Boolean))];
  const brandSuggestions = [...new Set(inventory.data.map((item) => item.brand).filter(Boolean))];
  const modelSuggestions = [...new Set(inventory.data.map((item) => item.model).filter(Boolean))];

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updatePurchaseEntry(editingId, form);
      } else {
        await createPurchaseEntry(form, user);
      }
      setForm(blankPurchase);
      setEditingId("");
    } finally {
      setSubmitting(false);
    }
  }

  if (purchases.loading || inventory.loading) {
    return <Loader text="Loading purchases..." />;
  }

  return (
    <div className="list-stack">
      <PageSection title={editingId ? "Edit Purchase Entry" : "New Purchase Entry"} subtitle="Record stock purchases and auto-add them to inventory">
        <form className="list-stack" onSubmit={handleSubmit}>
          <div className="form-grid">
            <Autocomplete
              label="Supplier Name"
              placeholder="Distributor or shop name"
              value={form.supplierName}
              suggestions={customers.data.map(c => c.name)}
              hint={matchedSupplier && !editingId ? "Supplier auto-filled" : null}
              onChange={(e) => setForm(curr => ({ ...curr, supplierName: e.target.value }))}
              onSelect={(name) => {
                const found = customers.data.find(c => c.name === name);
                if (found) {
                  setForm(curr => ({
                    ...curr,
                    supplierName: found.name,
                    supplierPhone: found.phone || ""
                  }));
                }
              }}
              required
            />
            <Autocomplete
              label="Supplier Phone"
              placeholder="Supplier mobile number"
              value={form.supplierPhone}
              suggestions={customers.data.map(c => c.phone).filter(Boolean)}
              hint={matchedSupplier && !editingId ? "Auto-filled" : null}
              onChange={(e) => setForm(curr => ({ ...curr, supplierPhone: e.target.value }))}
              onSelect={(phone) => {
                const found = customers.data.find(c => c.phone === phone);
                if (found) {
                  setForm(curr => ({
                    ...curr,
                    supplierName: found.name || "",
                    supplierPhone: found.phone
                  }));
                }
              }}
            />
            <div className="field"><label>Category</label><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{inventoryCategories.filter((item) => item !== "old_mobile").map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="field"><label>Type</label><input list="purchase-type-options" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} placeholder="mobile, accessory, spare..." /></div>
            <div className="field"><label>Brand</label><input list="purchase-brand-options" value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} placeholder="Samsung, Oppo, Apple..." /></div>
            <div className="field"><label>Model</label><input list="purchase-model-options" value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="A15, C55, iPhone 12..." /></div>
            <div className="field"><label>Item Name</label><input value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Tempered glass 9D" required /></div>
            <div className="field"><label>Quantity</label><input type="number" min="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Purchase qty" /></div>
            <div className="field"><label>Buying Price</label><input type="number" min="0" value={form.buyingPrice} onChange={(event) => setForm((current) => ({ ...current, buyingPrice: event.target.value }))} placeholder="Cost per item" /></div>
            <div className="field"><label>Selling Price</label><input type="number" min="0" value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} placeholder="Sale price per item" /></div>
            <div className="field"><label>Min Stock</label><input type="number" min="0" value={form.minStock} onChange={(event) => setForm((current) => ({ ...current, minStock: event.target.value }))} placeholder="Reorder alert qty" /></div>
            <div className="field"><label>Payment Source</label><select value={form.paymentSource} onChange={(event) => setForm((current) => ({ ...current, paymentSource: event.target.value }))}><option value="cash">cash</option><option value="account">account</option></select></div>
            <div className="field"><label>Note</label><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Invoice no, warranty, batch..." /></div>
          </div>
          <datalist id="supplier-options">{[...new Set(customers.data.map(c => c.name))].map((name) => <option key={name} value={name} />)}</datalist>
          <datalist id="purchase-type-options">{typeSuggestions.map((option) => <option key={option} value={option} />)}</datalist>
          <datalist id="purchase-brand-options">{brandSuggestions.map((option) => <option key={option} value={option} />)}</datalist>
          <datalist id="purchase-model-options">{modelSuggestions.map((option) => <option key={option} value={option} />)}</datalist>
          <div className="topbar-actions">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingId ? "Update Purchase" : "Save Purchase"}</Button>
            {editingId ? <Button type="button" variant="secondary" onClick={() => { setForm(blankPurchase); setEditingId(""); }}>Cancel</Button> : null}
          </div>
        </form>
      </PageSection>

      <PageSection title="Purchase History" subtitle="Recent stock purchases">
        <DataTable
          rows={purchases.data}
          columns={[
            { key: "purchaseNo", label: "Purchase No" },
            { key: "supplierName", label: "Supplier" },
            { key: "itemName", label: "Item" },
            { key: "quantity", label: "Qty" },
            { key: "totalAmount", label: "Total", render: (row) => formatCurrency(row.totalAmount) },
            { key: "paymentSource", label: "Paid Via" },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(row.id);
                    setForm({
                      supplierName: row.supplierName || "",
                      supplierPhone: row.supplierPhone || "",
                      category: row.category || "accessory",
                      type: row.type || "",
                      brand: row.brand || "",
                      model: row.model || "",
                      itemName: row.itemName || "",
                      quantity: row.quantity || 1,
                      buyingPrice: row.buyingPrice ?? "",
                      sellingPrice: row.sellingPrice ?? "",
                      paymentSource: row.paymentSource || "cash",
                      note: row.note || "",
                      minStock: row.minStock ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
              ),
            },
          ]}
        />
      </PageSection>
    </div>
  );
}
