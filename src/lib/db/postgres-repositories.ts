import { createHash, randomInt, randomUUID } from "node:crypto";
import { getPostgresPool, query } from "./postgres";
import type {
  AlertEvent,
  CachedBacktestResult,
  CleanupRetention,
  CleanupResult,
  NotificationChannel,
  NotificationChannelType,
  NotificationLog,
  PendingAlertEvent,
  ProviderErrorLog,
  ReplayDataset,
  ReplayDatasetSummary,
  SavedSymbolLevel,
  SavedRule,
  SessionUser,
  UserNotificationPreferences,
  UserRecord,
  WorkerRule,
  WorkerStatus,
} from "./sqlite-repositories";
import type { AlertRule, BacktestResult, Candle, SupportedSymbol, SymbolLevelType } from "@/lib/rules/types";
import type { IndicatorState } from "@/lib/rules/types";
import {
  assertSupportedLevelSymbol,
  assertValidLevelPrice,
  assertValidLevelType,
  isLevelExpired,
  type SymbolLevelInput,
} from "@/lib/symbol-levels";

type RuleRow = {
  id: string;
  user_id: string;
  name: string;
  symbol: SupportedSymbol;
  timeframe: "1m";
  logic: "AND";
  conditions_json: unknown;
  time_filter_json: unknown | null;
  cooldown_minutes: number;
  sms_enabled: boolean;
  is_active: boolean;
  market_hours_only: boolean;
  created_at: Date | string;
  last_triggered_at: Date | string | null;
};

type NotificationChannelRow = {
  id: string;
  type: NotificationChannelType;
  destination: string;
  label: string | null;
  is_verified: boolean;
  is_enabled: boolean;
  daily_limit: number;
  sent_today: number;
  count_date: Date | string;
  created_at: Date | string;
};

type AlertEventRow = {
  id: string;
  rule_id: string;
  rule_name: string;
  symbol: SupportedSymbol;
  triggered_at: Date | string;
  trigger_price: number | string;
  condition_summary: string;
  sms_status: string;
  performance_json: unknown | null;
};

type ReplayDatasetSummaryRow = {
  id: string;
  name: string;
  symbol: SupportedSymbol;
  source: string;
  candle_count: number;
  starts_at: Date | string;
  ends_at: Date | string;
  created_at: Date | string;
};

type SymbolLevelRow = {
  id: string;
  user_id: string;
  symbol: SupportedSymbol;
  name: string;
  price: number | string;
  level_type: SymbolLevelType;
  notes: string | null;
  expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
const jsonValue = <T>(value: unknown): T => (typeof value === "string" ? JSON.parse(value) : value) as T;
const toIso = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString() : (value ?? null);
const toDateLabel = (value: Date | string) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const countRows = (rows: unknown[]) => rows.length;

function mapRule(row: RuleRow): SavedRule {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    timeframe: row.timeframe,
    logic: row.logic,
    conditions: jsonValue(row.conditions_json),
    timeFilter: row.time_filter_json ? jsonValue(row.time_filter_json) : undefined,
    cooldownMinutes: Number(row.cooldown_minutes),
    smsEnabled: Boolean(row.sms_enabled),
    isActive: Boolean(row.is_active),
    marketHoursOnly: Boolean(row.market_hours_only),
    createdAt: toIso(row.created_at)!,
  };
}

function mapWorkerRule(row: RuleRow): WorkerRule {
  return {
    ...mapRule(row),
    userId: row.user_id,
    lastTriggeredAt: toIso(row.last_triggered_at),
  };
}

function mapNotificationChannel(row: NotificationChannelRow): NotificationChannel {
  return {
    id: row.id,
    type: row.type,
    destination: row.destination,
    label: row.label ?? undefined,
    isVerified: Boolean(row.is_verified),
    isEnabled: Boolean(row.is_enabled),
    dailyLimit: Number(row.daily_limit),
    sentToday: Number(row.sent_today),
    countDate: toDateLabel(row.count_date),
    createdAt: toIso(row.created_at)!,
  };
}

function mapAlertEvent(row: AlertEventRow): AlertEvent {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    symbol: row.symbol,
    triggeredAt: toIso(row.triggered_at)!,
    triggerPrice: Number(row.trigger_price),
    conditionSummary: row.condition_summary,
    smsStatus: row.sms_status,
    performance: row.performance_json ? jsonValue(row.performance_json) : undefined,
  };
}

function mapSymbolLevel(row: SymbolLevelRow): SavedSymbolLevel {
  const expiresAt = toIso(row.expires_at);
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    price: Number(row.price),
    levelType: row.level_type,
    notes: row.notes ?? undefined,
    expiresAt,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
    isExpired: isLevelExpired(expiresAt),
  };
}

function validateSymbolLevelInput(input: SymbolLevelInput | Partial<SymbolLevelInput>) {
  if (input.symbol) assertSupportedLevelSymbol(input.symbol);
  if (input.price !== undefined) assertValidLevelPrice(input.price);
  if (input.levelType) assertValidLevelType(input.levelType);
}

export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  const result = await query<UserRecord>(
    "SELECT id, email, password_hash, role FROM users WHERE email = $1",
    [email],
  );
  return result.rows[0];
}

export async function createUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  now: string;
}) {
  await query(
    "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)",
    [input.id, input.email, input.passwordHash, input.now],
  );
}

export async function createSessionRecord(input: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}) {
  await query(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)",
    [input.id, input.userId, input.tokenHash, input.expiresAt, input.createdAt],
  );
}

export async function deleteSessionByTokenHash(tokenHashValue: string) {
  await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHashValue]);
}

export async function getSessionUserByTokenHash(tokenHashValue: string, now: string) {
  const result = await query<SessionUser>(
    `SELECT users.id, users.email, users.role
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > $2`,
    [tokenHashValue, now],
  );
  return result.rows[0] ?? null;
}

export async function runCleanup(now: Date, retention: CleanupRetention): Promise<CleanupResult> {
  const client = await getPostgresPool().connect();
  const timestamp = now.toISOString();
  const hoursBefore = new Date(now.getTime() - retention.phoneVerificationHours * 60 * 60_000).toISOString();
  const providerCutoff = new Date(now.getTime() - retention.providerErrorLogDays * 24 * 60 * 60_000).toISOString();
  const notificationCutoff = new Date(now.getTime() - retention.notificationLogDays * 24 * 60 * 60_000).toISOString();
  const backtestCutoff = new Date(now.getTime() - retention.backtestResultDays * 24 * 60 * 60_000).toISOString();
  try {
    await client.query("BEGIN");
    const expiredSessions = await client.query("DELETE FROM sessions WHERE expires_at <= $1 RETURNING 1", [timestamp]);
    const phoneVerifications = await client.query(
      "DELETE FROM phone_verifications WHERE expires_at <= $1 OR created_at <= $2 RETURNING 1",
      [timestamp, hoursBefore],
    );
    const providerErrorLogs = await client.query(
      "DELETE FROM provider_error_logs WHERE created_at <= $1 RETURNING 1",
      [providerCutoff],
    );
    const notificationLogs = await client.query(
      "DELETE FROM notification_logs WHERE created_at <= $1 RETURNING 1",
      [notificationCutoff],
    );
    const cachedBacktestResults = await client.query(
      "DELETE FROM backtest_results WHERE created_at <= $1 RETURNING 1",
      [backtestCutoff],
    );
    const suggestedRuleCandidates = await client.query(
      "DELETE FROM suggested_rule_candidates WHERE expires_at IS NOT NULL AND expires_at <= $1 RETURNING 1",
      [timestamp],
    );
    await client.query("COMMIT");
    return {
      expiredSessions: countRows(expiredSessions.rows),
      phoneVerifications: countRows(phoneVerifications.rows),
      providerErrorLogs: countRows(providerErrorLogs.rows),
      notificationLogs: countRows(notificationLogs.rows),
      cachedBacktestResults: countRows(cachedBacktestResults.rows),
      suggestedRuleCandidates: countRows(suggestedRuleCandidates.rows),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listRules(userId: string) {
  const result = await query<RuleRow>(
    "SELECT * FROM alert_rules WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows.map(mapRule);
}

export async function getRule(userId: string, ruleId: string) {
  const result = await query<RuleRow>(
    "SELECT * FROM alert_rules WHERE id = $1 AND user_id = $2",
    [ruleId, userId],
  );
  return result.rows[0] ? mapRule(result.rows[0]) : null;
}

export async function listActiveWorkerRules() {
  const result = await query<RuleRow>(
    "SELECT * FROM alert_rules WHERE is_active = true ORDER BY symbol, created_at",
  );
  return result.rows.map(mapWorkerRule);
}

export async function listActiveWorkerRulesForUser(userId: string) {
  const result = await query<RuleRow>(
    "SELECT * FROM alert_rules WHERE user_id = $1 AND is_active = true ORDER BY symbol, created_at",
    [userId],
  );
  return result.rows.map(mapWorkerRule);
}

export async function createRule(userId: string, rule: AlertRule) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO alert_rules (
      id, user_id, name, symbol, timeframe, logic, conditions_json,
      time_filter_json, cooldown_minutes, sms_enabled, is_active,
      market_hours_only, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $13)`,
    [
      id,
      userId,
      rule.name,
      rule.symbol,
      rule.timeframe,
      rule.logic,
      JSON.stringify(rule.conditions),
      rule.timeFilter ? JSON.stringify(rule.timeFilter) : null,
      rule.cooldownMinutes,
      rule.smsEnabled,
      rule.isActive,
      rule.marketHoursOnly,
      now,
    ],
  );
  return { ...rule, id, createdAt: now };
}

export async function setRuleActive(userId: string, ruleId: string, isActive: boolean) {
  const result = await query(
    "UPDATE alert_rules SET is_active = $1, updated_at = $2 WHERE id = $3 AND user_id = $4",
    [isActive, new Date().toISOString(), ruleId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteRule(userId: string, ruleId: string) {
  const result = await query("DELETE FROM alert_rules WHERE id = $1 AND user_id = $2", [ruleId, userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function createAlertEvent(rule: WorkerRule, state: IndicatorState, conditionSummary: string) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM alert_events WHERE rule_id = $1 AND triggered_at = $2 LIMIT 1", [
      rule.id,
      state.timestamp,
    ]);
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return null;
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO alert_events (
        id, user_id, rule_id, symbol, triggered_at, trigger_price,
        indicator_snapshot_json, condition_summary, sms_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
      [
        id,
        rule.userId,
        rule.id,
        rule.symbol,
        state.timestamp,
        state.price,
        JSON.stringify(state),
        conditionSummary,
        rule.smsEnabled ? "skipped_no_verified_channel" : "not_sent",
        now,
      ],
    );
    await client.query("UPDATE alert_rules SET last_triggered_at = $1, updated_at = $2 WHERE id = $3", [
      state.timestamp,
      now,
      rule.id,
    ]);
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setAlertNotificationStatus(eventId: string, status: string, error?: string) {
  await query("UPDATE alert_events SET sms_status = $1, sms_error = $2 WHERE id = $3", [
    status,
    error ?? null,
    eventId,
  ]);
}

const alertEventSql = `SELECT
  alert_events.id,
  alert_events.rule_id,
  alert_rules.name AS rule_name,
  alert_events.symbol,
  alert_events.triggered_at,
  alert_events.trigger_price,
  alert_events.condition_summary,
  alert_events.sms_status,
  alert_events.performance_json
FROM alert_events
JOIN alert_rules ON alert_rules.id = alert_events.rule_id`;

export async function listAlertEvents(userId: string, limit = 100) {
  const result = await query<AlertEventRow>(`${alertEventSql}
    WHERE alert_events.user_id = $1
    ORDER BY alert_events.triggered_at DESC
    LIMIT $2`, [userId, limit]);
  return result.rows.map(mapAlertEvent);
}

export async function listRuleAlertEvents(userId: string, ruleId: string, limit = 25) {
  const result = await query<AlertEventRow>(`${alertEventSql}
    WHERE alert_events.user_id = $1 AND alert_events.rule_id = $2
    ORDER BY alert_events.triggered_at DESC
    LIMIT $3`, [userId, ruleId, limit]);
  return result.rows.map(mapAlertEvent);
}

export async function countAlertsToday(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM alert_events WHERE user_id = $1 AND triggered_at::date = $2::date",
    [userId, today],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listPendingAlertEvents(): Promise<PendingAlertEvent[]> {
  const result = await query<{
    id: string;
    symbol: SupportedSymbol;
    triggered_at: Date | string;
    trigger_price: number | string;
  }>(`SELECT id, symbol, triggered_at, trigger_price
      FROM alert_events
      WHERE performance_json IS NULL
      ORDER BY triggered_at`);
  return result.rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    triggeredAt: toIso(row.triggered_at)!,
    triggerPrice: Number(row.trigger_price),
  }));
}

export async function updateAlertPerformance(eventId: string, performance: Record<string, number>) {
  await query("UPDATE alert_events SET performance_json = $1::jsonb WHERE id = $2", [
    JSON.stringify(performance),
    eventId,
  ]);
}

export async function getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
  const now = new Date().toISOString();
  await query(
    `INSERT INTO user_notification_preferences (user_id, notifications_paused, updated_at)
     VALUES ($1, false, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, now],
  );
  const result = await query<{
    user_id: string;
    notifications_paused: boolean;
    updated_at: Date | string;
  }>("SELECT user_id, notifications_paused, updated_at FROM user_notification_preferences WHERE user_id = $1", [
    userId,
  ]);
  const row = result.rows[0];
  if (!row) throw new Error("Notification preferences could not be loaded.");
  return {
    userId: row.user_id,
    notificationsPaused: Boolean(row.notifications_paused),
    updatedAt: toIso(row.updated_at)!,
  };
}

export async function updateUserNotificationPreferences(
  userId: string,
  patch: { notificationsPaused: boolean },
) {
  const now = new Date().toISOString();
  await query(
    `INSERT INTO user_notification_preferences (user_id, notifications_paused, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       notifications_paused = excluded.notifications_paused,
       updated_at = excluded.updated_at`,
    [userId, patch.notificationsPaused, now],
  );
  return getUserNotificationPreferences(userId);
}

export async function listNotificationChannels(userId: string) {
  const result = await query<NotificationChannelRow>(
    `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
      sent_today, count_date, created_at
     FROM notification_channels
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(mapNotificationChannel);
}

export async function getNotificationChannelById(userId: string, channelId: string) {
  const result = await query<NotificationChannelRow>(
    `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
      sent_today, count_date, created_at
     FROM notification_channels
     WHERE id = $1 AND user_id = $2`,
    [channelId, userId],
  );
  return result.rows[0] ? mapNotificationChannel(result.rows[0]) : null;
}

async function resetNotificationCounters(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `UPDATE notification_channels
     SET sent_today = 0, count_date = $1::date, updated_at = $2
     WHERE user_id = $3 AND count_date <> $1::date`,
    [today, new Date().toISOString(), userId],
  );
}

export async function listEnabledNotificationChannels(userId: string) {
  await resetNotificationCounters(userId);
  const result = await query<NotificationChannelRow>(
    `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
      sent_today, count_date, created_at
     FROM notification_channels
     WHERE user_id = $1 AND is_enabled = true AND is_verified = true AND sent_today < daily_limit
     ORDER BY type, created_at`,
    [userId],
  );
  return result.rows.map(mapNotificationChannel);
}

export async function hasVerifiedNotificationChannel(userId: string) {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM notification_channels
     WHERE user_id = $1 AND is_enabled = true AND is_verified = true`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

async function getNotificationChannel(userId: string, type: NotificationChannelType, destination: string) {
  const result = await query<NotificationChannelRow>(
    `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
      sent_today, count_date, created_at
     FROM notification_channels
     WHERE user_id = $1 AND type = $2 AND destination = $3`,
    [userId, type, destination],
  );
  if (!result.rows[0]) throw new Error("Notification channel was not saved.");
  return mapNotificationChannel(result.rows[0]);
}

export async function createNotificationChannel(
  userId: string,
  input: {
    type: NotificationChannelType;
    destination: string;
    label?: string;
    isVerified?: boolean;
    isEnabled?: boolean;
    dailyLimit?: number;
  },
) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO notification_channels (
      id, user_id, type, destination, label, is_verified, is_enabled,
      daily_limit, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
    ON CONFLICT (user_id, type, destination) DO UPDATE SET
      label = excluded.label,
      is_verified = notification_channels.is_verified OR excluded.is_verified,
      is_enabled = excluded.is_enabled,
      daily_limit = excluded.daily_limit,
      updated_at = excluded.updated_at`,
    [
      id,
      userId,
      input.type,
      input.destination,
      input.label ?? null,
      Boolean(input.isVerified),
      input.isEnabled ?? true,
      input.dailyLimit ?? 10,
      now,
    ],
  );
  return getNotificationChannel(userId, input.type, input.destination);
}

export async function updateNotificationChannel(
  userId: string,
  channelId: string,
  patch: { isEnabled?: boolean; dailyLimit?: number; label?: string },
) {
  const currentResult = await query<{
    label: string | null;
    is_enabled: boolean;
    daily_limit: number;
  }>("SELECT label, is_enabled, daily_limit FROM notification_channels WHERE id = $1 AND user_id = $2", [
    channelId,
    userId,
  ]);
  const current = currentResult.rows[0];
  if (!current) return null;
  await query(
    `UPDATE notification_channels
     SET label = $1, is_enabled = $2, daily_limit = $3, updated_at = $4
     WHERE id = $5 AND user_id = $6`,
    [
      patch.label ?? current.label,
      patch.isEnabled ?? Boolean(current.is_enabled),
      patch.dailyLimit ?? current.daily_limit,
      new Date().toISOString(),
      channelId,
      userId,
    ],
  );
  return (await listNotificationChannels(userId)).find((channel) => channel.id === channelId) ?? null;
}

export async function deleteNotificationChannel(userId: string, channelId: string) {
  const result = await query("DELETE FROM notification_channels WHERE id = $1 AND user_id = $2", [
    channelId,
    userId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function startPhoneVerification(userId: string, phoneNumber: string) {
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);
  await query(
    `INSERT INTO phone_verifications (
      id, user_id, phone_number, code_hash, expires_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), userId, phoneNumber, hashCode(code), expiresAt.toISOString(), now.toISOString()],
  );
  return { code, expiresAt: expiresAt.toISOString() };
}

export async function verifyPhoneCode(userId: string, phoneNumber: string, code: string) {
  const result = await query<{
    id: string;
    code_hash: string;
    attempts: number;
    expires_at: Date | string;
  }>(
    `SELECT id, code_hash, attempts, expires_at
     FROM phone_verifications
     WHERE user_id = $1 AND phone_number = $2 AND verified_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, phoneNumber],
  );
  const row = result.rows[0];
  if (!row) return { ok: false, error: "No active verification code for that number." };
  if (new Date(toIso(row.expires_at)!).getTime() < Date.now()) {
    return { ok: false, error: "That verification code expired." };
  }
  if (row.attempts >= 5) return { ok: false, error: "Too many attempts. Start a new verification." };
  if (row.code_hash !== hashCode(code)) {
    await query("UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    return { ok: false, error: "That code did not match." };
  }
  await query("UPDATE phone_verifications SET verified_at = $1 WHERE id = $2", [
    new Date().toISOString(),
    row.id,
  ]);
  return {
    ok: true,
    channel: await createNotificationChannel(userId, {
      type: "sms",
      destination: phoneNumber,
      label: "SMS alerts",
      isVerified: true,
      isEnabled: true,
      dailyLimit: 10,
    }),
  };
}

export async function createNotificationLog(input: {
  userId: string;
  alertEventId?: string;
  channelId?: string;
  provider: string;
  channelType: NotificationChannelType;
  destination: string;
  status: string;
  message: string;
  error?: string;
}) {
  const id = randomUUID();
  await query(
    `INSERT INTO notification_logs (
      id, user_id, alert_event_id, channel_id, provider, channel_type,
      destination, status, message, error, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      input.userId,
      input.alertEventId ?? null,
      input.channelId ?? null,
      input.provider,
      input.channelType,
      input.destination,
      input.status,
      input.message,
      input.error ?? null,
      new Date().toISOString(),
    ],
  );
  return id;
}

export async function incrementNotificationChannelCount(channelId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `UPDATE notification_channels
     SET sent_today = sent_today + 1, count_date = $1::date, updated_at = $2
     WHERE id = $3`,
    [today, new Date().toISOString(), channelId],
  );
}

export async function listNotificationLogs(userId: string, limit = 25) {
  const result = await query<{
    id: string;
    alert_event_id: string | null;
    channel_id: string | null;
    provider: string;
    channel_type: NotificationChannelType;
    destination: string;
    status: string;
    message: string;
    error: string | null;
    created_at: Date | string;
  }>(
    `SELECT id, alert_event_id, channel_id, provider, channel_type, destination,
      status, message, error, created_at
     FROM notification_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map<NotificationLog>((row) => ({
    id: row.id,
    alertEventId: row.alert_event_id,
    channelId: row.channel_id,
    provider: row.provider,
    channelType: row.channel_type,
    destination: row.destination,
    status: row.status,
    message: row.message,
    error: row.error,
    createdAt: toIso(row.created_at)!,
  }));
}

export async function countNotificationAttemptsToday(userId?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const result = userId
    ? await query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM notification_logs WHERE user_id = $1 AND created_at::date = $2::date",
        [userId, today],
      )
    : await query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM notification_logs WHERE created_at::date = $1::date",
        [today],
      );
  return Number(result.rows[0]?.count ?? 0);
}

export async function createProviderErrorLog(input: {
  provider: string;
  symbol?: SupportedSymbol | null;
  context: string;
  statusCode?: number | null;
  message: string;
}) {
  const id = randomUUID();
  await query(
    `INSERT INTO provider_error_logs (
      id, provider, symbol, context, status_code, message, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      input.provider,
      input.symbol ?? null,
      input.context.slice(0, 120),
      input.statusCode ?? null,
      input.message.slice(0, 500),
      new Date().toISOString(),
    ],
  );
  return id;
}

export async function listProviderErrorLogs(limit = 50) {
  const result = await query<{
    id: string;
    provider: string;
    symbol: SupportedSymbol | null;
    context: string;
    status_code: number | null;
    message: string;
    created_at: Date | string;
  }>(
    `SELECT id, provider, symbol, context, status_code, message, created_at
     FROM provider_error_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map<ProviderErrorLog>((row) => ({
    id: row.id,
    provider: row.provider,
    symbol: row.symbol,
    context: row.context,
    statusCode: row.status_code,
    message: row.message,
    createdAt: toIso(row.created_at)!,
  }));
}

export async function countProviderErrorsSince(since: string) {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM provider_error_logs WHERE created_at >= $1",
    [since],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getCachedBacktestResult(userId: string, ruleId: string, rangeLabel: string) {
  const result = await query<{
    id: string;
    rule_id: string | null;
    symbol: SupportedSymbol;
    range_label: string;
    range_start: Date | string;
    range_end: Date | string;
    result_json: unknown;
    created_at: Date | string;
  }>(
    `SELECT id, rule_id, symbol, range_label, range_start, range_end, result_json, created_at
     FROM backtest_results
     WHERE user_id = $1 AND rule_id = $2 AND range_label = $3`,
    [userId, ruleId, rangeLabel],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    ruleId: row.rule_id,
    symbol: row.symbol,
    rangeLabel: row.range_label,
    rangeStart: toIso(row.range_start)!,
    rangeEnd: toIso(row.range_end)!,
    result: jsonValue<BacktestResult>(row.result_json),
    createdAt: toIso(row.created_at)!,
  } satisfies CachedBacktestResult;
}

export async function upsertBacktestResult(input: {
  userId: string;
  ruleId: string;
  symbol: SupportedSymbol;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  result: BacktestResult;
}) {
  await query(
    `INSERT INTO backtest_results (
      id, user_id, rule_id, symbol, range_label, range_start, range_end,
      result_json, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
    ON CONFLICT (user_id, rule_id, range_label) DO UPDATE SET
      symbol = excluded.symbol,
      range_start = excluded.range_start,
      range_end = excluded.range_end,
      result_json = excluded.result_json,
      created_at = excluded.created_at`,
    [
      randomUUID(),
      input.userId,
      input.ruleId,
      input.symbol,
      input.rangeLabel,
      input.rangeStart,
      input.rangeEnd,
      JSON.stringify(input.result),
      new Date().toISOString(),
    ],
  );
  return getCachedBacktestResult(input.userId, input.ruleId, input.rangeLabel);
}

function mapReplaySummary(row: ReplayDatasetSummaryRow): ReplayDatasetSummary {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    source: row.source,
    candleCount: Number(row.candle_count),
    startsAt: toIso(row.starts_at)!,
    endsAt: toIso(row.ends_at)!,
    createdAt: toIso(row.created_at)!,
  };
}

export async function listReplayDatasets(userId: string) {
  const result = await query<ReplayDatasetSummaryRow>(
    `SELECT id, name, symbol, source, candle_count, starts_at, ends_at, created_at
     FROM replay_datasets
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(mapReplaySummary);
}

export async function getReplayDataset(userId: string, datasetId: string) {
  const result = await query<{
    id: string;
    name: string;
    symbol: SupportedSymbol;
    source: string;
    candles_json: unknown;
    candle_count: number;
    starts_at: Date | string;
    ends_at: Date | string;
    created_at: Date | string;
  }>(
    `SELECT id, name, symbol, source, candles_json, candle_count, starts_at, ends_at, created_at
     FROM replay_datasets
     WHERE id = $1 AND user_id = $2`,
    [datasetId, userId],
  );
  const row = result.rows[0];
  return row ? ({ ...mapReplaySummary(row), candles: jsonValue<Candle[]>(row.candles_json) } satisfies ReplayDataset) : null;
}

export async function createReplayDataset(
  userId: string,
  input: {
    name: string;
    symbol: SupportedSymbol;
    source: string;
    candles: Candle[];
  },
) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const startsAt = input.candles[0]?.timestamp ?? now;
  const endsAt = input.candles.at(-1)?.timestamp ?? now;
  await query(
    `INSERT INTO replay_datasets (
      id, user_id, name, symbol, source, candles_json, candle_count,
      starts_at, ends_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)`,
    [
      id,
      userId,
      input.name,
      input.symbol,
      input.source,
      JSON.stringify(input.candles),
      input.candles.length,
      startsAt,
      endsAt,
      now,
    ],
  );
  return getReplayDataset(userId, id);
}

export async function deleteReplayDataset(userId: string, datasetId: string) {
  const result = await query("DELETE FROM replay_datasets WHERE id = $1 AND user_id = $2", [datasetId, userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateWorkerStatus(status: string, lastError?: string) {
  const now = new Date().toISOString();
  await query(
    `UPDATE market_worker_status
     SET status = $1, last_update_at = $2, last_error = $3, updated_at = $2
     WHERE id = 1`,
    [status, now, lastError ?? null],
  );
}

export async function recordWorkerTickStatus(input: {
  status: string;
  mode: string;
  runtimeMode?: string;
  workerId?: string | null;
  workerName?: string | null;
  lastCandleAt?: string | null;
  symbolsEvaluated: number;
  rulesEvaluated: number;
  triggersCreated: number;
  cooldownSkips: number;
  providerErrors: number;
  notificationAttempts: number;
  isRunning: boolean;
  nextRetryAt?: string | null;
  lastError?: string | null;
}) {
  const now = new Date().toISOString();
  await query(
    `UPDATE market_worker_status
     SET status = $1,
         mode = $2,
         runtime_mode = $3,
         worker_id = $4,
         worker_name = $5,
         heartbeat_at = $6,
         last_update_at = $6,
         last_tick_at = $6,
         last_candle_at = $7,
         symbols_evaluated = $8,
         rules_evaluated = $9,
         triggers_created = $10,
         cooldown_skips = $11,
         provider_errors = $12,
         notification_attempts = $13,
         is_running = $14,
         next_retry_at = $15,
         last_error = $16,
         updated_at = $6
     WHERE id = 1`,
    [
      input.status,
      input.mode,
      input.runtimeMode ?? "in-process",
      input.workerId ?? null,
      input.workerName ?? null,
      now,
      input.lastCandleAt ?? null,
      input.symbolsEvaluated,
      input.rulesEvaluated,
      input.triggersCreated,
      input.cooldownSkips,
      input.providerErrors,
      input.notificationAttempts,
      input.isRunning,
      input.nextRetryAt ?? null,
      input.lastError ?? null,
    ],
  );
}

export async function setWorkerLoopRunning(
  isRunning: boolean,
  mode: string,
  status?: string,
  runtimeMode = "in-process",
  workerId?: string | null,
  workerName?: string | null,
) {
  const now = new Date().toISOString();
  await query(
    `UPDATE market_worker_status
     SET status = $1,
         mode = $2,
         runtime_mode = $3,
         worker_id = $4,
         worker_name = $5,
         is_running = $6,
         heartbeat_at = $7,
         last_update_at = $8,
         updated_at = $8
     WHERE id = 1`,
    [
      status ?? (isRunning ? "running" : "idle"),
      mode,
      runtimeMode,
      workerId ?? null,
      workerName ?? null,
      isRunning,
      isRunning ? now : null,
      now,
    ],
  );
}

export async function getWorkerStatus() {
  const result = await query<{
    worker_id: string | null;
    worker_name: string | null;
    status: string;
    mode: string;
    runtime_mode: string;
    heartbeat_at: Date | string | null;
    last_update_at: Date | string | null;
    last_tick_at: Date | string | null;
    last_candle_at: Date | string | null;
    symbols_evaluated: number;
    rules_evaluated: number;
    triggers_created: number;
    cooldown_skips: number;
    provider_errors: number;
    notification_attempts: number;
    is_running: boolean;
    next_retry_at: Date | string | null;
    last_error: string | null;
  }>(
    `SELECT worker_id, worker_name, status, mode, runtime_mode, heartbeat_at,
      last_update_at, last_tick_at, last_candle_at,
      symbols_evaluated, rules_evaluated, triggers_created, cooldown_skips,
      provider_errors, notification_attempts, is_running, next_retry_at, last_error
     FROM market_worker_status
     WHERE id = 1`,
  );
  const row = result.rows[0];
  return {
    ...row,
    heartbeat_at: toIso(row.heartbeat_at),
    last_update_at: toIso(row.last_update_at),
    last_tick_at: toIso(row.last_tick_at),
    last_candle_at: toIso(row.last_candle_at),
    is_running: Number(Boolean(row.is_running)),
    next_retry_at: toIso(row.next_retry_at),
  } satisfies WorkerStatus;
}

export async function listSymbolLevels(userId: string, symbol: SupportedSymbol) {
  assertSupportedLevelSymbol(symbol);
  const result = await query<SymbolLevelRow>(
    `SELECT id, user_id, symbol, name, price, level_type, notes, expires_at, created_at, updated_at
     FROM symbol_levels
     WHERE user_id = $1 AND symbol = $2
     ORDER BY price DESC, created_at DESC`,
    [userId, symbol],
  );
  return result.rows.map(mapSymbolLevel);
}

export async function getSymbolLevel(userId: string, levelId: string) {
  const result = await query<SymbolLevelRow>(
    `SELECT id, user_id, symbol, name, price, level_type, notes, expires_at, created_at, updated_at
     FROM symbol_levels
     WHERE id = $1 AND user_id = $2`,
    [levelId, userId],
  );
  return result.rows[0] ? mapSymbolLevel(result.rows[0]) : null;
}

export async function createSymbolLevel(userId: string, input: SymbolLevelInput) {
  validateSymbolLevelInput(input);
  const id = randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO symbol_levels (
      id, user_id, symbol, name, price, level_type, notes, expires_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      id,
      userId,
      input.symbol,
      input.name,
      input.price,
      input.levelType,
      input.notes ?? null,
      input.expiresAt ?? null,
      now,
    ],
  );
  return getSymbolLevel(userId, id);
}

export async function updateSymbolLevel(
  userId: string,
  levelId: string,
  input: Partial<SymbolLevelInput>,
) {
  validateSymbolLevelInput(input);
  const existing = await getSymbolLevel(userId, levelId);
  if (!existing) return null;
  const next = {
    symbol: input.symbol ?? existing.symbol,
    name: input.name ?? existing.name,
    price: input.price ?? existing.price,
    levelType: input.levelType ?? existing.levelType,
    notes: input.notes === undefined ? existing.notes : input.notes,
    expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
  };
  await query(
    `UPDATE symbol_levels
     SET symbol = $1, name = $2, price = $3, level_type = $4, notes = $5, expires_at = $6, updated_at = $7
     WHERE id = $8 AND user_id = $9`,
    [
      next.symbol,
      next.name,
      next.price,
      next.levelType,
      next.notes ?? null,
      next.expiresAt ?? null,
      new Date().toISOString(),
      levelId,
      userId,
    ],
  );
  return getSymbolLevel(userId, levelId);
}

export async function deleteSymbolLevel(userId: string, levelId: string) {
  const result = await query("DELETE FROM symbol_levels WHERE id = $1 AND user_id = $2", [levelId, userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function listWatchlist(userId: string) {
  const result = await query<{ symbol: SupportedSymbol }>(
    "SELECT symbol FROM watchlist_symbols WHERE user_id = $1 ORDER BY created_at",
    [userId],
  );
  return result.rows.map((row) => row.symbol);
}

export async function addWatchlistSymbol(userId: string, symbol: SupportedSymbol) {
  await query(
    `INSERT INTO watchlist_symbols (id, user_id, symbol, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, symbol) DO NOTHING`,
    [randomUUID(), userId, symbol, new Date().toISOString()],
  );
}

export async function removeWatchlistSymbol(userId: string, symbol: SupportedSymbol) {
  await query("DELETE FROM watchlist_symbols WHERE user_id = $1 AND symbol = $2", [userId, symbol]);
}
