export type AppVersion = {
  packageVersion: string;
  commitSha: string | null;
  buildTime: string | null;
};

export function getAppVersion(): AppVersion {
  return {
    packageVersion: "0.1.0",
    commitSha:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GIT_COMMIT_SHA ??
      process.env.RENDER_GIT_COMMIT ??
      null,
    buildTime: process.env.BUILD_TIME ?? process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
  };
}
