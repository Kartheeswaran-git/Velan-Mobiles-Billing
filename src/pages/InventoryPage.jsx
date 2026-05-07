import { useMemo, useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { deleteRecord } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { inventoryCategories } from "../utils/constants";
import { formatCurrency, formatDate } from "../utils/format";
import { supabase } from "../supabase/client";

const blankForm = {
  category: "new_mobile",
  type: "",
  brand: "",
  model: "",
  itemName: "",
  sellingPrice: "",
  minStock: "",
  note: "",
};

export default function InventoryPage({ readOnly = false }) {
  const { user } = useAuth();
  const products = useFirestoreCollection("product_master", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const visibleRows = useMemo(
    () =>
      products.data.filter((item) => {
        const matchesFilter = filter === "all" ? true : item.category === filter;
        const needle = `${item.itemName} ${item.brand || ""} ${item.model || ""}`.toLowerCase();
        return matchesFilter && needle.includes(search.toLowerCase());
      }),
    [filter, products.data, search],
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
      sellingPrice: row.sellingPrice ?? "",
      minStock: row.minStock ?? "",
      note: row.note || "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("create_or_update_product", {
        p_id: editingId || null,
        p_category: form.category,
        p_type: form.type,
        p_brand: form.brand,
        p_model: form.model,
        p_item_name: form.itemName,
        p_selling_price: Number(form.sellingPrice || 0),
        p_min_stock: Number(form.minStock || 0),
        p_note: form.note
      });

      if (error) throw error;
      
      setMessage(editingId ? "Product updated." : "New product added to master list.");
      resetForm();
    } catch (err) {
      console.error(err);
      setMessage("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (user.role !== "admin") return;
    if (!confirm("Are you sure you want to delete this product from master list?")) return;
    await deleteRecord("product_master", id);
  }

  if (products.loading) {
    return <Loader text="Loading product master list..." />;
  }

  return (
    <div className="list-stack">
      {!readOnly ? (
        <PageSection title={editingId ? "Edit Master Product" : "Add New Product to Master"} subtitle="Define product details here. Stock quantity is added via Purchases page.">
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
                <input value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} placeholder="mobile, charger, display..." />
              </div>
              <div className="field">
                <label>Brand</label>
                <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} placeholder="Samsung, Vivo, Apple..." />
              </div>
              <div className="field">
                <label>Model</label>
                <input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="A15, Y21, iPhone 13..." />
              </div>
              <div className="field">
                <label>Item Name</label>
                <input value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Samsung A15 128GB" required />
              </div>
              <div className="field">
                <label>Selling Price</label>
                <input type="number" min="0" value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} placeholder="Default selling price" />
              </div>
              <div className="field">
                <label>Min Stock Alert</label>
                <input type="number" min="0" value={form.minStock} onChange={(event) => setForm((current) => ({ ...current, minStock: event.target.value }))} placeholder="Low stock alert qty" />
              </div>
            </div>
            <div className="field">
              <label>Product Note</label>
              <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Warranty terms, color options, or general notes" />
            </div>
            
            {message ? <div className={`badge ${message.startsWith("Error") ? "danger" : "success"}`}>{message}</div> : null}
            <div className="topbar-actions">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Update Product" : "Save to Master List"}
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

      <PageSection title="Master Product List" subtitle="Search and manage your product catalog">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Search Products</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, brand, model..." />
          </div>
          <div className="field">
            <label>Filter Category</label>
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
            { key: "itemName", label: "Item Name" },
            { key: "brand", label: "Brand" },
            { key: "model", label: "Model" },
            { key: "category", label: "Category" },
            { key: "sellingPrice", label: "Sale Price", render: (row) => formatCurrency(row.sellingPrice) },
            { key: "minStock", label: "Min Stock" },
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
