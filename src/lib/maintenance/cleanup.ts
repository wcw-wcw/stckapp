import { runCleanup } from "@/lib/db/repositories";

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

export const defaultCleanupRetention: CleanupRetention = {
  providerErrorLogDays: 14,
  notificationLogDays: 30,
  backtestResultDays: 14,
  phoneVerificationHours: 24,
};

export async function runLocalCleanup(
  now = new Date(),
  retention: CleanupRetention = defaultCleanupRetention,
): Promise<CleanupResult> {
  return runCleanup(now, retention);
}
