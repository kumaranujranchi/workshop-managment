import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, status, facilitatorId } = body;

    if (isConvexEnabled) {
      try {
        const updatedWorkshop = await convex.mutation(api.workshops.update, {
          id,
          title,
          description,
          status,
          facilitatorId,
        });
        return NextResponse.json(updatedWorkshop);
      } catch (err) {
        if (err.message.includes("not found")) {
          return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
        }
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    // Check if workshop exists
    const workshop = db.prepare('SELECT * FROM workshops WHERE id = ?').get(id);
    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // Prepare dynamic update query
    const updatedTitle = title !== undefined ? title : workshop.title;
    const updatedDescription = description !== undefined ? description : workshop.description;
    const updatedStatus = status !== undefined ? status : workshop.status;
    const updatedFacilitatorId = facilitatorId !== undefined ? facilitatorId : workshop.facilitatorId;

    db.prepare(`
      UPDATE workshops 
      SET title = ?, description = ?, status = ?, facilitatorId = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedTitle, updatedDescription, updatedStatus, updatedFacilitatorId, id);

    const updatedWorkshop = db.prepare(`
      SELECT w.*, f.name as facilitatorName 
      FROM workshops w
      JOIN facilitators f ON w.facilitatorId = f.id
      WHERE w.id = ?
    `).get(id);

    return NextResponse.json(updatedWorkshop);
  } catch (error) {
    console.error('Error updating workshop:', error);
    return NextResponse.json({ error: 'Failed to update workshop' }, { status: 500 });
  }
}
