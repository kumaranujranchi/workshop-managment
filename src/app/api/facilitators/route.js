import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export const dynamic = 'force-dynamic';

function generateFacilitatorId() {
  return 'f_' + Math.random().toString(36).substring(2, 7);
}

export async function GET() {
  try {
    if (isConvexEnabled) {
      let facilitators = await convex.query(api.facilitators.list);
      if (facilitators.length === 0) {
        try {
          await convex.mutation(api.facilitators.seed);
          facilitators = await convex.query(api.facilitators.list);
        } catch (seedErr) {
          console.error('Error seeding Convex facilitators:', seedErr);
        }
      }
      return NextResponse.json(facilitators);
    }
    const facilitators = db.prepare('SELECT * FROM facilitators').all();
    return NextResponse.json(facilitators);
  } catch (error) {
    console.error('Error fetching facilitators:', error);
    return NextResponse.json({ error: 'Failed to fetch facilitators' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    if (isConvexEnabled) {
      try {
        const newFacilitator = await convex.mutation(api.facilitators.create, { name, email });
        return NextResponse.json(newFacilitator, { status: 201 });
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    // Check if email already exists
    const existing = db.prepare('SELECT * FROM facilitators WHERE email = ?').get(email);
    if (existing) {
      return NextResponse.json({ error: 'Facilitator with this email already exists' }, { status: 400 });
    }

    const id = generateFacilitatorId();
    db.prepare('INSERT INTO facilitators (id, name, email) VALUES (?, ?, ?)')
      .run(id, name, email);

    const newFacilitator = db.prepare('SELECT * FROM facilitators WHERE id = ?').get(id);
    return NextResponse.json(newFacilitator, { status: 201 });
  } catch (error) {
    console.error('Error creating facilitator:', error);
    return NextResponse.json({ error: 'Failed to create facilitator' }, { status: 500 });
  }
}
