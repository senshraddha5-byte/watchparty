import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const STATE_DOC_ID = 'current';
const VIDEO_STATE_COLLECTION = 'videoState';

export interface VideoState {
  _id?: string;
  currentTime: number;
  isPlaying: boolean;
  isBuffering?: boolean;
  lastUpdatedBy: string;
  lastUpdatedAt: number;
  action: string;
}

export async function getVideoState(): Promise<VideoState | null> {
  const docRef = doc(db, VIDEO_STATE_COLLECTION, STATE_DOC_ID);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { ...snapshot.data(), _id: snapshot.id } as VideoState;
}

export async function updateVideoState(state: Partial<VideoState>): Promise<VideoState> {
  const docRef = doc(db, VIDEO_STATE_COLLECTION, STATE_DOC_ID);
  
  // Use a transaction to prevent race conditions during concurrent updates
  // (e.g. onSeeked and onWaiting firing at the same time)
  let updatedState: VideoState;
  
  try {
    const { runTransaction } = await import('firebase/firestore');
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      const timestamp = Date.now();
      
      const currentState = docSnap.exists() ? docSnap.data() as VideoState : null;
      
      updatedState = {
        currentTime: currentState?.currentTime ?? 0,
        isPlaying: currentState?.isPlaying ?? false,
        isBuffering: currentState?.isBuffering ?? false,
        lastUpdatedBy: currentState?.lastUpdatedBy ?? '',
        lastUpdatedAt: timestamp,
        action: currentState?.action ?? '',
        ...state,
      };
      
      transaction.set(docRef, updatedState, { merge: true });
    });
    
    return { ...updatedState!, _id: STATE_DOC_ID };
  } catch (error) {
    console.error('Transaction failed: ', error);
    // Fallback to simple setDoc if transaction fails
    const timestamp = Date.now();
    const newState = {
      ...state,
      lastUpdatedAt: timestamp,
    };
    await setDoc(docRef, newState, { merge: true });
    
    const finalDoc = await getDoc(docRef);
    return { ...finalDoc.data(), _id: finalDoc.id } as VideoState;
  }
}

export async function resetVideoState(): Promise<VideoState> {
  const docRef = doc(db, VIDEO_STATE_COLLECTION, STATE_DOC_ID);
  const resetState: VideoState = {
    currentTime: 0,
    isPlaying: false,
    lastUpdatedBy: '',
    lastUpdatedAt: Date.now(),
    action: '',
  };
  
  await setDoc(docRef, resetState);
  return { ...resetState, _id: STATE_DOC_ID };
}

export async function deleteAllVideoStates(): Promise<void> {
  const docRef = doc(db, VIDEO_STATE_COLLECTION, STATE_DOC_ID);
  await deleteDoc(docRef);
}