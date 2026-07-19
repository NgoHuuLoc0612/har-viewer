'use client';

interface ColumnToggleProps {
  columns: any[];
  visibility: Record<string, boolean>;
  setVisibility: (v: Record<string, boolean>) => void;
}

export function ColumnToggle({ columns, visibility, setVisibility }: ColumnToggleProps) {
  const toggle = (id: string) => {
    setVisibility({ ...visibility, [id]: !visibility[id] });
  };

  return (
    <div className="flex flex-wrap gap-2 px-4 py-3"
      style={{ background: 'var(--color-surface-1)', borderBottom: '1px solid var(--color-border)' }}>
      {columns.map(col => {
        const id = col.id as string;
        const isVisible = visibility[id] !== false;
        return (
          <button key={id} onClick={() => toggle(id)}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: isVisible ? 'var(--color-accent-bg)' : 'var(--color-surface-3)',
              border: `1px solid ${isVisible ? 'var(--color-accent)' : 'var(--color-border)'}`,
              color: isVisible ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
            {col.header || id}
          </button>
        );
      })}
    </div>
  );
}
