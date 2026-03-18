import "dotenv/config";

import { ensurePerformanceIndexes } from "../src/lib/db";

async function main() {
  await ensurePerformanceIndexes();
  console.log("Indices de performance aplicados.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
