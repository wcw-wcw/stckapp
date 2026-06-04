import { resolveDatabaseProviderMode, type RepositoryAdapterName } from "./provider";
import type { RawServerEnv } from "@/lib/config/env";
import * as postgres from "./postgres-repositories";
import * as sqlite from "./sqlite-repositories";

export type {
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

type SqliteRepository = typeof sqlite;
type RepositoryMethod = {
  [Key in keyof SqliteRepository]: SqliteRepository[Key] extends (...args: never[]) => unknown
    ? Key
    : never;
}[keyof SqliteRepository];

export function getRepositoryProvider(env: RawServerEnv = process.env): RepositoryAdapterName {
  return resolveDatabaseProviderMode(env).repositoryAdapter;
}

export function getRepository(env: RawServerEnv = process.env) {
  const mode = resolveDatabaseProviderMode(env);
  return mode.activeProvider === "postgres" ? postgres : sqlite;
}

function callRepository<Key extends RepositoryMethod>(
  method: Key,
  ...args: Parameters<SqliteRepository[Key]>
): Promise<Awaited<ReturnType<SqliteRepository[Key]>>> {
  const repository = getRepository();
  return Promise.resolve().then(
    () => (repository[method] as (...input: typeof args) => unknown)(...args),
  ) as Promise<Awaited<ReturnType<SqliteRepository[Key]>>>;
}

export const findUserByEmail = (...args: Parameters<SqliteRepository["findUserByEmail"]>) =>
  callRepository("findUserByEmail", ...args);
export const createUser = (...args: Parameters<SqliteRepository["createUser"]>) =>
  callRepository("createUser", ...args);
export const createSessionRecord = (...args: Parameters<SqliteRepository["createSessionRecord"]>) =>
  callRepository("createSessionRecord", ...args);
export const deleteSessionByTokenHash = (...args: Parameters<SqliteRepository["deleteSessionByTokenHash"]>) =>
  callRepository("deleteSessionByTokenHash", ...args);
export const getSessionUserByTokenHash = (...args: Parameters<SqliteRepository["getSessionUserByTokenHash"]>) =>
  callRepository("getSessionUserByTokenHash", ...args);
export const runCleanup = (...args: Parameters<SqliteRepository["runCleanup"]>) =>
  callRepository("runCleanup", ...args);

export const listRules = (...args: Parameters<SqliteRepository["listRules"]>) =>
  callRepository("listRules", ...args);
export const getRule = (...args: Parameters<SqliteRepository["getRule"]>) =>
  callRepository("getRule", ...args);
export const listActiveWorkerRules = (...args: Parameters<SqliteRepository["listActiveWorkerRules"]>) =>
  callRepository("listActiveWorkerRules", ...args);
export const listActiveWorkerRulesForUser = (
  ...args: Parameters<SqliteRepository["listActiveWorkerRulesForUser"]>
) => callRepository("listActiveWorkerRulesForUser", ...args);
export const createRule = (...args: Parameters<SqliteRepository["createRule"]>) =>
  callRepository("createRule", ...args);
export const setRuleActive = (...args: Parameters<SqliteRepository["setRuleActive"]>) =>
  callRepository("setRuleActive", ...args);
export const deleteRule = (...args: Parameters<SqliteRepository["deleteRule"]>) =>
  callRepository("deleteRule", ...args);
export const createAlertEvent = (...args: Parameters<SqliteRepository["createAlertEvent"]>) =>
  callRepository("createAlertEvent", ...args);
export const setAlertNotificationStatus = (
  ...args: Parameters<SqliteRepository["setAlertNotificationStatus"]>
) => callRepository("setAlertNotificationStatus", ...args);
export const listAlertEvents = (...args: Parameters<SqliteRepository["listAlertEvents"]>) =>
  callRepository("listAlertEvents", ...args);
export const listRuleAlertEvents = (...args: Parameters<SqliteRepository["listRuleAlertEvents"]>) =>
  callRepository("listRuleAlertEvents", ...args);
export const countAlertsToday = (...args: Parameters<SqliteRepository["countAlertsToday"]>) =>
  callRepository("countAlertsToday", ...args);
export const listPendingAlertEvents = (...args: Parameters<SqliteRepository["listPendingAlertEvents"]>) =>
  callRepository("listPendingAlertEvents", ...args);
export const updateAlertPerformance = (...args: Parameters<SqliteRepository["updateAlertPerformance"]>) =>
  callRepository("updateAlertPerformance", ...args);
export const getUserNotificationPreferences = (
  ...args: Parameters<SqliteRepository["getUserNotificationPreferences"]>
) => callRepository("getUserNotificationPreferences", ...args);
export const updateUserNotificationPreferences = (
  ...args: Parameters<SqliteRepository["updateUserNotificationPreferences"]>
) => callRepository("updateUserNotificationPreferences", ...args);
export const listNotificationChannels = (
  ...args: Parameters<SqliteRepository["listNotificationChannels"]>
) => callRepository("listNotificationChannels", ...args);
export const getNotificationChannelById = (
  ...args: Parameters<SqliteRepository["getNotificationChannelById"]>
) => callRepository("getNotificationChannelById", ...args);
export const listEnabledNotificationChannels = (
  ...args: Parameters<SqliteRepository["listEnabledNotificationChannels"]>
) => callRepository("listEnabledNotificationChannels", ...args);
export const hasVerifiedNotificationChannel = (
  ...args: Parameters<SqliteRepository["hasVerifiedNotificationChannel"]>
) => callRepository("hasVerifiedNotificationChannel", ...args);
export const createNotificationChannel = (
  ...args: Parameters<SqliteRepository["createNotificationChannel"]>
) => callRepository("createNotificationChannel", ...args);
export const updateNotificationChannel = (
  ...args: Parameters<SqliteRepository["updateNotificationChannel"]>
) => callRepository("updateNotificationChannel", ...args);
export const deleteNotificationChannel = (
  ...args: Parameters<SqliteRepository["deleteNotificationChannel"]>
) => callRepository("deleteNotificationChannel", ...args);
export const startPhoneVerification = (
  ...args: Parameters<SqliteRepository["startPhoneVerification"]>
) => callRepository("startPhoneVerification", ...args);
export const verifyPhoneCode = (...args: Parameters<SqliteRepository["verifyPhoneCode"]>) =>
  callRepository("verifyPhoneCode", ...args);
export const createNotificationLog = (
  ...args: Parameters<SqliteRepository["createNotificationLog"]>
) => callRepository("createNotificationLog", ...args);
export const incrementNotificationChannelCount = (
  ...args: Parameters<SqliteRepository["incrementNotificationChannelCount"]>
) => callRepository("incrementNotificationChannelCount", ...args);
export const listNotificationLogs = (
  ...args: Parameters<SqliteRepository["listNotificationLogs"]>
) => callRepository("listNotificationLogs", ...args);
export const countNotificationAttemptsToday = (
  ...args: Parameters<SqliteRepository["countNotificationAttemptsToday"]>
) => callRepository("countNotificationAttemptsToday", ...args);
export const createProviderErrorLog = (
  ...args: Parameters<SqliteRepository["createProviderErrorLog"]>
) => callRepository("createProviderErrorLog", ...args);
export const listProviderErrorLogs = (
  ...args: Parameters<SqliteRepository["listProviderErrorLogs"]>
) => callRepository("listProviderErrorLogs", ...args);
export const countProviderErrorsSince = (
  ...args: Parameters<SqliteRepository["countProviderErrorsSince"]>
) => callRepository("countProviderErrorsSince", ...args);
export const getCachedBacktestResult = (
  ...args: Parameters<SqliteRepository["getCachedBacktestResult"]>
) => callRepository("getCachedBacktestResult", ...args);
export const upsertBacktestResult = (
  ...args: Parameters<SqliteRepository["upsertBacktestResult"]>
) => callRepository("upsertBacktestResult", ...args);
export const listReplayDatasets = (...args: Parameters<SqliteRepository["listReplayDatasets"]>) =>
  callRepository("listReplayDatasets", ...args);
export const getReplayDataset = (...args: Parameters<SqliteRepository["getReplayDataset"]>) =>
  callRepository("getReplayDataset", ...args);
export const createReplayDataset = (...args: Parameters<SqliteRepository["createReplayDataset"]>) =>
  callRepository("createReplayDataset", ...args);
export const deleteReplayDataset = (...args: Parameters<SqliteRepository["deleteReplayDataset"]>) =>
  callRepository("deleteReplayDataset", ...args);
export const updateWorkerStatus = (...args: Parameters<SqliteRepository["updateWorkerStatus"]>) =>
  callRepository("updateWorkerStatus", ...args);
export const recordWorkerTickStatus = (
  ...args: Parameters<SqliteRepository["recordWorkerTickStatus"]>
) => callRepository("recordWorkerTickStatus", ...args);
export const setWorkerLoopRunning = (
  ...args: Parameters<SqliteRepository["setWorkerLoopRunning"]>
) => callRepository("setWorkerLoopRunning", ...args);
export const getWorkerStatus = (...args: Parameters<SqliteRepository["getWorkerStatus"]>) =>
  callRepository("getWorkerStatus", ...args);
export const listSymbolLevels = (...args: Parameters<SqliteRepository["listSymbolLevels"]>) =>
  callRepository("listSymbolLevels", ...args);
export const getSymbolLevel = (...args: Parameters<SqliteRepository["getSymbolLevel"]>) =>
  callRepository("getSymbolLevel", ...args);
export const createSymbolLevel = (...args: Parameters<SqliteRepository["createSymbolLevel"]>) =>
  callRepository("createSymbolLevel", ...args);
export const updateSymbolLevel = (...args: Parameters<SqliteRepository["updateSymbolLevel"]>) =>
  callRepository("updateSymbolLevel", ...args);
export const deleteSymbolLevel = (...args: Parameters<SqliteRepository["deleteSymbolLevel"]>) =>
  callRepository("deleteSymbolLevel", ...args);
export const listWatchlist = (...args: Parameters<SqliteRepository["listWatchlist"]>) =>
  callRepository("listWatchlist", ...args);
export const addWatchlistSymbol = (...args: Parameters<SqliteRepository["addWatchlistSymbol"]>) =>
  callRepository("addWatchlistSymbol", ...args);
export const removeWatchlistSymbol = (
  ...args: Parameters<SqliteRepository["removeWatchlistSymbol"]>
) => callRepository("removeWatchlistSymbol", ...args);
