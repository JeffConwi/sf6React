'use client'
// pages/index.tsx
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Box, CircularProgress } from '@mui/material'

// Only import client‑side (video refs)
const Trainer = dynamic(() => import('@/components/Trainer'), { ssr: false })

interface Sequence { id: string; src: string; driveImpactTime: number|null }

export default function HomePage() {
  const [seq, setSeq] = useState<Sequence[]|null>(null)

  useEffect(() => {
    fetch('/sequences.json')
      .then(r => r.json())
      .then(setSeq)
  }, [])

  if (!seq) return <CircularProgress />

  return (
    <Box sx={{ p: 2, textAlign: 'center' }}>
      <Trainer sequences={seq} />
    </Box>
  )
}
