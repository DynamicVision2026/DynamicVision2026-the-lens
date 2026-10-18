// shorts.yaml (Architect-owned): top-level sections, each a list of card ids (`  - id  # comment`).
// A tiny reader for that one shape, so the Shorts need no YAML dependency.
export function readList(text) {
  const lists = {};
  let section = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const head = line.match(/^([A-Za-z_][\w-]*):\s*$/);
    if (head) lists[(section = head[1])] = [];
    else if (section && /^\s+-\s+\S/.test(line)) lists[section].push(line.replace(/^\s+-\s+/, '').trim());
  }
  return lists;
}
