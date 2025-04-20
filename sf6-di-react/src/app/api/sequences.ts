import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to get the path to public/sequences.json
const DATA_FILE = path.join(process.cwd(), 'public', 'sequences.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const json = await fs.readFile(DATA_FILE, 'utf-8');
      const data = JSON.parse(json);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const updated: any = req.body;
      // Validate: should be an array of sequences
      if (!Array.isArray(updated)) {
        return res.status(400).json({ error: 'Payload must be an array' });
      }
      await fs.writeFile(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
      return res.status(200).json({ success: true });
    }

    // Method not allowed
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err: any) {
    console.error('API /api/sequences error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
