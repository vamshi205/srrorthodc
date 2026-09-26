import { Customer } from "@/lib/customerStorage";

/**
 * Common generic medical stop words that can be ignored or de-weighted
 * when identifying the core identity of a hospital.
 */
const MEDICAL_STOP_WORDS = new Set([
  "hospital",
  "hospitals",
  "clinic",
  "clinics",
  "centre",
  "center",
  "healthcare",
  "health",
  "care",
  "super",
  "speciality",
  "specialty",
  "multispeciality",
  "multi",
  "institute",
  "institutes",
  "medcity",
  "city",
  "pvt",
  "ltd",
  "limited",
  "and",
  "of",
  "the",
  "dr",
  "doctor",
  "trust",
  "memorial",
  "nursing",
  "home",
  "foundation",
]);

/**
 * Common regional city / locality abbreviations mapped to their canonical names.
 */
const LOCATION_ALIASES: Record<string, string> = {
  secbad: "secunderabad",
  "sec-bad": "secunderabad",
  scbad: "secunderabad",
  secun: "secunderabad",
  hyd: "hyderabad",
  kphb: "kukatpally",
  hitech: "hitec",
  hiteccity: "hitec",
  jhills: "jubilee",
  "jubilee-hills": "jubilee",
  bhills: "banjara",
  "banjara-hills": "banjara",
  gbowli: "gachibowli",
  smguda: "somajiguda",
  kndpr: "kondapur",
  mlkpt: "malakpet",
  dsnr: "dilsukhnagar",
  mdpr: "madhapur",
  lbnagar: "lb nagar",
  "lb-nagar": "lb nagar",
  srnagar: "sr nagar",
  mpt: "mehdipatnam",
};

/**
 * Compute standard Levenshtein distance between two strings
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
};

/**
 * Clean and extract significant identity tokens from a hospital name
 */
export const extractHospitalTokens = (name: string): string[] => {
  if (!name) return [];

  // Normalize delimiters (commas, dots, dashes, slashes) to spaces
  const clean = name
    .toLowerCase()
    .replace(/[,\.\-\/\(\)\&]/g, " ")
    .trim();

  const rawTokens = clean.split(/\s+/).filter(Boolean);

  // Expand aliases and filter out generic stop words
  const expandedTokens: string[] = [];
  rawTokens.forEach((token) => {
    const alias = LOCATION_ALIASES[token];
    if (alias) {
      alias.split(/\s+/).forEach((t) => expandedTokens.push(t));
    } else {
      expandedTokens.push(token);
    }
  });

  // Filter out stop words
  const significant = expandedTokens.filter((t) => !MEDICAL_STOP_WORDS.has(t) && t.length > 1);

  // If everything was filtered out, fallback to expanded tokens
  return significant.length > 0 ? significant : expandedTokens;
};

/**
 * Determine if two individual tokens are similar (exact match, prefix, or typo)
 */
const areTokensSimilar = (t1: string, t2: string): boolean => {
  if (t1 === t2) return true;

  // Substring or prefix match for tokens of meaningful length (>= 4)
  if (t1.length >= 4 && t2.length >= 4) {
    if (t1.startsWith(t2) || t2.startsWith(t1)) return true;
    if (t1.includes(t2) || t2.includes(t1)) return true;
  }

  // Allow 1 typo for words of length 4+, 2 typos / transpositions for 6+
  const maxDist = t1.length >= 6 && t2.length >= 6 ? 2 : t1.length >= 4 && t2.length >= 4 ? 1 : 0;
  if (maxDist > 0) {
    const dist = levenshteinDistance(t1, t2);
    if (dist <= maxDist) return true;
  }

  return false;
};

export interface DuplicateMatchResult {
  match: Customer;
  score: number;
  reason: string;
}

/**
 * Calculate similarity score (0 to 1) between an input query and an existing candidate name
 */
export const calculateHospitalSimilarity = (query: string, candidate: string): number => {
  const qClean = query.trim().toLowerCase();
  const cClean = candidate.trim().toLowerCase();

  if (!qClean || !cClean) return 0;
  if (qClean === cClean) return 1.0;

  // Stripped alphanumeric check
  const qAlpha = qClean.replace(/[^a-z0-9]/g, "");
  const cAlpha = cClean.replace(/[^a-z0-9]/g, "");
  if (qAlpha === cAlpha) return 0.99;
  if (cAlpha.length > 4 && qAlpha.length > 4) {
    if (cAlpha.startsWith(qAlpha) || qAlpha.startsWith(cAlpha)) return 0.95;
    if (cAlpha.includes(qAlpha) || qAlpha.includes(cAlpha)) return 0.92;
  }

  const qTokens = extractHospitalTokens(query);
  const cTokens = extractHospitalTokens(candidate);

  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  let matchedQueryTokens = 0;
  qTokens.forEach((qt) => {
    const found = cTokens.some((ct) => areTokensSimilar(qt, ct));
    if (found) matchedQueryTokens++;
  });

  const queryOverlap = matchedQueryTokens / qTokens.length;

  // Jaccard similarity across unique matched tokens
  const matchedCandidateTokens = cTokens.filter((ct) =>
    qTokens.some((qt) => areTokensSimilar(qt, ct))
  ).length;

  const unionSize = qTokens.length + cTokens.length - matchedQueryTokens;
  const jaccard = unionSize > 0 ? (matchedQueryTokens + matchedCandidateTokens) / (2 * unionSize) : 0;

  // Base weighted score
  let score = queryOverlap * 0.75 + jaccard * 0.25;

  // Brand + Branch penalty check:
  // If query specifies a brand and a distinct location (e.g. "Apollo" + "Jubilee")
  // but candidate has a conflicting different location (e.g. "DRDO" or "Secunderabad"),
  // significantly lower score so different hospital branches don't collide!
  const hasMultipleTokens = qTokens.length >= 2;
  if (hasMultipleTokens && queryOverlap < 0.6) {
    score = Math.min(score, 0.4);
  }

  return Math.min(Math.max(score, 0), 1);
};

/**
 * Detect if an entered hospital name is a near-duplicate of an existing registered customer.
 * Returns the highest matching customer if score exceeds threshold (default 0.70).
 */
export const findNearDuplicateHospital = (
  inputName: string,
  customers: Customer[],
  threshold = 0.70
): DuplicateMatchResult | null => {
  if (!inputName || !inputName.trim()) return null;
  const cleanInput = inputName.trim();

  // If already an exact case-insensitive match, not considered a "near-duplicate" needing prompt
  const exact = customers.find(
    (c) => c.name.trim().toLowerCase() === cleanInput.toLowerCase()
  );
  if (exact) return null;

  let bestMatch: Customer | null = null;
  let bestScore = 0;

  for (const cust of customers) {
    if (!cust.name) continue;
    const score = calculateHospitalSimilarity(cleanInput, cust.name);

    if (score >= threshold) {
      const isRegistered = cust.notes !== "From DC History";
      const bestIsRegistered = bestMatch?.notes !== "From DC History";

      // Better score, or equal/close score favoring registered directory customer over history
      const isBetter =
        score > bestScore + 0.03 ||
        (score >= bestScore - 0.03 && isRegistered && !bestIsRegistered) ||
        (score > bestScore);

      if (isBetter) {
        bestScore = score;
        bestMatch = cust;
      }
    }
  }

  if (!bestMatch) return null;

  let reason = "Similar hospital profile found in records";
  if (bestScore >= 0.90) {
    reason = "High confidence match with existing registered hospital";
  } else if (bestScore >= 0.75) {
    reason = "Possible alternative name / branch match";
  }

  return {
    match: bestMatch,
    score: bestScore,
    reason,
  };
};

