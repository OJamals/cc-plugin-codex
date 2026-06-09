import test from "node:test";
import assert from "node:assert/strict";

import { renderReviewResult } from "./render.mjs";

test("renderReviewResult accepts legacy adversarial status/body-detail shape", () => {
  const rendered = renderReviewResult(
    {
      parsed: {
        status: "needs-attention",
        summary: "No-ship until fixed.",
        findings: [
          {
            severity: "high",
            title: "Unit-only PATCH leaves stale BMI",
            file: "backend/src/modules/clinical/vitals/vitals.service.ts",
            line_start: 271,
            line_end: 299,
            confidence: 0.7,
            what_can_go_wrong: "BMI remains stale.",
            why_vulnerable: "Unit fields did not trigger recompute.",
            impact: "CDS sees wrong BMI.",
            recommendation: "Recompute when units change."
          }
        ]
      },
      rawOutput: ""
    },
    { reviewLabel: "Adversarial Review", targetLabel: "staged diff" }
  );

  assert.match(rendered, /Verdict: needs-attention/);
  assert.match(rendered, /Unit-only PATCH leaves stale BMI/);
  assert.match(rendered, /What can go wrong: BMI remains stale/);
});

