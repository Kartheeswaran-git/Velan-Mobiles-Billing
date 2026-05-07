import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Loader from "../components/Loader";
import DataTable from "../components/DataTable";
import PageSection from "../components/PageSection";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatCurrency, formatDate } from "../utils/format";
import { printBill } from "../utils/printBill";

export default function BillsHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const settings = useFirestoreCollection("app_settings", { orderBy: { field: "createdAt", direction: "desc" } });
  const currentSettings = settings.data[0] || {};
  const options =
    user.role === "admin"
      ? { orderBy: { field: "createdAt", direction: "desc" } }
      : {
          where: [{ field: "createdBy", operator: "==", value: user.uid }],
          orderBy: { field: "createdAt", direction: "desc" },
        };
  const bills = useFirestoreCollection("bills", options);

  if (bills.loading) {
    return <Loader text="Loading bills..." />;
  }

  return (
    <div className="list-stack">
      <PageSection title={user.role === "admin" ? "Bills History" : "My Bills"} subtitle="Saved billing records">
        <DataTable
          rows={bills.data}
          columns={[
            { key: "billNo", label: "Bill No" },
            { key: "customerName", label: "Customer" },
            { key: "paymentType", label: "Payment Type" },
            { key: "total", label: "Total", render: (row) => formatCurrency(row.total) },
            { key: "createdByName", label: "Created By" },
            { key: "createdAt", label: "Created At", render: (row) => formatDate(row.createdAt) },
            ...(user.role === "admin"
              ? [{
                  key: "actions",
                  label: "Action",
                  render: (row) => (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => navigate(`/admin/pos-billing?editBill=${row.id}`)}
                      >
                        Edit Invoice
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => printBill(row, currentSettings)}
                      >
                        Print
                      </Button>
                    </div>
                  ),
                }]
              : []),
          ]}
        />
      </PageSection>
    </div>
  );
}
