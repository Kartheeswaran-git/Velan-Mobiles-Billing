export const CRUD_OPERATIONS = ["create", "read", "update", "delete"];

export const PERMISSION_MODULES = [
  { key: "today", label: "Today", path: "/staff", operations: ["read", "update"] },
  { key: "parties", label: "Parties", path: "/staff/parties" },
  { key: "inventory", label: "Items & Inventory", path: "/staff/inventory" },
  { key: "sales", label: "Sales History", path: "/staff/bills", operations: ["read", "update", "delete"] },
  { key: "purchases", label: "Purchases", path: "/staff/purchases" },
  { key: "cash_bank", label: "Cash & Bank", path: "/staff/cash-bank" },
  { key: "money_transfer", label: "Money Transfer", path: "/staff/money-transfer" },
  { key: "e_invoicing", label: "E-Invoicing", path: "/staff/e-invoicing", operations: ["read"] },
  { key: "automated_bills", label: "Automated Bills", path: "/staff/automated-bills" },
  { key: "expenses", label: "Expenses", path: "/staff/expenses", operations: ["create", "read"] },
  { key: "billing", label: "POS Billing", path: "/staff/billing", operations: ["create", "read", "update"] },
  { key: "attendance", label: "Attendance & Payroll", path: "/staff/attendance-payroll" },
  { key: "online_orders", label: "Online Orders", path: "/staff/online-orders" },
  { key: "sms_marketing", label: "SMS Marketing", path: "/staff/sms-marketing" },
  { key: "service_jobs", label: "Service Jobs", path: "/staff/service-jobs" },
  { key: "old_mobiles", label: "Old Mobiles", path: "/staff/old-mobiles" },
  { key: "reports", label: "Reports", path: "/staff/reports", operations: ["read"] },
  { key: "data_export", label: "Data Export", path: "/staff/data-export", operations: ["read"] },
  { key: "settings", label: "Settings", path: "/staff/settings" },
];

export const DEFAULT_STAFF_PERMISSIONS = {
  today: { read: true, update: true },
  inventory: { read: true },
  sales: { read: true },
  billing: { create: true, read: true },
  money_transfer: { create: true, read: true },
  service_jobs: { create: true, read: true, update: true },
  old_mobiles: { create: true, read: true, update: true },
};

export function normalizePermissions(permissions = {}) {
  return PERMISSION_MODULES.reduce((result, module) => {
    result[module.key] = CRUD_OPERATIONS.reduce((operations, operation) => {
      operations[operation] = Boolean(permissions?.[module.key]?.[operation]);
      return operations;
    }, {});
    return result;
  }, {});
}

export function hasPermission(user, module, operation = "read") {
  if (user?.role === "admin") return true;
  return user?.active !== false && Boolean(user?.permissions?.[module]?.[operation]);
}

export function firstAllowedStaffPath(user) {
  return PERMISSION_MODULES.find((module) => hasPermission(user, module.key, "read"))?.path || "/login";
}
