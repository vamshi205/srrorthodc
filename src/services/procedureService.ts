import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Procedure } from '@/types/procedure';

const COLLECTION_NAME = 'procedures';

export const procedureService = {
    /**
     * Fetch all procedures from Firestore.
     * Stores the real Firestore doc.id as procedure.docId — the true primary key.
     */
    async getAll(): Promise<Procedure[]> {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
            const querySnapshot = await getDocs(q);

            const procedures: Procedure[] = [];
            querySnapshot.forEach((document) => {
                const data = document.data() as Procedure;
                // Always stamp the real Firestore document ID so updates use it
                procedures.push({ ...data, docId: document.id });
            });

            return procedures;
        } catch (error) {
            console.error('Error getting procedures:', error);
            throw error;
        }
    },

    /**
     * Create a new procedure.
     * Derives docId from name — only used for NEW procedures.
     */
    async save(procedure: Procedure): Promise<void> {
        try {
            if (!procedure.name) throw new Error('Procedure name is required');
            const docId = procedure.name.replace(/[^a-zA-Z0-9]/g, '_');
            // Strip docId before writing to Firestore (it's stored as the document ID, not a field)
            const { docId: _ignore, ...dataToWrite } = procedure;
            await setDoc(doc(db, COLLECTION_NAME, docId), { ...dataToWrite, docId }, { merge: false });
        } catch (error) {
            console.error('Error saving procedure:', error);
            throw error;
        }
    },

    /**
     * Update an existing procedure by its exact Firestore document ID.
     * Always updates the document in place without creating a duplicate.
     */
    async update(docId: string, procedure: Procedure): Promise<void> {
        try {
            if (!docId) throw new Error('Document ID is required for update');
            const { docId: _ignore, ...dataToWrite } = procedure;
            await setDoc(doc(db, COLLECTION_NAME, docId), { ...dataToWrite, docId }, { merge: true });
        } catch (error) {
            console.error('Error updating procedure:', error);
            throw error;
        }
    },

    /**
     * Delete a procedure using its Firestore document ID directly.
     * Always prefer this over delete-by-name to avoid ambiguity.
     */
    async deleteByDocId(docId: string): Promise<void> {
        try {
            if (!docId) throw new Error('Document ID is required');
            await deleteDoc(doc(db, COLLECTION_NAME, docId));
        } catch (error) {
            console.error('Error deleting procedure:', error);
            throw error;
        }
    },

    /**
     * Delete a procedure by name (legacy fallback — avoid using this).
     */
    async delete(name: string): Promise<void> {
        try {
            if (!name) throw new Error('Procedure name is required');
            const docId = name.replace(/[^a-zA-Z0-9]/g, '_');
            await deleteDoc(doc(db, COLLECTION_NAME, docId));
        } catch (error) {
            console.error('Error deleting procedure:', error);
            throw error;
        }
    },
};
