import { register } from "node:module";

register(new URL("./ts-path-loader.mjs", import.meta.url));

const { startStandaloneWorker, runStandaloneWorkerOnce } = await import("../src/worker/signaldesk-worker.ts");
const { getRepositoryProvider } = await import("../src/lib/db/repositories.ts");
const { getPostgresPool } = await import("../src/lib/db/postgres.ts");

const once = process.argv.includes("--once");
const intervalArg = process.argv.find((arg) => arg.startsWith("--interval-ms="));
const intervalMs = intervalArg ? Number(intervalArg.split("=")[1]) : undefined;

async function closeDatabasePool() {
  if (getRepositoryProvider() === "postgres-pool") {
    await getPostgresPool().end();
  }
}

if (once) {
  try {
    await runStandaloneWorkerOnce({ intervalMs });
  } finally {
    await closeDatabasePool();
  }
} else {
  const worker = await startStandaloneWorker({ intervalMs });
  const shutdown = async (signal) => {
    console.info(`[worker] received ${signal}; shutting down`);
    await worker.stop();
    await closeDatabasePool();
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await worker.stopped;
}
