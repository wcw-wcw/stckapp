import { getSafeConfigDiagnostics } from "../src/lib/config/env.ts";

const diagnostics = getSafeConfigDiagnostics();

console.log(JSON.stringify(diagnostics, null, 2));

if (!diagnostics.valid) {
  process.exitCode = 1;
}
