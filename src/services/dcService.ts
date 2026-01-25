import { db } from '../firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import type { SavedDc } from '@/lib/savedDcStorage';

const COLLECTION_NAME = 'dcs';

export const dcService = {
    /**
     * Fetch all DCs from Firestore, ordered by savedAt date (descending)
     */
    async getAll(): Promise<SavedDc[]> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                // Note: You might need to create an index for this query in Firebase Console
                orderBy('savedAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const dcs: SavedDc[] = [];

            querySnapshot.forEach((doc) => {
                // We cast the data to SavedDc type
                // Ensure your Firestore data matches this interface
                dcs.push(doc.data() as SavedDc);
            });

            return dcs;
        } catch (error) {
            console.error("Error getting DCs:", error);
            throw error;
        }
    },

    /**
     * Get a single DC by ID
     */
    async getById(id: string): Promise<SavedDc | null> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return docSnap.data() as SavedDc;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error getting DC:", error);
            throw error;
        }
    },

    /**
     * Save a new DC or overwrite an existing one
     */
    async save(dc: SavedDc): Promise<void> {
        try {
            if (!dc.id) {
                throw new Error("DC must have an ID");
            }

            // Store the DC using its ID as the document ID
            await setDoc(doc(db, COLLECTION_NAME, dc.id), dc);
        } catch (error) {
            console.error("Error saving DC:", error);
            throw error;
        }
    },

    /**
     * Update an existing DC
     * This is a shallow merge
     */
    async update(id: string, updates: Partial<SavedDc>): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating DC:", error);
            throw error;
        }
    },

    /**
     * Delete a DC
     */
    async delete(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting DC:", error);
            throw error;
        }
    }
};
