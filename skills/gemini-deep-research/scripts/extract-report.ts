/**
 * Extracts the final research report from a completed Gemini Interactions
 * API response.
 *
 * Response shape (per https://ai.google.dev/api/interactions-api):
 *   {
 *     "status": "completed",
 *     "steps": [
 *       { "type": "model_output",
 *         "content": [ { "type": "text", "text": "..." } ] },
 *       ...
 *     ]
 *   }
 *
 * Deep-research interactions may contain multiple `model_output` steps over
 * the run's lifetime (intermediate planning/synthesis) plus the final report.
 * We take the LAST `model_output` step's text content as the report — that's
 * what the agent emits last, and matches the original "last output is the
 * final report" intent of the previous (incorrect) `outputs[length-1]` code.
 */

export interface ContentBlock {
  type: string;
  text?: string;
}

export interface Step {
  type: string;
  content?: ContentBlock[];
}

export interface Interaction {
  id?: string;
  status?: "in_progress" | "completed" | "failed";
  steps?: Step[];
  error?: { message?: string };
}

export function extractReport(data: Interaction): string {
  const steps = data.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]!.type !== "model_output") continue;
    const blocks = steps[i]!.content ?? [];
    return blocks
      .filter((b): b is ContentBlock & { text: string } =>
        b.type === "text" && typeof b.text === "string"
      )
      .map((b) => b.text)
      .join("\n\n");
  }
  return "";
}
