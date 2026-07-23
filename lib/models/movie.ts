import { db } from '../firebase';
import { collection, getDocs, addDoc, query, where, deleteDoc, doc, writeBatch, updateDoc } from 'firebase/firestore';

const MOVIES_COLLECTION = 'movies';

export interface Movie {
  _id?: string;
  id: string;
  name: string;
  link: string;
  imdb: string;
  description: string;
  thumbnail?: string;
  trailer?: string;
}

export async function getAllMovies(): Promise<Movie[]> {
  const colRef = collection(db, MOVIES_COLLECTION);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(d => ({ ...d.data(), _id: d.id } as Movie));
}

export async function addMovie(name: string, link: string, imdb?: string, description?: string, thumbnail?: string, trailer?: string): Promise<Movie> {
  const colRef = collection(db, MOVIES_COLLECTION);
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  
  const newMovie: Movie = {
    id,
    name,
    link,
    imdb: imdb || '',
    description: description || '',
    thumbnail: thumbnail || '',
    trailer: trailer || ''
  };
  
  const docRef = await addDoc(colRef, newMovie);
  return { ...newMovie, _id: docRef.id };
}

export async function getMovieById(id: string): Promise<Movie | null> {
  const colRef = collection(db, MOVIES_COLLECTION);
  const q = query(colRef, where("id", "==", id));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { ...snapshot.docs[0].data(), _id: snapshot.docs[0].id } as Movie;
}

export async function updateMovie(id: string, updates: Partial<Movie>): Promise<boolean> {
  const colRef = collection(db, MOVIES_COLLECTION);
  const q = query(colRef, where("id", "==", id));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return false;
  
  const docRef = doc(db, MOVIES_COLLECTION, snapshot.docs[0].id);
  // Remove _id from updates if it exists so we don't accidentally write it
  const { _id, id: originalId, ...validUpdates } = updates;
  
  await updateDoc(docRef, validUpdates);
  return true;
}

export async function deleteMovie(id: string): Promise<boolean> {
  const colRef = collection(db, MOVIES_COLLECTION);
  const q = query(colRef, where("id", "==", id));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return false;
  
  await deleteDoc(doc(db, MOVIES_COLLECTION, snapshot.docs[0].id));
  return true;
}

export async function initializeMovies(movies: Movie[]): Promise<void> {
  const colRef = collection(db, MOVIES_COLLECTION);
  const snapshot = await getDocs(colRef);
  
  // Clear existing
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  
  // Insert new
  movies.forEach((m) => {
    const newDocRef = doc(colRef);
    batch.set(newDocRef, m);
  });
  
  await batch.commit();
}