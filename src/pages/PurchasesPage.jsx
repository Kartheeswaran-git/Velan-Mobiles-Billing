import { useEffect, useMemo, useState } from "react";
import Autocomplete from "../components/Autocomplete";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";
import { supabase } from "../supabase/client";
import { Link } from "react-router-dom";

const blankPurchase = {
  productId: "",
  supplierName: "",
  supplierPhone: "",
  category: "",
  type: "",
  brand: "",
  model: "",
  itemName: "",
  quantity: 1,
  buyingPrice: "",
  sellingPrice: "",
  paymentSource: "cash",
  note: "",
  imei: "",
};

export default function PurchasesPage() {
  const { user } = useAuth();
  const purchases = useFirestoreCollection("purchase_entries", { orderBy: { field: "createdAt", direction: "desc" } });
  const products = useFirestoreCollection("product_master", { orderBy: { field: "createdAt", direction: "desc" } });
  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankPurchase);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [searchItem, setSearchItem] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const filteredHistory = useMemo(() => {
    if (!historySearch) return purchases.data;
    const s = historySearch.toLowerCase();
    return purchases.data.filter(p => 
      p.purchaseNo?.toLowerCase().includes(s) ||
      p.supplierName?.toLowerCase().includes(s) ||
      p.itemName?.toLowerCase().includes(s)
    );
  }, [purchases.data, historySearch]);

  const matchedSupplier = customers.data.find((c) => 
    form.supplierName.length >= 3 && 
    c.name.toLowerCase().trim() === form.supplierName.toLowerCase().trim()
  );

  useEffect(() => {
    if (!matchedSupplier) return;
    setForm((current) => ({
      ...current,
      supplierPhone: matchedSupplier.phone || current.supplierPhone,
    }));
  }, [matchedSupplier?.id]);

  const productSuggestions = useMemo(() => 
    products.data.map(p => `${p.brand} ${p.model} - ${p.itemName}`),
    [products.data]
  );

  const handleProductSelect = (selectedText) => {
    const found = products.data.find(p => `${p.brand} ${p.model} - ${p.itemName}` === selectedText);
    if (found) {
      setForm(curr => ({
        ...curr,
        productId: found.id,
        category: found.category,
        type: found.type,
        brand: found.brand,
        model: found.model,
        itemName: found.itemName,
        sellingPrice: found.sellingPrice
      }));
      setSearchItem(selectedText);
    }
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.productId) {
      setMessage("Error: Please select a product from the list or add it to Items first.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("record_purchase", {
        p_product_id: form.productId,
        p_supplier_name: form.supplierName,
        p_supplier_phone: form.supplierPhone,
        p_quantity: Number(form.quantity),
        p_buying_price: Number(form.buyingPrice),
        p_payment_source: form.paymentSource,
        p_note: form.note,
        p_created_by: user.id || user.uid,
        p_created_by_name: user.name || "Staff",
        p_imei: form.imei || ""
      });

      if (error) throw error;
      
      setMessage(`Purchase recorded successfully: ${data}`);
      setForm(blankPurchase);
      setSearchItem("");
    } catch (err) {
      console.error(err);
      setMessage("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (purchases.loading || products.loading) {
    return <Loader text="Loading purchase flow..." />;
  }

  return (
    <div className="list-stack">
      <PageSection title="New Purchase Entry" subtitle="Select a product from master list and record supplier details">
        <form className="list-stack" onSubmit={handleSubmit}>
          <div className="form-grid form-grid-four">
            <div className="field field-span-2">
              <Autocomplete
                label="Search Product (Brand, Model, or Name)"
                placeholder="Type to search..."
                value={searchItem}
                suggestions={productSuggestions}
                onChange={(e) => {
                  setSearchItem(e.target.value);
                  if (form.productId) setForm(curr => ({ ...curr, productId: "" }));
                }}
                onSelect={handleProductSelect}
                required
              />
              {!form.productId && searchItem.length > 2 && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Product not found? </span>
                  <Link to="/inventory" className="link-text" style={{ fontSize: '0.85rem', fontWeight: '600' }}>Add New Product to Items</Link>
                </div>
              )}
            </div>

            <div className="field">
              <label>Category</label>
              <input value={form.category} readOnly placeholder="Auto-filled" style={{ backgroundColor: '#f9fafb' }} />
            </div>
            <div className="field">
              <label>Selling Price</label>
              <input value={form.sellingPrice ? formatCurrency(form.sellingPrice) : ""} readOnly placeholder="Auto-filled" style={{ backgroundColor: '#f9fafb' }} />
            </div>
          </div>

          <div className="form-grid">
            <Autocomplete
              label="Supplier Name"
              placeholder="Distributor name"
              value={form.supplierName}
              suggestions={customers.data.map(c => c.name)}
              hint={matchedSupplier ? "✓ Profile Linked" : null}
              onChange={(e) => setForm(curr => ({ ...curr, supplierName: e.target.value }))}
              onSelect={(name) => {
                const found = customers.data.find(c => c.name === name);
                if (found) {
                  setForm(curr => ({ ...curr, supplierName: found.name, supplierPhone: found.phone || "" }));
                }
              }}
              required
            />
            <Autocomplete
              label="Supplier Phone"
              placeholder="Supplier mobile"
              value={form.supplierPhone}
              suggestions={customers.data.map(c => c.phone).filter(Boolean)}
              onChange={(e) => setForm(curr => ({ ...curr, supplierPhone: e.target.value }))}
              onSelect={(phone) => {
                const found = customers.data.find(c => c.phone === phone);
                if (found) {
                  setForm(curr => ({ ...curr, supplierName: found.name || "", supplierPhone: found.phone }));
                }
              }}
            />
            <div className="field"><label>Quantity</label><input type="number" min="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Purchase qty" required /></div>
            <div className="field"><label>Buying Price</label><input type="number" min="0" value={form.buyingPrice} onChange={(event) => setForm((current) => ({ ...current, buyingPrice: event.target.value }))} placeholder="Cost per item" required /></div>
            <div className="field"><label>Payment Source</label><select value={form.paymentSource} onChange={(event) => setForm((current) => ({ ...current, paymentSource: event.target.value }))}><option value="cash">cash</option><option value="account">account</option></select></div>
            <div className="field">
              <label>Scan IMEI / Serial (Optional)</label>
              <input value={form.imei} onChange={(event) => setForm((current) => ({ ...current, imei: event.target.value }))} placeholder="Scan barcode or enter unique ID" autoComplete="off" />
            </div>
          </div>
          
          <div className="field"><label>Note</label><input value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Invoice no, warranty, batch..." /></div>

          {message ? <div className={`badge ${message.startsWith("Error") ? "danger" : "success"}`}>{message}</div> : null}
          
          <div className="topbar-actions">
            <Button type="submit" disabled={submitting}>{submitting ? "Processing..." : "Confirm Purchase & Update Stock"}</Button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Purchase History" subtitle="Recent stock acquisitions">
        <div className="field" style={{ marginBottom: '16px', maxWidth: '400px' }}>
          <input 
            placeholder="Search by Purchase No, Supplier or Item..." 
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
        </div>
        <DataTable
          rows={filteredHistory}
          columns={[
            { key: "purchaseNo", label: "Purchase No" },
            { key: "supplierName", label: "Supplier" },
            { key: "itemName", label: "Item" },
            { key: "quantity", label: "Qty" },
            { key: "totalAmount", label: "Total", render: (row) => formatCurrency(row.totalAmount) },
            { key: "paymentSource", label: "Paid Via" },
            { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </PageSection>
    </div>
  );
}
