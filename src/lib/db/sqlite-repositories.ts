import { createHash, randomInt, randomUUID } from "node:crypto";
import { getDatabase } from "./local";
import type { AlertRule, BacktestResult, Candle, SupportedSymbol } from "@/lib/rules/types";
import type { IndicatorState } from "@/lib/rules/types";

export type SessionUser = {
  id: string;
  email: string;
  role: "user" | "admin";
};

export type UserRecord = SessionUser & {
  password_hash: string;
};

type RuleRow = {
  id: string;
  user_id: string;
  name: string;
  symbol: SupportedSymbol;
  timeframe: "1m";
  logic: "AND";
  conditions_json: string;
  time_filter_json: string | null;
  cooldown_minutes: number;
  sms_enabled: number;
  is_active: number;
  market_hours_only: number;
  created_at: string;
  last_triggered_at: string | null;
};

export type SavedRule = AlertRule & { id: string; createdAt: string };
export type WorkerRule = SavedRule & { userId: string; lastTriggeredAt: string | null };

export type AlertEvent = {
  id: string;
  ruleId: string;
  ruleName: string;
  symbol: SupportedSymbol;
  triggeredAt: string;
  triggerPrice: number;
  conditionSummary: string;
  smsStatus: string;
  performance?: Record<string, number>;
};

export type PendingAlertEvent = {
  id: string;
  symbol: SupportedSymbol;
  triggeredAt: string;
  triggerPrice: number;
};

export type WorkerStatus = {
  status: string;
  mode: string;
  last_update_at: string | null;
  last_tick_at: string | null;
  last_candle_at: string | null;
  symbols_evaluated: number;
  rules_evaluated: number;
  triggers_created: number;
  cooldown_skips: number;
  provider_errors: number;
  notification_attempts: number;
  is_running: number;
  next_retry_at: string | null;
  last_error: string | null;
};

export type CachedBacktestResult = {
  id: string;
  ruleId: string | null;
  symbol: SupportedSymbol;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  result: BacktestResult;
  createdAt: string;
};

export type ReplayDataset = {
  id: string;
  name: string;
  symbol: SupportedSymbol;
  source: string;
  candles: Candle[];
  candleCount: number;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

export type ReplayDatasetSummary = Omit<ReplayDataset, "candles">;

export type NotificationChannelType = "sms" | "email" | "discord_webhook";

export type NotificationChannel = {
  id: string;
  type: NotificationChannelType;
  destination: string;
  label?: string;
  isVerified: boolean;
  isEnabled: boolean;
  dailyLimit: number;
  sentToday: number;
  countDate: string;
  createdAt: string;
};

export type NotificationLog = {
  id: string;
  alertEventId: string | null;
  channelId: string | null;
  provider: string;
  channelType: NotificationChannelType;
  destination: string;
  status: string;
  message: string;
  error: string | null;
  createdAt: string;
};

export type UserNotificationPreferences = {
  userId: string;
  notificationsPaused: boolean;
  updatedAt: string;
};

export type ProviderErrorLog = {
  id: string;
  provider: string;
  symbol: SupportedSymbol | null;
  context: string;
  statusCode: number | null;
  message: string;
  createdAt: string;
};

type NotificationChannelRow = {
  id: string;
  type: NotificationChannelType;
  destination: string;
  label: string | null;
  is_verified: number;
  is_enabled: number;
  daily_limit: number;
  sent_today: number;
  count_date: string;
  created_at: string;
};

type NotificationLogRow = {
  id: string;
  alert_event_id: string | null;
  channel_id: string | null;
  provider: string;
  channel_type: NotificationChannelType;
  destination: string;
  status: string;
  message: string;
  error: string | null;
  created_at: string;
};

type UserNotificationPreferencesRow = {
  user_id: string;
  notifications_paused: number;
  updated_at: string;
};

type ProviderErrorLogRow = {
  id: string;
  provider: string;
  symbol: SupportedSymbol | null;
  context: string;
  status_code: number | null;
  message: string;
  created_at: string;
};

type BacktestResultRow = {
  id: string;
  rule_id: string | null;
  symbol: SupportedSymbol;
  range_label: string;
  range_start: string;
  range_end: string;
  result_json: string;
  created_at: string;
};

type ReplayDatasetRow = {
  id: string;
  name: string;
  symbol: SupportedSymbol;
  source: string;
  candles_json?: string;
  candle_count: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

const daysBefore = (now: Date, days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60_000).toISOString();

const hoursBefore = (now: Date, hours: number) =>
  new Date(now.getTime() - hours * 60 * 60_000).toISOString();

const rowCount = (changes: number | bigint) => Number(changes);

export type CleanupRetention = {
  providerErrorLogDays: number;
  notificationLogDays: number;
  backtestResultDays: number;
  phoneVerificationHours: number;
};

export type CleanupResult = {
  expiredSessions: number;
  phoneVerifications: number;
  providerErrorLogs: number;
  notificationLogs: number;
  cachedBacktestResults: number;
  suggestedRuleCandidates: number;
};

export function findUserByEmail(email: string) {
  return getDatabase()
    .prepare("SELECT id, email, password_hash, role FROM users WHERE email = ?")
    .get(email) as UserRecord | undefined;
}

export function createUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  now: string;
}) {
  getDatabase()
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.id, input.email, input.passwordHash, input.now, input.now);
}

export function createSessionRecord(input: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}) {
  getDatabase()
    .prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.id, input.userId, input.tokenHash, input.expiresAt, input.createdAt);
}

export function deleteSessionByTokenHash(tokenHashValue: string) {
  getDatabase().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHashValue);
}

export function getSessionUserByTokenHash(tokenHashValue: string, now: string) {
  const row = getDatabase()
    .prepare(
      `SELECT users.id, users.email, users.role
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(tokenHashValue, now) as SessionUser | undefined;
  return row ?? null;
}

export function runCleanup(now: Date, retention: CleanupRetention): CleanupResult {
  const database = getDatabase();
  const timestamp = now.toISOString();
  const phoneCutoff = hoursBefore(now, retention.phoneVerificationHours);
  const providerCutoff = daysBefore(now, retention.providerErrorLogDays);
  const notificationCutoff = daysBefore(now, retention.notificationLogDays);
  const backtestCutoff = daysBefore(now, retention.backtestResultDays);

  database.exec("BEGIN");
  try {
    const expiredSessions = database
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(timestamp).changes;
    const phoneVerifications = database
      .prepare("DELETE FROM phone_verifications WHERE expires_at <= ? OR created_at <= ?")
      .run(timestamp, phoneCutoff).changes;
    const providerErrorLogs = database
      .prepare("DELETE FROM provider_error_logs WHERE created_at <= ?")
      .run(providerCutoff).changes;
    const notificationLogs = database
      .prepare("DELETE FROM notification_logs WHERE created_at <= ?")
      .run(notificationCutoff).changes;
    const cachedBacktestResults = database
      .prepare("DELETE FROM backtest_results WHERE created_at <= ?")
      .run(backtestCutoff).changes;
    const suggestedRuleCandidates = database
      .prepare("DELETE FROM suggested_rule_candidates WHERE expires_at IS NOT NULL AND expires_at <= ?")
      .run(timestamp).changes;

    const result = {
      expiredSessions: rowCount(expiredSessions),
      phoneVerifications: rowCount(phoneVerifications),
      providerErrorLogs: rowCount(providerErrorLogs),
      notificationLogs: rowCount(notificationLogs),
      cachedBacktestResults: rowCount(cachedBacktestResults),
      suggestedRuleCandidates: rowCount(suggestedRuleCandidates),
    };

    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function mapRule(row: RuleRow): SavedRule {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    timeframe: row.timeframe,
    logic: row.logic,
    conditions: JSON.parse(row.conditions_json),
    timeFilter: row.time_filter_json ? JSON.parse(row.time_filter_json) : undefined,
    cooldownMinutes: row.cooldown_minutes,
    smsEnabled: Boolean(row.sms_enabled),
    isActive: Boolean(row.is_active),
    marketHoursOnly: Boolean(row.market_hours_only),
    createdAt: row.created_at,
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
    dailyLimit: row.daily_limit,
    sentToday: row.sent_today,
    countDate: row.count_date,
    createdAt: row.created_at,
  };
}

function mapNotificationLog(row: NotificationLogRow): NotificationLog {
  return {
    id: row.id,
    alertEventId: row.alert_event_id,
    channelId: row.channel_id,
    provider: row.provider,
    channelType: row.channel_type,
    destination: row.destination,
    status: row.status,
    message: row.message,
    error: row.error,
    createdAt: row.created_at,
  };
}

function mapUserNotificationPreferences(
  row: UserNotificationPreferencesRow,
): UserNotificationPreferences {
  return {
    userId: row.user_id,
    notificationsPaused: Boolean(row.notifications_paused),
    updatedAt: row.updated_at,
  };
}

function mapProviderErrorLog(row: ProviderErrorLogRow): ProviderErrorLog {
  return {
    id: row.id,
    provider: row.provider,
    symbol: row.symbol,
    context: row.context,
    statusCode: row.status_code,
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapBacktestResult(row: BacktestResultRow): CachedBacktestResult {
  return {
    id: row.id,
    ruleId: row.rule_id,
    symbol: row.symbol,
    rangeLabel: row.range_label,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    result: JSON.parse(row.result_json),
    createdAt: row.created_at,
  };
}

function mapReplayDatasetSummary(row: ReplayDatasetRow): ReplayDatasetSummary {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    source: row.source,
    candleCount: row.candle_count,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

function mapReplayDataset(row: ReplayDatasetRow): ReplayDataset {
  return {
    ...mapReplayDatasetSummary(row),
    candles: JSON.parse(row.candles_json ?? "[]"),
  };
}

export function listRules(userId: string) {
  return (
    getDatabase()
      .prepare("SELECT * FROM alert_rules WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as RuleRow[]
  ).map(mapRule);
}

export function getRule(userId: string, ruleId: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM alert_rules WHERE id = ? AND user_id = ?")
    .get(ruleId, userId) as RuleRow | undefined;
  return row ? mapRule(row) : null;
}

export function listActiveWorkerRules() {
  return (
    getDatabase()
      .prepare("SELECT * FROM alert_rules WHERE is_active = 1 ORDER BY symbol, created_at")
      .all() as RuleRow[]
  ).map((row) => ({
    ...mapRule(row),
    userId: row.user_id,
    lastTriggeredAt: row.last_triggered_at,
  }));
}

export function listActiveWorkerRulesForUser(userId: string) {
  return (
    getDatabase()
      .prepare(
        "SELECT * FROM alert_rules WHERE user_id = ? AND is_active = 1 ORDER BY symbol, created_at",
      )
      .all(userId) as RuleRow[]
  ).map((row) => ({
    ...mapRule(row),
    userId: row.user_id,
    lastTriggeredAt: row.last_triggered_at,
  }));
}

export function createRule(userId: string, rule: AlertRule) {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO alert_rules (
        id, user_id, name, symbol, timeframe, logic, conditions_json,
        time_filter_json, cooldown_minutes, sms_enabled, is_active,
        market_hours_only, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      rule.name,
      rule.symbol,
      rule.timeframe,
      rule.logic,
      JSON.stringify(rule.conditions),
      rule.timeFilter ? JSON.stringify(rule.timeFilter) : null,
      rule.cooldownMinutes,
      Number(rule.smsEnabled),
      Number(rule.isActive),
      Number(rule.marketHoursOnly),
      now,
      now,
    );
  return { ...rule, id, createdAt: now };
}

export function setRuleActive(userId: string, ruleId: string, isActive: boolean) {
  const result = getDatabase()
    .prepare(
      "UPDATE alert_rules SET is_active = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
    .run(Number(isActive), new Date().toISOString(), ruleId, userId);
  return result.changes > 0;
}

export function deleteRule(userId: string, ruleId: string) {
  const result = getDatabase()
    .prepare("DELETE FROM alert_rules WHERE id = ? AND user_id = ?")
    .run(ruleId, userId);
  return result.changes > 0;
}

export function createAlertEvent(
  rule: WorkerRule,
  state: IndicatorState,
  conditionSummary: string,
) {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT id FROM alert_events WHERE rule_id = ? AND triggered_at = ? LIMIT 1")
    .get(rule.id, state.timestamp) as { id: string } | undefined;
  if (existing) return null;

  const id = randomUUID();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO alert_events (
        id, user_id, rule_id, symbol, triggered_at, trigger_price,
        indicator_snapshot_json, condition_summary, sms_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
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
    );
  database
    .prepare("UPDATE alert_rules SET last_triggered_at = ?, updated_at = ? WHERE id = ?")
    .run(state.timestamp, now, rule.id);
  return id;
}

export function setAlertNotificationStatus(eventId: string, status: string, error?: string) {
  getDatabase()
    .prepare("UPDATE alert_events SET sms_status = ?, sms_error = ? WHERE id = ?")
    .run(status, error ?? null, eventId);
}

export function listAlertEvents(userId: string, limit = 100) {
  return (
    getDatabase()
      .prepare(
        `SELECT
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
        JOIN alert_rules ON alert_rules.id = alert_events.rule_id
        WHERE alert_events.user_id = ?
        ORDER BY alert_events.triggered_at DESC
        LIMIT ?`,
      )
      .all(userId, limit) as Array<{
        id: string;
        rule_id: string;
        rule_name: string;
        symbol: SupportedSymbol;
        triggered_at: string;
        trigger_price: number;
        condition_summary: string;
        sms_status: string;
        performance_json: string | null;
      }>
  ).map<AlertEvent>((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    symbol: row.symbol,
    triggeredAt: row.triggered_at,
    triggerPrice: row.trigger_price,
    conditionSummary: row.condition_summary,
    smsStatus: row.sms_status,
    performance: row.performance_json ? JSON.parse(row.performance_json) : undefined,
  }));
}

export function listRuleAlertEvents(userId: string, ruleId: string, limit = 25) {
  return (
    getDatabase()
      .prepare(
        `SELECT
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
        JOIN alert_rules ON alert_rules.id = alert_events.rule_id
        WHERE alert_events.user_id = ? AND alert_events.rule_id = ?
        ORDER BY alert_events.triggered_at DESC
        LIMIT ?`,
      )
      .all(userId, ruleId, limit) as Array<{
        id: string;
        rule_id: string;
        rule_name: string;
        symbol: SupportedSymbol;
        triggered_at: string;
        trigger_price: number;
        condition_summary: string;
        sms_status: string;
        performance_json: string | null;
      }>
  ).map<AlertEvent>((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    symbol: row.symbol,
    triggeredAt: row.triggered_at,
    triggerPrice: row.trigger_price,
    conditionSummary: row.condition_summary,
    smsStatus: row.sms_status,
    performance: row.performance_json ? JSON.parse(row.performance_json) : undefined,
  }));
}

export function countAlertsToday(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const row = getDatabase()
    .prepare(
      "SELECT COUNT(*) AS count FROM alert_events WHERE user_id = ? AND substr(triggered_at, 1, 10) = ?",
    )
    .get(userId, today) as { count: number };
  return row.count;
}

export function listPendingAlertEvents() {
  return getDatabase()
    .prepare(
      `SELECT id, symbol, triggered_at, trigger_price
       FROM alert_events
       WHERE performance_json IS NULL
       ORDER BY triggered_at`,
    )
    .all()
    .map((row) => {
      const item = row as {
        id: string;
        symbol: SupportedSymbol;
        triggered_at: string;
        trigger_price: number;
      };
      return {
        id: item.id,
        symbol: item.symbol,
        triggeredAt: item.triggered_at,
        triggerPrice: item.trigger_price,
      };
    });
}

export function updateAlertPerformance(eventId: string, performance: Record<string, number>) {
  getDatabase()
    .prepare("UPDATE alert_events SET performance_json = ? WHERE id = ?")
    .run(JSON.stringify(performance), eventId);
}

export function getUserNotificationPreferences(userId: string) {
  const database = getDatabase();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT OR IGNORE INTO user_notification_preferences (
        user_id, notifications_paused, updated_at
      ) VALUES (?, 0, ?)`,
    )
    .run(userId, now);
  const row = database
    .prepare(
      `SELECT user_id, notifications_paused, updated_at
       FROM user_notification_preferences
       WHERE user_id = ?`,
    )
    .get(userId) as UserNotificationPreferencesRow | undefined;
  if (!row) throw new Error("Notification preferences could not be loaded.");
  return mapUserNotificationPreferences(row);
}

export function updateUserNotificationPreferences(
  userId: string,
  patch: { notificationsPaused: boolean },
) {
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO user_notification_preferences (
        user_id, notifications_paused, updated_at
      ) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        notifications_paused = excluded.notifications_paused,
        updated_at = excluded.updated_at`,
    )
    .run(userId, Number(patch.notificationsPaused), now);
  return getUserNotificationPreferences(userId);
}

export function listNotificationChannels(userId: string) {
  return (
    getDatabase()
      .prepare(
        `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
          sent_today, count_date, created_at
         FROM notification_channels
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(userId) as NotificationChannelRow[]
  ).map(mapNotificationChannel);
}

export function getNotificationChannelById(userId: string, channelId: string) {
  const row = getDatabase()
    .prepare(
      `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
        sent_today, count_date, created_at
       FROM notification_channels
       WHERE id = ? AND user_id = ?`,
    )
    .get(channelId, userId) as NotificationChannelRow | undefined;
  return row ? mapNotificationChannel(row) : null;
}

export function listEnabledNotificationChannels(userId: string) {
  resetNotificationCounters(userId);
  return (
    getDatabase()
      .prepare(
        `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
          sent_today, count_date, created_at
         FROM notification_channels
         WHERE user_id = ? AND is_enabled = 1 AND is_verified = 1 AND sent_today < daily_limit
         ORDER BY type, created_at`,
      )
      .all(userId) as NotificationChannelRow[]
  ).map(mapNotificationChannel);
}

export function hasVerifiedNotificationChannel(userId: string) {
  const row = getDatabase()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM notification_channels
       WHERE user_id = ? AND is_enabled = 1 AND is_verified = 1`,
    )
    .get(userId) as { count: number };
  return row.count > 0;
}

export function createNotificationChannel(
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
  getDatabase()
    .prepare(
      `INSERT INTO notification_channels (
        id, user_id, type, destination, label, is_verified, is_enabled,
        daily_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, type, destination) DO UPDATE SET
        label = excluded.label,
        is_verified = max(notification_channels.is_verified, excluded.is_verified),
        is_enabled = excluded.is_enabled,
        daily_limit = excluded.daily_limit,
        updated_at = excluded.updated_at`,
    )
    .run(
      id,
      userId,
      input.type,
      input.destination,
      input.label ?? null,
      Number(Boolean(input.isVerified)),
      Number(input.isEnabled ?? true),
      input.dailyLimit ?? 10,
      now,
      now,
    );
  return getNotificationChannel(userId, input.type, input.destination);
}

function getNotificationChannel(
  userId: string,
  type: NotificationChannelType,
  destination: string,
) {
  const row = getDatabase()
    .prepare(
      `SELECT id, type, destination, label, is_verified, is_enabled, daily_limit,
        sent_today, count_date, created_at
       FROM notification_channels
       WHERE user_id = ? AND type = ? AND destination = ?`,
    )
    .get(userId, type, destination) as NotificationChannelRow | undefined;
  if (!row) throw new Error("Notification channel was not saved.");
  return mapNotificationChannel(row);
}

export function updateNotificationChannel(
  userId: string,
  channelId: string,
  patch: { isEnabled?: boolean; dailyLimit?: number; label?: string },
) {
  const current = getDatabase()
    .prepare("SELECT label, is_enabled, daily_limit FROM notification_channels WHERE id = ? AND user_id = ?")
    .get(channelId, userId) as
    | { label: string | null; is_enabled: number; daily_limit: number }
    | undefined;
  if (!current) return null;
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE notification_channels
       SET label = ?, is_enabled = ?, daily_limit = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(
      patch.label ?? current.label,
      Number(patch.isEnabled ?? Boolean(current.is_enabled)),
      patch.dailyLimit ?? current.daily_limit,
      now,
      channelId,
      userId,
    );
  return listNotificationChannels(userId).find((channel) => channel.id === channelId) ?? null;
}

export function deleteNotificationChannel(userId: string, channelId: string) {
  const result = getDatabase()
    .prepare("DELETE FROM notification_channels WHERE id = ? AND user_id = ?")
    .run(channelId, userId);
  return result.changes > 0;
}

export function startPhoneVerification(userId: string, phoneNumber: string) {
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);
  getDatabase()
    .prepare(
      `INSERT INTO phone_verifications (
        id, user_id, phone_number, code_hash, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), userId, phoneNumber, hashCode(code), expiresAt.toISOString(), now.toISOString());
  return { code, expiresAt: expiresAt.toISOString() };
}

export function verifyPhoneCode(userId: string, phoneNumber: string, code: string) {
  const database = getDatabase();
  const row = database
    .prepare(
      `SELECT id, code_hash, attempts, expires_at
       FROM phone_verifications
       WHERE user_id = ? AND phone_number = ? AND verified_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(userId, phoneNumber) as
    | { id: string; code_hash: string; attempts: number; expires_at: string }
    | undefined;
  if (!row) return { ok: false, error: "No active verification code for that number." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That verification code expired." };
  }
  if (row.attempts >= 5) {
    return { ok: false, error: "Too many attempts. Start a new verification." };
  }
  if (row.code_hash !== hashCode(code)) {
    database
      .prepare("UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?")
      .run(row.id);
    return { ok: false, error: "That code did not match." };
  }
  const now = new Date().toISOString();
  database
    .prepare("UPDATE phone_verifications SET verified_at = ? WHERE id = ?")
    .run(now, row.id);
  return {
    ok: true,
    channel: createNotificationChannel(userId, {
      type: "sms",
      destination: phoneNumber,
      label: "SMS alerts",
      isVerified: true,
      isEnabled: true,
      dailyLimit: 10,
    }),
  };
}

export function createNotificationLog(input: {
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
  const now = new Date().toISOString();
  const id = randomUUID();
  getDatabase()
    .prepare(
      `INSERT INTO notification_logs (
        id, user_id, alert_event_id, channel_id, provider, channel_type,
        destination, status, message, error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
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
      now,
    );
  return id;
}

export function incrementNotificationChannelCount(channelId: string) {
  const today = new Date().toISOString().slice(0, 10);
  getDatabase()
    .prepare(
      `UPDATE notification_channels
       SET sent_today = sent_today + 1, count_date = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(today, new Date().toISOString(), channelId);
}

function resetNotificationCounters(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  getDatabase()
    .prepare(
      `UPDATE notification_channels
       SET sent_today = 0, count_date = ?, updated_at = ?
       WHERE user_id = ? AND count_date <> ?`,
    )
    .run(today, new Date().toISOString(), userId, today);
}

export function listNotificationLogs(userId: string, limit = 25) {
  return (
    getDatabase()
      .prepare(
        `SELECT id, alert_event_id, channel_id, provider, channel_type, destination,
          status, message, error, created_at
         FROM notification_logs
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(userId, limit) as NotificationLogRow[]
  ).map(mapNotificationLog);
}

export function countNotificationAttemptsToday(userId?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const row = userId
    ? (getDatabase()
        .prepare(
          "SELECT COUNT(*) AS count FROM notification_logs WHERE user_id = ? AND substr(created_at, 1, 10) = ?",
        )
        .get(userId, today) as { count: number })
    : (getDatabase()
        .prepare("SELECT COUNT(*) AS count FROM notification_logs WHERE substr(created_at, 1, 10) = ?")
        .get(today) as { count: number });
  return row.count;
}

export function createProviderErrorLog(input: {
  provider: string;
  symbol?: SupportedSymbol | null;
  context: string;
  statusCode?: number | null;
  message: string;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO provider_error_logs (
        id, provider, symbol, context, status_code, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.provider,
      input.symbol ?? null,
      input.context.slice(0, 120),
      input.statusCode ?? null,
      input.message.slice(0, 500),
      now,
    );
  return id;
}

export function listProviderErrorLogs(limit = 50) {
  return (
    getDatabase()
      .prepare(
        `SELECT id, provider, symbol, context, status_code, message, created_at
         FROM provider_error_logs
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as ProviderErrorLogRow[]
  ).map(mapProviderErrorLog);
}

export function countProviderErrorsSince(since: string) {
  const row = getDatabase()
    .prepare("SELECT COUNT(*) AS count FROM provider_error_logs WHERE created_at >= ?")
    .get(since) as { count: number };
  return row.count;
}

export function getCachedBacktestResult(userId: string, ruleId: string, rangeLabel: string) {
  const row = getDatabase()
    .prepare(
      `SELECT id, rule_id, symbol, range_label, range_start, range_end, result_json, created_at
       FROM backtest_results
       WHERE user_id = ? AND rule_id = ? AND range_label = ?`,
    )
    .get(userId, ruleId, rangeLabel) as BacktestResultRow | undefined;
  return row ? mapBacktestResult(row) : null;
}

export function upsertBacktestResult(input: {
  userId: string;
  ruleId: string;
  symbol: SupportedSymbol;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  result: BacktestResult;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO backtest_results (
        id, user_id, rule_id, symbol, range_label, range_start, range_end,
        result_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, rule_id, range_label) DO UPDATE SET
        symbol = excluded.symbol,
        range_start = excluded.range_start,
        range_end = excluded.range_end,
        result_json = excluded.result_json,
        created_at = excluded.created_at`,
    )
    .run(
      id,
      input.userId,
      input.ruleId,
      input.symbol,
      input.rangeLabel,
      input.rangeStart,
      input.rangeEnd,
      JSON.stringify(input.result),
      now,
    );
  return getCachedBacktestResult(input.userId, input.ruleId, input.rangeLabel);
}

export function listReplayDatasets(userId: string) {
  return (
    getDatabase()
      .prepare(
        `SELECT id, name, symbol, source, candle_count, starts_at, ends_at, created_at
         FROM replay_datasets
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(userId) as ReplayDatasetRow[]
  ).map(mapReplayDatasetSummary);
}

export function getReplayDataset(userId: string, datasetId: string) {
  const row = getDatabase()
    .prepare(
      `SELECT id, name, symbol, source, candles_json, candle_count, starts_at, ends_at, created_at
       FROM replay_datasets
       WHERE id = ? AND user_id = ?`,
    )
    .get(datasetId, userId) as ReplayDatasetRow | undefined;
  return row ? mapReplayDataset(row) : null;
}

export function createReplayDataset(
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
  getDatabase()
    .prepare(
      `INSERT INTO replay_datasets (
        id, user_id, name, symbol, source, candles_json, candle_count,
        starts_at, ends_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
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
    );
  return getReplayDataset(userId, id);
}

export function deleteReplayDataset(userId: string, datasetId: string) {
  const result = getDatabase()
    .prepare("DELETE FROM replay_datasets WHERE id = ? AND user_id = ?")
    .run(datasetId, userId);
  return result.changes > 0;
}

export function updateWorkerStatus(status: string, lastError?: string) {
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE market_worker_status
       SET status = ?, last_update_at = ?, last_error = ?, updated_at = ?
       WHERE id = 1`,
    )
    .run(status, now, lastError ?? null, now);
}

export function recordWorkerTickStatus(input: {
  status: string;
  mode: string;
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
  getDatabase()
    .prepare(
      `UPDATE market_worker_status
       SET status = ?,
           mode = ?,
           last_update_at = ?,
           last_tick_at = ?,
           last_candle_at = ?,
           symbols_evaluated = ?,
           rules_evaluated = ?,
           triggers_created = ?,
           cooldown_skips = ?,
           provider_errors = ?,
           notification_attempts = ?,
           is_running = ?,
           next_retry_at = ?,
           last_error = ?,
           updated_at = ?
       WHERE id = 1`,
    )
    .run(
      input.status,
      input.mode,
      now,
      now,
      input.lastCandleAt ?? null,
      input.symbolsEvaluated,
      input.rulesEvaluated,
      input.triggersCreated,
      input.cooldownSkips,
      input.providerErrors,
      input.notificationAttempts,
      Number(input.isRunning),
      input.nextRetryAt ?? null,
      input.lastError ?? null,
      now,
    );
}

export function setWorkerLoopRunning(isRunning: boolean, mode: string, status?: string) {
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE market_worker_status
       SET status = ?, mode = ?, is_running = ?, last_update_at = ?, updated_at = ?
       WHERE id = 1`,
    )
    .run(status ?? (isRunning ? "running" : "idle"), mode, Number(isRunning), now, now);
}

export function getWorkerStatus() {
  return getDatabase()
    .prepare(
      `SELECT status, mode, last_update_at, last_tick_at, last_candle_at,
        symbols_evaluated, rules_evaluated, triggers_created, cooldown_skips,
        provider_errors, notification_attempts, is_running, next_retry_at, last_error
       FROM market_worker_status
       WHERE id = 1`,
    )
    .get() as WorkerStatus;
}

export function listWatchlist(userId: string) {
  return getDatabase()
    .prepare("SELECT symbol FROM watchlist_symbols WHERE user_id = ? ORDER BY created_at")
    .all(userId)
    .map((row) => (row as { symbol: SupportedSymbol }).symbol);
}

export function addWatchlistSymbol(userId: string, symbol: SupportedSymbol) {
  getDatabase()
    .prepare(
      "INSERT OR IGNORE INTO watchlist_symbols (id, user_id, symbol, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(randomUUID(), userId, symbol, new Date().toISOString());
}

export function removeWatchlistSymbol(userId: string, symbol: SupportedSymbol) {
  getDatabase()
    .prepare("DELETE FROM watchlist_symbols WHERE user_id = ? AND symbol = ?")
    .run(userId, symbol);
}
