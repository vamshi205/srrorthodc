// src/services/firestoreService.ts

import { db } from '@/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { SavedDc } from '@/lib/savedDcStorage';

const DC_COLLECTION = 'delivery_challans';

/**
 * Fetch all DCs from Firestore
 */
export async function fetchDcsFromFirestore(): Promise<SavedDc[]> {
  try {
    // Query to fetch all documents, ordered by savedAt descending
    const q = query(
      collection(db, DC_COLLECTION),
      orderBy('savedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const dcs: SavedDc[] = [];

    querySnapshot.forEach((doc) => {
      // Firestore data is safe to cast to SavedDc as the schema is designed to match
      dcs.push(doc.data() as SavedDc);
    });

    return dcs;
  } catch (error) {
    console.error('Error fetching DCs from Firestore:', error);
    throw error;
  }
}

/**
 * Save a new DC to Firestore
 */
export async function saveDcToFirestore(dc: SavedDc): Promise<boolean> {
  try {
    // Use the DC's ID as the document ID for easy lookup and update
    const dcRef = doc(db, DC_COLLECTION, dc.id);
    // Sanitize data to remove undefined values
    const sanitizedDc = JSON.parse(JSON.stringify(dc));
    await setDoc(dcRef, sanitizedDc);
    return true;
  } catch (error) {
    console.error('Error saving DC to Firestore:', error);
    throw error;
  }
}

/**
 * Update an existing DC in Firestore
 */
export async function updateDcInFirestore(dc: SavedDc): Promise<boolean> {
  try {
    const dcRef = doc(db, DC_COLLECTION, dc.id);
    // updateDoc is more efficient than setDoc if only a few fields are changing, 
    // but setDoc with the full object is safer for a full replacement.
    // Since the logic in savedDcStorage.ts handles merging, we can use setDoc for simplicity.
    // Sanitize data to remove undefined values
    const sanitizedDc = JSON.parse(JSON.stringify(dc));
    await setDoc(dcRef, sanitizedDc);
    return true;
  } catch (error) {
    console.error('Error updating DC in Firestore:', error);
    throw error;
  }
}

/**
 * Delete a DC from Firestore
 */
export async function deleteDcFromFirestore(id: string): Promise<boolean> {
  try {
    const dcRef = doc(db, DC_COLLECTION, id);
    await deleteDoc(dcRef);
    return true;
  } catch (error) {
    console.error('Error deleting DC from Firestore:', error);
    throw error;
  }
}
