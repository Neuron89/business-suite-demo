interface Column<T> {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
  rowKey?: (row: T, i: number) => string | number;
}

export default function DataTable<T extends Record<string, any>>({
  rows,
  columns,
  empty = 'No data',
  rowKey,
}: Props<T>) {
  if (!rows.length) {
    return <div className="text-sm text-navy-500 dark:text-navy-300 py-4">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-navy-500 dark:text-navy-300 border-b border-slate-200 dark:border-navy-700">
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className={`py-2 px-3 font-medium ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={rowKey ? rowKey(r, i) : i}
              className="border-b border-slate-100 dark:border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-800"
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={`py-2 px-3 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
                >
                  {c.render ? c.render(r) : String(r[c.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
