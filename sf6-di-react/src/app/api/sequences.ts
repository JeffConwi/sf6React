// pages/api/sequences.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const filePath = path.join(process.cwd(), 'public', 'sequences.json')
  if (req.method === 'GET') {
    const json = await fs.readFile(filePath, 'utf-8')
    return res.status(200).json(JSON.parse(json))
  }
  if (req.method === 'POST') {
    // e.g. req.body = updated array
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2))
    return res.status(200).json({ status: 'ok' })
  }
  res.setHeader('Allow', ['GET','POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
