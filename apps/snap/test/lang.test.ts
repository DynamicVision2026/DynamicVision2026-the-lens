import { describe, expect, it } from "vitest";
import { gradeLabel } from "../src/curriculum";
import { langFromTag } from "../src/lib/lang";

describe("display language", () => {
  it("maps browser tags to our four languages", () => {
    expect(langFromTag("ja-JP")).toBe("ja");
    expect(langFromTag("en-US")).toBe("en");
    expect(langFromTag("zh-CN")).toBe("zh-Hans");
    expect(langFromTag("zh-Hans-SG")).toBe("zh-Hans");
    expect(langFromTag("zh-TW")).toBe("zh-Hant");
    expect(langFromTag("zh-HK")).toBe("zh-Hant");
    expect(langFromTag("zh-Hant")).toBe("zh-Hant");
    expect(langFromTag("ko-KR")).toBeNull();
    expect(langFromTag(null)).toBeNull();
  });
  it("tests run in Japanese, so grade labels stay as saved", () => {
    expect(gradeLabel("小5")).toBe("小5");
  });
});
