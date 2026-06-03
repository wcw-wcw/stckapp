"use client";

import { useState } from "react";
import type {
  NotificationChannel,
  NotificationLog,
  UserNotificationPreferences,
} from "@/lib/db/repositories";

const typeLabels: Record<NotificationChannel["type"], string> = {
  sms: "SMS",
  email: "Email",
  discord_webhook: "Discord webhook",
};

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function displayDestination(channel: Pick<NotificationChannel, "type" | "destination">) {
  if (channel.type !== "discord_webhook") return channel.destination;
  try {
    const url = new URL(channel.destination);
    const parts = url.pathname.split("/").filter(Boolean);
    const webhookId = parts[2];
    return webhookId ? `${url.hostname}/api/webhooks/${webhookId}/...` : "Discord webhook";
  } catch {
    return "Discord webhook";
  }
}

export function NotificationSettings({
  initialChannels,
  initialLogs,
  initialPreferences,
  userEmail,
  realNotificationsEnabled,
}: {
  initialChannels: NotificationChannel[];
  initialLogs: NotificationLog[];
  initialPreferences: UserNotificationPreferences;
  userEmail: string;
  realNotificationsEnabled: boolean;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [mockCode, setMockCode] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  async function requestJson(path: string, init: RequestInit) {
    setError(undefined);
    setMessage(undefined);
    const response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Something went wrong.");
    }
    return payload;
  }

  async function startPhone() {
    setBusy("phone-start");
    try {
      const payload = await requestJson("/api/notifications/phone/start", {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      });
      setMockCode(payload.mockCode);
      setMessage("Mock code generated locally. No SMS was sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start verification.");
    } finally {
      setBusy(undefined);
    }
  }

  async function verifyPhone() {
    setBusy("phone-verify");
    try {
      const payload = await requestJson("/api/notifications/phone/verify", {
        method: "POST",
        body: JSON.stringify({ phoneNumber, code: phoneCode }),
      });
      setChannels((current) => [payload.channel, ...current.filter((item) => item.id !== payload.channel.id)]);
      setMockCode("");
      setPhoneCode("");
      setMessage("SMS channel verified for mock alerts.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify that code.");
    } finally {
      setBusy(undefined);
    }
  }

  async function addChannel(type: "email" | "discord_webhook") {
    setBusy(type);
    try {
      const payload = await requestJson("/api/notifications/channels", {
        method: "POST",
        body: JSON.stringify({
          type,
          destination: type === "email" ? email : discordWebhook,
          label: type === "email" ? "Email alerts" : "Discord alerts",
          dailyLimit: type === "email" ? 25 : 25,
        }),
      });
      setChannels((current) => [payload.channel, ...current.filter((item) => item.id !== payload.channel.id)]);
      if (type === "discord_webhook") setDiscordWebhook("");
      setMessage(`${typeLabels[type]} channel saved in mock mode.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that channel.");
    } finally {
      setBusy(undefined);
    }
  }

  async function toggleChannel(channel: NotificationChannel) {
    setBusy(channel.id);
    try {
      const payload = await requestJson(`/api/notifications/channels/${channel.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: !channel.isEnabled }),
      });
      setChannels((current) => current.map((item) => (item.id === channel.id ? payload.channel : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that channel.");
    } finally {
      setBusy(undefined);
    }
  }

  async function deleteChannel(channel: NotificationChannel) {
    setBusy(channel.id);
    try {
      await requestJson(`/api/notifications/channels/${channel.id}`, { method: "DELETE" });
      setChannels((current) => current.filter((item) => item.id !== channel.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete that channel.");
    } finally {
      setBusy(undefined);
    }
  }

  async function testChannel(channel: NotificationChannel) {
    setBusy(`test-${channel.id}`);
    try {
      const payload = await requestJson(`/api/notifications/channels/${channel.id}/test`, {
        method: "POST",
      });
      setMessage(
        payload.realNotificationsEnabled
          ? `${typeLabels[channel.type]} test sent.`
          : `${typeLabels[channel.type]} test logged in mock mode.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not test that channel.");
    } finally {
      setBusy(undefined);
    }
  }

  async function toggleAccountPause() {
    setBusy("account-pause");
    try {
      const payload = await requestJson("/api/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({ notificationsPaused: !preferences.notificationsPaused }),
      });
      setPreferences(payload.preferences);
      setMessage(
        payload.preferences.notificationsPaused
          ? "Automatic alert notifications are paused. Manual channel tests still run."
          : "Automatic alert notifications are resumed.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update notification pause.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="grid profile-grid">
      <section className="card profile-wide">
        <div className="card-header">
          <h2>Account notification pause</h2>
          <span className={preferences.notificationsPaused ? "pill pill-warning" : "pill"}>
            {preferences.notificationsPaused ? "paused" : "active"}
          </span>
        </div>
        <p className="small">
          This pauses automatic rule-triggered alert delivery across every channel. Alert events are still recorded, channel-level pause settings stay unchanged, and manual Test actions remain available.
        </p>
        <div className="action-row">
          <button
            className={preferences.notificationsPaused ? "button" : "button button-secondary"}
            disabled={busy === "account-pause"}
            onClick={toggleAccountPause}
          >
            {preferences.notificationsPaused ? "Resume all alert notifications" : "Pause all alert notifications"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Notification channels</h2>
          <span className="pill">{channels.filter((channel) => channel.isEnabled).length} enabled</span>
        </div>
        <div className="channel-list">
          {channels.length === 0 && (
            <p className="empty-state">Add at least one channel before enabling notifications on a rule.</p>
          )}
          {channels.map((channel) => (
            <div className="channel-row" key={channel.id}>
              <div>
                <div className="rule-title">
                  <strong>{channel.label ?? typeLabels[channel.type]}</strong>
                  <span className={channel.isVerified ? "pill" : "pill pill-muted"}>
                    {channel.isVerified ? "verified" : "unverified"}
                  </span>
                  <span className={channel.isEnabled ? "pill" : "pill pill-muted"}>
                    {channel.isEnabled ? "enabled" : "paused"}
                  </span>
                </div>
                <p className="small">
                  {typeLabels[channel.type]} · {displayDestination(channel)} · {channel.sentToday}/{channel.dailyLimit} today
                </p>
              </div>
              <div className="rule-actions">
                <button className="mini-button" disabled={busy === `test-${channel.id}`} onClick={() => testChannel(channel)}>
                  Test
                </button>
                <button className="mini-button" disabled={busy === channel.id} onClick={() => toggleChannel(channel)}>
                  {channel.isEnabled ? "Pause" : "Enable"}
                </button>
                <button className="mini-button mini-button-danger" disabled={busy === channel.id} onClick={() => deleteChannel(channel)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2>Add channels</h2></div>
        <div className="stacked-fields">
          <div className="field">
            <label htmlFor="phone">SMS phone number</label>
            <input id="phone" placeholder="+13125550123" type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          </div>
          <div className="action-row">
            <button className="button" disabled={busy === "phone-start"} onClick={startPhone}>Generate local code</button>
          </div>
          {mockCode && (
            <div className="notice">
              Local mock code: <strong>{mockCode}</strong>. This is shown only because real SMS delivery is off.
            </div>
          )}
          <div className="field">
            <label htmlFor="phone-code">6-digit SMS code</label>
            <input id="phone-code" inputMode="numeric" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} />
          </div>
          <button className="button button-secondary" disabled={busy === "phone-verify"} onClick={verifyPhone}>Verify SMS</button>

          <div className="field">
            <label htmlFor="email">Email destination</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button className="button button-secondary" disabled={busy === "email"} onClick={() => addChannel("email")}>Add email</button>

          <div className="field">
            <label htmlFor="discord">Discord webhook URL</label>
            <input id="discord" placeholder="https://discord.com/api/webhooks/..." value={discordWebhook} onChange={(event) => setDiscordWebhook(event.target.value)} />
          </div>
          <button className="button button-secondary" disabled={busy === "discord_webhook"} onClick={() => addChannel("discord_webhook")}>Add Discord webhook</button>
        </div>
        <div className="notice" style={{ marginTop: "1rem" }}>
          Discord real delivery is {realNotificationsEnabled ? "enabled" : "disabled"}. Email and SMS messages are logged locally.
        </div>
        {message && <p className="success-notice">{message}</p>}
        {error && <p className="notice" style={{ marginTop: "0.8rem" }}>{error}</p>}
      </section>

      <section className="card profile-wide">
        <div className="card-header"><h2>Recent mock delivery logs</h2></div>
        <table>
          <thead>
            <tr><th>Time</th><th>Channel</th><th>Provider</th><th>Status</th><th>Destination</th></tr>
          </thead>
          <tbody>
            {initialLogs.length === 0 && (
              <tr><td className="empty-state" colSpan={5}>No notification logs yet.</td></tr>
            )}
            {initialLogs.map((log) => (
              <tr key={log.id}>
                <td>{timeLabel(log.createdAt)}</td>
                <td>{typeLabels[log.channelType]}</td>
                <td>{log.provider}</td>
                <td>{log.status}</td>
                <td>{log.channelType === "discord_webhook" ? "Discord webhook" : log.destination}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
