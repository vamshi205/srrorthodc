export interface SizeQty {
  size: string;
  qty: string;
}

export interface FixedItem {
  name: string;
  qty: string;
}

export interface Location {
  room: string;
  rack: string;
  box: string;
}

export interface Procedure {
  docId?: string;           // Actual Firestore document ID — the true primary key
  name: string;
  items: string[];
  fixedItems: FixedItem[];
  instruments: string[];
  type: string;
  instrumentImageMapping?: Record<string, string | null>;
  fixedItemImageMapping?: Record<string, string | null>;
  itemImageMapping?: Record<string, string | null>;
  instrumentLocationMapping?: Record<string, Location | null>;
  fixedItemLocationMapping?: Record<string, Location | null>;
  itemLocationMapping?: Record<string, Location | null>;
}

export interface SelectedItem {
  itemName: string;
  sizeQty: SizeQty[];
}

export interface ActiveProcedure extends Procedure {
  materialType: string;
  selectedItems: Map<string, SelectedItem>;
  selectedFixedItems: Map<string, boolean>;
  fixedQtyEdits: Map<string, string>;
  instruments: string[];
  boxNumbers: string[];
  instrumentImageMapping?: Record<string, string | null>;
  fixedItemImageMapping?: Record<string, string | null>;
  itemImageMapping?: Record<string, string | null>;
  instrumentLocationMapping?: Record<string, Location | null>;
  fixedItemLocationMapping?: Record<string, Location | null>;
  itemLocationMapping?: Record<string, Location | null>;
}
