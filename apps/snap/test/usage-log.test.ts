import { afterEach, describe, expect, it, vi } from "vitest";
import { logUsage } from "../src/reader/claude";

describe("logUsage", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("logs token counts and sizes only, as one JSON line", () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logUsage(
      { model: "claude-haiku-5-5", stop_reason: "end_turn", usage: { input_tokens: 4800, output_tokens: 900 } as never },
      "小5",
      { w: 1200, h: 1600 },
      2100,
    );
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ event: "read_usage", model: "claude-haiku-5-5", input_tokens: 4800, output_tokens: 900, cache_read_input_tokens: 0, img_w: 1200 });
    expect(Object.keys(line)).not.toContain("text");
    spy.mockRestore();
  });
});
