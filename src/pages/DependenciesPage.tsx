import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Upload, FileJson } from "lucide-react";
import { useDependencies } from "@/hooks/useDependencies";
import { useUploadDependencies } from "@/hooks/useUploadDependencies";
import { DataTable, type Column } from "@/components/DataTable";
import { SeverityBadge } from "@/components/SeverityBadge";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import type { Dependency } from "@/lib/types";

export function DependenciesPage() {
  const { id: projectId = "" } = useParams();
  const deps = useDependencies(projectId);
  const upload = useUploadDependencies(projectId);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (file) upload.mutate(file);
  }, [upload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"] },
    multiple: false,
  });

  if (deps.isLoading) return <PageSkeleton />;

  const columns: Column<Dependency>[] = [
    { key: "package", header: "Package", render: (d) => <span className="mono text-cyan-100">{d.package_name}</span> },
    { key: "version", header: "Version", render: (d) => <span className="mono text-xs">{d.version}</span> },
    { key: "ecosystem", header: "Ecosystem", render: (d) => d.ecosystem },
    { key: "direct", header: "Direct", render: (d) => (d.direct ? "Yes" : "No") },
    { key: "advisories", header: "Advisories", render: (d) => (
      <div className="flex flex-wrap gap-1">
        {d.advisories.map((a) => <SeverityBadge key={a.id} severity={a.severity} className="text-[10px]" />)}
      </div>
    ) },
    { key: "fixed", header: "Fixed version", render: (d) => <span className="mono text-xs">{d.fixed_version || "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dependencies</h1>
        <p className="mt-1 text-sm text-slate-400">Upload a manifest to map packages to known advisories.</p>
      </div>

      <div
        {...getRootProps()}
        className={`panel flex cursor-pointer flex-col items-center justify-center border-dashed p-8 text-center transition ${isDragActive ? "border-accent bg-accent/5" : "hover:border-accent/40"}`}
      >
        <input {...getInputProps()} />
        <Upload className="text-accent" size={24} />
        <div className="mt-3 font-medium text-slate-100">Drop package.json or package-lock.json</div>
        <p className="mt-1 text-sm text-slate-400">Or click to select a file. Upload is stubbed in demo mode.</p>
        {upload.isPending ? <p className="mt-2 text-xs text-accent">Uploading...</p> : null}
        {upload.isSuccess ? <p className="mt-2 text-xs text-emerald-400">Dependency scan loaded.</p> : null}
      </div>

      <div className="panel p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-300"><FileJson size={16} className="text-accent" /> Dependencies</div>
        <DataTable columns={columns} rows={deps.data || []} rowKey={(d) => d.id} />
      </div>
    </div>
  );
}
