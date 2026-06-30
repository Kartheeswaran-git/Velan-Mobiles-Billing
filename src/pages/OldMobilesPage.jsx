import { useEffect, useMemo, useState } from "react";
import Autocomplete from "../components/Autocomplete";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { createOldMobilePurchase, sellOldMobile, addOldMobileRepair, updateOldMobileExpectedSale } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";
import { printOldMobileReceipt } from "../utils/printOldMobileReceipt";

const blankPurchase = {
  customerName: "",
  customerPhone: "",
  brand: "",
  model: "",
  imei: "",
  serialNumber: "",
  aadharNo: "",
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
  const repairs = useFirestoreCollection("old_mobile_repairs", { orderBy: { field: "createdAt", direction: "desc" } });
  const settings = useFirestoreCollection("app_settings", { orderBy: { field: "createdAt", direction: "desc" } });
  const currentSettings = settings.data[0] || {};
  const [purchase, setPurchase] = useState(blankPurchase);
  const [sale, setSale] = useState({ inventoryId: "", sellPrice: "", customerName: "", customerPhone: "" });
  const [mobileSearch, setMobileSearch] = useState("");
  const [editingExpected, setEditingExpected] = useState({ id: null, value: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [repairModal, setRepairModal] = useState({ open: false, item: null, cost: "", note: "" });

  const oldMobiles = useMemo(() => inventory.data.filter((item) => item.category === "old_mobile" && item.status === "available"), [inventory.data]);
  const totalStockValue = useMemo(() => oldMobiles.reduce((sum, item) => sum + Number(item.buyingPrice || 0) + Number(item.repairCost || 0), 0), [oldMobiles]);

  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

  const matchedPurchaseCustomer = customers.data.find((c) => {
    const typedPhone = normalizePhone(purchase.customerPhone);
    if (typedPhone.length >= 5 && normalizePhone(c.phone) === typedPhone) return true;
    if (purchase.customerName.length >= 3 && c.name.toLowerCase().trim() === purchase.customerName.toLowerCase().trim()) return true;
    return false;
  });

  const matchedSaleCustomer = customers.data.find((c) => {
    const typedPhone = normalizePhone(sale.customerPhone);
    if (typedPhone.length >= 5 && normalizePhone(c.phone) === typedPhone) return true;
    if (sale.customerName.length >= 3 && c.name.toLowerCase().trim() === sale.customerName.toLowerCase().trim()) return true;
    return false;
  });

  useEffect(() => {
    if (!matchedPurchaseCustomer) return;
    setPurchase((current) => ({
      ...current,
      customerName: matchedPurchaseCustomer.name || current.customerName,
      customerPhone: matchedPurchaseCustomer.phone || current.customerPhone,
    }));
  }, [matchedPurchaseCustomer?.id]);

  useEffect(() => {
    if (!matchedSaleCustomer) return;
    setSale((current) => ({
      ...current,
      customerName: matchedSaleCustomer.name || current.customerName,
      customerPhone: matchedSaleCustomer.phone || current.customerPhone,
    }));
  }, [matchedSaleCustomer?.id]);

  async function handlePurchase(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage({ text: "", type: "" });
    try {
      await createOldMobilePurchase(purchase, user);
      setPurchase(blankPurchase);
      setMessage({ text: "Old mobile purchase saved successfully!", type: "success" });
    } catch (err) {
      setMessage({ text: "Error: " + err.message, type: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSale(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage({ text: "", type: "" });
    try {
      await sellOldMobile({ ...sale, currentUser: user });
      setSale({ inventoryId: "", sellPrice: "", customerName: "", customerPhone: "" });
      setMobileSearch("");
      setMessage({ text: "Old mobile sale completed!", type: "success" });
    } catch (err) {
      setMessage({ text: "Error: " + err.message, type: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveRepair(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await addOldMobileRepair(repairModal.item.id, repairModal.cost, repairModal.note, user);
      setRepairModal(prev => ({ ...prev, cost: "", note: "" }));
      setMessage({ text: "Repair entry added!", type: "success" });
    } catch (err) {
      alert("Error saving repair: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (inventory.loading || history.loading || customers.loading) {
    return <Loader text="Loading old mobiles..." />;
  }

  return (
    <div className="list-stack">
      <div className="form-grid form-grid-wide">
        <PageSection title="Buy Old Mobile" subtitle="Record a used phone purchase">
          <form className="form-grid" onSubmit={handlePurchase}>
            <Autocomplete
              label="Seller Name"
              placeholder="Search by name..."
              value={purchase.customerName}
              suggestions={customers.data.map(c => c.name)}
              onChange={(e) => setPurchase(curr => ({ ...curr, customerName: e.target.value }))}
              onSelect={(name) => {
                const found = customers.data.find(c => c.name === name);
                if (found) {
                  setPurchase(curr => ({
                    ...curr,
                    customerName: found.name,
                    customerPhone: found.phone || ""
                  }));
                }
              }}
              required
            />
            <div className="field">
              <Autocomplete
                label="Seller Phone"
                placeholder="Seller mobile number"
                value={purchase.customerPhone}
                suggestions={customers.data.map(c => c.phone).filter(Boolean)}
                onChange={(e) => setPurchase(curr => ({ ...curr, customerPhone: e.target.value }))}
                onSelect={(phone) => {
                  const found = customers.data.find(c => normalizePhone(c.phone) === normalizePhone(phone));
                  if (found) {
                    setPurchase(curr => ({
                      ...curr,
                      customerName: found.name || "",
                      customerPhone: found.phone
                    }));
                  }
                }}
                required
              />
              {matchedPurchaseCustomer ? <span className="field-hint" style={{ marginTop: 2, fontSize: '0.8rem', color: 'var(--success)' }}>✓ Profile Linked</span> : null}
            </div>

            <div className="field"><label>Brand</label><input value={purchase.brand} onChange={(event) => setPurchase((current) => ({ ...current, brand: event.target.value }))} placeholder="Apple, Samsung..." required /></div>
            <div className="field"><label>Model</label><input value={purchase.model} onChange={(event) => setPurchase((current) => ({ ...current, model: event.target.value }))} placeholder="iPhone 13, S21..." required /></div>
            
            <div className="field"><label>Scan IMEI Barcode</label><input value={purchase.imei} onChange={(event) => setPurchase((current) => ({ ...current, imei: event.target.value }))} placeholder="Scan or enter device IMEI" autoComplete="off" required /></div>
            <div className="field"><label>Serial Number</label><input value={purchase.serialNumber} onChange={(event) => setPurchase((current) => ({ ...current, serialNumber: event.target.value }))} placeholder="Optional S/N" autoComplete="off" /></div>

            <div className="field"><label>Aadhaar No</label><input value={purchase.aadharNo} onChange={(event) => setPurchase((current) => ({ ...current, aadharNo: event.target.value }))} placeholder="Seller Aadhaar" /></div>
            <div className="field"><label>Condition</label><input value={purchase.condition} onChange={(event) => setPurchase((current) => ({ ...current, condition: event.target.value }))} placeholder="Good, Cracked, etc." /></div>

            <div className="field"><label>Buy Price</label><input type="number" value={purchase.buyPrice} onChange={(event) => setPurchase((current) => ({ ...current, buyPrice: event.target.value }))} placeholder="₹ 0.00" required /></div>
            <div className="field"><label>Expected Sale</label><input type="number" value={purchase.expectedSellPrice} onChange={(event) => setPurchase((current) => ({ ...current, expectedSellPrice: event.target.value }))} placeholder="₹ 0.00" /></div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Note</label>
              <input value={purchase.note} onChange={(event) => setPurchase((current) => ({ ...current, note: event.target.value }))} placeholder="Additional details..." />
            </div>

            {message.text && message.type === "success" && <div className="badge success" style={{ gridColumn: "1 / -1" }}>{message.text}</div>}
            {message.text && message.type === "danger" && <div className="badge danger" style={{ gridColumn: "1 / -1" }}>{message.text}</div>}

            <div style={{ gridColumn: "1 / -1" }}>
              <Button type="submit" disabled={submitting} block>
                {submitting ? "Saving..." : "Save Purchase"}
              </Button>
            </div>
          </form>
        </PageSection>

        <PageSection title="Sell Old Mobile" subtitle="Mark used phone as sold and calculate profit">
          <form className="list-stack" onSubmit={handleSale}>
            <Autocomplete
              label="Available Mobile"
              placeholder="Scan IMEI or search by model..."
              value={mobileSearch}
              suggestions={oldMobiles.filter(m => m.status === 'available').map(m => `${m.itemName} - ${m.imei}`)}
              onChange={(e) => {
                setMobileSearch(e.target.value);
                setSale(curr => ({ ...curr, inventoryId: "" }));
              }}
              onSelect={(val) => {
                const found = oldMobiles.find(m => `${m.itemName} - ${m.imei}` === val);
                if (found) {
                  setSale(curr => ({ ...curr, inventoryId: found.id }));
                  setMobileSearch(`${found.itemName} - ${found.imei}`);
                }
              }}
              required
            />
            <Autocomplete
              label="Buyer Name"
              placeholder="Search by name..."
              value={sale.customerName}
              suggestions={customers.data.map(c => c.name)}
              onChange={(e) => setSale(curr => ({ ...curr, customerName: e.target.value }))}
              onSelect={(name) => {
                const found = customers.data.find(c => c.name === name);
                if (found) {
                  setSale(curr => ({
                    ...curr,
                    customerName: found.name,
                    customerPhone: found.phone || ""
                  }));
                }
              }}
              required
            />
            <div className="field">
              <Autocomplete
                label="Buyer Phone"
                placeholder="Buyer mobile number"
                value={sale.customerPhone}
                suggestions={customers.data.map(c => c.phone).filter(Boolean)}
                onChange={(e) => setSale(curr => ({ ...curr, customerPhone: e.target.value }))}
                onSelect={(phone) => {
                  const found = customers.data.find(c => normalizePhone(c.phone) === normalizePhone(phone));
                  if (found) {
                    setSale(curr => ({
                      ...curr,
                      customerName: found.name || "",
                      customerPhone: found.phone
                    }));
                  }
                }}
                required
              />
              {matchedSaleCustomer ? <span className="field-hint" style={{ marginTop: 2, fontSize: '0.8rem', color: 'var(--success)' }}>✓ Profile Linked</span> : null}
            </div>
            
            <div className="field">
              <label>Sale Price</label>
              <input type="number" min="0" value={sale.sellPrice} onChange={(event) => setSale((current) => ({ ...current, sellPrice: event.target.value }))} placeholder="Final sale amount" required />
            </div>
            <Button type="submit" block>Complete Sale</Button>
          </form>
        </PageSection>
      </div>

      <PageSection 
        title="Old Mobile Inventory" 
        subtitle="Bought and resale stock"
        actions={<div className="badge primary" style={{ fontSize: '1rem' }}>Total Stock Value: {formatCurrency(totalStockValue)}</div>}
      >
        <DataTable
          rows={oldMobiles}
          columns={[
            {
              key: "itemName",
              label: "Mobile Details",
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{row.itemName}</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>IMEI: {row.imei}</div>
                </div>
              )
            },
            {
              key: "investment",
              label: "Investment",
              render: (row) => {
                const bPrice = Number(row.buyingPrice || row.buying_price || 0);
                const rCost = Number(row.repairCost || row.repair_cost || 0);
                return (
                  <div>
                    <div style={{ fontWeight: 700 }}>{formatCurrency(bPrice + rCost)}</div>
                    <div className="muted" style={{ fontSize: '0.7rem' }}>B: {formatCurrency(bPrice)} | R: {formatCurrency(rCost)}</div>
                    {(row.repairNote || row.repair_note) && <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontStyle: 'italic' }}>Note: {row.repairNote || row.repair_note}</div>}
                  </div>
                );
              }
            },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            {
              key: "actions",
              label: "Repair",
              render: (row) => (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setRepairModal({
                      open: true,
                      item: row,
                      cost: "",
                      note: ""
                    });
                  }}
                >
                  {row.repairCost > 0 ? "Add Repair" : "Add Repair"}
                </Button>
              )
            },
          ]}
        />
      </PageSection>

      <PageSection title="Old Mobile Profit History" subtitle="Purchase and sales log">
        <DataTable
          rows={history.data.filter(row => row.stage === 'sold' || row.stage === 'purchased')}
          columns={[
            {
              key: "device",
              label: "Mobile",
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{row.brand} {row.model}</div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>IMEI: {row.imei}</div>
                </div>
              )
            },
            {
              key: "parties",
              label: "Parties",
              render: (row) => (
                <div>
                  <div style={{ fontSize: '0.9rem' }}>S: {row.sellerName || row.customerName}</div>
                  {row.buyerName && <div style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>B: {row.buyerName}</div>}
                </div>
              )
            },
            { 
              key: "investment", 
              label: "Investment", 
              render: (row) => {
                const bPrice = Number(row.buyPrice || row.buy_price || 0);
                const rCost = Number(row.repairCost || row.repair_cost || 0);
                return (
                  <div>
                    <div>{formatCurrency(bPrice + rCost)}</div>
                    <div className="muted" style={{ fontSize: '0.7rem' }}>B: {formatCurrency(bPrice)} | R: {formatCurrency(rCost)}</div>
                    {(row.repairNote || row.repair_note) && <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontStyle: 'italic' }}>Note: {row.repairNote || row.repair_note}</div>}
                  </div>
                );
              }
            },
            { 
              key: "expected", 
              label: "Exp. Sale", 
              render: (row) => {
                const currentId = row.mobileId || row.mobile_id;
                const isEditing = editingExpected.id === currentId;
                const price = row.expectedSellPrice || row.expected_sell_price || 0;

                if (isEditing) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input 
                        type="number"
                        autoFocus
                        value={editingExpected.value}
                        onChange={(e) => setEditingExpected(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateOldMobileExpectedSale(currentId, editingExpected.value);
                            setEditingExpected({ id: null, value: "" });
                          }
                          if (e.key === 'Escape') setEditingExpected({ id: null, value: "" });
                        }}
                        style={{ width: '90px', height: '36px', padding: '0 8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                      />
                      <Button 
                        size="sm"
                        onClick={() => {
                          updateOldMobileExpectedSale(currentId, editingExpected.value);
                          setEditingExpected({ id: null, value: "" });
                        }}
                      >
                        Set
                      </Button>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {row.stage === 'purchased' ? (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => setEditingExpected({ id: currentId, value: price })}
                        style={{ minWidth: '100px', justifyContent: 'space-between' }}
                      >
                        {formatCurrency(price)} <span style={{ opacity: 0.5 }}>✎</span>
                      </Button>
                    ) : (
                      <span className="muted" style={{ paddingLeft: '12px' }}>{formatCurrency(price)}</span>
                    )}
                  </div>
                );
              }
            },
            { key: "sellPrice", label: "Sold For", render: (row) => row.sellPrice > 0 ? formatCurrency(row.sellPrice) : "-" },
            {
              key: "profit",
              label: "Profit",
              render: (row) => row.stage === 'sold' ? (
                <span style={{ color: row.profit > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                  {formatCurrency(row.profit)}
                </span>
              ) : <span className="muted">Pending</span>
            },
            {
              key: "actions",
              label: "Receipts",
              render: (row) => (
                <div className="topbar-actions">
                  <Button variant="secondary" size="small" onClick={() => printOldMobileReceipt(row, 'buy', currentSettings)}>Buy Bill</Button>
                  {row.stage === 'sold' && <Button variant="secondary" size="small" onClick={() => printOldMobileReceipt(row, 'sell', currentSettings)}>Sale Bill</Button>}
                </div>
              )
            }
          ]}
        />
      </PageSection>

      {repairModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', borderRadius: '16px', padding: '0', overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '24px', color: 'white' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Repair History</h2>
              <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '0.9rem' }}>{repairModal.item?.itemName}</p>
            </div>

            <div style={{ padding: '24px' }}>
              {(() => {
                const currentItemRepairs = repairs.data.filter(r => (r.mobileId === repairModal.item?.id || r.mobile_id === repairModal.item?.id));
                const currentTotalRepair = currentItemRepairs.reduce((sum, r) => sum + Number(r.amount || 0), 0);
                
                return (
                  <div className="list-stack">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Total Repair Investment</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(currentTotalRepair)}</span>
                    </div>

                    <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '8px' }}>
                      <div className="list-stack">
                        {currentItemRepairs.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔧</div>
                            <p>No repair entries yet</p>
                          </div>
                        ) : (
                          currentItemRepairs.map(repair => (
                            <div key={repair.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{repair.note}</div>
                                <div className="muted" style={{ fontSize: '0.75rem' }}>{formatDate(repair.createdAt)}</div>
                              </div>
                              <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(repair.amount)}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '24px', borderTop: '2px dashed #e2e8f0' }}>
                      <h4 style={{ marginBottom: '16px', color: '#1e293b' }}>Add New Entry</h4>
                      <form className="form-grid" onSubmit={handleSaveRepair}>
                        <div className="field">
                          <label>Amount (₹)</label>
                          <input 
                            type="number" 
                            value={repairModal.cost} 
                            onChange={(e) => setRepairModal(prev => ({ ...prev, cost: e.target.value }))}
                            placeholder="0.00"
                            required
                            style={{ height: '48px', fontSize: '1.1rem', fontWeight: 600 }}
                          />
                        </div>
                        <div className="field">
                          <label>Work Description</label>
                          <input 
                            type="text" 
                            value={repairModal.note} 
                            onChange={(e) => setRepairModal(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="e.g. Battery, Charging Strip"
                            required
                            style={{ height: '48px' }}
                          />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '8px' }}>
                          <Button variant="secondary" type="button" onClick={() => setRepairModal({ open: false, item: null, cost: "", note: "" })} style={{ flex: 1 }}>Close</Button>
                          <Button type="submit" disabled={submitting} style={{ flex: 2 }}>{submitting ? 'Saving...' : 'Add Repair Entry'}</Button>
                        </div>
                      </form>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
