import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

// Random ID Helper
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workshopId = searchParams.get('workshopId');

    if (isConvexEnabled) {
      const feedbackList = await convex.query(api.feedback.list, {
        workshopId: workshopId || undefined,
      });
      return NextResponse.json(feedbackList);
    }

    let feedbackList;
    if (workshopId) {
      feedbackList = db.prepare('SELECT * FROM feedback WHERE workshopId = ? ORDER BY createdAt DESC').all(workshopId);
    } else {
      feedbackList = db.prepare('SELECT * FROM feedback ORDER BY createdAt DESC').all();
    }
    return NextResponse.json(feedbackList);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { workshopId, participantId, rating, comments, mcqResponses } = body;

    if (!workshopId || !participantId || rating === undefined) {
      return NextResponse.json({ error: 'workshopId, participantId, and rating are required' }, { status: 400 });
    }

    const ratingVal = parseInt(rating, 10);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const mcqJson = mcqResponses ? JSON.stringify(mcqResponses) : null;

    if (isConvexEnabled) {
      // Verify participant exists and belongs to this workshop
      const participants = await convex.query(api.participants.list, { workshopId });
      const participant = participants.find((p) => p.id === participantId);
      if (!participant) {
        return NextResponse.json({ error: 'Invalid participant registration for this workshop' }, { status: 400 });
      }

      // Check if feedback already submitted
      const feedbackList = await convex.query(api.feedback.list, { workshopId });
      const existing = feedbackList.find((f) => f.participantId === participantId);
      if (existing) {
        return NextResponse.json({ error: 'Feedback already submitted for this workshop' }, { status: 400 });
      }

      const newFeedback = await convex.mutation(api.feedback.create, {
        workshopId,
        participantId,
        rating: ratingVal,
        comments: comments || '',
        mcqResponses: mcqJson,
      });
      return NextResponse.json(newFeedback, { status: 201 });
    }

    // Verify participant and workshop relationship
    const participant = db.prepare('SELECT * FROM participants WHERE id = ? AND workshopId = ?').get(participantId, workshopId);
    if (!participant) {
      return NextResponse.json({ error: 'Invalid participant registration for this workshop' }, { status: 400 });
    }

    // Check if feedback already submitted
    const existing = db.prepare('SELECT * FROM feedback WHERE workshopId = ? AND participantId = ?').get(workshopId, participantId);
    if (existing) {
      return NextResponse.json({ error: 'Feedback already submitted for this workshop' }, { status: 400 });
    }

    const id = generateId();
    db.prepare(`
      INSERT INTO feedback (id, workshopId, participantId, rating, comments, mcqResponses)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, workshopId, participantId, ratingVal, comments || '', mcqJson);

    const newFeedback = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id);
    return NextResponse.json(newFeedback, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
