import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (isConvexEnabled) {
      const logs = await convex.query(api.agent.listRecommendations);
      return NextResponse.json(logs);
    }

    // Fetch logs and join with workshop info if possible
    const logs = db.prepare(`
      SELECT l.*, w.title as workshopTitle 
      FROM agent_audit_logs l
      LEFT JOIN workshops w ON l.targetId = w.id AND l.targetType = 'workshop'
      ORDER BY l.createdAt DESC
    `).all();

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching agent logs:', error);
    return NextResponse.json({ error: 'Failed to fetch agent logs' }, { status: 500 });
  }
}
