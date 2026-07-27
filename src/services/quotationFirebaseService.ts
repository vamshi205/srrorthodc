// src/services/quotationFirebaseService.ts

import { db } from '@/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

export const DEFAULT_COMPANY_DATA = {
  name: 'Sri Raja Rajeshwari Ortho Plus',
  address: 'H.No. 6-2-599 | Khairthabad | Hyderabad | Telangana - 500004',
  phone: '9396857455, 9397857455 | 040-65557455',
  email: 'srrorthoplus999@gmail.com',
  website: 'www.srrorthoplus.com',
  signatoryName: 'A. SATYANARAYANA',
  signatoryRole: 'Proprietor',
  signature: ''
};

export const DEFAULT_QUOTATION_TEMPLATES = [
  {
    id: 'trauma-implants-template',
    name: 'Trauma & Fracture Implants',
    description: 'Quotation template for standard trauma plates, cortical & cancellous screws, and pins.',
    subject: 'Quotation for Orthopedic Trauma Implants & Surgical Instruments',
    requiresPriceList: false,
    defaultPriceListId: '',
    defaultMake: 'SRR / Standard ISO & CE Certified',
    defaultDelivery: 'Immediate / Within 24 Hours',
    defaultDiscount: '10%',
    defaultGst: '5%',
    defaultPayment: '30 Days from Invoice Date',
    defaultValidity: '30 Days',
    defaultWarranty: '1 Year Manufacturer Warranty',
    defaultSpacing: 'compact',
    isPinned: true,
    content: [
      {
        type: 'text',
        value: 'With reference to your requirement, we are pleased to submit our lowest competitive rates for Trauma & Fracture Implants as detailed below. All items are manufactured using Medical Grade Titanium / Stainless Steel (316L).'
      },
      {
        type: 'table',
        headers: ['S.No', 'Item Description', 'HSN Code', 'Qty', 'Rate (₹)', 'Amount (₹)'],
        rows: [
          ['1', '3.5mm Small Fragment Locking Compression Plate (LCP) - 6 Hole', '90211000', '2', '2500', '5000.00'],
          ['2', '3.5mm Cortical Screws Self Tapping - Titanium (3.5mm x 32mm)', '90211000', '10', '350', '3500.00'],
          ['3', '4.5mm Broad Locking Plate - Titanium - 8 Hole', '90211000', '1', '4200', '4200.00'],
          ['4', '4.5mm Cortical Screws Self Tapping (4.5mm x 40mm)', '90211000', '8', '450', '3600.00'],
          ['5', 'Cannulated Cancellous Screws 6.5mm (16mm Thread - 75mm)', '90211000', '4', '850', '3400.00'],
          ['6', 'Kirschner Wires (K-Wires) 2.0mm Stainless Steel', '90211000', '10', '120', '1200.00']
        ]
      },
      {
        type: 'text',
        value: 'Terms & Conditions:\n1. Taxes: GST @ 5% extra as applicable.\n2. Delivery: F.O.R. Hospital Premises.\n3. Payment: Within 30 days of receipt of material.\n4. Subject to Hyderabad Jurisdiction.'
      }
    ]
  },
  {
    id: 'intramedullary-nailing-template',
    name: 'Intramedullary Nailing Systems',
    description: 'Comprehensive quotation for Tibial, Femoral, and PFN Interlocking Nailing Systems.',
    subject: 'Quotation for Intramedullary Interlocking Nailing Systems',
    requiresPriceList: false,
    defaultPriceListId: '',
    defaultMake: 'SRR Ortho / CE Certified',
    defaultDelivery: 'Immediate',
    defaultDiscount: '12%',
    defaultGst: '5%',
    defaultPayment: '30 Days',
    defaultValidity: '30 Days',
    defaultWarranty: '1 Year Warranty',
    defaultSpacing: 'compact',
    isPinned: true,
    content: [
      {
        type: 'text',
        value: 'We hereby offer our technical and financial quote for Medical Grade Titanium Intramedullary Interlocking Nailing Systems for Long Bone Fractures.'
      },
      {
        type: 'table',
        headers: ['S.No', 'Item Description', 'HSN Code', 'Qty', 'Rate (₹)', 'Amount (₹)'],
        rows: [
          ['1', 'Universal Tibial Interlocking Nail (Titanium - 9mm x 340mm)', '90211000', '1', '6500', '6500.00'],
          ['2', 'Universal Femoral Interlocking Nail (Titanium - 10mm x 380mm)', '90211000', '1', '7200', '7200.00'],
          ['3', 'Proximal Femoral Nail (PFN / A2 PFN) Long - 135 Degree', '90211000', '1', '8500', '8500.00'],
          ['4', '4.9mm Interlocking Bolts (Length 30mm - 60mm)', '90211000', '6', '450', '2700.00'],
          ['5', 'PFN Lag Screw 8.0mm & Hip Pin 6.4mm', '90211000', '2', '1200', '2400.00'],
          ['6', 'Nail End Caps (Standard 0mm / 5mm / 10mm)', '90211000', '2', '550', '1100.00']
        ]
      }
    ]
  },
  {
    id: 'spine-implants-template',
    name: 'Spine Pedicle Screw & Fixation Systems',
    description: 'Quotation template for Spine Surgery implants including Polyaxial Screws, Rods & Cages.',
    subject: 'Quotation for Spine Surgery Implants & Pedicle Screw Fixation System',
    requiresPriceList: false,
    defaultPriceListId: '',
    defaultMake: 'SRR Spine Series',
    defaultDelivery: 'Within 24 Hours',
    defaultDiscount: '15%',
    defaultGst: '5%',
    defaultPayment: '30 Days',
    defaultValidity: '60 Days',
    defaultWarranty: 'Full Lifetime Implant Material Guarantee',
    defaultSpacing: 'compact',
    isPinned: false,
    content: [
      {
        type: 'text',
        value: 'Sub: Quotation for Lumbar / Thoracic Spine Pedicle Screw Fixation Systems & PEEK Cages.'
      },
      {
        type: 'table',
        headers: ['S.No', 'Item Description', 'HSN Code', 'Qty', 'Rate (₹)', 'Amount (₹)'],
        rows: [
          ['1', 'Polyaxial Pedicle Screw Titanium (6.5mm x 45mm)', '90211000', '4', '3500', '14000.00'],
          ['2', 'Monoaxial Pedicle Screw Titanium (6.5mm x 40mm)', '90211000', '2', '3200', '6400.00'],
          ['3', 'Titanium Spine Connecting Rod 5.5mm (Length 100mm)', '90211000', '2', '1800', '3600.00'],
          ['4', 'Transverse Cross Link Connector (Adjustable)', '90211000', '1', '2800', '2800.00'],
          ['5', 'TLIF PEEK Lumbar Cage (Height 10mm x 28mm)', '90211000', '1', '7500', '7500.00'],
          ['6', 'Locking Set Screws 5.5mm', '90211000', '6', '350', '2100.00']
        ]
      }
    ]
  },
  {
    id: 'arthroplasty-implants-template',
    name: 'Joint Replacement & Arthroplasty',
    description: 'Quotation for Total Knee Replacement (TKR) and Bipolar / Total Hip Replacement (THR).',
    subject: 'Quotation for Joint Replacement Implants (Total Knee & Hip Arthroplasty)',
    requiresPriceList: false,
    defaultPriceListId: '',
    defaultMake: 'SRR Arthro Series / Imported USFDA Grade',
    defaultDelivery: 'On Surgery Schedule',
    defaultDiscount: '10%',
    defaultGst: '5%',
    defaultPayment: '30 Days',
    defaultValidity: '30 Days',
    defaultWarranty: '15 Years Clinical Track Record',
    defaultSpacing: 'compact',
    isPinned: false,
    content: [
      {
        type: 'text',
        value: 'We submit our standard quotation for Knee and Hip Joint Arthroplasty Implants.'
      },
      {
        type: 'table',
        headers: ['S.No', 'Item Description', 'HSN Code', 'Qty', 'Rate (₹)', 'Amount (₹)'],
        rows: [
          ['1', 'Total Knee Replacement System (Femoral + Tibial Component + Poly Insert)', '90211000', '1 Set', '48000', '48000.00'],
          ['2', 'Patellar Component High Flex Poly', '90211000', '1', '4500', '4500.00'],
          ['3', 'Bipolar Hip Prosthesis System (Modular Stem + Head + Shell)', '90211000', '1 Set', '24000', '24000.00'],
          ['4', 'Radiopaque Bone Cement with Antibiotic (40g Pack)', '30064000', '2', '2200', '4400.00'],
          ['5', 'Pulse Lavage Disposable Irrigation System', '90189099', '1', '3500', '3500.00']
        ]
      }
    ]
  },
  {
    id: 'surgical-instruments-template',
    name: 'Orthopedic Instrument Sets & Trays',
    description: 'Quotation for Reamers, Drill Bits, Drivers, Taps and General Ortho Instrument Sets.',
    subject: 'Quotation for Surgical Instrument Trays & Reaming Tools',
    requiresPriceList: false,
    defaultPriceListId: '',
    defaultMake: 'SRR Surgical Stainless Steel',
    defaultDelivery: 'Immediate Ex-Stock',
    defaultDiscount: '10%',
    defaultGst: '12%',
    defaultPayment: '30 Days',
    defaultValidity: '60 Days',
    defaultWarranty: '2 Years Instrument Warranty',
    defaultSpacing: 'compact',
    isPinned: false,
    content: [
      {
        type: 'text',
        value: 'Quotation for Premium Grade Stainless Steel Orthopedic Surgical Instruments and Drills.'
      },
      {
        type: 'table',
        headers: ['S.No', 'Item Description', 'HSN Code', 'Qty', 'Rate (₹)', 'Amount (₹)'],
        rows: [
          ['1', 'Quick Coupling Drill Bit SS 2.7mm x 150mm', '90189099', '5', '450', '2250.00'],
          ['2', 'Quick Coupling Drill Bit SS 3.5mm x 180mm', '90189099', '5', '500', '2500.00'],
          ['3', 'Hexagonal Screw Driver 2.5mm Shaft with Handle', '90189099', '2', '1200', '2400.00'],
          ['4', 'Flexible Intramedullary Reamer Shaft with Heads (8mm - 12mm)', '90189099', '1 Set', '18500', '18500.00'],
          ['5', 'Bone Tap 3.5mm Quick Coupling', '90189099', '2', '950', '1900.00'],
          ['6', 'Depth Gauge for Small Fragment Screws (0 - 60mm)', '90189099', '2', '1400', '2800.00']
        ]
      }
    ]
  }
];

export async function fetchQuotationDataFromFirestore() {
  try {
    // 1. Fetch Company Settings
    const companySnap = await getDoc(doc(db, 'settings', 'company'));
    let companyData = companySnap.exists() ? companySnap.data() : null;
    if (!companyData) {
      companyData = DEFAULT_COMPANY_DATA;
      await setDoc(doc(db, 'settings', 'company'), DEFAULT_COMPANY_DATA);
    }

    // 2. Fetch Templates
    const templatesSnap = await getDocs(collection(db, 'templates'));
    let templates = templatesSnap.docs.map(d => {
      const data = d.data();
      try {
        return { ...data, content: typeof data.content === 'string' ? JSON.parse(data.content) : data.content || [] };
      } catch {
        return data;
      }
    });

    if (templates.length === 0) {
      templates = DEFAULT_QUOTATION_TEMPLATES;
      for (const t of DEFAULT_QUOTATION_TEMPLATES) {
        await setDoc(doc(db, 'templates', t.id), {
          ...t,
          content: JSON.stringify(t.content)
        });
      }
    }

    // 3. Fetch History
    let history: any[] = [];
    try {
      const historySnap = await getDocs(query(collection(db, 'history'), orderBy('id', 'desc')));
      history = historySnap.docs.map(d => {
        const data = d.data();
        try {
          return { ...data, content: typeof data.content === 'string' ? JSON.parse(data.content) : data.content || [] };
        } catch {
          return data;
        }
      });
    } catch (e) {
      console.warn('History fetch error:', e);
    }

    // 4. Fetch Email History
    let emailHistory: any[] = [];
    try {
      const emailSnap = await getDocs(collection(db, 'emailHistory'));
      emailHistory = emailSnap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Email history fetch error:', e);
    }

    // 5. Fetch Price Lists
    let priceLists: any[] = [];
    try {
      const priceListsSnap = await getDocs(collection(db, 'priceLists'));
      priceLists = priceListsSnap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Price lists fetch error:', e);
    }

    // 6. Fetch Drive Files & Folders
    let driveFiles: any[] = [];
    try {
      const driveFilesSnap = await getDocs(collection(db, 'driveFiles'));
      driveFiles = driveFilesSnap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Drive files fetch error:', e);
    }

    let driveFolders: any[] = [];
    try {
      const driveFoldersSnap = await getDocs(collection(db, 'driveFolders'));
      driveFolders = driveFoldersSnap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Drive folders fetch error:', e);
    }

    return {
      companyData,
      templates,
      history,
      emailHistory,
      priceLists,
      driveFiles,
      driveFolders
    };
  } catch (error) {
    console.error('[QuotationHost] Error fetching quotation data from Firestore:', error);
    return {
      companyData: DEFAULT_COMPANY_DATA,
      templates: DEFAULT_QUOTATION_TEMPLATES,
      history: [],
      emailHistory: [],
      priceLists: [],
      driveFiles: [],
      driveFolders: []
    };
  }
}

export async function saveQuotationTemplateToFirestore(template: any) {
  try {
    const ref = doc(db, 'templates', template.id);
    await setDoc(ref, {
      ...template,
      content: typeof template.content === 'string' ? template.content : JSON.stringify(template.content || [])
    });
    return true;
  } catch (error) {
    console.error('[QuotationHost] Error saving template:', error);
    return false;
  }
}

export async function deleteQuotationTemplateFromFirestore(id: string) {
  try {
    await deleteDoc(doc(db, 'templates', id));
    return true;
  } catch (error) {
    console.error('[QuotationHost] Error deleting template:', error);
    return false;
  }
}

export async function saveQuotationHistoryToFirestore(item: any) {
  try {
    const ref = doc(db, 'history', item.id);
    await setDoc(ref, {
      ...item,
      content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content || [])
    });
    return true;
  } catch (error) {
    console.error('[QuotationHost] Error saving quotation history:', error);
    return false;
  }
}

export async function saveCompanySettingsToFirestore(data: any) {
  try {
    const ref = doc(db, 'settings', 'company');
    await setDoc(ref, data);
    return true;
  } catch (error) {
    console.error('[QuotationHost] Error saving company settings:', error);
    return false;
  }
}
