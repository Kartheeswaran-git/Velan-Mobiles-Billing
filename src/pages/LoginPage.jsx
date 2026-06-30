import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { firstAllowedStaffPath } from "../utils/permissions";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user?.role) {
      navigate(user.role === "admin" ? "/admin" : firstAllowedStaffPath(user), { replace: true });
    }
  }, [loading, navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(form.email, form.password);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-hero">
          <h1>Velan Mobiles Shop Management</h1>
          <p>Billing, inventory, service, staff tracking, and daily ledger control in one fast Supabase app.</p>
          <div className="list-stack">
            <div>Admin access for full reporting and control</div>
            <div>Staff access for billing and service workflows</div>
            <div>Realtime Supabase updates for daily shop usage</div>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Login</h2>
          <p className="muted">Use your Supabase Authentication email and password.</p>
          {location.state?.from?.pathname ? <p className="muted">You’ll be returned to your previous page after login.</p> : null}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="admin@shop.com"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="••••••••"
            />
          </div>
          {error ? <p className="badge danger">{error}</p> : null}
          <div style={{ marginTop: 18 }}>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Login"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
