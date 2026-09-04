import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NodePoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  radius: number;
  label: string;
  pulse: number;
}

interface ConstellationGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export default function ConstellationGrid({
  className,
  children,
  ...props
}: ConstellationGridProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrameId = 0;
    let width = 0;
    let height = 0;
    let nodes: NodePoint[] = [];
    let lastTime = performance.now();

    const pointer = {
      x: -1000,
      y: -1000,
      previousX: -1000,
      previousY: -1000,
      vx: 0,
      vy: 0,
      radius: 220,
    };

    const initNodes = () => {
      nodes = [];
      const spacing = 58;
      const columns = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          const x = column * spacing;
          const y = row * spacing;
          nodes.push({
            x,
            y,
            vx: 0,
            vy: 0,
            baseX: x,
            baseY: y,
            radius: Math.random() * 1 + 1,
            label: `${(column * 7).toString(16).toUpperCase()}:${(row * 11)
              .toString(16)
              .toUpperCase()}`,
            pulse: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes();
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };

    const clearPointer = () => {
      pointer.x = -1000;
      pointer.y = -1000;
      pointer.previousX = -1000;
      pointer.previousY = -1000;
      pointer.vx = 0;
      pointer.vy = 0;
    };

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      pointer.vx = (pointer.x - pointer.previousX) / (dt * 1000 || 1);
      pointer.vy = (pointer.y - pointer.previousY) / (dt * 1000 || 1);
      pointer.previousX = pointer.x;
      pointer.previousY = pointer.y;
      const speed = Math.hypot(pointer.vx, pointer.vy);

      ctx.fillStyle = "#020706";
      ctx.fillRect(0, 0, width, height);

      const spring = 18;
      const damping = 0.82;

      for (const node of nodes) {
        if (!reduceMotion) node.pulse += dt * 2.2;
        const dx = pointer.x - node.x;
        const dy = pointer.y - node.y;
        const distance = Math.hypot(dx, dy);

        // Pointer-driven movement is direct user feedback, so it remains active
        // even when ambient animation is reduced at the operating-system level.
        if (distance < pointer.radius && distance > 0) {
          const power = 1 - distance / pointer.radius;
          const force = power * (1500 + speed * 150);
          const angle = Math.atan2(dy, dx);
          node.vx -= Math.cos(angle) * force * dt;
          node.vy -= Math.sin(angle) * force * dt;
        }

        node.vx += (node.baseX - node.x) * spring * dt;
        node.vy += (node.baseY - node.y) * spring * dt;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx * dt * 60;
        node.y += node.vy * dt * 60;
      }

      const connectionDistance = 78;
      const connectionDistanceSquared = connectionDistance * connectionDistance;

      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        for (let next = index + 1; next < nodes.length; next += 1) {
          const other = nodes[next];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared < connectionDistanceSquared) {
            const alpha = (1 - Math.sqrt(distanceSquared) / connectionDistance) * 0.15;
            ctx.strokeStyle = `rgba(130, 229, 178, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }

      for (const node of nodes) {
        const distance = Math.hypot(pointer.x - node.x, pointer.y - node.y);
        const isNear = distance < pointer.radius;
        const alpha = isNear ? 0.92 : 0.24 + Math.sin(node.pulse) * 0.08;
        ctx.fillStyle = isNear ? `rgba(32, 200, 115, ${alpha})` : `rgba(210, 242, 225, ${alpha})`;
        const radius = isNear ? node.radius * 2.1 : node.radius + Math.sin(node.pulse) * 0.25;

        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fill();

        if (!reduceMotion && distance < 86) {
          const ring = ((node.pulse * 18) % 28) + 4;
          ctx.strokeStyle = `rgba(32, 200, 115, ${(1 - ring / 32) * 0.36})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ring, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = "8px ui-monospace, SFMono-Regular, Consolas, monospace";
          ctx.fillStyle = "rgba(80, 229, 150, 0.78)";
          ctx.fillText(node.label, node.x + 10, node.y - 10);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    host.addEventListener("pointermove", updatePointer);
    host.addEventListener("pointerleave", clearPointer);
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", updatePointer);
      host.removeEventListener("pointerleave", clearPointer);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn("relative h-full w-full overflow-hidden bg-[#020706]", className)}
      {...props}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_46%,transparent_0%,rgba(2,7,6,0.14)_38%,rgba(2,7,6,0.78)_100%)]"
      />
      {children ? <div className="relative z-10 h-full w-full">{children}</div> : null}
    </div>
  );
}
