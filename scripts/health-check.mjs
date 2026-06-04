const baseUrl = process.env.SIGNALDESK_BASE_URL ?? process.env.HEALTH_BASE_URL ?? process.argv[2];

if (!baseUrl) {
  console.error("Set SIGNALDESK_BASE_URL or pass a base URL to check /api/health.");
  process.exit(1);
}

try {
  const body = await getJson(`${baseUrl.replace(/\/$/, "")}/api/health`);
  console.log(JSON.stringify({
    status: body.status,
    service: body.service,
    timestamp: body.timestamp,
    version: body.version,
    database: body.database,
    marketData: body.marketData,
    warnings: body.warnings,
  }, null, 2));
  if (body.status !== "ok") process.exitCode = 1;
} catch (error) {
  console.error(`[health] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
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
          reject(new Error(`HTTP ${res.statusCode ?? "unknown"}`));
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
