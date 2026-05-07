import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { addRecord, updateRecord } from "../supabase/database";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";

const defaultSettings = {
  shopName: "",
  shopPhone: "",
  address: "",
  gstin: "",
  invoicePrefix: "BILL",
  paperSize: "A4",
  footerNote: "Thank you for shopping with us.",
};

export default function SettingsPage() {
  const settings = useFirestoreCollection("app_settings", { orderBy: { field: "createdAt", direction: "desc" } });
  const current = useMemo(() => settings.data[0] || null, [settings.data]);
  const [form, setForm] = useState(defaultSettings);

  useEffect(() => {
    if (current) {
      setForm({
        shopName: current.shopName || "",
        shopPhone: current.shopPhone || "",
        address: current.address || "",
        gstin: current.gstin || "",
        invoicePrefix: current.invoicePrefix || "BILL",
        paperSize: current.paperSize || "A4",
        footerNote: current.footerNote || "Thank you for shopping with us.",
      });
    }
  }, [current]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (current?.id) {
      await updateRecord("app_settings", current.id, form);
    } else {
      await addRecord("app_settings", form);
    }
  }

  if (settings.loading) return <Loader text="Loading settings..." />;

  return (
    <PageSection title="Settings" subtitle="Configure shop details used across billing and reports">
      <form className="list-stack" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field"><label>Shop Name</label><input value={form.shopName} onChange={(event) => setForm((currentForm) => ({ ...currentForm, shopName: event.target.value }))} placeholder="Velan Mobiles" /></div>
          <div className="field"><label>Shop Phone</label><input value={form.shopPhone} onChange={(event) => setForm((currentForm) => ({ ...currentForm, shopPhone: event.target.value }))} placeholder="Shop contact number" /></div>
          <div className="field"><label>GSTIN</label><input value={form.gstin} onChange={(event) => setForm((currentForm) => ({ ...currentForm, gstin: event.target.value }))} placeholder="GSTIN optional" /></div>
          <div className="field"><label>Invoice Prefix</label><input value={form.invoicePrefix} onChange={(event) => setForm((currentForm) => ({ ...currentForm, invoicePrefix: event.target.value }))} placeholder="BILL" /></div>
          <div className="field">
            <label>Print Paper Size</label>
            <select value={form.paperSize} onChange={(event) => setForm((currentForm) => ({ ...currentForm, paperSize: event.target.value }))}>
              <option value="A4">A4</option>
              <option value="A5">A5</option>
            </select>
          </div>
        </div>
        <div className="field"><label>Address</label><textarea value={form.address} onChange={(event) => setForm((currentForm) => ({ ...currentForm, address: event.target.value }))} placeholder="Shop address printed on invoices" /></div>
        <div className="field"><label>Invoice Footer Note</label><textarea value={form.footerNote} onChange={(event) => setForm((currentForm) => ({ ...currentForm, footerNote: event.target.value }))} placeholder="Thank you for shopping with us." /></div>
        <Button type="submit">Save Settings</Button>
      </form>
    </PageSection>
  );
}
