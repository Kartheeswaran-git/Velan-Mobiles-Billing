import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";

export default function EInvoicingPage() {
  const bills = useFirestoreCollection("bills", { orderBy: { field: "createdAt", direction: "desc" } });

  function printInvoice(row) {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    const items = (row.items || []).map((item, index) => `<tr><td>${index + 1}</td><td>${item.itemName}</td><td>${item.quantity}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.total)}</td></tr>`).join("");
    printWindow.document.write(`<!doctype html><html><head><title>${row.billNo}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:10px}.totals{margin-top:20px;text-align:right}</style></head><body><h2>Velan Mobiles E-Invoice</h2><p>Invoice No: ${row.billNo}</p><p>Date: ${formatDate(row.createdAt)}</p><p>Customer: ${row.customerName} (${row.customerPhone})</p><table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table><div class="totals"><p>Subtotal: ${formatCurrency(row.subtotal)}</p><p>Discount: ${formatCurrency(row.discount)}</p><h3>Total: ${formatCurrency(row.total)}</h3></div><script>window.onload=function(){window.print()}</script></body></html>`);
    printWindow.document.close();
  }

  if (bills.loading) {
    return <Loader text="Loading e-invoices..." />;
  }

  return (
    <PageSection title="E-Invoicing" subtitle="View and print generated invoices">
      <DataTable
        rows={bills.data}
        columns={[
          { key: "billNo", label: "Invoice No" },
          { key: "customerName", label: "Customer" },
          { key: "paymentType", label: "Payment" },
          { key: "total", label: "Amount", render: (row) => formatCurrency(row.total) },
          { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) },
          { key: "print", label: "Action", render: (row) => <Button type="button" variant="secondary" onClick={() => printInvoice(row)}>Print</Button> },
        ]}
      />
    </PageSection>
  );
}
