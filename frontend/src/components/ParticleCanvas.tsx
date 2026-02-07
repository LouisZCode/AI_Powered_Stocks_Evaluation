"use client";

import { useRef, useEffect, type RefObject } from "react";
import type { Phase } from "@/lib/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

interface FeederParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  absorbed: boolean;
}

interface Props {
  phase: Phase;
  progressBarRef: RefObject<HTMLDivElement | null>;
}

export default function ParticleCanvas({ phase, progressBarRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const COUNT = 1000;
    const CONNECTION_DIST = 70;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouse);

    // Init background particles
    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.3) * 0.8,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 0.5,
      phase: Math.random() * Math.PI * 2,
    }));

    // Feeder particles (for ingesting phase)
    const feeders: FeederParticle[] = [];
    let lastSpawnTime = 0;
    const FEEDER_MAX = 25;
    const SPAWN_INTERVAL = 120; // ms

    function spawnFeeder(w: number, h: number) {
      // Pick a random edge
      const edge = Math.floor(Math.random() * 4);
      let x: number, y: number;
      switch (edge) {
        case 0: x = Math.random() * w; y = -5; break;       // top
        case 1: x = Math.random() * w; y = h + 5; break;    // bottom
        case 2: x = -5; y = Math.random() * h; break;       // left
        default: x = w + 5; y = Math.random() * h; break;   // right
      }

      // Initial velocity pointing inward toward center
      const cx = w / 2;
      const cy = h / 2;
      const angle = Math.atan2(cy - y, cx - x);
      const speed = 1.5 + Math.random() * 1.5;

      feeders.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 2,
        opacity: 0.7 + Math.random() * 0.3,
        life: 0,
        absorbed: false,
      });
    }

    let prevTime = performance.now();

    const draw = (now: number) => {
      const dt = (now - prevTime) / 1000;
      prevTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const currentPhase = phaseRef.current;
      const isAnalyzing = currentPhase === "analyzing";
      const isIngesting = currentPhase === "ingesting";
      const speed = isAnalyzing ? 3 : 1;
      const mouse = mouseRef.current;

      // --- Background particles ---
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += 0.01;
        p.x += p.vx * speed;
        p.y += p.vy * speed + Math.sin(p.phase) * 0.3;

        // Mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && dist > 0) {
          p.x += (dx / dist) * 2;
          p.y += (dy / dist) * 2;
        }

        // Wrap around
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.y > canvas.height + 10) p.y = -10;
        if (p.y < -10) p.y = canvas.height + 10;

        // Draw trail
        const gradient = ctx.createLinearGradient(
          p.x - p.vx * 8, p.y, p.x, p.y
        );
        const color = isAnalyzing
          ? `rgba(251, 191, 36, ${0.6 * (p.size / 2.5)})`
          : `rgba(125, 211, 252, ${0.6 * (p.size / 2.5)})`;
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, color);
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 8, p.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = p.size;
        ctx.stroke();

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Connections
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const cdx = p.x - q.x;
          const cdy = p.y - q.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < CONNECTION_DIST) {
            const alpha = (1 - cdist / CONNECTION_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = isAnalyzing
              ? `rgba(251, 191, 36, ${alpha})`
              : `rgba(125, 211, 252, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // --- Feeder particles (ingesting phase) ---
      // Spawn new feeders
      if (isIngesting && progressBarRef.current && feeders.length < FEEDER_MAX) {
        if (now - lastSpawnTime > SPAWN_INTERVAL) {
          spawnFeeder(canvas.width, canvas.height);
          lastSpawnTime = now;
        }
      }

      // Get bar position for attraction target
      let barCx = canvas.width / 2;
      let barCy = canvas.height / 2;
      if (progressBarRef.current) {
        const rect = progressBarRef.current.getBoundingClientRect();
        barCx = rect.left + rect.width / 2;
        barCy = rect.top + rect.height / 2;
      }

      // Update and draw feeders
      for (let i = feeders.length - 1; i >= 0; i--) {
        const f = feeders[i];
        f.life += dt;

        // Attract toward progress bar
        const dx = barCx - f.x;
        const dy = barCy - f.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          // Attraction force strengthens as distance decreases
          const force = 150 / (dist + 50);
          f.vx += (dx / dist) * force * dt * 60;
          f.vy += (dy / dist) * force * dt * 60;
        }

        // Damping
        f.vx *= 0.98;
        f.vy *= 0.98;

        f.x += f.vx;
        f.y += f.vy;

        // Absorb when close to bar
        if (dist < 15) {
          f.absorbed = true;
        }

        // Remove absorbed or expired
        if (f.absorbed || f.life > 8) {
          feeders.splice(i, 1);
          continue;
        }

        // Draw feeder: glow circle → core → velocity trail
        // Glow
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 230, 253, ${0.3 * f.opacity})`;
        ctx.fill();

        // Velocity trail
        const trailLen = 12;
        const trailGrad = ctx.createLinearGradient(
          f.x - (f.vx / (Math.abs(f.vx) + 0.1)) * trailLen,
          f.y - (f.vy / (Math.abs(f.vy) + 0.1)) * trailLen,
          f.x, f.y
        );
        trailGrad.addColorStop(0, "transparent");
        trailGrad.addColorStop(1, `rgba(186, 230, 253, ${0.5 * f.opacity})`);
        ctx.beginPath();
        ctx.moveTo(
          f.x - (f.vx / (Math.abs(f.vx) + 0.1)) * trailLen,
          f.y - (f.vy / (Math.abs(f.vy) + 0.1)) * trailLen
        );
        ctx.lineTo(f.x, f.y);
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = f.size;
        ctx.stroke();

        // Core
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 230, 253, ${f.opacity})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, [progressBarRef]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ pointerEvents: "auto" }}
    />
  );
}
