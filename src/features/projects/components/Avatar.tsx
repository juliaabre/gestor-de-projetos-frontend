const PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-800",
];

export function initials(name: string) {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${colorFor(name)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
