import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, onboardingStatus } = body;

    if (isConvexEnabled) {
      try {
        const updatedParticipant = await convex.mutation(api.participants.update, {
          id,
          status,
          onboardingStatus,
        });
        return NextResponse.json(updatedParticipant);
      } catch (err) {
        if (err.message.includes("not found")) {
          return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        }
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const updatedStatus = status !== undefined ? status : participant.status;
    const updatedOnboardingStatus = onboardingStatus !== undefined ? onboardingStatus : participant.onboardingStatus;

    db.prepare(`
      UPDATE participants 
      SET status = ?, onboardingStatus = ?
      WHERE id = ?
    `).run(updatedStatus, updatedOnboardingStatus, id);

    const updatedParticipant = db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
    return NextResponse.json(updatedParticipant);
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
}
