import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, Cloud, Database, FileText, CheckCircle2, Settings, UserCheck, HardDrive, Trash2, ArrowLeft } from "lucide-react";

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
  }, []);

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
    <div className="space-y-6 max-w-4xl mx-auto py-4">
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
            <TabsList className="grid grid-cols-4 h-10 w-full max-w-lg mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <TabsTrigger value="catalog" className="text-xs font-semibold gap-1.5"><Database className="w-3.5 h-3.5" /> Catalog & Imports</TabsTrigger>
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
