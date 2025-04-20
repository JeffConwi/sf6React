// src/app/api/sequences/route.ts
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'public', 'sequences.json')

export async function GET() {
  const json = await fs.readFile(DATA_FILE, 'utf-8')
  return NextResponse.json(JSON.parse(json))
}

export async function POST(request: Request) {
  const updated = await request.json()
  if (!Array.isArray(updated)) {
    return NextResponse.json({ error: 'Must send an array' }, { status: 400 })
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  return NextResponse.json({ success: true })
}
