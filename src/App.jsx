import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import StaffDashboardPage from "./pages/StaffDashboardPage";
import BillingPage from "./pages/BillingPage";
import BillsHistoryPage from "./pages/BillsHistoryPage";
import InventoryPage from "./pages/InventoryPage";
import InventoryTransactionsPage from "./pages/InventoryTransactionsPage";
import ServiceJobsPage from "./pages/ServiceJobsPage";
import CashLedgerPage from "./pages/CashLedgerPage";
import AccountLedgerPage from "./pages/AccountLedgerPage";
import OldMobilesPage from "./pages/OldMobilesPage";
import StaffManagementPage from "./pages/StaffManagementPage";
import ReportsPage from "./pages/ReportsPage";
import PartiesPage from "./pages/PartiesPage";
import PurchasesPage from "./pages/PurchasesPage";
import CashBankPage from "./pages/CashBankPage";
import EInvoicingPage from "./pages/EInvoicingPage";
import AutomatedBillsPage from "./pages/AutomatedBillsPage";
import ExpensesPage from "./pages/ExpensesPage";
import AttendancePayrollPage from "./pages/AttendancePayrollPage";
import OnlineOrdersPage from "./pages/OnlineOrdersPage";
import SmsMarketingPage from "./pages/SmsMarketingPage";
import SettingsPage from "./pages/SettingsPage";
import MoneyTransferPage from "./pages/MoneyTransferPage";
import DataExportPage from "./pages/DataExportPage";
import ProtectedRoute from "./routes/ProtectedRoute";

function HomeRedirect() {
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="parties" element={<PartiesPage />} />
        <Route path="items" element={<InventoryPage />} />
        <Route path="sales" element={<BillsHistoryPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="cash-bank" element={<CashBankPage />} />
        <Route path="money-transfer" element={<MoneyTransferPage />} />
        <Route path="e-invoicing" element={<EInvoicingPage />} />
        <Route path="automated-bills" element={<AutomatedBillsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="pos-billing" element={<BillingPage />} />
        <Route path="attendance-payroll" element={<AttendancePayrollPage />} />
        <Route path="manage-users" element={<StaffManagementPage />} />
        <Route path="online-orders" element={<OnlineOrdersPage />} />
        <Route path="sms-marketing" element={<SmsMarketingPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="bills" element={<BillsHistoryPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory-transactions" element={<InventoryTransactionsPage />} />
        <Route path="service-jobs" element={<ServiceJobsPage />} />
        <Route path="cash-ledger" element={<CashLedgerPage />} />
        <Route path="account-ledger" element={<AccountLedgerPage />} />
        <Route path="old-mobiles" element={<OldMobilesPage />} />
        <Route path="staff" element={<StaffManagementPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="data-export" element={<DataExportPage />} />
      </Route>

      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={["staff", "admin"]}>
            <AppLayout role="staff" />
          </ProtectedRoute>
        }
      >
        <Route index element={<StaffDashboardPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="bills" element={<BillsHistoryPage />} />
        <Route path="service-jobs" element={<ServiceJobsPage />} />
        <Route path="money-transfer" element={<MoneyTransferPage />} />
        <Route path="cash-ledger" element={<CashLedgerPage />} />
        <Route path="inventory" element={<InventoryPage readOnly />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
