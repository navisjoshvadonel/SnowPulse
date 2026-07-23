"use client";

import React, { useEffect, useRef } from "react";

export default function SnowfallStorm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, vx: 0, vy: 0, lastX: 0, lastY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle representation
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      spin: number;
      spinSpeed: number;
    }

    const particles: Particle[] = [];
    const maxParticles = 180;

    // Initialize particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 2 + 1,
        radius: Math.random() * 2.5 + 0.8,
        alpha: Math.random() * 0.5 + 0.3,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.03,
      });
    }

    // Handle mouse move
    const handleMouseMove = (e: MouseEvent) => {
      const mouse = mouseRef.current;
      const x = e.clientX;
      const y = e.clientY;

      if (mouse.lastX !== 0) {
        mouse.vx = (x - mouse.lastX) * 0.15;
        mouse.vy = (y - mouse.lastY) * 0.15;
      }
      mouse.x = x;
      mouse.y = y;
      mouse.lastX = x;
      mouse.lastY = y;
    };

    // Handle resize
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    // Main animation loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const mouse = mouseRef.current;
      
      // Mute/decay mouse velocity
      mouse.vx *= 0.95;
      mouse.vy *= 0.95;

      particles.forEach((p) => {
        // Move according to basic velocity
        p.y += p.vy;
        p.x += p.vx;
        p.spin += p.spinSpeed;

        // Apply global mouse wind effect
        p.x += mouse.vx * 0.8;
        p.y += mouse.vy * 0.4;

        // Local interaction with cursor (storm swirl / push effect)
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 160) {
          const force = (160 - dist) / 160;
          // Calculate angle from mouse to snowflake
          const angle = Math.atan2(dy, dx);
          
          // Push away slightly & rotate (swirl)
          const pushForce = force * 2.5;
          const swirlAngle = angle + Math.PI / 2;
          
          p.x += Math.cos(angle) * pushForce + Math.cos(swirlAngle) * force * 1.5;
          p.y += Math.sin(angle) * pushForce + Math.sin(swirlAngle) * force * 1.5;
        }

        // Keep bounds
        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
          p.vy = Math.random() * 2 + 1;
          p.vx = (Math.random() - 0.5) * 1.5;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        // Render snowflake
        ctx.save();
        ctx.beginPath();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        
        // Draw crystal-like shape
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 bg-transparent" />;
}
