import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Procedure } from '@/types/procedure';

const COLLECTION_NAME = 'procedures';

export const procedureService = {
    /**
     * Fetch all procedures from Firestore
     */
    async getAll(): Promise<Procedure[]> {
        try {
            // Order by name alphabetically
            const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
            const querySnapshot = await getDocs(q);

            const procedures: Procedure[] = [];
            querySnapshot.forEach((doc) => {
                procedures.push(doc.data() as Procedure);
            });

            return procedures;
        } catch (error) {
            console.error("Error getting procedures:", error);
            throw error;
        }
    },

    /**
     * Save (Create or Update) a procedure
     * Uses the procedure name as the document ID (sanitized)
     */
    async save(procedure: Procedure): Promise<void> {
        try {
            if (!procedure.name) throw new Error("Procedure name is required");

            // Create a safe ID from the name (e.g., "Total Hip Replacement" -> "Total_Hip_Replacement")
            // This ensures uniqueness by name and readable IDs
            const docId = procedure.name.replace(/[^a-zA-Z0-9]/g, '_');

            await setDoc(doc(db, COLLECTION_NAME, docId), procedure);
        } catch (error) {
            console.error("Error saving procedure:", error);
            throw error;
        }
    },

    /**
     * Delete a procedure by name
     */
    async delete(name: string): Promise<void> {
        try {
            if (!name) throw new Error("Procedure name is required");
            const docId = name.replace(/[^a-zA-Z0-9]/g, '_');
            await deleteDoc(doc(db, COLLECTION_NAME, docId));
        } catch (error) {
            console.error("Error deleting procedure:", error);
            throw error;
        }
    }
};
