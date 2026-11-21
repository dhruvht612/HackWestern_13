// Just enough Markdown for the scan report: headings, **Key:** field rows, paragraphs, numbered lists, pipe tables.
// ponytail: no links, bullets, or code spans; add them here (or pull in a parser) if the report grows them.

export type Block =
  | { kind: "h1" | "h2"; text: string }
  | { kind: "fields"; rows: [string, string][] }
  | { kind: "p"; text: string }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const FIELD = /^\*\*([^*]+?):\*\*\s*(.*)$/;
const NUMBERED = /^\d+\.\s/;
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd());
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (/^#\s/.test(line)) {
      blocks.push({ kind: "h1", text: line.replace(/^#\s+/, "") });
      i++;
    } else if (/^#{2,6}\s/.test(line)) {
      blocks.push({ kind: "h2", text: line.replace(/^#{2,6}\s+/, "") });
      i++;
    } else if (line.trimStart().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) rows.push(cells(lines[i++]));
      const [head, ...rest] = rows;
      blocks.push({ kind: "table", head, rows: rest.filter((r) => !r.every((c) => /^:?-+:?$/.test(c))) });
    } else if (NUMBERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBERED.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, "").trim());
      blocks.push({ kind: "ol", items });
    } else if (FIELD.test(line)) {
      const rows: [string, string][] = [];
      for (let m = lines[i]?.match(FIELD); m; m = lines[i]?.match(FIELD)) {
        rows.push([m[1], m[2].trim()]);
        i++;
      }
      blocks.push({ kind: "fields", rows });
    } else {
      const para = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#|\s*\||\d+\.\s|\*\*[^*]+?:\*\*)/.test(lines[i])) para.push(lines[i++].trim());
      blocks.push({ kind: "p", text: para.join(" ") });
    }
  }
  return blocks;
}

/** Split **bold** runs so the renderer can wrap them; odd indexes are bold. */
export const splitBold = (text: string) => text.split(/\*\*([^*]+)\*\*/);
