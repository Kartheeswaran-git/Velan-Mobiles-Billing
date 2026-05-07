import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import StatusBadge from "../components/StatusBadge";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatDate } from "../utils/format";

export default function InventoryTransactionsPage() {
  const transactions = useFirestoreCollection("inventory_transactions", { orderBy: { field: "createdAt", direction: "desc" } });

  if (transactions.loading) {
    return <Loader text="Loading inventory transactions..." />;
  }

  return (
    <PageSection title="Inventory Transactions" subtitle="Stock entry, sales, damages, and returns">
      <DataTable
        rows={transactions.data}
        columns={[
          { key: "itemId", label: "Item ID" },
          { key: "action", label: "Action", render: (row) => <StatusBadge value={row.action} /> },
          { key: "quantity", label: "Qty" },
          { key: "note", label: "Note" },
          { key: "staffId", label: "Staff" },
          { key: "createdAt", label: "Time", render: (row) => formatDate(row.createdAt) },
        ]}
      />
    </PageSection>
  );
}
