import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';
import { executeAgenticAction } from '@/lib/agent.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'execute' or 'dismiss'

    if (isConvexEnabled) {
      if (action === 'execute') {
        try {
          const result = await convex.mutation(api.agent.executeAction, { id });
          if (result.success) {
            return NextResponse.json({ success: true, message: result.message });
          } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
          }
        } catch (err) {
          if (err.message.includes("not found")) {
            return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
          }
          return NextResponse.json({ error: err.message }, { status: 500 });
        }
      } else if (action === 'dismiss') {
        try {
          await convex.mutation(api.agent.dismissAction, { id });
          return NextResponse.json({ success: true, message: 'Recommendation dismissed.' });
        } catch (err) {
          if (err.message.includes("not found")) {
            return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
          }
          return NextResponse.json({ error: err.message }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Invalid action, must be "execute" or "dismiss"' }, { status: 400 });
      }
    }

    const recommendation = db.prepare('SELECT * FROM agent_audit_logs WHERE id = ?').get(id);
    if (!recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    if (action === 'execute') {
      const result = executeAgenticAction(id);
      if (result.success) {
        return NextResponse.json({ success: true, message: result.message });
      } else {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
    } else if (action === 'dismiss') {
      db.prepare('UPDATE agent_audit_logs SET status = "dismissed" WHERE id = ?').run(id);
      return NextResponse.json({ success: true, message: 'Recommendation dismissed.' });
    } else {
      return NextResponse.json({ error: 'Invalid action, must be "execute" or "dismiss"' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling agent recommendation action:', error);
    return NextResponse.json({ error: error.message || 'Failed to process action' }, { status: 500 });
  }
}
