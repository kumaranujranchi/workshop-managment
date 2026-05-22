import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import { runAgenticReasoning } from '@/lib/agent.js';
import db from '@/lib/db.js';

export async function POST() {
  try {
    if (isConvexEnabled) {
      const recommendations = await convex.mutation(api.agent.runReasoning);
      return NextResponse.json({ success: true, recommendations });
    }

    runAgenticReasoning();
    
    // Fetch updated recommendations list
    const logs = db.prepare(`
      SELECT l.*, w.title as workshopTitle 
      FROM agent_audit_logs l
      LEFT JOIN workshops w ON l.targetId = w.id AND l.targetType = 'workshop'
      ORDER BY l.createdAt DESC
    `).all();

    return NextResponse.json({ success: true, recommendations: logs });
  } catch (error) {
    console.error('Error running agent reasoning loop:', error);
    return NextResponse.json({ error: 'Failed to run agent reasoning loop' }, { status: 500 });
  }
}

