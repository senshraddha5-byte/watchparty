import { NextResponse } from 'next/server';
import { getVideoState, updateVideoState, resetVideoState } from '@/lib/models/videoState';
import { broadcastState } from './stream/route';

export const dynamic = 'force-dynamic';

// GET /api/state - Get current playback state from MongoDB
export async function GET() {
  try {
    const state = await getVideoState();
    
    if (!state) {
      // Return default state if none exists
      return NextResponse.json({
        currentTime: 0,
        isPlaying: false,
        lastUpdatedBy: '',
        lastUpdatedAt: Date.now(),
        action: ''
      });
    }
    
    return NextResponse.json(state);
  } catch (error) {
    console.error('[STATE API] GET Error reading state:', error);
    return NextResponse.json({ error: 'Failed to read state' }, { status: 500 });
  }
}

// POST /api/state - Update playback state in MongoDB
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { currentTime, isPlaying, isBuffering, user, action } = body;
    

    const updateData: any = {};
    if (typeof currentTime === 'number') updateData.currentTime = currentTime;
    if (typeof isPlaying === 'boolean') updateData.isPlaying = isPlaying;
    if (typeof isBuffering === 'boolean') updateData.isBuffering = isBuffering;
    if (user) updateData.lastUpdatedBy = user;
    if (typeof action === 'string') updateData.action = action;

    // Update state in MongoDB -> now Firebase
    const newState = await updateVideoState(updateData);
    

    // Broadcast to all connected SSE clients
    broadcastState(newState);

    return NextResponse.json(newState);
  } catch (error) {
    console.error('[STATE API] POST Error updating state:', error);
    return NextResponse.json({ error: 'Failed to update state' }, { status: 500 });
  }
}

// DELETE /api/state - Reset playback state in MongoDB
export async function DELETE() {
  try {
    
    const resetState = await resetVideoState();

    // Broadcast to all connected SSE clients
    broadcastState(resetState);

    return NextResponse.json(resetState);
  } catch (error) {
    console.error('[STATE API] DELETE Error resetting state:', error);
    return NextResponse.json({ error: 'Failed to reset state' }, { status: 500 });
  }
}
