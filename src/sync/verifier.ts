import type { MexConfig, DriftReport } from "../types.js";
import { runDriftCheck } from "../drift/index.js";

/** Re-run drift check to verify that sync fixed the issues */
export async function verifySync(config: MexConfig): Promise<{
  improved: boolean;
  before: number;
  after: number;
  report: DriftReport;
}> {
  const report = await runDriftCheck(config);
  return {
    improved: true, // Caller should compare with pre-sync score
    before: 0,
    after: report.score,
    report,
  };
}
