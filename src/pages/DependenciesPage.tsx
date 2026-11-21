import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useDependencies } from "@/hooks/useDependencies";
import { useUploadDependencies } from "@/hooks/useUploadDependencies";
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

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (file) upload.mutate(file);
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"] },
    multiple: false,
  });

  if (deps.isLoading) return <PageSkeleton />;

  const columns: Column<Dependency>[] = [
    { key: "package", header: "Package", render: (d) => <span className="mono font-bold">{d.package_name}</span> },
    { key: "version", header: "Version", render: (d) => <span className="mono text-[13px]">{d.version}</span> },
    { key: "ecosystem", header: "Ecosystem", render: (d) => <span className="text-ink-soft">{d.ecosystem}</span> },
    { key: "direct", header: "Direct", render: (d) => (d.direct ? "Yes" : <span className="text-ink-soft">Transitive</span>) },
    {
      key: "advisories",
      header: "Advisories",
      render: (d) => (
        <div className="flex flex-wrap items-center gap-2">
          {d.advisories.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5">
              <SeverityBadge severity={a.severity} className="text-[11px]" />
              <span className="mono text-[13px] text-ink-soft">{a.id}</span>
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

      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center border-2 border-dashed p-8 text-center transition-colors",
          isDragActive ? "border-ink bg-manila/20" : "border-ink/35 hover:border-ink hover:bg-manila/10",
        )}
      >
        <input {...getInputProps()} />
        <Upload size={22} aria-hidden="true" />
        <div className="mt-3 font-semibold">Drop package.json or package-lock.json here</div>
        <p className="mt-1 text-sm text-ink-soft">Or click to choose a file. In demo mode the upload is simulated.</p>
        {upload.isPending ? <p className="mt-3 text-[13px] font-semibold">Reading manifest…</p> : null}
        {upload.isSuccess ? <p className="mt-3 text-[13px] font-semibold">Manifest loaded. The table below is up to date.</p> : null}
        {upload.isError ? (
          <p className="mt-3 text-[13px] font-semibold text-severity-critical">Upload failed. Check the file is valid JSON and try again.</p>
        ) : null}
        {fileRejections.length ? (
          <p className="mt-3 text-[13px] font-semibold text-severity-critical">Only .json manifests are accepted.</p>
        ) : null}
      </div>

      <DataTable columns={columns} rows={deps.data || []} rowKey={(d) => d.id} />
    </div>
  );
}
