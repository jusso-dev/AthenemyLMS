// Test-only identity substitution in a disposable COPY. Production source never imports it.
import {
  cp,
  mkdtemp,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
const url = new URL(process.env.DATABASE_URL ?? "invalid:");
if (
  !url.pathname.endsWith("_verify") ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !process.env.WORKFLOW_RUN_ID
)
  throw new Error(
    "Workflow tests require a local disposable _verify database and run ID",
  );
const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), "athenemy-workflow-"));
let child;
let cleaning = false;
async function cleanup(code = 0) {
  if (cleaning) return;
  cleaning = true;
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((r) => child.once("exit", r)),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await rm(directory, { recursive: true, force: true });
  process.exit(code);
}
process.on("SIGTERM", () => void cleanup());
process.on("SIGINT", () => void cleanup());
try {
  for (const name of [
    "src",
    "public",
    "next.config.ts",
    "tsconfig.json",
    "package.json",
    "postcss.config.mjs",
  ])
    await cp(join(root, name), join(directory, name), { recursive: true });
  await symlink(
    join(root, "node_modules"),
    join(directory, "node_modules"),
    "dir",
  );
  let auth = await readFile(join(directory, "src/lib/auth.ts"), "utf8");
  auth = auth.slice(
    auth.indexOf("import"),
    auth.indexOf("export function isClerkConfigured"),
  );
  auth = auth.replace(
    'import { auth, currentUser } from "@clerk/nextjs/server";',
    'import { cookies } from "next/headers";',
  );
  auth += `
export function isClerkConfigured() { return false; }
export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const id = (await cookies()).get("workflow-user")?.value;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, include: appUserInclude });
  if (!user || !user.clerkId.startsWith("workflow-" + process.env.WORKFLOW_RUN_ID + "-")) return null;
  return { ...user, organizationMembershipCount: user._count.organizationMemberships } as AppUser;
});
export async function requireAppUser() { const user = await getCurrentAppUser(); if (!user) throw new Error("Authentication required"); return user; }
`;
  await writeFile(join(directory, "src/lib/auth.ts"), auth);
  await writeFile(
    join(directory, "src/proxy.ts"),
    'import { NextResponse } from "next/server"; export function proxy() { return NextResponse.next(); }',
  );
  const env = Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "SystemRoot"]
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
  Object.assign(env, {
    DATABASE_URL: url.href,
    DIRECT_URL: url.href,
    WORKFLOW_RUN_ID: process.env.WORKFLOW_RUN_ID,
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3101",
    EMAIL_PROVIDER: "stub",
    SCORM_STORAGE_DIR: join(directory, ".private/scorm"),
    NEXT_TELEMETRY_DISABLED: "1",
  });
  child = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    { cwd: directory, env, stdio: "inherit" },
  );
  child.once("exit", (code) => void cleanup(code ?? 1));
} catch (error) {
  console.error(error);
  await cleanup(1);
}
