import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency } from "../utils/format";

export default function ReportsPage() {
  const bills = useFirestoreCollection("bills", { orderBy: { field: "createdAt", direction: "desc" } });
  const cash = useFirestoreCollection("cash_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const account = useFirestoreCollection("account_ledger", { orderBy: { field: "createdAt", direction: "desc" } });
  const inventory = useFirestoreCollection("inventory", { orderBy: { field: "createdAt", direction: "desc" } });
  const oldSales = useFirestoreCollection("old_mobile_transactions", { orderBy: { field: "createdAt", direction: "desc" } });

  if (bills.loading || cash.loading || account.loading || inventory.loading || oldSales.loading) {
    return <Loader text="Loading reports..." />;
  }

  const totalSales = bills.data.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
  const totalCashIncome = cash.data.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalCashExpense = cash.data.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalAccountIncome = account.data.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalAccountExpense = account.data.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const stockValue = inventory.data.reduce((sum, item) => sum + Number(item.buyingPrice || 0) * Number(item.quantity || 0), 0);
  const estimatedProfit = totalSales + totalCashIncome + totalAccountIncome - totalCashExpense - totalAccountExpense;
  const staffSales = {};
  bills.data.forEach((bill) => {
    const key = bill.createdByName || bill.createdBy || "Unknown";
    staffSales[key] = staffSales[key] || { id: key, name: key, total: 0, count: 0 };
    staffSales[key].total += Number(bill.total || 0);
    staffSales[key].count += 1;
  });

  return (
    <div className="list-stack">
      <div className="card-grid">
        <StatCard label="Total Sales" value={formatCurrency(totalSales)} hint="All saved bills" />
        <StatCard label="Stock Value" value={formatCurrency(stockValue)} hint="Based on buying price" />
        <StatCard label="Cash Net" value={formatCurrency(totalCashIncome - totalCashExpense)} hint="Income minus expense" />
        <StatCard label="Estimated Profit" value={formatCurrency(estimatedProfit)} hint="High-level business snapshot" />
      </div>

      <PageSection title="Staff Activity" subtitle="Sales contribution by staff">
        <DataTable
          rows={Object.values(staffSales)}
          columns={[
            { key: "name", label: "Staff" },
            { key: "count", label: "Bills Count" },
            { key: "total", label: "Sales Total", render: (row) => formatCurrency(row.total) },
          ]}
        />
      </PageSection>

      <PageSection title="Old Mobile Profit" subtitle="Used mobile business performance">
        <DataTable
          rows={oldSales.data.filter((row) => row.stage === "sold")}
          columns={[
            { key: "mobileId", label: "Mobile ID" },
            { key: "customerName", label: "Customer" },
            { key: "buyPrice", label: "Buy", render: (row) => formatCurrency(row.buyPrice) },
            { key: "sellPrice", label: "Sell", render: (row) => formatCurrency(row.sellPrice) },
            { key: "profit", label: "Profit", render: (row) => formatCurrency(row.profit) },
          ]}
        />
      </PageSection>
    </div>
  );
}
