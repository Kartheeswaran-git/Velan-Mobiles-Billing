import { formatCurrency, formatDate } from "./format";

export function printOldMobileReceipt(tx, type = 'buy', settings = {}) {
  const isBuy = type === 'buy';
  const customerName = isBuy ? (tx.sellerName || tx.customerName) : tx.buyerName;
  const customerPhone = isBuy ? tx.sellerPhone : tx.buyerPhone;
  const price = isBuy ? tx.buyPrice : tx.sellPrice;
  const title = isBuy ? "USED MOBILE PURCHASE RECEIPT" : "USED MOBILE SALE INVOICE";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; line-height: 1.5; }
        .header { text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px; }
        .shop-name { font-size: 24px; font-weight: 800; color: #ef4444; text-transform: uppercase; margin: 0; }
        .shop-info { font-size: 12px; color: #64748b; margin-top: 5px; }
        .receipt-title { font-size: 16px; font-weight: 700; margin: 15px 0; text-decoration: underline; text-align: center; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 13px; }
        .info-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
        .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
        .value { font-weight: 600; }

        .item-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
        .item-table th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; }
        .item-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        
        .total-section { text-align: right; margin-top: 20px; }
        .total-row { display: flex; justify-content: flex-end; gap: 20px; font-size: 18px; font-weight: 800; }

        .declaration { font-size: 10px; color: #64748b; margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px; font-weight: 600; }
        
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="shop-name">${settings.shopName || 'VELAN MOBILES'}</h1>
        <div class="shop-info">
          ${settings.address || 'Your Shop Address, City'}<br>
          Phone: ${settings.phone || '9XXXX XXXXX'} | GST: ${settings.gstNo || 'Not Provided'}
        </div>
      </div>

      <div class="receipt-title">${title}</div>

      <div class="info-grid">
        <div class="info-box">
          <div class="label">${isBuy ? 'Seller Details' : 'Buyer Details'}</div>
          <div class="value">${customerName}</div>
          <div class="value">${customerPhone || '-'}</div>
          ${isBuy && tx.aadharNo ? `<div class="value">Aadhaar: ${tx.aadharNo}</div>` : ''}
        </div>
        <div class="info-box">
          <div class="label">Date & Time</div>
          <div class="value">${formatDate(tx.createdAt || new Date())}</div>
          <div class="label" style="margin-top: 8px;">TXN ID</div>
          <div class="value">${tx.id?.slice(0, 13).toUpperCase() || 'NEW'}</div>
        </div>
      </div>

      <table class="item-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>IMEI / Serial</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Used Mobile Device</strong><br>
              <small>${tx.brand || ''} ${tx.model || ''}</small><br>
              <small style="color: #64748b;">Condition: ${tx.condition || 'As Inspected'}</small>
            </td>
            <td>
              ${tx.imei || '-'}<br>
              <small style="color: #64748b;">S/N: ${tx.serialNumber || tx.serial_number || '-'}</small>
            </td>
            <td style="text-align: right;">${formatCurrency(price)}</td>
          </tr>
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-row">
          <span>Net Amount:</span>
          <span style="color: #ef4444;">${formatCurrency(price)}</span>
        </div>
      </div>

      <div class="declaration">
        <strong>Declaration:</strong> I hereby declare that the above mentioned mobile phone belongs to me and I am selling it of my own free will. All documents provided are genuine. The shop is not responsible for any software issues or future network locks on used devices.
      </div>

      <div class="signatures">
        <div>Customer Signature</div>
        <div>Authorized Signatory</div>
      </div>

      <script>
        window.onload = () => {
          window.print();
          // window.close(); // Optional: close window after printing
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
}
