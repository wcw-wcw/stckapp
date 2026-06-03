import { z } from "zod";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalSecret = z.preprocess(blankToUndefined, z.string().optional());

const booleanFlag = (name: string, defaultValue: "true" | "false") =>
  z
    .enum(["true", "false"], {
      invalid_type_error: `${name} must be either "true" or "false".`,
      required_error: `${name} is required.`,
    })
    .default(defaultValue)
    .transform((value) => value === "true");

const envSchema = z
  .object({
    MARKET_DATA_PROVIDER: z
      .enum(["mock", "alpaca"], {
        errorMap: () => ({
          message: 'MARKET_DATA_PROVIDER must be "mock" or "alpaca".',
        }),
      })
      .default("mock"),
    ENABLE_REAL_NOTIFICATIONS: booleanFlag("ENABLE_REAL_NOTIFICATIONS", "false"),
    GLOBAL_DAILY_NOTIFICATION_LIMIT: z.coerce
      .number({
        invalid_type_error: "GLOBAL_DAILY_NOTIFICATION_LIMIT must be a non-negative integer.",
      })
      .int("GLOBAL_DAILY_NOTIFICATION_LIMIT must be a non-negative integer.")
      .min(0, "GLOBAL_DAILY_NOTIFICATION_LIMIT must be a non-negative integer.")
      .default(100),
    ALPACA_API_KEY_ID: optionalSecret,
    ALPACA_API_SECRET_KEY: optionalSecret,
    ALPACA_DATA_FEED: z.preprocess(blankToUndefined, z.string().default("iex")),
    DATABASE_PROVIDER: z
      .enum(["sqlite", "postgres"], {
        errorMap: () => ({
          message: 'DATABASE_PROVIDER must be "sqlite" or "postgres".',
        }),
      })
      .default("sqlite"),
    DATABASE_URL: optionalSecret,
  })
  .passthrough()
  .superRefine((env, context) => {
    if (env.DATABASE_PROVIDER === "postgres" && !env.DATABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when DATABASE_PROVIDER=postgres.",
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;
export type DatabaseProvider = ServerEnv["DATABASE_PROVIDER"];
export type RawServerEnv = Record<string, string | undefined>;

export type SafeConfigDiagnostics = {
  valid: boolean;
  errors: string[];
  marketDataProvider: ServerEnv["MARKET_DATA_PROVIDER"] | "invalid";
  realNotificationsEnabled: boolean;
  globalDailyNotificationLimit: number | null;
  alpacaCredentialsPresent: boolean;
  alpacaKeyPresent: boolean;
  alpacaSecretPresent: boolean;
  discordRealNotificationSafety: "mocked" | "real-enabled" | "invalid";
  databaseProvider: DatabaseProvider | "invalid";
  databaseUrlPresent: boolean;
  postgresConfigComplete: boolean;
};

function formatConfigErrors(error: z.ZodError) {
  return error.issues.map((issue) => issue.message);
}

export function loadServerEnv(env: RawServerEnv = process.env): ServerEnv {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid SignalDesk server configuration: ${formatConfigErrors(result.error).join(" ")}`);
  }
  return result.data;
}

export function safeLoadServerEnv(env: RawServerEnv = process.env) {
  return envSchema.safeParse(env);
}

export function getSafeConfigDiagnostics(
  env: RawServerEnv = process.env,
): SafeConfigDiagnostics {
  const result = safeLoadServerEnv(env);
  const rawDatabaseProvider = env.DATABASE_PROVIDER?.toLowerCase();
  const rawMarketProvider = env.MARKET_DATA_PROVIDER?.toLowerCase();
  const databaseUrlPresent = Boolean(env.DATABASE_URL);
  const alpacaKeyPresent = Boolean(env.ALPACA_API_KEY_ID);
  const alpacaSecretPresent = Boolean(env.ALPACA_API_SECRET_KEY);

  if (!result.success) {
    return {
      valid: false,
      errors: formatConfigErrors(result.error),
      marketDataProvider:
        rawMarketProvider === "mock" || rawMarketProvider === "alpaca" ? rawMarketProvider : "invalid",
      realNotificationsEnabled: env.ENABLE_REAL_NOTIFICATIONS === "true",
      globalDailyNotificationLimit: null,
      alpacaCredentialsPresent: alpacaKeyPresent && alpacaSecretPresent,
      alpacaKeyPresent,
      alpacaSecretPresent,
      discordRealNotificationSafety:
        env.ENABLE_REAL_NOTIFICATIONS === "true"
          ? "real-enabled"
          : env.ENABLE_REAL_NOTIFICATIONS === "false" || env.ENABLE_REAL_NOTIFICATIONS === undefined
            ? "mocked"
            : "invalid",
      databaseProvider:
        rawDatabaseProvider === "sqlite" || rawDatabaseProvider === "postgres"
          ? rawDatabaseProvider
          : "invalid",
      databaseUrlPresent,
      postgresConfigComplete: rawDatabaseProvider === "postgres" && databaseUrlPresent,
    };
  }

  return {
    valid: true,
    errors: [],
    marketDataProvider: result.data.MARKET_DATA_PROVIDER,
    realNotificationsEnabled: result.data.ENABLE_REAL_NOTIFICATIONS,
    globalDailyNotificationLimit: result.data.GLOBAL_DAILY_NOTIFICATION_LIMIT,
    alpacaCredentialsPresent: Boolean(result.data.ALPACA_API_KEY_ID && result.data.ALPACA_API_SECRET_KEY),
    alpacaKeyPresent: Boolean(result.data.ALPACA_API_KEY_ID),
    alpacaSecretPresent: Boolean(result.data.ALPACA_API_SECRET_KEY),
    discordRealNotificationSafety: result.data.ENABLE_REAL_NOTIFICATIONS ? "real-enabled" : "mocked",
    databaseProvider: result.data.DATABASE_PROVIDER,
    databaseUrlPresent: Boolean(result.data.DATABASE_URL),
    postgresConfigComplete: result.data.DATABASE_PROVIDER === "postgres" && Boolean(result.data.DATABASE_URL),
  };
}
