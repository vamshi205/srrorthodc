import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";

// List of all primary collections in Firestore database
const ALL_FIRESTORE_COLLECTIONS = [
  "bank_accounts",
  "bank_transactions",
  "procedures",
  "cash_invoices",
  "hospitals",
  "doctors",
  "personnel",
  "quotations",
  "templates",
  "history",
  "emailHistory",
  "priceLists",
  "driveFiles",
  "driveFolders",
  "settings",
  "dcs",
  "delivery_challans",
];

export async function downloadCompleteFirestoreBackup(): Promise<{ success: boolean; count: number }> {
  try {
    const backupData: Record<string, any[]> = {};
    let totalDocsCount = 0;

    for (const collectionName of ALL_FIRESTORE_COLLECTIONS) {
      try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const docsList: any[] = [];
        querySnapshot.forEach((docSnap) => {
          docsList.push({
            _id: docSnap.id,
            ...docSnap.data(),
          });
        });
        backupData[collectionName] = docsList;
        totalDocsCount += docsList.length;
      } catch (colErr) {
        console.warn(`Could not backup collection ${collectionName}:`, colErr);
        backupData[collectionName] = [];
      }
    }

    const fullExport = {
      exportTimestamp: new Date().toISOString(),
      exportVersion: "1.0",
      system: "SRR Ortho Executive Admin Backup",
      totalDocuments: totalDocsCount,
      collections: backupData,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullExport, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `SRR_Ortho_Firestore_FullBackup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);

    return { success: true, count: totalDocsCount };
  } catch (error) {
    console.error("Failed to download Firestore backup:", error);
    return { success: false, count: 0 };
  }
}
