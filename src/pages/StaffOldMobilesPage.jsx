import React, { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import Autocomplete from "../components/Autocomplete";
import { sellOldMobile } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";
import { printBill } from "../utils/printBill";

export default function StaffOldMobilesPage() {
  const { user } = useAuth();
  const inventory = useFirestoreCollection("inventory", { 
    where: [
      { field: "category", operator: "==", value: "old_mobile" },
      { field: "status", operator: "==", value: "available" }
    ],
    orderBy: { field: "createdAt", direction: "desc" } 
  });
  const customers = useFirestoreCollection("customers", { orderBy: { field: "createdAt", direction: "desc" } });
  const settings = useFirestoreCollection("app_settings", { orderBy: { field: "createdAt", direction: "desc" } });
  const [submitting, setSubmitting] = useState(false);
  const [sellModal, setSellModal] = useState({ open: false, item: null, sellPrice: "", customerName: "", customerPhone: "" });
  const [message, setMessage] = useState({ text: "", type: "" });

  const normalizePhone = (p) => p?.replace(/\D/g, '').slice(-10);
  const matchedCustomer = customers.data.find(c => normalizePhone(c.phone) === normalizePhone(sellModal.customerPhone));

  async function handleSale(event) {
    event.preventDefault();
    if (!sellModal.item) return;
    
    setSubmitting(true);
    try {
      await sellOldMobile(
        sellModal.item.id,
        sellModal.sellPrice,
        sellModal.customerName,
        sellModal.customerPhone,
        user.id || user.uid,
        user.name || "Staff"
      );
      
      const billData = {
        billNo: "OLD-" + Date.now().toString().slice(-6),
        createdAt: new Date().toISOString(),
        createdByName: user.name || "Staff",
        customerName: sellModal.customerName,
        customerPhone: sellModal.customerPhone,
        items: [{
          itemName: sellModal.item.itemName,
          imei: sellModal.item.imei,
          quantity: 1,
          price: sellModal.sellPrice,
          total: sellModal.sellPrice
        }],
        subtotal: sellModal.sellPrice,
        discount: 0,
        total: sellModal.sellPrice,
        cashAmount: sellModal.sellPrice,
        accountAmount: 0,
        paymentType: "cash"
      };

      printBill(billData, settings.data[0] || {});
      setMessage({ text: "Sold successfully! Bill printed.", type: "success" });
      setSellModal({ open: false, item: null, sellPrice: "", customerName: "", customerPhone: "" });
    } catch (err) {
      alert("Error processing sale: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (inventory.loading || customers.loading) {
    return <Loader text="Loading available mobiles..." />;
  }

  const columns = [
    { key: "itemName", label: "Mobile Model" },
    { key: "imei", label: "IMEI / Serial" },
    { key: "condition", label: "Condition" },
    { 
      key: "price", 
      label: "Selling Price", 
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
          {formatCurrency(row.sellingPrice || row.selling_price || 0)}
        </span>
      )
    },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <Button 
          size="sm" 
          onClick={() => setSellModal({ 
            open: true, 
            item: row, 
            sellPrice: row.sellingPrice || row.selling_price || "",
            customerName: "",
            customerPhone: ""
          })}
        >
          Sell & Bill
        </Button>
      )
    }
  ];

  return (
    <div className="list-stack">
      {message.text && (
        <div className={`badge ${message.type}`} style={{ marginBottom: '20px' }}>
          {message.text}
        </div>
      )}

      <PageSection title="Available Old Mobiles" subtitle="Select a device to generate a bill">
        <DataTable 
          columns={columns}
          rows={inventory.data} 
          emptyText="No old mobiles available for sale right now."
        />
      </PageSection>

      {sellModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px', padding: 0, overflow: 'hidden', borderRadius: '16px' }}>
            <div className="modal-header" style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '24px', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Generate Sales Bill</h2>
              <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>Complete the transaction for this device</p>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ 
                backgroundColor: '#f8fafc', 
                padding: '16px', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{sellModal.item?.itemName}</div>
                  <div className="muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>IMEI: {sellModal.item?.imei}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Condition</div>
                  <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{sellModal.item?.condition || 'Good'}</div>
                </div>
              </div>

              <form className="list-stack" onSubmit={handleSale} style={{ gap: '20px' }}>
                <div className="form-grid">
                  <Autocomplete
                    label="Customer Name"
                    placeholder="Buyer's full name"
                    value={sellModal.customerName}
                    suggestions={customers.data.map(c => c.name)}
                    onChange={(e) => setSellModal(curr => ({ ...curr, customerName: e.target.value }))}
                    onSelect={(name) => {
                      const found = customers.data.find(c => c.name === name);
                      if (found) {
                        setSellModal(curr => ({
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
                      label="Customer Phone"
                      placeholder="10-digit mobile number"
                      value={sellModal.customerPhone}
                      suggestions={customers.data.map(c => c.phone).filter(Boolean)}
                      onChange={(e) => setSellModal(curr => ({ ...curr, customerPhone: e.target.value }))}
                      onSelect={(phone) => {
                        const found = customers.data.find(c => normalizePhone(c.phone) === normalizePhone(phone));
                        if (found) {
                          setSellModal(curr => ({
                            ...curr,
                            customerName: found.name || "",
                            customerPhone: found.phone
                          }));
                        }
                      }}
                      required
                    />
                    {matchedCustomer ? <span className="field-hint" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Existing Customer Found</span> : null}
                  </div>
                </div>

                <div className="field" style={{ 
                  backgroundColor: '#fff1f1', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  border: '1px solid #fee2e2' 
                }}>
                  <label style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Final Sale Price (₹)</label>
                  <input 
                    type="number" 
                    value={sellModal.sellPrice} 
                    onChange={(e) => setSellModal(prev => ({ ...prev, sellPrice: e.target.value }))}
                    required
                    style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 800, 
                      color: 'var(--primary)',
                      textAlign: 'center',
                      height: '54px',
                      borderRadius: '10px',
                      border: '2px solid #fee2e2'
                    }}
                  />
                  <div className="muted" style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.8rem' }}>
                    Standard Price: {formatCurrency(sellModal.item?.sellingPrice || 0)}
                  </div>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 2fr', 
                  gap: '12px', 
                  marginTop: '12px' 
                }}>
                  <Button 
                    variant="secondary" 
                    type="button" 
                    style={{ height: '50px', borderRadius: '10px' }}
                    onClick={() => setSellModal({ open: false, item: null, sellPrice: "", customerName: "", customerPhone: "" })}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitting}
                    style={{ height: '50px', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 700 }}
                  >
                    {submitting ? 'Generating...' : 'Complete Sale & Print Bill'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
