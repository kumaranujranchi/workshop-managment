import { NextResponse } from 'next/server';
import { isConvexEnabled, convex, api } from '@/lib/convexClient.js';
import db from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    if (isConvexEnabled) {
      const notifications = await convex.query(api.participants.listNotifications);
      return NextResponse.json(notifications);
    }

    const notifications = db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC').all();
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
