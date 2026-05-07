import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/Button";

const adminSections = [
  {
    title: "General",
    links: [
      { to: "/admin", label: "Dashboard" },
      { to: "/admin/parties", label: "Parties" },
      { to: "/admin/items", label: "Items" },
      { to: "/admin/sales", label: "Sales" },
      { to: "/admin/money-transfer", label: "Customer Transfers" },
      { to: "/admin/purchases", label: "Purchases" },
      { to: "/admin/reports", label: "Reports" },
      { to: "/admin/data-export", label: "Data Export" },
    ],
  },
  {
    title: "Accounting Solutions",
    links: [
      { to: "/admin/cash-bank", label: "Cash & Bank" },
      { to: "/admin/e-invoicing", label: "E-Invoicing" },
      { to: "/admin/automated-bills", label: "Automated Bills" },
      { to: "/admin/expenses", label: "Expenses" },
      { to: "/admin/pos-billing", label: "POS Billing" },
    ],
  },
  {
    title: "Business Tools",
    links: [
      { to: "/admin/attendance-payroll", label: "Staff Attendance & Payroll" },
      { to: "/admin/manage-users", label: "Manage Users" },
      { to: "/admin/online-orders", label: "Online Orders" },
      { to: "/admin/sms-marketing", label: "SMS Marketing" },
      { to: "/admin/service-jobs", label: "Service Jobs" },
      { to: "/admin/old-mobiles", label: "Old Mobiles" },
      { to: "/admin/settings", label: "Settings" },
    ],
  },
];

const staffLinks = [
  { to: "/staff", label: "Dashboard" },
  { to: "/staff/billing", label: "Billing" },
  { to: "/staff/bills", label: "My Bills" },
  { to: "/staff/service-jobs", label: "Service Jobs" },
  { to: "/staff/money-transfer", label: "Money Transfer" },
  { to: "/staff/cash-ledger", label: "Cash Entry" },
  { to: "/staff/inventory", label: "Inventory" },
  { to: "/staff/old-mobiles", label: "Sell Old Mobile" },
];

export default function AppLayout({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = role === "admin" ? adminSections.flatMap((section) => section.links) : staffLinks;
  const activeLink = links.find((link) => location.pathname === link.to);
  const activeTitle = activeLink?.label || (role === "admin" ? "Dashboard" : "Workspace");
  const greetingName = user?.name ? user.name.split(" ")[0] : "User";

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Velan Mobiles</div>
        <div className="brand-subtitle">Daily shop operations</div>
        <div className="sidebar-quick-action">
          <Button variant="secondary" onClick={() => navigate(role === "admin" ? "/admin/pos-billing" : "/staff/billing")}>
            Create Invoice
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/${role}/money-transfer`)}>
            Money Transfer
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/${role}/service-jobs`)}>
            New Service
          </Button>
        </div>
        {role === "admin" ? (
          adminSections.map((section) => (
            <div key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === `/${role}`} className="nav-link">
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))
        ) : (
          <>
            <div className="nav-section-title">{role} panel</div>
            {staffLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === `/${role}`} className="nav-link">
                {link.label}
              </NavLink>
            ))}
          </>
        )}
      </aside>

      <main className="content">
        <div className="mobile-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === `/${role}`}
              className={`nav-link ${location.pathname === link.to ? "active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="topbar">
          <div className="page-title">
            <h1>{activeTitle}</h1>
            <p>Welcome back, {greetingName} • {role === "admin" ? "Admin workspace" : "Staff workspace"}</p>
          </div>
          <div className="topbar-actions">
            <div className="dashboard-range-pill">{user?.role || role}</div>
            <Button variant="secondary" onClick={() => navigate(role === "admin" ? "/admin/billing" : "/staff/billing")}>
              Quick Billing
            </Button>
            <Button onClick={handleLogout}>Logout</Button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
