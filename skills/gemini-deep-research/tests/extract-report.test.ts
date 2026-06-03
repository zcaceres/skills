import { describe, test, expect } from "bun:test";
import { extractReport, type Interaction } from "../scripts/extract-report.ts";

describe("extractReport — Gemini Interactions API response shape", () => {
  test("reads text from steps[].content[].text (single model_output step)", () => {
    const data: Interaction = {
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: "Hello! I'm doing well..." }],
        },
      ],
    };
    expect(extractReport(data)).toBe("Hello! I'm doing well...");
  });

  test("concatenates multiple text blocks within a model_output step", () => {
    const data: Interaction = {
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [
            { type: "text", text: "First chunk." },
            { type: "text", text: "Second chunk." },
          ],
        },
      ],
    };
    expect(extractReport(data)).toBe("First chunk.\n\nSecond chunk.");
  });

  test("returns the LAST model_output step's content when multiple exist", () => {
    const data: Interaction = {
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: "Intermediate planning output" }],
        },
        {
          type: "model_output",
          content: [{ type: "text", text: "Final research report" }],
        },
      ],
    };
    expect(extractReport(data)).toBe("Final research report");
  });

  test("ignores non-model_output steps (e.g., tool calls, thinking)", () => {
    const data: Interaction = {
      status: "completed",
      steps: [
        { type: "tool_call", content: [{ type: "text", text: "search query" }] },
        {
          type: "model_output",
          content: [{ type: "text", text: "the actual report" }],
        },
      ],
    };
    expect(extractReport(data)).toBe("the actual report");
  });

  test("ignores non-text content blocks within a model_output step", () => {
    const data: Interaction = {
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [
            { type: "citation" },
            { type: "text", text: "body text" },
            { type: "image" },
          ],
        },
      ],
    };
    expect(extractReport(data)).toBe("body text");
  });

  test("returns empty string when no model_output step exists", () => {
    const data: Interaction = {
      status: "completed",
      steps: [
        { type: "tool_call", content: [{ type: "text", text: "search" }] },
      ],
    };
    expect(extractReport(data)).toBe("");
  });

  test("returns empty string when steps is missing", () => {
    const data: Interaction = { status: "completed" };
    expect(extractReport(data)).toBe("");
  });

  test("returns empty string when steps is empty", () => {
    const data: Interaction = { status: "completed", steps: [] };
    expect(extractReport(data)).toBe("");
  });

  test("handles model_output step with no content array", () => {
    const data: Interaction = {
      status: "completed",
      steps: [{ type: "model_output" }],
    };
    expect(extractReport(data)).toBe("");
  });

  test("does NOT read from a legacy `outputs` field (regression for bug)", () => {
    // The previous implementation read from data.outputs[length-1].text,
    // which doesn't exist on the actual API response. If someone re-adds
    // that path, this test catches it: an `outputs`-only response should
    // produce "", not a populated report.
    const data = {
      status: "completed",
      outputs: [{ text: "this field doesn't exist on real API" }],
    } as unknown as Interaction;
    expect(extractReport(data)).toBe("");
  });
});
