import { execSync } from "child_process";
import type { NextConfig } from "next";

function getGitSha(): string {
  // Docker builds pass GIT_SHA as a build arg (.git is not in the image);
  // Railway and Vercel provide the SHA as env vars
  const envSha =
    process.env.GIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (envSha) return envSha.slice(0, 7);

  // Fallback: read it from git directly (works during build on Railway)
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: getGitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
