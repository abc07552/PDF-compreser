import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
export function Glyph({
  icon: Icon,
  tone = 'cyan',
  size = 18,
}: {
  icon: LucideIcon;
  tone?: string;
  size?: number;
}) {
  return (
    <span className={`v-glyph tone-${tone}`}>
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
}
export function Head({
  icon: Icon,
  title,
  tone = 'cyan',
  end,
}: {
  icon: LucideIcon;
  title: string;
  tone?: string;
  end?: ReactNode;
}) {
  return (
    <header className="v-head">
      <h2>
        <Icon className={'ink-' + tone} size={17} strokeWidth={1.8} />
        {title}
      </h2>
      {end}
    </header>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={'v-icon ' + (active ? 'on' : '')}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={16} />
    </button>
  );
}
export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={'v-switch ' + (on ? 'on' : '')}
    >
      <i />
    </button>
  );
}
export function Count({ n }: { n: number }) {
  return <span className="v-count">{n.toString().padStart(2, '0')}</span>;
}
