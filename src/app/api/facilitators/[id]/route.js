import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email } = body;

    if (isConvexEnabled) {
      try {
        const updatedFacilitator = await convex.mutation(api.facilitators.update, { id, name, email });
        return NextResponse.json(updatedFacilitator);
      } catch (err) {
        if (err.message.includes("not found")) {
          return NextResponse.json({ error: 'Facilitator not found' }, { status: 404 });
        }
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    // Check if facilitator exists
    const facilitator = db.prepare('SELECT * FROM facilitators WHERE id = ?').get(id);
    if (!facilitator) {
      return NextResponse.json({ error: 'Facilitator not found' }, { status: 404 });
    }

    const updatedName = name !== undefined ? name : facilitator.name;
    const updatedEmail = email !== undefined ? email : facilitator.email;

    // If email is being changed, check for uniqueness
    if (updatedEmail !== facilitator.email) {
      const existing = db.prepare('SELECT * FROM facilitators WHERE email = ?').get(updatedEmail);
      if (existing) {
        return NextResponse.json({ error: 'Email already in use by another facilitator' }, { status: 400 });
      }
    }

    db.prepare('UPDATE facilitators SET name = ?, email = ? WHERE id = ?')
      .run(updatedName, updatedEmail, id);

    const updatedFacilitator = db.prepare('SELECT * FROM facilitators WHERE id = ?').get(id);
    return NextResponse.json(updatedFacilitator);
  } catch (error) {
    console.error('Error updating facilitator:', error);
    return NextResponse.json({ error: 'Failed to update facilitator' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (isConvexEnabled) {
      try {
        await convex.mutation(api.facilitators.remove, { id });
        return NextResponse.json({ success: true, message: 'Facilitator deleted successfully' });
      } catch (err) {
        if (err.message.includes("active workshops") || err.message.includes("assigned")) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
    }

    // Check if facilitator exists
    const facilitator = db.prepare('SELECT * FROM facilitators WHERE id = ?').get(id);
    if (!facilitator) {
      return NextResponse.json({ error: 'Facilitator not found' }, { status: 404 });
    }

    // Check if facilitator has workshops assigned
    const workshops = db.prepare('SELECT COUNT(*) as count FROM workshops WHERE facilitatorId = ?').get(id);
    if (workshops.count > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete facilitator: they are assigned to one or more workshops. Please reassign or archive those workshops first.' 
      }, { status: 400 });
    }

    db.prepare('DELETE FROM facilitators WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Facilitator deleted successfully' });
  } catch (error) {
    console.error('Error deleting facilitator:', error);
    return NextResponse.json({ error: 'Failed to delete facilitator' }, { status: 500 });
  }
}
