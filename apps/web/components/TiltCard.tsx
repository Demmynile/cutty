'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'

/** Leans toward the pointer in 3D, with a soft glare that follows it. */
export function TiltCard({ children, className = '', max = 10 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 20 })
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 20 })
  const gx = useTransform(px, (v) => `${v * 100}%`)
  const gy = useTransform(py, (v) => `${v * 100}%`)
  const glare = useMotionTemplate`radial-gradient(500px circle at ${gx} ${gy}, rgba(255,255,255,0.55), transparent 45%)`
  const glareOpacity = useMotionValue(0)

  return (
    <div style={{ perspective: 1000 }} className={className}>
      <motion.div
        ref={ref}
        style={{ rotateX, rotateY }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return
          const r = ref.current!.getBoundingClientRect()
          px.set((e.clientX - r.left) / r.width)
          py.set((e.clientY - r.top) / r.height)
          glareOpacity.set(1)
        }}
        onPointerLeave={() => {
          px.set(0.5)
          py.set(0.5)
          glareOpacity.set(0)
        }}
        className="preserve-3d relative h-full"
      >
        {children}
        <motion.div
          style={{ background: glare, opacity: glareOpacity }}
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light transition-opacity duration-300"
        />
      </motion.div>
    </div>
  )
}
