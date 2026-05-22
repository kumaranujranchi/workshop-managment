import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, onboardingStatus, expectations } = body;

    if (isConvexEnabled) {
      try {
        const updatedParticipant = await convex.mutation(api.participants.update, {
          id,
          status,
          onboardingStatus,
          expectations,
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

    const workshop = db.prepare('SELECT * FROM workshops WHERE id = ?').get(participant.workshopId);

    const updatedStatus = status !== undefined ? status : participant.status;
    const updatedOnboardingStatus = onboardingStatus !== undefined ? onboardingStatus : participant.onboardingStatus;
    const updatedExpectations = expectations !== undefined ? expectations : participant.expectations;

    // Handle transition to declined
    if (updatedStatus === 'declined' && participant.status !== 'declined') {
      const wasOccupyingSeat = participant.status === 'registered' || participant.status === 'confirmed';
      if (wasOccupyingSeat && workshop) {
        // Find oldest waitlisted participant
        const oldestWaitlisted = db.prepare(`
          SELECT * FROM participants 
          WHERE workshopId = ? AND status = 'waitlisted' 
          ORDER BY createdAt ASC 
          LIMIT 1
        `).get(participant.workshopId);

        if (oldestWaitlisted) {
          db.prepare("UPDATE participants SET status = 'registered' WHERE id = ?").run(oldestWaitlisted.id);

          // Promoted confirmation email
          db.prepare(`
            INSERT INTO notifications (id, type, recipient, subject, body, status)
            VALUES (?, 'email', ?, ?, ?, 'sent')
          `).run(
            generateId(),
            oldestWaitlisted.email,
            `Seat Confirmed: ${workshop.title}`,
            `Hi ${oldestWaitlisted.name},\n\nYou have been promoted from the waitlist and registered for the workshop "${workshop.title}".\nDate/Time: ${workshop.dateTime || 'TBD'}`
          );

          // Promoted calendar invite
          db.prepare(`
            INSERT INTO notifications (id, type, recipient, subject, body, status)
            VALUES (?, 'calendar', ?, ?, ?, 'sent')
          `).run(
            generateId(),
            oldestWaitlisted.email,
            `Calendar Invitation: ${workshop.title}`,
            `Event: ${workshop.title}\nDate/Time: ${workshop.dateTime || 'TBD'}\nLocation: Zoom / Online Meeting Link`
          );
        }
      }

      // Revocation calendar event
      if (workshop) {
        db.prepare(`
          INSERT INTO notifications (id, type, recipient, subject, body, status)
          VALUES (?, 'calendar', ?, ?, ?, 'revoked')
        `).run(
          generateId(),
          participant.email,
          `Revoked Invitation: ${workshop.title}`,
          `The calendar event for "${workshop.title}" has been cancelled.`
        );
      }
    }

    db.prepare(`
      UPDATE participants 
      SET status = ?, onboardingStatus = ?, expectations = ?
      WHERE id = ?
    `).run(updatedStatus, updatedOnboardingStatus, updatedExpectations, id);

    const updatedParticipant = db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
    return NextResponse.json(updatedParticipant);
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
}
