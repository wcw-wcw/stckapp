import { requireUser } from "@/lib/auth/require-user";
import { listNotificationChannels, listNotificationLogs } from "@/lib/db/repositories";
import { realNotificationsEnabled } from "@/lib/notifications/notification-service";
import { NotificationSettings } from "./notification-settings";

export default async function SettingsPage() {
  const user = await requireUser();
  const channels = listNotificationChannels(user.id);
  const logs = listNotificationLogs(user.id);
  const realDelivery = realNotificationsEnabled();
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Account settings</p>
          <h1>Stay deliberate.</h1>
          <p className="subhead">Manage local notification channels for alert delivery. Discord can send real test messages only when the local safety flag is enabled.</p>
        </div>
      </div>
      <section className="grid split-grid">
        <div className="card">
          <div className="card-header"><h2>Local account</h2><span className="pill">Active</span></div>
          <p className="small">Signed in as</p>
          <p>{user.email}</p>
          <div className="notice">Account data currently lives only in your local SQLite database.</div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Delivery guardrails</h2></div>
          <p className="small">Rules can only send notifications after at least one verified channel is enabled.</p>
          <p className="small">Each channel has its own daily cap, and delivery attempts are written to local logs for debugging.</p>
          <div className="notice">
            Real Discord delivery is {realDelivery ? "enabled" : "disabled"}. SMS and email still use mock delivery.
          </div>
        </div>
      </section>
      <NotificationSettings
        initialChannels={channels}
        initialLogs={logs}
        userEmail={user.email}
        realNotificationsEnabled={realDelivery}
      />
    </div>
  );
}
