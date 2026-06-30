import { useState } from "react";
import Button from "../components/Button";
import PageSection from "../components/PageSection";
import Loader from "../components/Loader";
import { fetchCollection } from "../supabase/database";
import { exportToCSV } from "../utils/exportUtils";

export default function DataExportPage() {
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");

  async function handleExport(collectionName, label) {
    setExporting(collectionName);
    setError("");
    try {
      const data = await fetchCollection(collectionName, { 
        orderBy: { field: 'createdAt', direction: 'desc' } 
      });
      exportToCSV(data, label.toLowerCase().replace(/\s+/g, "_"));
    } catch (err) {
      setError(`Failed to export ${label}: ${err.message}`);
    } finally {
      setExporting("");
    }
  }

  const exportOptions = [
    { key: "bills", label: "Sales Bills" },
    { key: "inventory", label: "Inventory Items" },
    { key: "service_jobs", label: "Service Jobs" },
    { key: "staff_attendance", label: "Staff Attendance" },
    { key: "customers", label: "Customer List" },
    { key: "money_transfers", label: "Money Transfers" },
    { key: "automated_bills", label: "Automated Bills" },
    { key: "purchase_entries", label: "Purchase History" },
    { key: "cash_ledger", label: "Cash Ledger" },
    { key: "account_ledger", label: "Account Ledger" },
  ];

  return (
    <div className="list-stack">
      <PageSection 
        title="Backup & Export" 
        subtitle="Download your shop data as CSV files compatible with Microsoft Excel"
      >
        <div className="card-grid">
          {exportOptions.map((option) => (
            <div key={option.key} className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>{option.label}</h3>
                <p className="muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>Export all records from the {option.label} table.</p>
              </div>
              <Button 
                onClick={() => handleExport(option.key, option.label)}
                disabled={!!exporting}
                variant={exporting === option.key ? "secondary" : "primary"}
              >
                {exporting === option.key ? "Exporting..." : "Download Excel (CSV)"}
              </Button>
            </div>
          ))}
        </div>
      </PageSection>

      {error && (
        <div className="badge danger" style={{ padding: '12px', fontSize: '1rem' }}>
          {error}
        </div>
      )}

      <PageSection title="Help" subtitle="How to open in Excel">
        <div className="muted" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
          <p>1. Download the file using the buttons above.</p>
          <p>2. Open Microsoft Excel.</p>
          <p>3. Go to <strong>File &gt; Open</strong> and select the downloaded .csv file.</p>
          <p>4. If Excel asks for formatting, choose <strong>Comma</strong> as the delimiter.</p>
        </div>
      </PageSection>
    </div>
  );
}
