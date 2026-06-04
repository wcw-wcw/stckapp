import { spawnSync } from "node:child_process";

const baseUrl = process.env.SIGNALDESK_BASE_URL ?? process.env.HEALTH_BASE_URL;

function run(label, command, args) {
  console.log(`[smoke] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

async function checkHealth(url) {
  console.log(`[smoke] health ${url}`);
  const body = await getJson(`${url.replace(/\/$/, "")}/api/health`);
  console.log(JSON.stringify({
    status: body.status,
    service: body.service,
    timestamp: body.timestamp,
    database: body.database,
    marketData: body.marketData,
    warnings: body.warnings,
  }, null, 2));
}

async function getJson(url) {
  const { request } = await import(url.startsWith("https:") ? "node:https" : "node:http");
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", timeout: 10_000 }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Health check failed with HTTP ${res.statusCode ?? "unknown"}.`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("request timed out"));
    });
    req.end();
  });
}

try {
  run("config", "npm", ["run", "config:check"]);
  run("database status", "npm", ["run", "db:status"]);
  run("schema parity", "npm", ["run", "db:schema:check"]);
  run("worker status", "npm", ["run", "worker:status"]);
  if (baseUrl) await checkHealth(baseUrl);
  console.log("[smoke] ok");
} catch (error) {
  console.error(`[smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
