import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { createBill, fetchSingle, updateBillAdmin } from "../supabase/database";
import { calculateBillSummary, formatCurrency } from "../utils/format";
import { printBill } from "../utils/printBill";

const initialCustomer = { name: "", phone: "", address: "" };
const initialLine = { inventoryId: "", itemName: "", category: "", imei: "", quantity: 1, price: "", total: "" };

function normalizeBillItems(items = []) {
  return items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    return {
      inventoryId: item.inventoryId || item.inventory_id,
      itemName: item.itemName || item.item_name || "",
      category: item.category || "",
      imei: item.imei || "",
      quantity,
      price,
      total: Number(item.total || quantity * price),
    };
  });
}

export default function BillingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editBillId = searchParams.get("editBill");
  const inventory = useFirestoreCollection("inventory", { orderBy: { field: "createdAt", direction: "desc" } });
  const settings = useFirestoreCollection("app_settings", { orderBy: { field: "createdAt", direction: "desc" } });
  const currentSettings = settings.data[0] || {};
  const [customer, setCustomer] = useState(initialCustomer);
  const [line, setLine] = useState(initialLine);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState({ paymentType: "cash", cashAmount: "", accountAmount: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [lastSavedBill, setLastSavedBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [loadingEditBill, setLoadingEditBill] = useState(false);

  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  
  const filteredInventory = useMemo(
    () =>
      inventory.data.filter(
        (item) =>
          item.status === "available" &&
          Number(item.quantity || 0) > 0 &&
          `${item.itemName} ${item.imei || ""}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [inventory.data, search],
  );

  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
  const matchedCustomer = customers.data.find((c) => {
    const typedPhone = normalizePhone(customer.phone);
    return typedPhone.length >= 5 && normalizePhone(c.phone) === typedPhone;
  });

  useEffect(() => {
    if (!matchedCustomer || editBillId) return;
    setCustomer((current) => ({
      ...current,
      name: matchedCustomer.name || current.name,
      address: matchedCustomer.address || current.address,
    }));
  }, [matchedCustomer?.id, editBillId]);


  const summary = useMemo(() => {
    const totals = calculateBillSummary(cart, discount);
    return { ...totals, discount: Number(discount || 0) };
  }, [cart, discount]);

  useEffect(() => {
    let active = true;

    async function loadBillForEdit() {
      if (!editBillId) {
        setEditingBill(null);
        return;
      }

      setLoadingEditBill(true);
      setError("");
      setMessage("");
      try {
        const bill = await fetchSingle("bills", editBillId);
        if (!active) return;
        const items = normalizeBillItems(bill.items || []);
        setEditingBill(bill);
        setCustomer({
          name: bill.customerName || "",
          phone: bill.customerPhone || "",
          address: bill.customerAddress || "",
        });
        setCart(items);
        setDiscount(Number(bill.discount || 0) ? Number(bill.discount || 0) : "");
        setPayment({
          paymentType: bill.paymentType || "cash",
          cashAmount: Number(bill.cashAmount || 0) ? Number(bill.cashAmount || 0) : "",
          accountAmount: Number(bill.accountAmount || 0) ? Number(bill.accountAmount || 0) : "",
        });
        setLastSavedBill(null);
        setLine(initialLine);
        setSearch("");
        setMessage(`Editing bill ${bill.billNo}. Update the invoice and save changes.`);
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      } finally {
        if (active) {
          setLoadingEditBill(false);
        }
      }
    }

    loadBillForEdit();

    return () => {
      active = false;
    };
  }, [editBillId]);

  function handleSelectItem(inventoryItem) {
    const price = Number(inventoryItem.sellingPrice || 0);
    setLine({
      inventoryId: inventoryItem.id,
      itemName: inventoryItem.itemName,
      category: inventoryItem.category,
      imei: inventoryItem.imei || "",
      quantity: 1,
      price,
      total: price,
    });
  }

  const selectedStock = filteredInventory.find((item) => item.id === line.inventoryId);

  function addToCart() {
    if (!line.inventoryId) return;
    setCart((current) => [
      ...current,
      {
        ...line,
        quantity: Number(line.quantity),
        price: Number(line.price),
        total: Number(line.quantity) * Number(line.price),
      },
    ]);
    setLine(initialLine);
  }

  function removeLine(index) {
    setCart((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateCartLine(index, patch) {
    setCart((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) {
          return item;
        }

        const quantity = patch.quantity ?? item.quantity;
        const price = patch.price ?? item.price;
        return {
          ...item,
          ...patch,
          quantity: Number(quantity),
          price: Number(price),
          total: Number(quantity) * Number(price),
        };
      }),
    );
  }

  function resetBillForm() {
    setCustomer(initialCustomer);
    setCart([]);
    setDiscount("");
    setPayment({ paymentType: "cash", cashAmount: "", accountAmount: "" });
    setLine(initialLine);
    setSearch("");
    setEditingBill(null);
    setLastSavedBill(null);
  }

  function cancelEdit() {
    resetBillForm();
    setSearchParams({});
    setMessage("");
    setError("");
    navigate("/admin/bills");
  }

  function syncPayment(type, total) {
    if (type === "cash") {
      return { paymentType: "cash", cashAmount: total, accountAmount: "" };
    }
    if (type === "account") {
      return { paymentType: "account", cashAmount: "", accountAmount: total };
    }
    return { paymentType: "split", cashAmount: payment.cashAmount, accountAmount: payment.accountAmount };
  }

  function handlePrintBill() {
    if (!lastSavedBill) return;
    printBill(lastSavedBill, currentSettings);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!customer.name || !customer.phone || !cart.length) {
      setError("Customer name, phone, and at least one item are required. Address is optional.");
      return;
    }

    const total = Number(summary.total);
    const payTotal = Number(payment.cashAmount || 0) + Number(payment.accountAmount || 0);
    if (payTotal !== total) {
      setError("Cash and account amounts must match the bill total.");
      return;
    }

    setSubmitting(true);
    try {
      const billSnapshot = {
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        items: cart.map((item) => ({ ...item })),
        subtotal: summary.subtotal,
        discount: summary.discount,
        total: summary.total,
        cashAmount: Number(payment.cashAmount || 0),
        accountAmount: Number(payment.accountAmount || 0),
        paymentType: payment.paymentType,
        createdByName: user.name,
        createdAt: new Date().toISOString(),
      };

      if (editingBill) {
        await updateBillAdmin(editingBill.id, {
          customerName: customer.name,
          customerPhone: customer.phone,
          items: cart,
          discount: summary.discount,
          paymentType: payment.paymentType,
          cashAmount: Number(payment.cashAmount || 0),
          accountAmount: Number(payment.accountAmount || 0),
        }, user);
        setLastSavedBill({
          ...billSnapshot,
          billNo: editingBill.billNo,
          createdAt: editingBill.createdAt,
          createdByName: editingBill.createdByName,
        });
        setMessage(`Bill updated successfully: ${editingBill.billNo}`);
        return;
      }

      const billNo = await createBill({
        customer,
        items: cart,
        summary,
        payment,
        currentUser: user,
      });
      setLastSavedBill({
        ...billSnapshot,
        billNo,
      });
      setMessage(`Bill saved successfully: ${billNo}`);
      setCustomer(initialCustomer);
      setCart([]);
      setDiscount("");
      setPayment({ paymentType: "cash", cashAmount: "", accountAmount: "" });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (inventory.loading || loadingEditBill) {
    return <Loader text="Loading inventory for billing..." />;
  }

  return (
    <div className="list-stack">
      <PageSection
        title={editingBill ? `Edit Sales Invoice - ${editingBill.billNo}` : "Create Bill"}
        subtitle={editingBill ? "Update customer, items, discount, and payment for this saved bill" : "Customer, stock pick, cart, and payment in one billing screen"}
      >
        <form className="list-stack" onSubmit={handleSubmit}>
          <div className="billing-grid">
            <div className="billing-main">
              <div className="billing-block">
                <div className="billing-block-header">
                  <h3>Customer Details</h3>
                  <span className="muted">Quick entry for walk-in billing</span>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label>Customer Name</label>
                    <input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="Customer full name" required />
                  </div>
                  <div className="field">
                    <label>Phone</label>
                    <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="Customer mobile number" required />
                    {matchedCustomer && !editBillId ? <span className="field-hint">Customer details auto-filled.</span> : null}
                  </div>
                  <div className="field">
                    <label>Address (Optional)</label>
                    <input value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} placeholder="Street, area, city optional" />
                  </div>
                </div>
              </div>

              <div className="billing-block">
                <div className="billing-block-header">
                  <h3>Pick Product</h3>
                  <span className="muted">Search and add stock directly into the bill</span>
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Search by item or IMEI</label>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Samsung, charger, IMEI..." />
                </div>

                <div className="billing-stock-grid">
                  {filteredInventory.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`stock-card ${line.inventoryId === item.id ? "active" : ""}`}
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="stock-card-top">
                        <strong>{item.itemName}</strong>
                        <span>{formatCurrency(item.sellingPrice)}</span>
                      </div>
                      <div className="stock-card-meta">
                        <span>{item.category}</span>
                        <span>Qty {item.quantity}</span>
                        <span>{item.imei || "No IMEI"}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <div className="field">
                    <label>Selected Item</label>
                    <input value={line.itemName} readOnly placeholder="Choose an item above" />
                  </div>
                  <div className="field">
                    <label>Available Qty</label>
                    <input value={selectedStock?.quantity ?? "-"} readOnly />
                  </div>
                  <div className="field">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedStock?.quantity || undefined}
                      value={line.quantity}
                      placeholder="Qty"
                      onChange={(event) =>
                        setLine((current) => ({
                          ...current,
                          quantity: Number(event.target.value),
                          total: Number(event.target.value) * Number(current.price || 0),
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Price</label>
                    <input
                      type="number"
                      min="0"
                      value={line.price}
                      placeholder="Sale price"
                      onChange={(event) =>
                        setLine((current) => ({
                          ...current,
                          price: Number(event.target.value),
                          total: Number(current.quantity || 0) * Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Line Total</label>
                    <input value={line.total} readOnly />
                  </div>
                  <div className="field billing-action-field">
                    <label>&nbsp;</label>
                    <Button type="button" onClick={addToCart} disabled={!line.inventoryId}>
                      Add To Bill
                    </Button>
                  </div>
                </div>
              </div>

              <div className="billing-block">
                <div className="billing-block-header">
                  <h3>Bill Items</h3>
                  <span className="muted">{cart.length} item(s) ready to save</span>
                </div>
                <DataTable
                  rows={cart.map((item, index) => ({ ...item, id: `${item.inventoryId}-${index}`, index }))}
                  columns={[
                    { key: "itemName", label: "Item" },
                    { key: "imei", label: "IMEI" },
                    {
                      key: "quantity",
                      label: "Qty",
                      render: (row) => (
                        <input
                          className="table-input"
                          type="number"
                          min="1"
                          value={row.quantity}
                          placeholder="Qty"
                          onChange={(event) => updateCartLine(row.index, { quantity: Number(event.target.value || 1) })}
                        />
                      ),
                    },
                    {
                      key: "price",
                      label: "Price",
                      render: (row) => (
                        <input
                          className="table-input"
                          type="number"
                          min="0"
                          value={row.price}
                          placeholder="Price"
                          onChange={(event) => updateCartLine(row.index, { price: Number(event.target.value || 0) })}
                        />
                      ),
                    },
                    { key: "total", label: "Line Total", render: (row) => formatCurrency(row.total) },
                    {
                      key: "actions",
                      label: "Action",
                      render: (row) => (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => removeLine(row.index)}
                        >
                          Remove
                        </Button>
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            <div className="billing-side">
              <div className="billing-block billing-sticky">
                <div className="billing-block-header">
                  <h3>Payment Summary</h3>
                  <span className="muted">Complete and save bill</span>
                </div>

                <div className="form-grid billing-payment-grid">
                  <div className="field">
                    <label>Discount</label>
                    <input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="Discount amount" />
                  </div>
                  <div className="field">
                    <label>Payment Type</label>
                    <select
                      value={payment.paymentType}
                      onChange={(event) => setPayment(syncPayment(event.target.value, summary.total))}
                    >
                      <option value="cash">Cash</option>
                      <option value="account">Account</option>
                      <option value="split">Split</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Cash Amount</label>
                    <input
                      type="number"
                      min="0"
                      value={payment.cashAmount}
                      placeholder="Cash received"
                      onChange={(event) => setPayment((current) => ({ ...current, cashAmount: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Account Amount</label>
                    <input
                      type="number"
                      min="0"
                      value={payment.accountAmount}
                      placeholder="Bank/UPI received"
                      onChange={(event) => setPayment((current) => ({ ...current, accountAmount: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="billing-totals">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <strong>{formatCurrency(summary.subtotal)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Discount</span>
                    <strong>{formatCurrency(summary.discount)}</strong>
                  </div>
                  <div className="summary-row total">
                    <span>Total</span>
                    <strong>{formatCurrency(summary.total)}</strong>
                  </div>
                </div>

                {error ? <div className="badge danger">{error}</div> : null}
                {message ? <div className="badge success">{message}</div> : null}

                <div className="topbar-actions">
                  <Button type="submit" disabled={submitting || !cart.length}>
                    {submitting ? (editingBill ? "Updating Bill..." : "Saving Bill...") : (editingBill ? "Update Bill" : "Save Bill")}
                  </Button>
                  {editingBill ? (
                    <Button type="button" variant="secondary" onClick={cancelEdit}>
                      Cancel Edit
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" onClick={handlePrintBill} disabled={!lastSavedBill}>
                    Print Bill
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </PageSection>
    </div>
  );
}
