import { formatCurrency, formatDate } from "./format";

const PAPER_PRESETS = {
  A4: {
    size: "A4 portrait",
    width: "190mm",
    bodyPadding: "10mm",
    invoicePadding: "7mm",
    fontSize: "14px",
  },
  A5: {
    size: "A5 portrait",
    width: "138mm",
    bodyPadding: "6mm",
    invoicePadding: "5mm",
    fontSize: "12px",
  },
};

export function printBill(billData, shopSettings = {}) {
  if (!billData) return;
  const paperSize = shopSettings.paperSize === "A5" ? "A5" : "A4";
  const paper = PAPER_PRESETS[paperSize];
  const brandName = shopSettings.shopName || "Velan Mobiles";
  const footerNote = shopSettings.footerNote || `Thank you for shopping with ${brandName}.`;
  const shopAddress = shopSettings.address || "";
  const shopPhone = shopSettings.shopPhone || "";
  const gstin = shopSettings.gstin || "";

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow popups to print the bill.");
    return;
  }

  const invoiceRows = billData.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.itemName}</td>
          <td>${item.imei || "-"}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.price)}</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `,
    )
    .join("");

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${billData.billNo}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: ${paper.bodyPadding};
            color: #111827;
            font-size: ${paper.fontSize};
            background: #ffffff;
          }
          .invoice {
            width: ${paper.width};
            margin: 0 auto;
            border: 1px solid #d1d5db;
            padding: ${paper.invoicePadding};
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            border-bottom: 2px solid #dc2626;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .brand {
            font-size: ${paperSize === "A5" ? "22px" : "28px"};
            font-weight: 700;
            color: #b91c1c;
            margin-bottom: 6px;
          }
          .muted {
            color: #4b5563;
            font-size: 13px;
          }
          .shop-meta {
            margin-top: 8px;
            line-height: 1.45;
          }
          .meta {
            text-align: right;
          }
          .meta strong {
            display: block;
            font-size: 16px;
            margin-bottom: 4px;
          }
          .section {
            margin-bottom: 18px;
          }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 8px;
          }
          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 10px 12px;
            text-align: left;
            font-size: 14px;
          }
          th {
            background: #f9fafb;
          }
          .totals {
            margin-left: auto;
            width: ${paperSize === "A5" ? "250px" : "320px"};
            margin-top: 20px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .totals-row.total {
            font-size: 18px;
            font-weight: 700;
            border-bottom: 2px solid #111827;
          }
          .footer {
            margin-top: 28px;
            display: flex;
            justify-content: space-between;
            gap: 20px;
            color: #4b5563;
            font-size: 13px;
          }
          @media print {
            @page {
              size: ${paper.size};
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .invoice {
              border: none;
              width: 100%;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div>
              <div class="brand">${brandName}</div>
              <div class="muted">Mobile Shop Billing Invoice</div>
              <div class="muted">Sales, service, accessories, and devices</div>
              <div class="muted shop-meta">
                ${shopAddress ? `<div>${shopAddress}</div>` : ""}
                ${shopPhone ? `<div>Phone: ${shopPhone}</div>` : ""}
                ${gstin ? `<div>GSTIN: ${gstin}</div>` : ""}
              </div>
            </div>
            <div class="meta">
              <strong>${billData.billNo}</strong>
              <div class="muted">Date: ${formatDate(billData.createdAt)}</div>
              <div class="muted">Staff: ${billData.createdByName}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Customer Details</div>
            <div class="detail-grid">
              <div>
                <div><strong>${billData.customerName}</strong></div>
                <div class="muted">${billData.customerPhone}</div>
              </div>
              <div class="muted">${billData.customerAddress || "Walk-in customer"}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Bill Items</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>IMEI</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRows}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><strong>${formatCurrency(billData.subtotal)}</strong></div>
            <div class="totals-row"><span>Discount</span><strong>${formatCurrency(billData.discount)}</strong></div>
            <div class="totals-row"><span>Cash Paid</span><strong>${formatCurrency(billData.cashAmount)}</strong></div>
            <div class="totals-row"><span>Account Paid</span><strong>${formatCurrency(billData.accountAmount)}</strong></div>
            <div class="totals-row total"><span>Grand Total</span><strong>${formatCurrency(billData.total)}</strong></div>
          </div>

          <div class="footer">
            <div>Payment Mode: ${billData.paymentType}</div>
            <div>${footerNote}</div>
          </div>
        </div>
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
