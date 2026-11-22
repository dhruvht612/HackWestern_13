import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useDependencies } from "@/hooks/useDependencies";
import { useUploadDependencies } from "@/hooks/useUploadDependencies";
import { useAssets, useCurrentScan } from "@/hooks/useScanData";
import { DataTable, type Column } from "@/components/DataTable";
import { SeverityBadge } from "@/components/SeverityBadge";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import type { Dependency } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DependenciesPage() {
  const { id: projectId = "" } = useParams();
  const deps = useDependencies(projectId);
  const upload = useUploadDependencies(projectId);
  const { scanId } = useCurrentScan();
  const hosts = (useAssets(scanId).data || []).filter((a) => a.status === "resolved").map((a) => a.hostname);
  const [deployedOn, setDeployedOn] = useState("");

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (file) upload.mutate({ file, deployedOn: deployedOn || undefined });
    },
    [upload, deployedOn],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"] },
    multiple: false,
  });

  if (deps.isLoading) return <PageSkeleton />;

  const columns: Column<Dependency>[] = [
    { key: "package", header: "Package", render: (d) => <span className="mono font-bold">{d.package_name}</span> },
    { key: "version", header: "Version", render: (d) => (d.resolved === false ? <span className="mono text-[13px] text-fg-soft" title="package.json declares a range; upload package-lock.json for exact versions">{d.version} (range, not checked)</span> : <span className="mono text-[13px]">{d.version}</span>) },
    { key: "deployed", header: "Deployed on", render: (d) => <span className="mono text-[13px] text-fg-soft">{d.deployed_on || "Not mapped"}</span> },
    { key: "ecosystem", header: "Ecosystem", render: (d) => <span className="text-fg-soft">{d.ecosystem}</span> },
    { key: "direct", header: "Direct", render: (d) => (d.direct ? "Yes" : <span className="text-fg-soft">Transitive</span>) },
    {
      key: "advisories",
      header: "Advisories",
      render: (d) => (
        <div className="flex flex-wrap items-center gap-2">
          {d.advisories.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5">
              {a.severity ? (
                <SeverityBadge severity={a.severity} className="text-[11px]" />
              ) : (
                <span className="border-[1.5px] border-dashed border-fg-faint px-1.5 text-[11px] font-bold uppercase text-fg-soft" title="OSV publishes no severity for this advisory">Unrated</span>
              )}
              <span className="mono text-[13px] text-fg-soft">{a.id}</span>
            </span>
          ))}
        </div>
      ),
    },
    { key: "fixed", header: "Fixed in", render: (d) => <span className="mono text-[13px] font-bold">{d.fixed_version || "No fix yet"}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dependencies" description="Packages from your manifest, matched against OSV advisories." />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="deployed-on" className="field-label mb-1.5 block">
            Deployed on (host)
          </label>
          <select id="deployed-on" className="field w-auto min-w-[16rem] py-2 font-mono text-[13px]" value={deployedOn} onChange={(e) => setDeployedOn(e.target.value)}>
            <option value="">Not mapped to a host</option>
            {hosts.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <p className="max-w-[46ch] pb-1 text-xs text-fg-soft">
          Mapping the manifest to the host it ships on is what ties a package advisory to an exposed asset. Hosts come from the latest scan.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center border-2 border-dashed p-8 text-center transition-colors",
          isDragActive ? "border-silver bg-silver/20" : "border-silver/35 hover:border-silver hover:bg-silver/10",
        )}
      >
        <input {...getInputProps()} />
        <Upload size={22} aria-hidden="true" />
        <div className="mt-3 font-semibold">Drop package.json or package-lock.json here</div>
        <p className="mt-1 text-sm text-fg-soft">Or click to choose a file. In demo mode the upload is simulated.</p>
        {upload.isPending ? <p className="mt-3 text-[13px] font-semibold">Reading manifest…</p> : null}
        {upload.isSuccess ? <p className="mt-3 text-[13px] font-semibold">Manifest loaded. The table below is up to date.</p> : null}
        {upload.isError ? (
          <p role="alert" className="mt-3 text-[13px] font-semibold text-severity-critical">{(upload.error as Error).message}</p>
        ) : null}
        {fileRejections.length ? (
          <p className="mt-3 text-[13px] font-semibold text-severity-critical">Only .json manifests are accepted.</p>
        ) : null}
      </div>

      <DataTable columns={columns} rows={deps.data || []} rowKey={(d) => d.id} />
    </div>
  );
}
