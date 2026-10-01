import { TYPE_COLORS, TYPE_LABELS } from "@/lib/format";

interface TypeBadgeProps {
  type: string;
  size?: "sm" | "md";
}

export function TypeBadge({ type, size = "md" }: TypeBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full font-semibold text-white shadow-sm ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
      style={{ backgroundColor: TYPE_COLORS[type] ?? "#777" }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}
