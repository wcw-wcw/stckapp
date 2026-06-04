import { pathToFileURL } from "node:url";
import { dirname, extname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolvePath("src", specifier.slice(2));
    const resolved = existsSync(target) || extname(target) ? target : `${target}.ts`;
    return nextResolve(pathToFileURL(resolved).href, context);
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    const resolved = existsSync(target) || extname(target) ? target : `${target}.ts`;
    if (existsSync(resolved)) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}
