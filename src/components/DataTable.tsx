import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular min-w-full text-sm">
        <thead>
          <tr className="ledger-head">
            {columns.map((col) => (
              <th key={col.key} scope="col" className={`whitespace-nowrap px-3 py-2.5 ${col.className || ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/15">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? "cursor-pointer transition-colors hover:bg-manila/15" : "transition-colors hover:bg-manila/10"}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-3 align-middle text-ink ${col.className || ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
