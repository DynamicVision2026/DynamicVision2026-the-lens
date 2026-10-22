import { LANG, LANGS, LANG_LABEL, setLang, type Lang } from "../lib/lang";

/** 日本語 / English / 简体中文 / 繁體中文 — a native select (works well on phones); changing it reloads. */
export function LangSwitch({ className = "" }: { className?: string }) {
  return (
    <label className={`lang-switch ${className}`}>
      <span aria-hidden="true">🌐</span>
      <select aria-label="Language / 言語 / 语言" value={LANG} onChange={(e) => setLang(e.target.value as Lang)} data-testid="lang-switch">
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_LABEL[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
