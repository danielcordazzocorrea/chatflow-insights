import { useState, type MouseEvent, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Cursor-following surface adapted from the supplied 21st.dev bento reference. */
export default function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };
  return (
    <div
      onMouseMove={onMouseMove}
      className={cn("spotlight-card", className)}
      style={{ "--spot-x": `${position.x}px`, "--spot-y": `${position.y}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
