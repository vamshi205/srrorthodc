import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw,
  Cloud,
  Database,
  FileText,
  CheckCircle2,
  Settings,
  UserCheck,
  HardDrive,
  Trash2,
  ArrowLeft,
  Building2,
  Phone,
  MapPin,
  User,
  Plus,
  Search,
  Edit2,
  Sparkles,
} from "lucide-react";
import {
  Customer,
  HospitalContact,
  getSavedCustomers,
  saveCustomer,
  deleteCustomer,
  fetchUnifiedCustomers,
  syncCustomersFromDcs,
} from "@/lib/customerStorage";
import { loadSavedDcs } from "@/lib/savedDcStorage";

type CashInvoiceAdminProps = {
  onBack: () => void;
};

export const CashInvoiceAdmin: React.FC<CashInvoiceAdminProps> = ({ onBack }) => {
  const [xlsxLoaded, setXlsxLoaded] = useState(false);

  // Form states
  const [templateTheme, setTemplateTheme] = useState("classic");
  const [gdriveClientId, setGdriveClientId] = useState("");
  const [gdriveFolderId, setGdriveFolderId] = useState("");
  const [gdriveStatus, setGdriveStatus] = useState("Offline");
  const [gdriveUserEmail, setGdriveUserEmail] = useState("");

  const [companyProfile, setCompanyProfile] = useState({
    name: "SRR ORTHO PLUS",
    address: "217, SIDDARTH NAGAR, HYDERABAD - 500038",
    contact: "9396857455",
    gstin: "",
    bank: "HDFC BANK, A/C: 5010023456789, IFSC: HDFC0001234, Hyderabad Branch",
    upi: "srrortho@hdfcbank",
    signature: "A.SATYANARAYANA"
  });

  // Data states
  const [catalogName, setCatalogName] = useState("");
  const [catalogCount, setCatalogCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);
  const [invoicesCount, setInvoicesCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);

  // Load SheetJS dynamically from CDN
  useEffect(() => {
    if ((window as any).XLSX) {
      setXlsxLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setXlsxLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Fetch localstorage settings on mount
  useEffect(() => {
    // Template
    const savedTemplate = localStorage.getItem("im_template_theme") || "classic";
    setTemplateTheme(savedTemplate);

    // GDrive
    setGdriveClientId(localStorage.getItem("im_gdrive_client_id") || "");
    setGdriveFolderId(localStorage.getItem("im_gdrive_folder_id") || "");
    const gdriveToken = localStorage.getItem("im_gdrive_access_token");
    const gdriveExpiry = parseInt(localStorage.getItem("im_gdrive_token_expiry") || "0");
    const hasToken = gdriveToken && Date.now() < gdriveExpiry;
    setGdriveStatus(hasToken ? "Connected" : "Offline");
    setGdriveUserEmail(localStorage.getItem("im_gdrive_user_email") || "");

    // Company Profile
    try {
      const savedProfile = localStorage.getItem("im_company_profile");
      if (savedProfile) {
        setCompanyProfile(prev => ({ ...prev, ...JSON.parse(savedProfile) }));
      }
    } catch (e) {
      console.error("Error loading company profile", e);
    }

    // Counts
    setCatalogName(localStorage.getItem("im_price_list_name") || "No Catalog Loaded");
    try {
      const priceList = localStorage.getItem("im_price_list");
      setCatalogCount(priceList ? JSON.parse(priceList).length : 0);
    } catch (e) { setCatalogCount(0); }

    try {
      const savedItems = localStorage.getItem("im_invoice_items");
      setItemsCount(savedItems ? JSON.parse(savedItems).length : 0);
    } catch (e) { setItemsCount(0); }

    try {
      const savedInvoices = localStorage.getItem("im_saved_invoices");
      setInvoicesCount(savedInvoices ? JSON.parse(savedInvoices).length : 0);
    } catch (e) { setInvoicesCount(0); }

    try {
      const savedCusts = localStorage.getItem("im_customers");
      setCustomersCount(savedCusts ? JSON.parse(savedCusts).length : 0);
    } catch (e) { setCustomersCount(0); }

    // Load Customers and listen to updates
    setCustomerList(getSavedCustomers());
    fetchUnifiedCustomers().then((list) => {
      setCustomerList(list);
      setCustomersCount(list.length);
    });

    const handleCustUpdate = () => {
      const updated = getSavedCustomers();
      setCustomerList(updated);
      setCustomersCount(updated.length);
    };
    window.addEventListener("srrortho:customers_updated", handleCustUpdate);
    return () => {
      window.removeEventListener("srrortho:customers_updated", handleCustUpdate);
    };
  }, []);

  // Customer Management states
  const [customerList, setCustomerList] = useState<Customer[]>(getSavedCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [custName, setCustName] = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [custHospitalNumber, setCustHospitalNumber] = useState("");
  const [custOtNumber, setCustOtNumber] = useState("");
  const [custPersonalNumber, setCustPersonalNumber] = useState("");
  const [custContactPerson, setCustContactPerson] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [custContacts, setCustContacts] = useState<HospitalContact[]>([]);
  const [isCustSaving, setIsCustSaving] = useState(false);

  // Filtered customer list
  const filteredCustomers = customerList.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.otNumber && c.otNumber.includes(q)) ||
      (c.hospitalNumber && c.hospitalNumber.includes(q)) ||
      (c.personalNumber && c.personalNumber.includes(q)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.contacts && c.contacts.some(item => 
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.phone && item.phone.includes(q)) ||
        (item.role && item.role.toLowerCase().includes(q))
      ))
    );
  });

  const handleAddContactRow = () => {
    setCustContacts((prev) => [
      ...prev,
      { id: `c_${Date.now()}`, role: "OT Number", name: "", phone: "" },
    ]);
  };

  const handleUpdateContactRow = (index: number, field: keyof HospitalContact, value: string) => {
    setCustContacts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveContactRow = (index: number) => {
    setCustContacts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveCustomerSubmit = async () => {
    if (!custName.trim()) {
      toast.error("Hospital / Customer name is required.");
      return;
    }

    setIsCustSaving(true);
    try {
      const cleanContacts = custContacts.filter(c => c.name?.trim() || c.phone?.trim());
      const saved = await saveCustomer({
        id: editingCust?.id,
        name: custName.trim(),
        previousName: editingCust?.name,
        mobile: (custMobile || custPersonalNumber || custOtNumber || custHospitalNumber || cleanContacts[0]?.phone || "").trim(),
        hospitalNumber: custHospitalNumber.trim(),
        otNumber: custOtNumber.trim(),
        personalNumber: custPersonalNumber.trim(),
        contactPerson: custContactPerson.trim(),
        contacts: cleanContacts,
        address: custAddress.trim(),
        email: custEmail.trim(),
        notes: custNotes.trim(),
      });

      toast.success(editingCust ? `Updated "${saved.name}"` : `Added "${saved.name}" to directory.`);
      setEditingCust(null);
      setCustName("");
      setCustMobile("");
      setCustHospitalNumber("");
      setCustOtNumber("");
      setCustPersonalNumber("");
      setCustContactPerson("");
      setCustAddress("");
      setCustEmail("");
      setCustNotes("");
      setCustContacts([]);
      setCustomerList(getSavedCustomers());
      setCustomersCount(getSavedCustomers().length);
    } catch (e: any) {
      toast.error(e.message || "Failed to save customer.");
    } finally {
      setIsCustSaving(false);
    }
  };

  const handleEditCustomerClick = (cust: Customer) => {
    setEditingCust(cust);
    setCustName(cust.name);
    setCustMobile(cust.mobile || "");
    setCustHospitalNumber(cust.hospitalNumber || "");
    setCustOtNumber(cust.otNumber || "");
    setCustPersonalNumber(cust.personalNumber || "");
    setCustContactPerson(cust.contactPerson || "");
    setCustAddress(cust.address || "");
    setCustEmail(cust.email || "");
    setCustNotes(cust.notes || "");
    setCustContacts(Array.isArray(cust.contacts) ? [...cust.contacts] : []);
  };

  const handleCancelEditCust = () => {
    setEditingCust(null);
    setCustName("");
    setCustMobile("");
    setCustHospitalNumber("");
    setCustOtNumber("");
    setCustPersonalNumber("");
    setCustContactPerson("");
    setCustAddress("");
    setCustEmail("");
    setCustNotes("");
    setCustContacts([]);
  };

  const handleDeleteCustomerClick = async (id: string, name: string) => {
    if (confirm(`Remove "${name}" from customer directory?`)) {
      await deleteCustomer(id);
      setCustomerList(getSavedCustomers());
      setCustomersCount(getSavedCustomers().length);
      toast.success(`Removed "${name}"`);
    }
  };

  const handleSyncDcHospitals = async () => {
    try {
      const dcs = await loadSavedDcs();
      const updated = syncCustomersFromDcs(dcs);
      setCustomerList(updated);
      setCustomersCount(updated.length);
      toast.success(`Synchronized ${updated.length} customers from DC history.`);
    } catch (e) {
      console.error("Error syncing DC hospitals:", e);
      toast.error("Could not sync hospitals from DC history.");
    }
  };

  // Profile Form changes
  const handleProfileChange = (field: string, value: string) => {
    setCompanyProfile(prev => ({ ...prev, [field]: value }));
  };

  const saveCompanyProfile = () => {
    localStorage.setItem("im_company_profile", JSON.stringify(companyProfile));
    toast.success("Company profile defaults updated successfully!");
  };

  // Template changes
  const saveTemplateTheme = (value: string) => {
    setTemplateTheme(value);
    localStorage.setItem("im_template_theme", value);
    toast.success(`Default template changed to: ${value.toUpperCase()}`);
  };

  // GDrive actions
  const saveGDriveConfig = () => {
    localStorage.setItem("im_gdrive_client_id", gdriveClientId.trim());
    localStorage.setItem("im_gdrive_folder_id", gdriveFolderId.trim());
    toast.success("Google Drive configuration saved!");
  };

  const handleGDriveLogin = () => {
    if (!gdriveClientId.trim()) {
      toast.error("Please enter a Google Client ID first!");
      return;
    }
    localStorage.setItem("im_gdrive_client_id", gdriveClientId.trim());
    localStorage.setItem("im_gdrive_folder_id", gdriveFolderId.trim());

    // OAuth implicit flow
    const redirectUri = window.location.origin + "/cash-invoice";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${gdriveClientId.trim()}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile")}`;
    
    toast.info("Redirecting to Google Account Sign-In...");
    window.location.href = authUrl;
  };

  const handleGDriveLogout = () => {
    localStorage.removeItem("im_gdrive_access_token");
    localStorage.removeItem("im_gdrive_token_expiry");
    localStorage.removeItem("im_gdrive_user_email");
    localStorage.removeItem("im_gdrive_user_name");
    setGdriveStatus("Offline");
    setGdriveUserEmail("");
    toast.success("Google Drive disconnected.");
  };

  // Price List Excel parsing
  const handleCatalogUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!xlsxLoaded) {
      toast.error("Spreadsheet library is still loading. Please try again in 5 seconds.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const XLSX = (window as any).XLSX;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        const findRowValue = (row: any, synonyms: string[]): any => {
          if (!row || typeof row !== 'object') return undefined;
          const keys = Object.keys(row);
          for (const syn of synonyms) {
            for (const key of keys) {
              if (key.toLowerCase().trim() === syn.toLowerCase().trim()) {
                return row[key];
              }
            }
          }
          for (const syn of synonyms) {
            for (const key of keys) {
              const lowerKey = key.toLowerCase().trim();
              const lowerSyn = syn.toLowerCase().trim();
              if (lowerKey.includes(lowerSyn) || lowerSyn.includes(lowerKey)) {
                return row[key];
              }
            }
          }
          return undefined;
        };

        const parsedCatalog = rawJson.map((row: any) => {
          const skuVal = findRowValue(row, ['sku', 'code', 'product id', 'product_id', 'item code', 'id', 'item_code', 'matched sku/code']);
          const descVal = findRowValue(row, ['description', 'desc', 'product name', 'product_name', 'item', 'item name', 'clean item name', 'product', 'name']);
          const sizeVal = findRowValue(row, ['size', 'specification', 'spec', 'dimension', 'size/specification', 'sizes', 'specs']);
          const priceVal = findRowValue(row, ['sell price', 'price', 'rate', 'unit price', 'rate (unit price)', 'mrp', 'cost', 'sell_price', 'sell price (inc tax)']);

          const sku = skuVal !== undefined && skuVal !== null ? String(skuVal).trim() : "";
          const desc = descVal !== undefined && descVal !== null ? String(descVal).trim() : "";
          const size = sizeVal !== undefined && sizeVal !== null ? String(sizeVal).trim() : "";
          const priceRaw = priceVal !== undefined && priceVal !== null ? String(priceVal).replace(/[^0-9.]/g, '') : "0";

          return {
            sku: sku,
            description: desc,
            size: size,
            price: parseFloat(priceRaw) || 0
          };
        }).filter(item => item.description !== "");

        if (parsedCatalog.length === 0) {
          toast.error("No valid items found. Ensure headers match: Product Name/Description, Sell Price/Price, Size");
          return;
        }

        localStorage.setItem("im_price_list", JSON.stringify(parsedCatalog));
        localStorage.setItem("im_price_list_name", file.name);
        setCatalogName(file.name);
        setCatalogCount(parsedCatalog.length);
        toast.success(`Price List loaded: ${parsedCatalog.length} items loaded from ${file.name}`);
      } catch (err) {
        console.error("Error reading spreadsheet", err);
        toast.error("Failed to parse Excel file. Ensure file format is valid.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClearCatalog = () => {
    if (confirm("Are you sure you want to remove the current product catalog? Suggestions in Cash Invoice will default to sample data.")) {
      localStorage.removeItem("im_price_list");
      localStorage.removeItem("im_price_list_name");
      setCatalogName("No Catalog Loaded");
      setCatalogCount(0);
      toast.success("Catalog database cleared.");
    }
  };

  // Invoice Items Bulk upload parser
  const handleItemsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!xlsxLoaded) {
      toast.error("Spreadsheet library is still loading. Please try again in 5 seconds.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const XLSX = (window as any).XLSX;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        const findRowValue = (row: any, synonyms: string[]): any => {
          if (!row || typeof row !== 'object') return undefined;
          const keys = Object.keys(row);
          for (const syn of synonyms) {
            for (const key of keys) {
              if (key.toLowerCase().trim() === syn.toLowerCase().trim()) {
                return row[key];
              }
            }
          }
          for (const syn of synonyms) {
            for (const key of keys) {
              const lowerKey = key.toLowerCase().trim();
              const lowerSyn = syn.toLowerCase().trim();
              if (lowerKey.includes(lowerSyn) || lowerSyn.includes(lowerKey)) {
                return row[key];
              }
            }
          }
          return undefined;
        };

        const parsedItems = rawJson.map((row: any) => {
          const descVal = findRowValue(row, ['description', 'desc', 'product name', 'product_name', 'item', 'item name', 'clean item name', 'product', 'name', 'original invoice description']);
          const skuVal = findRowValue(row, ['sku', 'code', 'product id', 'product_id', 'item code', 'id', 'item_code', 'matched sku/code']);
          const sizeVal = findRowValue(row, ['size', 'specification', 'spec', 'dimension', 'size/specification', 'sizes', 'specs']);
          const qtyVal = findRowValue(row, ['qty', 'quantity', 'qnt']);
          const rateVal = findRowValue(row, ['sell price', 'price', 'rate', 'unit price', 'rate (unit price)', 'mrp', 'cost', 'sell_price']);

          const desc = descVal !== undefined && descVal !== null ? String(descVal).trim() : "";
          const sku = skuVal !== undefined && skuVal !== null ? String(skuVal).trim() : "";
          const size = sizeVal !== undefined && sizeVal !== null ? String(sizeVal).trim() : "";
          const qtyRaw = qtyVal !== undefined && qtyVal !== null ? String(qtyVal).replace(/[^0-9]/g, '') : "1";
          const rateRaw = rateVal !== undefined && rateVal !== null ? String(rateVal).replace(/[^0-9.]/g, '') : "0";

          return {
            description: desc,
            sku: sku,
            size: size,
            qty: parseInt(qtyRaw) || 1,
            rate: parseFloat(rateRaw) || 0
          };
        }).filter(item => item.description !== "");

        if (parsedItems.length === 0) {
          toast.error("No valid items found. Ensure sheet contains headers like Product Name/Description, Size, Qty, Sell Price/Rate");
          return;
        }

        localStorage.setItem("im_invoice_items", JSON.stringify(parsedItems));
        setItemsCount(parsedItems.length);
        toast.success(`Successfully loaded ${parsedItems.length} items to invoice draft! Return to Cash Invoice to view.`);
      } catch (err) {
        console.error("Error reading items spreadsheet", err);
        toast.error("Failed to parse items Excel file. Ensure file format is valid.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClearDraftItems = () => {
    if (confirm("Are you sure you want to clear the active invoice draft items?")) {
      localStorage.removeItem("im_invoice_items");
      setItemsCount(0);
      toast.success("Draft items cleared.");
    }
  };

  // Maintenance clears
  const handleClearInvoices = () => {
    if (confirm("DANGER: This will delete ALL saved cash invoices in this browser. This action cannot be undone. Proceed?")) {
      localStorage.removeItem("im_saved_invoices");
      setInvoicesCount(0);
      toast.success("All saved invoices deleted.");
    }
  };

  const handleClearCustomers = () => {
    if (confirm("DANGER: This will delete ALL saved customers in this browser directory. Proceed?")) {
      localStorage.removeItem("im_customers");
      localStorage.removeItem("im_client_info");
      setCustomersCount(0);
      toast.success("Customer directory cleared.");
    }
  };

  return (
    <div className="space-y-6 w-full py-2 sm:py-4">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="gap-2 h-9">
          <ArrowLeft className="w-4 h-4" /> Back to Choice
        </Button>
        <div>
          <h1 className="text-xl font-display font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Cash Invoice Management
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure catalog price lists, defaults, template aesthetics, and cloud backups.
          </p>
        </div>
      </div>

      <Card className="glass-card rounded-xl border border-border shadow-md">
        <CardContent className="p-6">
          <Tabs defaultValue="catalog" className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto sm:h-10 w-full max-w-4xl mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
              <TabsTrigger value="catalog" className="text-xs font-semibold gap-1.5"><Database className="w-3.5 h-3.5" /> Catalog &amp; Imports</TabsTrigger>
              <TabsTrigger value="customers" className="text-xs font-semibold gap-1.5"><Building2 className="w-3.5 h-3.5 text-teal-600" /> Customers &amp; Hospitals</TabsTrigger>
              <TabsTrigger value="profile" className="text-xs font-semibold gap-1.5"><UserCheck className="w-3.5 h-3.5" /> Profile</TabsTrigger>
              <TabsTrigger value="gdrive" className="text-xs font-semibold gap-1.5"><Cloud className="w-3.5 h-3.5" /> Cloud Backup</TabsTrigger>
              <TabsTrigger value="data" className="text-xs font-semibold gap-1.5"><Settings className="w-3.5 h-3.5" /> Maintenance</TabsTrigger>
            </TabsList>

            {/* Catalog & Imports tab */}
            <TabsContent value="catalog" className="space-y-8">
              {/* SECTION 1: Product Catalog Database */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Product Price Catalog Database</h3>
                  <p className="text-xs text-muted-foreground">
                    Upload your price list Excel spreadsheet to enable autocomplete product recommendations on the Invoice canvas.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  {/* File Dropzone Card */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-slate-50/50 dark:bg-slate-900/20 text-center hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all">
                    <span className="text-3xl mb-2">📊</span>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Price List Spreadsheet</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Drag & drop or upload .xlsx, .xls, or .csv</p>
                    <Label htmlFor="catalog-file-input" className="mt-4">
                      <span className="btn-gradient inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer shadow-sm shadow-teal-500/10">
                        Browse Files
                      </span>
                    </Label>
                    <Input 
                      type="file" 
                      id="catalog-file-input" 
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                      onChange={handleCatalogUpload}
                    />
                  </div>

                  {/* Catalog Status Info */}
                  <div className="flex flex-col justify-between border border-border rounded-lg p-4 bg-slate-50/30 dark:bg-slate-950/20">
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Catalog Status</h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Price Catalog:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={catalogName}>{catalogName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Database Records:</span>
                          <span className="font-extrabold text-teal-600 dark:text-teal-400">{catalogCount} Items</span>
                        </div>
                      </div>
                    </div>
                    {catalogCount > 0 && (
                      <Button variant="destructive" size="sm" onClick={handleClearCatalog} className="w-full mt-4 gap-1.5 text-xs font-medium">
                        <Trash2 className="w-3.5 h-3.5" /> Remove Catalog Database
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: Bulk Import Invoice Items */}
              <div className="border-t border-border/40 pt-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Bulk Import Invoice Items (Draft)</h3>
                  <p className="text-xs text-muted-foreground">
                    Upload an Excel/CSV spreadsheet containing line items to bulk-load them into the active invoice sheet.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  {/* Items File Dropzone Card */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-slate-50/50 dark:bg-slate-900/20 text-center hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all">
                    <span className="text-3xl mb-2">📥</span>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Invoice Items Spreadsheet</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Drag & drop or upload .xlsx, .xls, or .csv</p>
                    <Label htmlFor="items-file-input" className="mt-4">
                      <span className="btn-gradient inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer shadow-sm shadow-purple-500/10">
                        Browse Files
                      </span>
                    </Label>
                    <Input 
                      type="file" 
                      id="items-file-input" 
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                      onChange={handleItemsUpload}
                    />
                  </div>

                  {/* Items Status Info */}
                  <div className="flex flex-col justify-between border border-border rounded-lg p-4 bg-slate-50/30 dark:bg-slate-950/20">
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Import Status</h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Active Draft Items:</span>
                          <span className="font-extrabold text-purple-600 dark:text-purple-400">{itemsCount} Items Loaded</span>
                        </div>
                      </div>
                    </div>
                    {itemsCount > 0 && (
                      <Button variant="destructive" size="sm" onClick={handleClearDraftItems} className="w-full mt-4 gap-1.5 text-xs font-medium">
                        <Trash2 className="w-3.5 h-3.5" /> Clear Draft Items
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Profile Defaults tab */}
            <TabsContent value="profile" className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Default Company & Payment Details</h3>
                <p className="text-xs text-muted-foreground">
                  Update your default business profile, bank account, UPI ID, and authorized signature. These values populate new cash bills automatically.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="prof-name" className="text-xs font-bold">Company Name</Label>
                  <Input 
                    id="prof-name" 
                    value={companyProfile.name} 
                    onChange={e => handleProfileChange("name", e.target.value)} 
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-contact" className="text-xs font-bold">Contact Number / Phone</Label>
                  <Input 
                    id="prof-contact" 
                    value={companyProfile.contact} 
                    onChange={e => handleProfileChange("contact", e.target.value)} 
                    className="h-9 text-xs"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="prof-address" className="text-xs font-bold">Company Address</Label>
                  <Textarea 
                    id="prof-address" 
                    value={companyProfile.address} 
                    onChange={e => handleProfileChange("address", e.target.value)} 
                    rows={2} 
                    className="text-xs resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-upi" className="text-xs font-bold">UPI Payment ID (for QR Generation)</Label>
                  <Input 
                    id="prof-upi" 
                    value={companyProfile.upi} 
                    onChange={e => handleProfileChange("upi", e.target.value)} 
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-sig" className="text-xs font-bold">Authorized Signatory Name</Label>
                  <Input 
                    id="prof-sig" 
                    value={companyProfile.signature} 
                    onChange={e => handleProfileChange("signature", e.target.value)} 
                    className="h-9 text-xs"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="prof-bank" className="text-xs font-bold">HDFC Bank Account Details</Label>
                  <Textarea 
                    id="prof-bank" 
                    value={companyProfile.bank} 
                    onChange={e => handleProfileChange("bank", e.target.value)} 
                    rows={2} 
                    className="text-xs resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveCompanyProfile} className="btn-gradient px-6 h-9 text-xs font-semibold shadow-sm">
                  Save Profile Defaults
                </Button>
              </div>
            </TabsContent>

            {/* Google Drive sync tab */}
            <TabsContent value="gdrive" className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Google Drive Cloud Backups</h3>
                <p className="text-xs text-muted-foreground">
                  Synchronize catalog prices, saved invoices, and customer directories securely across devices using your private Google Drive file backup space.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="gdrive-client" className="text-xs font-bold">Google API OAuth Client ID</Label>
                    <Input 
                      id="gdrive-client" 
                      type="password" 
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      placeholder="Enter Client ID..." 
                      value={gdriveClientId} 
                      onChange={e => setGdriveClientId(e.target.value)} 
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gdrive-folder" className="text-xs font-bold">Drive Backup Folder ID (Optional)</Label>
                    <Input 
                      id="gdrive-folder" 
                      placeholder="Enter Folder ID (defaults to root)..." 
                      value={gdriveFolderId} 
                      onChange={e => setGdriveFolderId(e.target.value)} 
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={saveGDriveConfig} className="text-xs h-8">
                      Save Config
                    </Button>
                    {gdriveStatus !== "Connected" ? (
                      <Button size="sm" onClick={handleGDriveLogin} className="btn-gradient text-xs h-8">
                        🔑 Sign In with Google
                      </Button>
                    ) : (
                      <Button variant="destructive" size="sm" onClick={handleGDriveLogout} className="text-xs h-8">
                        🚪 Disconnect Google
                      </Button>
                    )}
                  </div>
                </div>

                {/* Cloud Status Card */}
                <div className="flex flex-col justify-between border border-border rounded-lg p-4 bg-slate-50/30 dark:bg-slate-950/20">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Connection Status</h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Google Service:</span>
                        <span className={`font-bold ${gdriveStatus === "Connected" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{gdriveStatus}</span>
                      </div>
                      {gdriveStatus === "Connected" && gdriveUserEmail && (
                        <div className="flex justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Connected Email:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{gdriveUserEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {gdriveStatus === "Connected" && (
                    <div className="text-[10px] text-muted-foreground bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg mt-4 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Backups are synchronized automatically in the background on Cash Invoice save/print actions.</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Maintenance tab */}
            <TabsContent value="data" className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Preferences & Data Maintenance</h3>
                <p className="text-xs text-muted-foreground">
                  Select default templates and perform database cleanup operations for saved invoices and local directories.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Default Template Choice */}
                <div className="space-y-3 border border-border rounded-lg p-4 bg-slate-50/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Default Bill Template</h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-template-theme" className="text-[10px] text-muted-foreground">A4 Layout Aesthetic</Label>
                    <Select value={templateTheme} onValueChange={saveTemplateTheme}>
                      <SelectTrigger id="admin-template-theme" className="h-9 text-xs">
                        <SelectValue placeholder="Choose a template theme..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic">Classic Corporate</SelectItem>
                        <SelectItem value="minimal">Minimalist Grid</SelectItem>
                        <SelectItem value="teal">Modern Teal</SelectItem>
                        <SelectItem value="midnight">Midnight Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Storage maintenance card */}
                <div className="space-y-4 border border-border rounded-lg p-4 bg-slate-50/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Local Browser Directories</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <p className="font-bold text-slate-900 dark:text-slate-100">Saved Cash Invoices</p>
                        <p className="text-[10px] text-muted-foreground">{invoicesCount} Invoices in browser</p>
                      </div>
                      {invoicesCount > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleClearInvoices} className="h-8 text-xs font-medium gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Clear All
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-3">
                      <div className="text-xs">
                        <p className="font-bold text-slate-900 dark:text-slate-100">Customer Directory</p>
                        <p className="text-[10px] text-muted-foreground">{customersCount} Customers in browser</p>
                      </div>
                      {customersCount > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleClearCustomers} className="h-8 text-xs font-medium gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Clear All
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Customers & Hospitals Tab */}
            <TabsContent value="customers" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    Customer &amp; Hospital Directory
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage official hospital and customer accounts. Synchronized across Delivery Challans, Cash Invoicing, and reminders.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncDcHospitals}
                    className="h-8 text-xs gap-1.5 border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    Import from DC History
                  </Button>
                </div>
              </div>

              {/* Form to Add / Edit Customer */}
              <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-50/40 dark:bg-teal-950/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    {editingCust ? "Edit Customer / Hospital" : "Add New Customer / Hospital"}
                  </h4>
                  {editingCust && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEditCust}
                      className="h-6 text-[11px] text-muted-foreground"
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs font-bold">Hospital / Customer Name *</Label>
                    <Input
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="e.g. Apollo Hospital, Jubilee Hills"
                      className="mt-1 h-8 text-xs bg-white dark:bg-slate-950 font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-sky-600" />
                      Hospital Number (Reception / Board)
                    </Label>
                    <Input
                      type="tel"
                      value={custHospitalNumber}
                      onChange={(e) => setCustHospitalNumber(e.target.value)}
                      placeholder="e.g. 040-23607777"
                      className="mt-1 h-8 text-xs bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-teal-600" />
                      OT Number (Theatre / Incharge)
                    </Label>
                    <Input
                      type="tel"
                      value={custOtNumber}
                      onChange={(e) => setCustOtNumber(e.target.value)}
                      placeholder="e.g. 9848011223"
                      className="mt-1 h-8 text-xs bg-white dark:bg-slate-950 font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                      <User className="w-3 h-3 text-purple-600" />
                      Personal Number (Doctor / Mobile)
                    </Label>
                    <Input
                      type="tel"
                      value={custPersonalNumber}
                      onChange={(e) => setCustPersonalNumber(e.target.value)}
                      placeholder="e.g. 9848099881"
                      className="mt-1 h-8 text-xs bg-white dark:bg-slate-950 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-bold">Primary Doctor / Contact Person</Label>
                    <Input
                      value={custContactPerson}
                      onChange={(e) => setCustContactPerson(e.target.value)}
                      placeholder="e.g. Dr. Rao / Sister Sujatha"
                      className="mt-1 h-8 text-xs bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold">Branch / Address</Label>
                    <Input
                      value={custAddress}
                      onChange={(e) => setCustAddress(e.target.value)}
                      placeholder="e.g. Jubilee Hills, Hyderabad"
                      className="mt-1 h-8 text-xs bg-white dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold">Email ID</Label>
                    <Input
                      type="email"
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      placeholder="e.g. apollo@hospital.com"
                      className="mt-1 h-8 text-xs bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>

                {/* Dynamic Additional Contacts */}
                <div className="p-3 rounded-lg border border-border/80 bg-white/60 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Additional Contacts &amp; Numbers (Surgeons, OT Nurses, Stores, Accounts)
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddContactRow}
                      className="h-7 text-xs gap-1 border-teal-500 text-teal-700 hover:bg-teal-50"
                    >
                      <Plus className="w-3 h-3" /> Add Contact
                    </Button>
                  </div>
                  {custContacts.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">
                      No additional staff added. Click "+ Add Contact" to maintain multiple phone numbers.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {custContacts.map((contact, idx) => (
                        <div key={contact.id || idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                          <select
                            value={contact.role}
                            onChange={(e) => handleUpdateContactRow(idx, "role", e.target.value)}
                            className="h-7 text-xs font-bold rounded border border-input bg-background px-2 text-foreground"
                          >
                            <option value="OT Person">🩺 OT Person</option>
                            <option value="Accounts">💳 Accounts</option>
                            <option value="Reception">🏥 Reception</option>
                            <option value="Doctor">👨‍⚕️ Doctor</option>
                            <option value="Others">📋 Others</option>
                          </select>
                          <Input
                            placeholder="Staff Name"
                            value={contact.name}
                            onChange={(e) => handleUpdateContactRow(idx, "name", e.target.value)}
                            className="h-7 text-xs bg-white dark:bg-slate-950"
                          />
                          <Input
                            placeholder="Phone Number"
                            value={contact.phone}
                            onChange={(e) => handleUpdateContactRow(idx, "phone", e.target.value)}
                            className="h-7 text-xs bg-white dark:bg-slate-950"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveContactRow(idx)}
                            className="h-7 w-7 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={isCustSaving || !custName.trim()}
                    onClick={handleSaveCustomerSubmit}
                    className="h-8 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {editingCust ? "Update Hospital / Customer" : "Save Customer"}
                  </Button>
                </div>
              </div>

              {/* Search and Customer List */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search hospital, OT number, doctor, phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                  <Badge variant="outline" className="self-start sm:self-auto text-xs px-2.5 py-1 font-bold">
                    {filteredCustomers.length} Registered Hospitals
                  </Badge>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-muted-foreground border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Hospital / Customer</th>
                        <th className="py-2.5 px-3">Phone Lines (OT / Hosp / Pers)</th>
                        <th className="py-2.5 px-3">Staff &amp; Contacts</th>
                        <th className="py-2.5 px-4">Address / Branch</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                            No customers found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((cust) => (
                          <tr key={cust.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                            <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                              <div className="text-teal-800 dark:text-teal-300 font-bold text-sm">{cust.name}</div>
                              {cust.email && <div className="text-[10.5px] text-muted-foreground">✉️ {cust.email}</div>}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                {cust.otNumber && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9.5px] font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 px-1.5 py-0.5 rounded">OT</span>
                                    <a href={`tel:${cust.otNumber}`} className="font-semibold text-teal-700 hover:underline">{cust.otNumber}</a>
                                  </div>
                                )}
                                {cust.hospitalNumber && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9.5px] font-extrabold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 rounded">HOSP</span>
                                    <a href={`tel:${cust.hospitalNumber}`} className="font-semibold text-sky-700 hover:underline">{cust.hospitalNumber}</a>
                                  </div>
                                )}
                                {cust.personalNumber && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9.5px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded">PERS</span>
                                    <a href={`tel:${cust.personalNumber}`} className="font-semibold text-purple-700 hover:underline">{cust.personalNumber}</a>
                                  </div>
                                )}
                                {!cust.otNumber && !cust.hospitalNumber && !cust.personalNumber && cust.mobile && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9.5px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">MOB</span>
                                    <a href={`tel:${cust.mobile}`} className="font-semibold text-slate-700 hover:underline">{cust.mobile}</a>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {cust.contactPerson && <div className="font-bold text-slate-800 dark:text-slate-200">👤 {cust.contactPerson}</div>}
                              {Array.isArray(cust.contacts) && cust.contacts.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {cust.contacts.slice(0, 3).map((c, i) => (
                                    <div key={i} className="text-[11px] flex items-center gap-1">
                                      <span className="text-[9px] uppercase font-bold text-slate-400">[{c.role}]:</span>
                                      <span>{c.name}</span>
                                      {c.phone && <span className="text-teal-600 font-medium">({c.phone})</span>}
                                    </div>
                                  ))}
                                  {cust.contacts.length > 3 && (
                                    <div className="text-[10px] text-teal-600 font-bold">+{cust.contacts.length - 3} more contacts</div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground max-w-xs truncate" title={cust.address}>
                              {cust.address || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-right space-x-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCustomerClick(cust)}
                                className="h-7 w-7 text-slate-500 hover:text-teal-700"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCustomerClick(cust.id, cust.name)}
                                className="h-7 w-7 text-slate-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
