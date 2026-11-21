import projects from "../../shared/fixtures/projects.json";
import project from "../../shared/fixtures/project.json";
import scanCreated from "../../shared/fixtures/scan_created.json";
import scan from "../../shared/fixtures/scan.json";
import assets from "../../shared/fixtures/assets.json";
import findings from "../../shared/fixtures/findings.json";
import dependencies from "../../shared/fixtures/dependencies.json";
import graph from "../../shared/fixtures/graph.json";
import analysis from "../../shared/fixtures/analysis.json";
import report from "../../shared/fixtures/report.md?raw";
import health from "../../shared/fixtures/health.json";

export const fixtures = {
  projects,
  project,
  scanCreated,
  scan,
  assets,
  findings,
  dependencies,
  graph,
  analysis,
  report,
  health,
} as const;
