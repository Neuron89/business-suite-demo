import Link from 'next/link';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'amber' | 'navy' | 'green' | 'red';
  href?: string;
}

const tones: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-white dark:bg-navy-900 text-navy-800 dark:text-white',
  amber: 'bg-amber-50 dark:bg-navy-800 text-amber-800 dark:text-amber-300',
  navy: 'bg-navy-50 dark:bg-navy-800 text-navy-800 dark:text-white',
  green: 'bg-green-50 dark:bg-navy-800 text-green-700 dark:text-green-300',
  red: 'bg-red-50 dark:bg-navy-800 text-red-700 dark:text-red-300',
};

export default function StatCard({ label, value, sub, tone = 'default', href }: Props) {
  const body = (
    <>
      <div className="text-[10px] sm:text-xs uppercase tracking-wide font-medium opacity-70">
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-bold mt-1 leading-tight">{value}</div>
      {sub && <div className="text-[10px] sm:text-xs opacity-60 mt-1">{sub}</div>}
    </>
  );

  const cls = `card ${tones[tone]} ${href ? 'cursor-pointer transition hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-amber-400/40' : ''}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
