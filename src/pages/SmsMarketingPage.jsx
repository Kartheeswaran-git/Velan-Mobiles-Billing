import { useState } from "react";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import Loader from "../components/Loader";
import PageSection from "../components/PageSection";
import { addRecord, updateRecord } from "../supabase/database";
import { useAuth } from "../hooks/useAuth";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { formatDate } from "../utils/format";

const blankCampaign = {
  title: "",
  audience: "all_customers",
  message: "",
  status: "draft",
};

export default function SmsMarketingPage() {
  const { user } = useAuth();
  const campaigns = useFirestoreCollection("sms_campaigns", { orderBy: { field: "createdAt", direction: "desc" } });
  const [form, setForm] = useState(blankCampaign);

  async function handleSubmit(event) {
    event.preventDefault();
    await addRecord("sms_campaigns", { ...form, createdBy: user.uid, createdByName: user.name, sentCount: 0 });
    setForm(blankCampaign);
  }

  if (campaigns.loading) return <Loader text="Loading SMS campaigns..." />;

  return (
    <div className="list-stack">
      <PageSection title="SMS Marketing" subtitle="Draft and mark promotional or reminder campaigns as sent">
        <form className="list-stack" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field"><label>Title</label><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Festival offer, service reminder..." required /></div>
            <div className="field"><label>Audience</label><select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}><option value="all_customers">all_customers</option><option value="recent_buyers">recent_buyers</option><option value="service_customers">service_customers</option></select></div>
            <div className="field"><label>Status</label><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">draft</option><option value="ready">ready</option></select></div>
          </div>
          <div className="field"><label>Message</label><textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Type the SMS or WhatsApp campaign message" required /></div>
          <Button type="submit">Save Campaign</Button>
        </form>
      </PageSection>
      <PageSection title="Campaign History" subtitle="Track saved and sent campaigns">
        <DataTable
          rows={campaigns.data}
          columns={[
            { key: "title", label: "Title" },
            { key: "audience", label: "Audience" },
            { key: "status", label: "Status" },
            { key: "createdByName", label: "Created By" },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
            { key: "send", label: "Action", render: (row) => <Button type="button" variant="secondary" onClick={() => updateRecord("sms_campaigns", row.id, { status: "sent", sentCount: (row.sentCount || 0) + 1 })}>Mark Sent</Button> },
          ]}
        />
      </PageSection>
    </div>
  );
}
