import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "../src/lib/prisma";
import { enqueueInactivityEvents } from "../src/lib/automations/inactivity";
import { runWorkerBatch } from "../src/lib/automations/worker";

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
async function main() {
  let lastInactivityScan = 0;
  const once = process.argv.includes("--once");
  try {
    do {
      try {
        if (Date.now() - lastInactivityScan > 3_600_000) {
          await enqueueInactivityEvents();
          lastInactivityScan = Date.now();
        }
        const result = await runWorkerBatch();
        if (once || result.events || result.automations || result.webhooks)
          console.info("[worker] batch", result);
      } catch {
        console.error(
          "[worker] Batch failed; pending work remains in PostgreSQL.",
        );
        if (once) {
          process.exitCode = 1;
          break;
        }
      }
      if (!once && !stopping) await delay(2000);
    } while (!once && !stopping);
  } finally {
    await prisma.$disconnect();
  }
}
void main();
