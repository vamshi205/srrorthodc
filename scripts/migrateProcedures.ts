import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';
// import 'dotenv/config';

// Hardcoded config to ensure script runs independently
const firebaseConfig = {
    apiKey: "AIzaSyDuK5kOP_WsiFTgMQE7B2qyYaAPDwdi_hY",
    authDomain: "srrorthodc-antigravity.firebaseapp.com",
    projectId: "srrorthodc-antigravity",
    storageBucket: "srrorthodc-antigravity.firebasestorage.app",
    messagingSenderId: "851487467736",
    appId: "1:851487467736:web:1065fa1ffbfdd194530fad",
    measurementId: "G-RPSEV8795H"
};

const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2GZRYcJnEjFaDryWHowegMFVkf8xzewGsEKqNLw7onpe1if24LnJrIZAl4CB5QdgVFjE1PqFYmUa/pub?output=csv';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
    console.log('Starting migration...');
    console.log('Fetching CSV from Google Sheets...');

    try {
        const response = await fetch(SHEETS_URL);
        if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        const csvText = await response.text();

        console.log('Parsing CSV...');

        Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data.slice(1); // Skip header
                console.log(`Found ${rows.length} procedures to migrate.`);

                let count = 0;
                const batchSize = 50;

                for (const row of rows) {
                    try {
                        const procedure = parseRow(row);
                        if (!procedure.name) continue;

                        // Use procedure name as document ID (sanitized)
                        // Or generate a random ID. Using name is better for idempotency.
                        // But names might have slashes, so let's just use the name field in the doc and allow auto-ID or customized ID.
                        // Actually, let's use a safe-slug of the name as ID to be readable.
                        const docId = procedure.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

                        await setDoc(doc(db, 'procedures', docId), procedure);

                        count++;
                        if (count % 10 === 0) process.stdout.write('.');
                    } catch (e) {
                        console.error(`\nError saving ${row[0]}:`, e);
                    }
                }

                console.log(`\nMigration complete! Successfully imported ${count} procedures.`);
                process.exit(0);
            },
            error: (err) => {
                console.error('CSV Parse Error:', err);
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Logic copied from useProcedures.ts to ensure data consistency
function parseRow(row) {
    const [name, items, fixedItems, fixedQty, instruments, type, instrumentImages, fixedItemImages, itemImages, itemLocations, fixedItemLocations, instrumentLocations] = row;

    // Parse fixed items and qtys strictly by | only
    const fixedItemsArr = fixedItems ? fixedItems.split('|').map(s => s.trim()).filter(Boolean) : [];
    const fixedQtyArr = fixedQty ? fixedQty.split('|').map(s => s.trim()).filter(Boolean) : [];
    const fixedList = fixedItemsArr.map((item, idx) => ({
        name: item,
        qty: fixedQtyArr[idx] || '1'
    }));

    // Parse editable items (from Items column only, pipe-separated)
    const editableItems = items
        ? items.split('|').map(item => item.trim()).filter(Boolean)
        : [];

    // Parse instruments and their images
    const instrumentsArr = instruments
        ? instruments.split('|').map(inst => inst.trim()).filter(Boolean)
        : [];
    const instrumentImagesArr = instrumentImages
        ? instrumentImages.split('|').map(url => url.trim()).filter(Boolean)
        : [];

    // Parse fixed item images
    const fixedItemImagesArr = fixedItemImages
        ? fixedItemImages.split('|').map(url => url.trim()).filter(Boolean)
        : [];

    // Parse selectable item images
    const itemImagesArr = itemImages
        ? itemImages.split('|').map(url => url.trim()).filter(Boolean)
        : [];

    // Parse locations - format: Room1|Rack2|Box3|Room4|Rack5|Box6
    const parseLocations = (locationString) => {
        if (!locationString) return [];
        const parts = locationString.split('|').map(p => p.trim()).filter(Boolean);
        const locations = [];
        // Each location is 3 parts: Room, Rack, Box
        for (let i = 0; i < parts.length; i += 3) {
            if (i + 2 < parts.length) {
                locations.push({
                    room: parts[i] || '',
                    rack: parts[i + 1] || '',
                    box: parts[i + 2] || '',
                });
            } else {
                // Incomplete location, push null
                locations.push(null);
            }
        }
        return locations;
    };

    const itemLocationsArr = parseLocations(itemLocations);
    const fixedItemLocationsArr = parseLocations(fixedItemLocations);
    const instrumentLocationsArr = parseLocations(instrumentLocations);

    // Create instrument-image mapping for this procedure
    const instrumentImageMapping = {};
    instrumentsArr.forEach((inst, idx) => {
        // Note: old code had fallback maps, here we rely only on the sheet data for migration
        instrumentImageMapping[inst] = instrumentImagesArr[idx] || null;
    });

    // Create fixed item-image mapping for this procedure
    const fixedItemImageMapping = {};
    fixedItemsArr.forEach((item, idx) => {
        fixedItemImageMapping[item] = fixedItemImagesArr[idx] || null;
    });

    // Create selectable item-image mapping for this procedure
    const itemImageMapping = {};
    editableItems.forEach((item, idx) => {
        // Extract item name without size/qty pattern for matching
        const itemName = item.match(/^(.+?)\s*\{/)?.[1]?.trim() || item.trim();
        itemImageMapping[itemName] = itemImagesArr[idx] || null;
    });

    // Create location mappings
    const instrumentLocationMapping = {};
    instrumentsArr.forEach((inst, idx) => {
        instrumentLocationMapping[inst] = instrumentLocationsArr[idx] || null;
    });

    const fixedItemLocationMapping = {};
    fixedItemsArr.forEach((item, idx) => {
        fixedItemLocationMapping[item] = fixedItemLocationsArr[idx] || null;
    });

    const itemLocationMapping = {};
    editableItems.forEach((item, idx) => {
        // Extract item name without size/qty pattern for matching
        const itemName = item.match(/^(.+?)\s*\{/)?.[1]?.trim() || item.trim();
        itemLocationMapping[itemName] = itemLocationsArr[idx] || null;
    });

    return {
        name: name ? name.trim() : '',
        items: editableItems,
        fixedItems: fixedList,
        instruments: instrumentsArr,
        type: type ? type.trim() : 'General',
        instrumentImageMapping,
        fixedItemImageMapping,
        itemImageMapping,
        instrumentLocationMapping,
        fixedItemLocationMapping,
        itemLocationMapping,
    };
}

migrate();
