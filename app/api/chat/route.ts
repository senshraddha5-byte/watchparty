import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  edited: boolean;
  replyTo: string | null;
  user?: string;
}

const CHATS_COLLECTION = 'chats';

// GET /api/chat - Get all chat messages from Firestore
export async function GET() {
  try {
    const colRef = collection(db, CHATS_COLLECTION);
    const q = query(colRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);
    
    const messages: ChatMessage[] = snapshot.docs.map(d => ({
      id: d.id,
      text: d.data().text,
      timestamp: d.data().timestamp,
      edited: d.data().edited || false,
      replyTo: d.data().replyTo || null,
      user: d.data().user || 'Anonymous'
    }));
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error('[API/Chat] Error fetching chat from Firestore:', error);
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}

// POST /api/chat - Send a new message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, user, replyTo } = body;

    if (!text || !user) {
      return NextResponse.json(
        { error: 'Text and user are required' },
        { status: 400 }
      );
    }

    const colRef = collection(db, CHATS_COLLECTION);
    
    const newMessageData = {
      text,
      timestamp: Date.now(),
      edited: false,
      replyTo: replyTo || null,
      user: user.toLowerCase()
    };
    
    const docRef = await addDoc(colRef, newMessageData);

    const newMessage: ChatMessage = {
      id: docRef.id,
      ...newMessageData
    };

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error('[API/Chat] Error sending message to Firestore:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// PUT /api/chat - Edit a message
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { messageId, text } = body;

    if (!messageId || !text) {
      return NextResponse.json(
        { error: 'MessageId and text are required' },
        { status: 400 }
      );
    }

    const docRef = doc(db, CHATS_COLLECTION, messageId);
    await updateDoc(docRef, {
      text: text,
      edited: true
    });

    return NextResponse.json({
      id: messageId,
      text,
      edited: true
    });
  } catch (error) {
    console.error('[API/Chat] Error editing message:', error);
    return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 });
  }
}

// DELETE /api/chat - Delete a message
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      const colRef = collection(db, CHATS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, CHATS_COLLECTION, d.id)));
      await Promise.all(deletePromises);
      return NextResponse.json({ success: true, message: 'All messages cleared' });
    }

    if (!messageId) {
      return NextResponse.json(
        { error: 'MessageId is required' },
        { status: 400 }
      );
    }

    const docRef = doc(db, CHATS_COLLECTION, messageId);
    await deleteDoc(docRef);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/Chat] Error deleting message:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}