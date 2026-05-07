import { useMemo, useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { addInventoryItem, deleteRecord, updateInventoryItem } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { inventoryCategories, inventoryStatuses } from "../utils/constants";
import { formatCurrency, formatDate } from "../utils/format";

const blankForm = {
  category: "new_mobile",
  type: "",
  brand: "",
  model: "",
  itemName: "",
  serialNumber: "",
  buyingPrice: "",
  sellingPrice: "",
  quantity: 1,
  minStock: "",
  supplier: "",
  status: "available",
  note: "",
};

export default function InventoryPage({ readOnly = false }) {
  const { user } = useAuth();
  const inventory = useFirestoreCollection("inventory", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const typeSuggestions = useMemo(() => [...new Set(inventory.data.map((item) => item.type).filter(Boolean))], [inventory.data]);
  const brandSuggestions = useMemo(() => [...new Set(inventory.data.map((item) => item.brand).filter(Boolean))], [inventory.data]);
  const modelSuggestions = useMemo(() => [...new Set(inventory.data.map((item) => item.model).filter(Boolean))], [inventory.data]);

  const visibleRows = useMemo(
    () =>
      inventory.data.filter((item) => {
        const matchesFilter = filter === "all" ? true : item.category === filter;
        const needle = `${item.itemName} ${item.imei || ""} ${item.brand || ""} ${item.model || ""}`.toLowerCase();
        return matchesFilter && needle.includes(search.toLowerCase());
      }),
    [filter, inventory.data, search],
  );

  function resetForm() {
    setForm(blankForm);
    setEditingId("");
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      category: row.category || "new_mobile",
      type: row.type || "",
      brand: row.brand || "",
      model: row.model || "",
      itemName: row.itemName || "",
      serialNumber: row.serialNumber || "",
      buyingPrice: row.buyingPrice ?? "",
      sellingPrice: row.sellingPrice ?? "",
      quantity: row.quantity ?? 1,
      minStock: row.minStock ?? "",
      supplier: row.supplier || "",
      status: row.status || "available",
      note: row.note || "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updateInventoryItem(editingId, form);
        setMessage("Inventory item updated.");
      } else {
        await addInventoryItem(form, user);
        setMessage("Inventory item added.");
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (user.role !== "admin") return;
    await deleteRecord("inventory", id);
  }

  if (inventory.loading) {
    return <Loader text="Loading inventory..." />;
  }

  return (
    <div className="list-stack">
      {!readOnly ? (
        <PageSection title={editingId ? "Edit Stock Item" : "Add Stock Item"} subtitle="Track mobiles, accessories, spare parts, and old phones">
          <form className="list-stack" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {inventoryCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Type</label>
                <input list="inventory-type-options" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} placeholder="mobile, charger, display..." />
              </div>
              <div className="field">
                <label>Brand</label>
                <input list="inventory-brand-options" value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} placeholder="Samsung, Vivo, Apple..." />
              </div>
              <div className="field">
                <label>Model</label>
                <input list="inventory-model-options" value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="A15, Y21, iPhone 13..." />
              </div>
              <div className="field">
                <label>Item Name</label>
                <input value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Samsung A15 128GB" required />
              </div>
              <div className="field">
                <label>Serial Number</label>
                <input value={form.serialNumber} onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))} placeholder="Serial or barcode number" />
              </div>
              <div className="field">
                <label>Buying Price</label>
                <input type="number" min="0" value={form.buyingPrice} onChange={(event) => setForm((current) => ({ ...current, buyingPrice: event.target.value }))} placeholder="Buying price" />
              </div>
              <div className="field">
                <label>Selling Price</label>
                <input type="number" min="0" value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} placeholder="Selling price" />
              </div>
              <div className="field">
                <label>Quantity</label>
                <input type="number" min="0" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Stock quantity" />
              </div>
              <div className="field">
                <label>Min Stock</label>
                <input type="number" min="0" value={form.minStock} onChange={(event) => setForm((current) => ({ ...current, minStock: event.target.value }))} placeholder="Low stock alert qty" />
              </div>
              <div className="field">
                <label>Supplier</label>
                <input value={form.supplier} onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))} placeholder="Supplier or distributor name" />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  {inventoryStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Note</label>
              <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Warranty, color, storage, or purchase note" />
            </div>
            <datalist id="inventory-type-options">
              {typeSuggestions.map((option) => <option key={option} value={option} />)}
            </datalist>
            <datalist id="inventory-brand-options">
              {brandSuggestions.map((option) => <option key={option} value={option} />)}
            </datalist>
            <datalist id="inventory-model-options">
              {modelSuggestions.map((option) => <option key={option} value={option} />)}
            </datalist>
            {message ? <div className="badge success">{message}</div> : null}
            <div className="topbar-actions">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Update Item" : "Add Item"}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel Edit
                </Button>
              ) : null}
            </div>
          </form>
        </PageSection>
      ) : null}

      <PageSection title="Current Inventory" subtitle="Search by name and filter by category">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Search</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="iPhone, charger..." />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All Categories</option>
              {inventoryCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          rows={visibleRows}
          columns={[
            { key: "itemName", label: "Item" },
            { key: "category", label: "Category" },
            { key: "quantity", label: "Qty" },
            { key: "buyingPrice", label: "Buy", render: (row) => formatCurrency(row.buyingPrice) },
            { key: "sellingPrice", label: "Sell", render: (row) => formatCurrency(row.sellingPrice) },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "createdAt", label: "Added", render: (row) => formatDate(row.createdAt) },
            {
              key: "actions",
              label: "Actions",
              render: (row) =>
                readOnly ? (
                  "-"
                ) : (
                  <div className="topbar-actions">
                    <Button type="button" variant="secondary" onClick={() => startEdit(row)}>
                      Edit
                    </Button>
                    {user.role === "admin" ? (
                      <Button type="button" variant="danger" onClick={() => handleDelete(row.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ),
            },
          ]}
        />
      </PageSection>
    </div>
  );
}
