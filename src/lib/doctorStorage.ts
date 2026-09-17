import { SavedDc } from "./savedDcStorage";
import { getSavedCustomers, normalizeHospitalName } from "./customerStorage";

export interface DoctorRecommendation {
  name: string;
  count: number;
  isHospitalSpecific: boolean;
  source: "hospital_history" | "customer_contact" | "general_history";
}

const STORAGE_KEY = "srrortho:saved_doctors";

/**
 * Get saved list of all known doctors
 */
export const getSavedDoctors = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Save a doctor name to permanent roster
 */
export const saveDoctorName = (name: string): string[] => {
  const clean = name.trim();
  if (!clean) return getSavedDoctors();

  const current = getSavedDoctors();
  const lower = clean.toLowerCase();
  if (!current.some((d) => d.toLowerCase() === lower)) {
    const updated = [clean, ...current];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving doctor to localStorage:", e);
    }
    return updated;
  }
  return current;
};

/**
 * Extracts and computes doctor recommendations for a specific hospital
 */
export const getDoctorRecommendations = (
  hospitalName?: string,
  dcs: SavedDc[] = []
): DoctorRecommendation[] => {
  const normHospital = hospitalName ? normalizeHospitalName(hospitalName).toLowerCase() : "";
  const hospitalDoctorsMap = new Map<string, number>();
  const generalDoctorsMap = new Map<string, number>();

  // 1. Check saved customer directory for this hospital's contact person
  if (normHospital) {
    const customers = getSavedCustomers();
    const matchedCustomer = customers.find(
      (c) => normalizeHospitalName(c.name).toLowerCase() === normHospital
    );
    if (matchedCustomer?.contactPerson?.trim()) {
      const contact = matchedCustomer.contactPerson.trim();
      hospitalDoctorsMap.set(contact, 100); // Priority
    }
  }

  // 2. Scan past DCs
  dcs.forEach((dc) => {
    const doc = dc.doctorName?.trim();
    if (!doc) return;

    const dcHosp = dc.hospitalName ? normalizeHospitalName(dc.hospitalName).toLowerCase() : "";
    if (normHospital && dcHosp === normHospital) {
      hospitalDoctorsMap.set(doc, (hospitalDoctorsMap.get(doc) || 0) + 1);
    } else {
      generalDoctorsMap.set(doc, (generalDoctorsMap.get(doc) || 0) + 1);
    }
  });

  // 3. Scan saved doctors roster
  getSavedDoctors().forEach((doc) => {
    if (!generalDoctorsMap.has(doc) && !hospitalDoctorsMap.has(doc)) {
      generalDoctorsMap.set(doc, 0);
    }
  });

  const results: DoctorRecommendation[] = [];

  // Add hospital-specific first
  hospitalDoctorsMap.forEach((count, name) => {
    results.push({
      name,
      count,
      isHospitalSpecific: true,
      source: count >= 100 ? "customer_contact" : "hospital_history",
    });
  });

  // Add general doctors
  generalDoctorsMap.forEach((count, name) => {
    if (!hospitalDoctorsMap.has(name)) {
      results.push({
        name,
        count,
        isHospitalSpecific: false,
        source: "general_history",
      });
    }
  });

  return results.sort((a, b) => {
    if (a.isHospitalSpecific && !b.isHospitalSpecific) return -1;
    if (!a.isHospitalSpecific && b.isHospitalSpecific) return 1;
    return b.count - a.count;
  });
};
