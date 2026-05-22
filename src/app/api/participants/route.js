import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export const dynamic = 'force-dynamic';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workshopId = searchParams.get('workshopId');

    if (isConvexEnabled) {
      const participants = await convex.query(api.participants.list, {
        workshopId: workshopId || undefined,
      });
      return NextResponse.json(participants);
    }

    let participants;
    if (workshopId) {
      participants = db.prepare('SELECT * FROM participants WHERE workshopId = ? ORDER BY createdAt DESC').all(workshopId);
    } else {
      participants = db.prepare('SELECT * FROM participants ORDER BY createdAt DESC').all();
    }

    return NextResponse.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, workshopId } = body;

    if (!name || !email || !workshopId) {
      return NextResponse.json({ error: 'Name, email, and workshopId are required' }, { status: 400 });
    }

    if (isConvexEnabled) {
      const workshop = await convex.query(api.workshops.get, { id: workshopId });
      if (!workshop) {
        return NextResponse.json({ error: 'Workshop not found' }, { status: 444 });
      }
      if (workshop.status !== 'published') {
        return NextResponse.json({ error: 'Workshop is not open for registration' }, { status: 400 });
      }

      const newParticipant = await convex.mutation(api.participants.create, {
        name,
        email,
        workshopId,
      });
      return NextResponse.json(newParticipant, { status: 201 });
    }

    // Check if workshop is open for registration
    const workshop = db.prepare('SELECT * FROM workshops WHERE id = ?').get(workshopId);
    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 444 });
    }
    if (workshop.status !== 'published') {
      return NextResponse.json({ error: 'Workshop is not open for registration' }, { status: 400 });
    }

    const id = generateId();
    // Default values
    const status = 'registered';
    const onboardingStatus = 'pending';

    db.prepare(`
      INSERT INTO participants (id, name, email, workshopId, status, onboardingStatus)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, email, workshopId, status, onboardingStatus);

    const newParticipant = db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
    return NextResponse.json(newParticipant, { status: 201 });
  } catch (error) {
    console.error('Error creating participant:', error);
    return NextResponse.json({ error: 'Failed to register participant' }, { status: 500 });
  }
}
