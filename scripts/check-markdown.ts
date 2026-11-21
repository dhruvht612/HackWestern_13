// Self-check for the report Markdown parser. Run: node --experimental-strip-types scripts/check-markdown.ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseMarkdown, splitBold } from "../src/lib/markdownBlocks.ts";

const blocks = parseMarkdown(readFileSync(new URL("../shared/fixtures/report.md", import.meta.url), "utf8"));
const of = <K extends string>(kind: K) => blocks.filter((b) => b.kind === kind) as Extract<(typeof blocks)[number], { kind: K }>[];

assert.equal(blocks[0].kind, "h1");
assert.deepEqual(of("fields")[0].rows.map(([k]) => k), ["Project", "Scan", "Completed", "Status"]);
assert.equal(of("ol")[0].items.length, 3);
const [assets] = of("table");
assert.equal(assets.head[0], "Hostname");
assert.equal(assets.rows.length, 5, "separator row dropped, five hosts kept");
assert.ok(of("h2").length >= 4);
assert.ok(blocks.every((b) => !("text" in b) || !b.text.startsWith("#")), "no raw heading markers leak into text");
assert.deepEqual(splitBold("a **b** c"), ["a ", "b", " c"]);
// Unknown syntax must not hang the parser.
assert.deepEqual(parseMarkdown("####### odd\n- bullet"), [{ kind: "p", text: "####### odd - bullet" }]);

console.log(`ok: ${blocks.length} blocks`);
