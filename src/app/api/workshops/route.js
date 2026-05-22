import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export const dynamic = 'force-dynamic';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function GET() {
  try {
    if (isConvexEnabled) {
      const workshops = await convex.query(api.workshops.list);
      return NextResponse.json(workshops);
    }

    const workshops = db.prepare(`
      SELECT w.*, f.name as facilitatorName, f.email as facilitatorEmail,
      (SELECT COUNT(*) FROM participants WHERE workshopId = w.id) as participantCount,
      (SELECT COUNT(*) FROM participants WHERE workshopId = w.id AND status = 'confirmed') as confirmedCount,
      (SELECT COUNT(*) FROM feedback WHERE workshopId = w.id) as feedbackCount,
      (SELECT AVG(rating) FROM feedback WHERE workshopId = w.id) as avgRating
      FROM workshops w
      JOIN facilitators f ON w.facilitatorId = f.id
      ORDER BY w.createdAt DESC
    `).all();

    return NextResponse.json(workshops);
  } catch (error) {
    console.error('Error fetching workshops:', error);
    return NextResponse.json({ error: 'Failed to fetch workshops' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, description, facilitatorId, dateTime, capacity } = body;

    if (!title || !facilitatorId) {
      return NextResponse.json({ error: 'Title and Facilitator are required' }, { status: 400 });
    }

    if (isConvexEnabled) {
      const newWorkshop = await convex.mutation(api.workshops.create, {
        title,
        description: description || '',
        facilitatorId,
        dateTime: dateTime || undefined,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
      });
      return NextResponse.json(newWorkshop, { status: 201 });
    }

    const id = generateId();
    const status = 'draft';
    const finalCapacity = capacity !== undefined ? Number(capacity) : 20;

    db.prepare(`
      INSERT INTO workshops (id, title, description, facilitatorId, status, dateTime, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, description || '', facilitatorId, status, dateTime || null, finalCapacity);

    const newWorkshop = db.prepare(`
      SELECT w.*, f.name as facilitatorName 
      FROM workshops w
      JOIN facilitators f ON w.facilitatorId = f.id
      WHERE w.id = ?
    `).get(id);

    return NextResponse.json(newWorkshop, { status: 201 });
  } catch (error) {
    console.error('Error creating workshop:', error);
    return NextResponse.json({ error: 'Failed to create workshop' }, { status: 500 });
  }
}
