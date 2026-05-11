import { useState } from "react";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate, isSameDay, toDateObject } from "../utils/format";

const chartViewOptions = [
  { value: "overall", label: "Overall" },
  { value: "sales", label: "Sales" },
  { value: "moneyTransfer", label: "Customer Transfer" },
  { value: "service", label: "Service" },
];

const chartViewLabels = {
  overall: "Overall",
  sales: "Sales",
  moneyTransfer: "Customer Transfer",
  service: "Service",
};

export default function AdminDashboardPage() {
  const [chartView, setChartView] = useState("overall");
  const bills = useFirestoreCollection("bills", { orderBy: { field: "createdAt", direction: "desc" } });
  const inventory = useFirestoreCollection("inventory", { orderBy: { field: "createdAt", direction: "desc" } });
  const services = useFirestoreCollection("service_jobs", { orderBy: { field: "receivedAt", direction: "desc" } });
  const cashLedger = useFirestoreCollection("cash_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const accountLedger = useFirestoreCollection("account_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const moneyTransfers = useFirestoreCollection("money_transfers", { orderBy: { field: "createdAt", direction: "desc" } });

  if (bills.loading || inventory.loading || services.loading || cashLedger.loading || accountLedger.loading || moneyTransfers.loading) {
    return <Loader text="Loading admin dashboard..." />;
  }

  const todayBills = bills.data.filter((bill) => isSameDay(bill.createdAt));
  const todayCash = todayBills.reduce((sum, bill) => sum + Number(bill.cashAmount || 0), 0);
  const todayAccount = todayBills.reduce((sum, bill) => sum + Number(bill.accountAmount || 0), 0);
  const totalSales = todayBills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
  const todayExpenses = cashLedger.data
    .filter((entry) => entry.type === "expense" && isSameDay(entry.createdAt))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const todayMoneyTransfers = moneyTransfers.data.filter((transfer) => isSameDay(transfer.createdAt));
  const todayMoneyTransferProfit = todayMoneyTransfers.reduce((sum, transfer) => sum + Number(transfer.commission || 0), 0);
  const todayServiceProfit = services.data
    .filter((job) => job.status === "delivered" && isSameDay(job.deliveredAt))
    .reduce((sum, job) => sum + (Number(job.estimate || 0) - Number(job.sparePartsCost || 0)), 0);
  const estimatedProfit = totalSales + todayMoneyTransferProfit + todayServiceProfit - todayExpenses;
  const cashBalance =
    cashLedger.data.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + Number(entry.amount || 0), 0) -
    cashLedger.data.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const accountBalance =
    accountLedger.data.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + Number(entry.amount || 0), 0) -
    accountLedger.data.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalBalance = cashBalance + accountBalance;

  const lowStock = inventory.data.filter((item) => Number(item.quantity || 0) <= Number(item.minStock || 0));
  const availableMobiles = inventory.data.filter((item) => item.category === "new_mobile" && item.status === "available").length;
  const accessoriesCount = inventory.data
    .filter((item) => item.category === "accessory")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const oldMobilesAvailable = inventory.data.filter((item) => item.category === "old_mobile" && item.status === "available").length;
  const pendingJobs = services.data.filter((job) => ["received", "checking", "waiting_approval", "repairing"].includes(job.status));
  const readyDelivery = services.data.filter((job) => job.status === "ready");
  const toCollect = pendingJobs.reduce((sum, job) => Math.max(Number(job.estimate || 0) - Number(job.advance || 0), 0) + sum, 0);
  const toPay = todayExpenses;
  const chartTrend = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));

    const sales = bills.data
      .filter((bill) => isSameDay(bill.createdAt, day))
      .reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const moneyTransfer = moneyTransfers.data
      .filter((transfer) => isSameDay(transfer.createdAt, day))
      .reduce((sum, transfer) => sum + Number(transfer.commission || 0), 0);
    const service = services.data
      .filter((job) => isSameDay(job.receivedAt, day))
      .reduce((sum, job) => sum + Number(job.advance || 0), 0);
    const overall = sales + moneyTransfer + service;

    return {
      id: day.toISOString(),
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(day),
      dateLabel: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(day),
      sales,
      moneyTransfer,
      service,
      overall,
      value: { overall, sales, moneyTransfer, service }[chartView] || 0,
    };
  });
  const selectedChartLabel = chartViewLabels[chartView] || "Overall";
  const selectedChartTotal = chartTrend.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const maxTrendValue = Math.max(...chartTrend.map((entry) => entry.value), 1);
  const chartWidth = 640;
  const chartHeight = 220;
  const chartPadding = 28;
  const chartStep = chartTrend.length > 1 ? (chartWidth - chartPadding * 2) / (chartTrend.length - 1) : 0;
  const chartPoints = chartTrend.map((entry, index) => {
    const x = chartPadding + index * chartStep;
    const normalized = entry.value / maxTrendValue;
    const y = chartHeight - chartPadding - normalized * (chartHeight - chartPadding * 2);
    return {
      ...entry,
      x,
      y,
    };
  });
  const chartPath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${chartPath} L ${chartWidth - chartPadding} ${chartHeight - chartPadding} L ${chartPadding} ${chartHeight - chartPadding} Z`;
  const recentBills = bills.data
    .slice()
    .sort((left, right) => toDateObject(right.createdAt) - toDateObject(left.createdAt))
    .slice(0, 5);
  const latestTransactions = [
    ...recentBills.map((bill) => ({
      id: `bill-${bill.id}`,
      date: bill.createdAt,
      type: "Sale Invoice",
      txnNo: bill.billNo,
      partyName: bill.customerName,
      amount: Number(bill.total || 0),
    })),
    ...cashLedger.data.slice(0, 5).map((entry) => ({
      id: `cash-${entry.id}`,
      date: entry.createdAt,
      type: entry.type === "expense" ? "Cash Expense" : "Cash Income",
      txnNo: entry.category,
      partyName: entry.createdByName || "Staff",
      amount: Number(entry.amount || 0) * (entry.type === "expense" ? -1 : 1),
    })),
    ...moneyTransfers.data.slice(0, 5).map((transfer) => ({
      id: `money-transfer-${transfer.id}`,
      date: transfer.createdAt,
      type: "Customer Transfer",
      txnNo: transfer.transferNo,
      partyName: transfer.customerName || "Customer",
      amount: Number(transfer.commission || 0),
    })),
  ]
    .sort((left, right) => toDateObject(right.date) - toDateObject(left.date))
    .slice(0, 6);
  const checklist = [
    {
      id: "check-1",
      label: "Follow up repaired devices",
      value: readyDelivery.length,
      done: readyDelivery.length === 0,
      note: readyDelivery.length ? `${readyDelivery.length} job(s) are ready for delivery` : "No repaired devices waiting",
    },
    {
      id: "check-2",
      label: "Reorder low stock items",
      value: lowStock.length,
      done: lowStock.length === 0,
      note: lowStock.length ? `${lowStock.length} item(s) are below minimum stock` : "Stock levels are healthy",
    },
    {
      id: "check-3",
      label: "Review service queue",
      value: pendingJobs.length,
      done: pendingJobs.length === 0,
      note: pendingJobs.length ? `${pendingJobs.length} active service job(s) in progress` : "Service queue is clear",
    },
  ];
  const totalInvoices7Days = chartTrend.reduce((sum, entry, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return sum + bills.data.filter((bill) => isSameDay(bill.createdAt, day)).length;
  }, 0);

  const staffMap = {};
  todayBills.forEach((bill) => {
    const key = bill.createdByName || bill.createdBy || "Unknown";
    staffMap[key] = staffMap[key] || { id: key, name: key, sales: 0, bills: 0, cash: 0 };
    staffMap[key].sales += Number(bill.total || 0);
    staffMap[key].bills += 1;
    staffMap[key].cash += Number(bill.cashAmount || 0);
  });

  const serviceStaffMap = {};
  services.data
    .filter((job) => isSameDay(job.receivedAt))
    .forEach((job) => {
      const key = job.receivedByName || job.receivedBy || "Unknown";
      serviceStaffMap[key] = serviceStaffMap[key] || { id: key, name: key, jobs: 0, advance: 0 };
      serviceStaffMap[key].jobs += 1;
      serviceStaffMap[key].advance += Number(job.advance || 0);
    });

  return (
    <div className="dashboard-shell">
      <div className="dashboard-heading">
        <div>
          <h2>Business Overview</h2>
          <p className="muted">Live summary of collections, payables, balances, and daily activity.</p>
        </div>
        <div className="dashboard-update-chip">
          <span>Last Update:</span>
          <strong>{formatDate(new Date().toISOString())}</strong>
        </div>
      </div>

      <div className="dashboard-overview-grid">
        <div className="overview-card overview-card-success">
          <div className="overview-card-label">To Collect</div>
          <div className="overview-card-value">{formatCurrency(toCollect)}</div>
          <div className="overview-card-note">{readyDelivery.length} repair delivery follow-ups</div>
        </div>
        <div className="overview-card overview-card-danger">
          <div className="overview-card-label">To Pay</div>
          <div className="overview-card-value">{formatCurrency(toPay)}</div>
          <div className="overview-card-note">Today expenses and pending cash outflow</div>
        </div>
        <div className="overview-card overview-card-neutral">
          <div className="overview-card-label">Total Cash + Bank Balance</div>
          <div className="overview-card-value">{formatCurrency(totalBalance)}</div>
          <div className="overview-card-note">Cash {formatCurrency(cashBalance)} • Bank {formatCurrency(accountBalance)}</div>
        </div>
        <div className="overview-card overview-card-money">
          <div className="overview-card-label">Today Customer Transfer Profit</div>
          <div className="overview-card-value">{formatCurrency(todayMoneyTransferProfit)}</div>
          <div className="overview-card-note">{todayMoneyTransfers.length} transfer(s) recorded today</div>
        </div>
        <div className="overview-card overview-card-success">
          <div className="overview-card-label">Today Service Profit</div>
          <div className="overview-card-value">{formatCurrency(todayServiceProfit)}</div>
          <div className="overview-card-note">Profit from jobs delivered today</div>
        </div>
        <div className="overview-card overview-card-money" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', borderColor: '#4ade80' }}>
          <div className="overview-card-label">Estimated Overall Profit Today</div>
          <div className="overview-card-value" style={{ color: '#15803d' }}>{formatCurrency(estimatedProfit)}</div>
          <div className="overview-card-note">Sales + MT + Service - Expenses</div>
        </div>
      </div>

      <div className="dashboard-main-grid">
        <PageSection title="Latest Transactions" subtitle="Recent invoices and cash movements">
          {latestTransactions.length ? (
            <div className="dashboard-transaction-table">
              <div className="dashboard-transaction-head">
                <span>Date</span>
                <span>Type</span>
                <span>Txn No</span>
                <span>Party Name</span>
                <span>Amount</span>
              </div>
              {latestTransactions.map((entry) => (
                <div key={entry.id} className="dashboard-transaction-row">
                  <span>{formatDate(entry.date)}</span>
                  <span>{entry.type}</span>
                  <span>{entry.txnNo}</span>
                  <span>{entry.partyName}</span>
                  <span className={entry.amount < 0 ? "amount-negative" : "amount-positive"}>{formatCurrency(entry.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-illustration">🧾</div>
              <h3>No transactions made yet</h3>
              <p>Create your first invoice or cash entry to start seeing activity here.</p>
            </div>
          )}
        </PageSection>

        <PageSection title="Today's Checklist" subtitle="Smart daily reminders for the shop">
          <div className="dashboard-checklist">
            {checklist.map((item) => (
              <div key={item.id} className="checklist-card">
                <div className={`checklist-dot ${item.done ? "done" : "pending"}`} />
                <div className="checklist-body">
                  <div className="checklist-title-row">
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                  <p>{item.note}</p>
                </div>
              </div>
            ))}
            <div className="dashboard-coming-soon">
              <div className="dashboard-empty-illustration">📌</div>
              <h3>Coming Soon...</h3>
              <p>Smarter overdue follow-ups and staff action reminders will show here.</p>
            </div>
          </div>
        </PageSection>
      </div>

      <div className="dashboard-report-grid">
        <PageSection title={`${selectedChartLabel} Report`} subtitle="Last 7 days performance trend">
          <div className="sales-chart-card">
            <div className="sales-chart-header">
              <div>
                <div className="stat-label">Last 7 Days {selectedChartLabel}</div>
                <div className="sales-chart-total">{formatCurrency(selectedChartTotal)}</div>
              </div>
              <div className="chart-view-tabs" aria-label="Chart view">
                {chartViewOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`chart-view-tab ${chartView === option.value ? "active" : ""}`}
                    onClick={() => setChartView(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sales-chart">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="sales-line-chart" role="img" aria-label={`Last 7 days ${selectedChartLabel} line graph`}>
                <line x1={chartPadding} y1={chartHeight - chartPadding} x2={chartWidth - chartPadding} y2={chartHeight - chartPadding} className="sales-line-axis" />
                <line x1={chartPadding} y1={chartPadding} x2={chartPadding} y2={chartHeight - chartPadding} className="sales-line-axis" />
                <path d={areaPath} className="sales-line-area" />
                <path d={chartPath} className="sales-line-path" />
                {chartPoints.map((point) => (
                  <g key={point.id}>
                    <circle cx={point.x} cy={point.y} r="5.5" className="sales-line-dot" />
                    <text x={point.x} y={point.y - 12} textAnchor="middle" className="sales-line-value">
                      {point.value > 0 ? formatCurrency(point.value) : "-"}
                    </text>
                    <text x={point.x} y={chartHeight - 10} textAnchor="middle" className="sales-line-label">
                      {point.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="sales-line-dates">
              {chartTrend.map((entry) => (
                <div key={entry.id} className="sales-line-date-item">
                  <strong>{entry.label}</strong>
                  <span>{entry.dateLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </PageSection>

        <div className="dashboard-report-side">
          <div className="report-metric-card">
            <span>Invoices Made</span>
            <strong>{totalInvoices7Days}</strong>
          </div>
          <div className="report-metric-card">
            <span>Customer Transfer Profit Today</span>
            <strong>{formatCurrency(todayMoneyTransferProfit)}</strong>
          </div>
          <div className="report-metric-card">
            <span>Available Mobiles</span>
            <strong>{availableMobiles}</strong>
          </div>
          <div className="report-metric-card">
            <span>Accessories Count</span>
            <strong>{accessoriesCount}</strong>
          </div>
          <div className="report-metric-card">
            <span>Old Mobiles Ready</span>
            <strong>{oldMobilesAvailable}</strong>
          </div>
          <div className="report-metric-card">
            <span>Pending Service Jobs</span>
            <strong>{pendingJobs.length}</strong>
          </div>
          <div className="report-metric-card">
            <span>Service Profit Today</span>
            <strong>{formatCurrency(todayServiceProfit)}</strong>
          </div>
          <div className="report-metric-card">
            <span>Estimated Total Profit Today</span>
            <strong>{formatCurrency(estimatedProfit)}</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-footer-grid">
        <PageSection title="Staff Billing Summary" subtitle="Today billing performance">
          <div className="dashboard-mini-table">
            {Object.values(staffMap).length ? (
              Object.values(staffMap).map((row) => (
                <div key={row.id} className="dashboard-mini-row">
                  <div>
                    <strong>{row.name}</strong>
                    <p>{row.bills} bill(s) today</p>
                  </div>
                  <div className="dashboard-mini-values">
                    <span>{formatCurrency(row.sales)}</span>
                    <small>Cash {formatCurrency(row.cash)}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="dashboard-empty-inline">No staff billing activity yet today.</div>
            )}
          </div>
        </PageSection>

        <PageSection title="Service Summary" subtitle="Today jobs received">
          <div className="dashboard-mini-table">
            {Object.values(serviceStaffMap).length ? (
              Object.values(serviceStaffMap).map((row) => (
                <div key={row.id} className="dashboard-mini-row">
                  <div>
                    <strong>{row.name}</strong>
                    <p>{row.jobs} job(s) received today</p>
                  </div>
                  <div className="dashboard-mini-values">
                    <span>{formatCurrency(row.advance)}</span>
                    <small>Advance Collected</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="dashboard-empty-inline">No service jobs received today.</div>
            )}
          </div>
        </PageSection>

        <PageSection title="Low Stock Alert" subtitle="Immediate attention items">
          <div className="dashboard-mini-table">
            {lowStock.slice(0, 5).length ? (
              lowStock.slice(0, 5).map((item) => (
                <div key={item.id} className="dashboard-mini-row">
                  <div>
                    <strong>{item.itemName}</strong>
                    <p>{item.category}</p>
                  </div>
                  <div className="dashboard-mini-values">
                    <span>Qty {item.quantity}</span>
                    <small><StatusBadge value={item.status} /></small>
                  </div>
                </div>
              ))
            ) : (
              <div className="dashboard-empty-inline">All stock levels look healthy.</div>
            )}
          </div>
        </PageSection>
      </div>
    </div>
  );
}
