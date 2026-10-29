import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  lines?: 2 | 3;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
  /** Prefer for long APU / material names */
  apu?: boolean;
};

/** Progressive disclosure for long copy: line-clamp + «Ver más / Ver menos». */
export function ExpandableText({
  children,
  lines = 2,
  className,
  moreLabel = "Ver más",
  lessLabel = "Ver menos",
  apu = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const clamp = lines === 3 ? "line-clamp-3" : "line-clamp-2";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      // When open, keep the toggle; when closed, compare scroll vs client height
      if (open) {
        setNeedsToggle(true);
        return;
      }
      setNeedsToggle(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [children, open, lines]);

  return (
    <div className={cn("min-w-0", className)}>
      <div
        ref={ref}
        className={cn(apu && "text-apu", !open && clamp, open && "break-words")}
      >
        {children}
      </div>
      {(needsToggle || open) && (
        <button
          type="button"
          className="mt-1 bg-transparent border-0 p-0 text-[12.5px] font-semibold text-[var(--micaa-accent)] hover:underline"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  );
}

export default ExpandableText;
