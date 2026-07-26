/**
 * Cash Invoice Maker & Price Recommendation Engine
 * Core Application Logic
 */

// Application State
const state = {
    priceList: [],          // Loaded price list catalog
    invoiceItems: [],       // Current items on the invoice
    companyProfile: {},     // Persisted company profile
    clientInfo: {},         // Persisted client info
    activeRecIndex: -1,     // Selected autocomplete recommendation index
    activeRecInput: null,   // Current active search input element
    activeSizeIndex: -1,    // Selected autocomplete size index
    activeSizeInput: null,  // Current active size input element
    customers: [],          // Saved customer directory
    savedInvoices: []       // Saved invoices list
};
let activeDashboardTab = "invoices";

// Default Company Data
const DEFAULT_COMPANY = {
    name: "SRR ORTHO PLUS",
    address: "217, SIDDARTH NAGAR, HYDERABAD - 500038",
    contact: "9396857455",
    email: "srrorthoplus999@gmail.com",
    website: "srrorthoplus.com",
    gstin: "36AAAAA1111A1Z1",
    bank: "HDFC BANK, A/C: 5010023456789, IFSC: HDFC0001234, Hyderabad Branch",
    upi: "9396857455@ybl"
};

// Default Client Data
const DEFAULT_CLIENT = {
    name: "",
    address: "",
    mobile: "",
    email: "",
    invNumber: "",
    dcNumber: "",
    invDate: new Date().toISOString().split('T')[0],
    invDue: new Date().toISOString().split('T')[0]
};

// Sample Implants Data (Fallback if no custom catalog uploaded)
const SAMPLE_CATALOG = [
    { sku: "727967", description: "Fix Bipolar Prosthesis - Fenested", size: "53mm", price: 1600.0 },
    { sku: "727968", description: "Fix Bipolar Prosthesis - Fenested", size: "45mm", price: 1600.0 },
    { sku: "503849", description: "Rush Nail", size: "3.5 mm x 300 mm", price: 275.0 },
    { sku: "503850", description: "Rush Nail", size: "2.0 mm x 260 mm", price: 250.0 },
    { sku: "503852", description: "SS Wire", size: "30 SWG", price: 310.0 },
    { sku: "503853", description: "SS Wire", size: "16 SWG", price: 290.0 },
    { sku: "705346", description: "Schanz Tapper Pins - 6.0mm", size: "32th - 200mm", price: 75.0 },
    { sku: "753274", description: "Drill Bits", size: "4.0 mm x 250 mm", price: 135.0 },
    { sku: "753275", description: "Drill Bits", size: "2.7 mm x 150 mm", price: 120.0 }
];

// Sample Invoice Items to load
const SAMPLE_INVOICE_ITEMS = [
    { description: "Fix Bipolar Prosthesis - Fenested", sku: "727967", size: "53mm", qty: 2, rate: 1600 },
    { description: "Rush Nail", sku: "503849", size: "3.5 mm x 300 mm", qty: 16, rate: 275 },
    { description: "SS Wire", sku: "503852", size: "30 SWG", qty: 16, rate: 310 },
    { description: "Schanz Tapper Pins - 6.0mm", sku: "705346", size: "32th - 200mm", qty: 10, rate: 75 },
    { description: "Drill Bits", sku: "753274", size: "4.0 mm x 250 mm", qty: 15, rate: 135 }
];

// Auto-incrementing sequential invoice number generator
function getNextInvoiceNumber() {
    const saved = state.savedInvoices || [];
    if (saved.length === 0) {
        return "SRR-2026-0001";
    }
    let maxNum = 0;
    saved.forEach(inv => {
        const numStr = inv.invNumber || "";
        const match = numStr.match(/\d+$/); // match trailing digits
        if (match) {
            const val = parseInt(match[0]);
            if (val > maxNum) maxNum = val;
        }
    });
    const nextVal = maxNum + 1;
    const formattedVal = String(nextVal).padStart(4, '0');
    return `SRR-2026-${formattedVal}`;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    checkAuthGuard();
    handleGoogleOAuthRedirect();
    loadPersistedData();
    setupEventListeners();
    renderInvoiceRows();
    updateCalculations();
    initGoogleDriveSyncQuietly();
});

// Load Data from LocalStorage
function loadPersistedData() {
    // 1. Saved Invoices (Load first so sequential numbering helper can access it)
    const savedInvs = localStorage.getItem("im_saved_invoices");
    if (savedInvs) {
        state.savedInvoices = JSON.parse(savedInvs);
    } else {
        state.savedInvoices = [];
    }
    renderSavedInvoicesList();

    // 2. Company Profile
    state.companyProfile = JSON.parse(JSON.stringify(DEFAULT_COMPANY));
    
    // Sync UI elements (inputs and preview labels)
    for (const key in state.companyProfile) {
        const input = document.getElementById(`comp-${key}`);
        if (input) input.value = state.companyProfile[key];
        
        const preview = document.getElementById(`preview-comp-${key}`);
        if (preview) preview.innerText = state.companyProfile[key];
    }
    document.getElementById("preview-signature-comp").innerText = state.companyProfile.name || "";

    // 3. Client & Invoice Info
    const savedClient = localStorage.getItem("im_client_info");
    if (savedClient) {
        state.clientInfo = JSON.parse(savedClient);
    } else {
        state.clientInfo = { ...DEFAULT_CLIENT };
    }
    
    // Auto-generate invoice number if empty
    if (!state.clientInfo.invNumber) {
        state.clientInfo.invNumber = getNextInvoiceNumber();
    }
    if (state.clientInfo.dcNumber === undefined) {
        state.clientInfo.dcNumber = "";
    }
    
    // Sync UI inputs
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal("client-name", state.clientInfo.name || "");
    setVal("client-address", state.clientInfo.address || "");
    setVal("client-mobile", state.clientInfo.mobile || "");
    setVal("client-email", state.clientInfo.email || "");
    setVal("inv-number", state.clientInfo.invNumber || "");
    setVal("dc-number", state.clientInfo.dcNumber || "");
    setVal("inv-date", state.clientInfo.invDate || "");
    const invDueEl = document.getElementById("inv-due");
    if (invDueEl) invDueEl.value = state.clientInfo.invDue || "";
    
    // Sync Preview text
    document.getElementById("preview-client-name").innerText = state.clientInfo.name || "Click to enter Hospital / Customer Name";
    document.getElementById("preview-client-address").innerText = state.clientInfo.address || "Click to enter Customer Address";
    document.getElementById("preview-client-mobile").innerText = state.clientInfo.mobile || "+91 Mobile Number";
    document.getElementById("preview-client-email").innerText = state.clientInfo.email || "customer@email.com";
    document.getElementById("preview-inv-number").innerText = state.clientInfo.invNumber || "";
    document.getElementById("preview-dc-number").innerText = state.clientInfo.dcNumber || "-";
    document.getElementById("preview-inv-date").innerText = formatDateString(state.clientInfo.invDate);
    const previewInvDueEl = document.getElementById("preview-inv-due");
    if (previewInvDueEl) previewInvDueEl.innerText = formatDateString(state.clientInfo.invDue);

    // 4. Price List Catalog
    const savedPriceList = localStorage.getItem("im_price_list");
    const savedCatalogName = localStorage.getItem("im_price_list_name");
    if (savedPriceList) {
        state.priceList = JSON.parse(savedPriceList);
        updateCatalogBadge(state.priceList.length, savedCatalogName || "Loaded from storage");
    } else {
        // Load sample catalog items by default so recommendations work out-of-the-box
        state.priceList = [...SAMPLE_CATALOG];
        updateCatalogBadge(state.priceList.length, "Sample Implants Catalog");
    }

    // 5. Invoice Draft Items
    const savedItems = localStorage.getItem("im_invoice_items");
    if (savedItems) {
        state.invoiceItems = JSON.parse(savedItems);
    } else {
        // Initial empty row
        state.invoiceItems = [{ description: "", sku: "", size: "", qty: 1, rate: 0 }];
    }

    // 6. Customer Directory
    const savedCust = localStorage.getItem("im_customers");
    if (savedCust) {
        state.customers = JSON.parse(savedCust);
    } else {
        state.customers = [];
    }
    renderCustomerList();
    populateCustomerSelector();

    // 7. Google Drive Configuration
    state.gdriveClientId = localStorage.getItem("im_gdrive_client_id") || "";
    state.gdriveFolderId = localStorage.getItem("im_gdrive_folder_id") || "";
    state.gdriveAccessToken = localStorage.getItem("im_gdrive_access_token") || "";
    state.gdriveTokenExpiry = parseInt(localStorage.getItem("im_gdrive_token_expiry")) || 0;
    state.gdriveUserEmail = localStorage.getItem("im_gdrive_user_email") || "";
    state.gdriveUserName = localStorage.getItem("im_gdrive_user_name") || "";

    const clientIdInput = document.getElementById("gdrive-client-id");
    const folderIdInput = document.getElementById("gdrive-folder-id");
    if (clientIdInput) clientIdInput.value = state.gdriveClientId;
    if (folderIdInput) folderIdInput.value = state.gdriveFolderId;

    updateGDriveUIStatus();
}

// Set up UI Interaction Event Listeners
function setupEventListeners() {
    // Toggle + Add Dropdown Menu
    const addMenuBtn = document.getElementById("add-menu-btn");
    const addDropdownMenu = document.getElementById("add-dropdown-menu");
    
    if (addMenuBtn && addDropdownMenu) {
        addMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            addDropdownMenu.classList.toggle("show");
            const viewDropdown = document.getElementById("view-dropdown-menu");
            if (viewDropdown) viewDropdown.classList.remove("show");
        });
    }

    // Close Dropdown Menu on clicking outside
    document.addEventListener("click", (e) => {
        if (addDropdownMenu && !addMenuBtn.contains(e.target) && !addDropdownMenu.contains(e.target)) {
            addDropdownMenu.classList.remove("show");
        }
    });

    // Add Customer modal controls
    const addCustModal = document.getElementById("add-customer-modal");
    const closeCustModalBtn = document.getElementById("close-cust-modal-btn");
    const cancelCustModalBtn = document.getElementById("cancel-cust-modal-btn");
    const saveCustModalBtn = document.getElementById("save-cust-modal-btn");

    const openCustModal = () => {
        if (addCustModal) {
            addCustModal.classList.add("active");
            const nameField = document.getElementById("modal-cust-name");
            if (nameField) nameField.focus();
        }
    };

    const closeCustModal = () => {
        if (addCustModal) {
            addCustModal.classList.remove("active");
            // Clear inputs
            document.getElementById("modal-cust-name").value = "";
            document.getElementById("modal-cust-mobile").value = "";
            document.getElementById("modal-cust-email").value = "";
            document.getElementById("modal-cust-address").value = "";
        }
    };

    if (closeCustModalBtn) closeCustModalBtn.addEventListener("click", closeCustModal);
    if (cancelCustModalBtn) cancelCustModalBtn.addEventListener("click", closeCustModal);
    
    // Close modal on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && addCustModal && addCustModal.classList.contains("active")) {
            closeCustModal();
        }
    });

    if (saveCustModalBtn) {
        saveCustModalBtn.addEventListener("click", () => {
            const name = document.getElementById("modal-cust-name").value.trim();
            const mobile = document.getElementById("modal-cust-mobile").value.trim();
            const email = document.getElementById("modal-cust-email").value.trim();
            const address = document.getElementById("modal-cust-address").value.trim();
            
            if (!name) {
                alert("Customer name is required!");
                return;
            }
            
            const newCustomer = { name, mobile, email, address };
            state.customers.push(newCustomer);
            localStorage.setItem("im_customers", JSON.stringify(state.customers));
            
            // Re-render UI list & dropdown
            renderCustomerList();
            populateCustomerSelector();
            
            // Auto preload created customer directly onto current invoice
            preloadCustomer(newCustomer);
            
            closeCustModal();
            showStatus(`Added and loaded customer: ${name}`);

            // Background Google Drive sync
            if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                syncCustomersWithGDrive(true);
            }
        });
    }

    // Add Customer option click
    const addCustomerMenuOpt = document.getElementById("add-customer-menu-opt");
    if (addCustomerMenuOpt) {
        addCustomerMenuOpt.addEventListener("click", () => {
            if (addDropdownMenu) addDropdownMenu.classList.remove("show");
            openCustModal();
        });
    }

    // Toggle View Dropdown Menu
    const viewMenuBtn = document.getElementById("view-menu-btn");
    const viewDropdownMenu = document.getElementById("view-dropdown-menu");
    if (viewMenuBtn && viewDropdownMenu) {
        viewMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            viewDropdownMenu.classList.toggle("show");
            if (addDropdownMenu) addDropdownMenu.classList.remove("show");
        });
    }

    // Close Dropdown Menus on clicking outside
    document.addEventListener("click", (e) => {
        if (addDropdownMenu && !addMenuBtn.contains(e.target) && !addDropdownMenu.contains(e.target)) {
            addDropdownMenu.classList.remove("show");
        }
        if (viewDropdownMenu && !viewMenuBtn.contains(e.target) && !viewDropdownMenu.contains(e.target)) {
            viewDropdownMenu.classList.remove("show");
        }
    });

    // View Customers option click
    const viewCustomersOpt = document.getElementById("view-customers-opt");
    const viewCustomersModal = document.getElementById("view-customers-modal");
    const closeViewCustModalBtn = document.getElementById("close-view-cust-modal-btn");
    const closeViewCustModalBtn2 = document.getElementById("close-view-cust-modal-btn2");
    const modalCustSearch = document.getElementById("modal-cust-search");

    const openViewCustModal = () => {
        if (viewCustomersModal) {
            viewCustomersModal.classList.add("active");
            if (modalCustSearch) modalCustSearch.value = "";
            renderModalCustomerList();
        }
    };

    const closeViewCustModal = () => {
        if (viewCustomersModal) {
            viewCustomersModal.classList.remove("active");
        }
    };

    if (viewCustomersOpt) {
        viewCustomersOpt.addEventListener("click", () => {
            if (viewDropdownMenu) viewDropdownMenu.classList.remove("show");
            openViewCustModal();
        });
    }

    if (closeViewCustModalBtn) closeViewCustModalBtn.addEventListener("click", closeViewCustModal);
    if (closeViewCustModalBtn2) closeViewCustModalBtn.addEventListener("click", closeViewCustModal);

    if (modalCustSearch) {
        modalCustSearch.addEventListener("input", (e) => {
            renderModalCustomerList(e.target.value);
        });
    }

    // View Invoices option click (opens standalone dashboard page)
    const viewInvoicesOpt = document.getElementById("view-invoices-opt");
    const invoicesDashboardContainer = document.getElementById("invoices-dashboard-container");
    const invoiceEditorContainer = document.querySelector(".invoice-container");
    const backToEditorBtn = document.getElementById("back-to-editor-btn");
    const dashboardInvSearch = document.getElementById("dashboard-inv-search");


    if (viewInvoicesOpt) {
        viewInvoicesOpt.addEventListener("click", () => {
            if (viewDropdownMenu) viewDropdownMenu.classList.remove("show");
            switchDashboardTab("invoices");
            openInvoicesDashboard();
        });
    }

    const viewReportsOpt = document.getElementById("view-reports-opt");
    if (viewReportsOpt) {
        viewReportsOpt.addEventListener("click", () => {
            if (viewDropdownMenu) viewDropdownMenu.classList.remove("show");
            switchDashboardTab("reports");
            openInvoicesDashboard();
        });
    }



    if (backToEditorBtn) {
        backToEditorBtn.addEventListener("click", closeInvoicesDashboard);
    }

    if (dashboardInvSearch) {
        dashboardInvSearch.addEventListener("input", (e) => {
            if (activeDashboardTab === "invoices") {
                renderDashboardInvoicesList(e.target.value);
            } else {
                renderDashboardReportsList(e.target.value);
            }
        });
    }

    // Ledger Modal close logic
    const ledgerModal = document.getElementById("ledger-modal");
    const closeLedgerBtn = document.getElementById("close-ledger-modal-btn");
    const closeLedgerBtn2 = document.getElementById("close-ledger-modal-btn2");
    
    const closeLedger = () => {
        if (ledgerModal) {
            ledgerModal.classList.remove("active");
        }
    };
    if (closeLedgerBtn) closeLedgerBtn.addEventListener("click", closeLedger);
    if (closeLedgerBtn2) closeLedgerBtn2.addEventListener("click", closeLedger);

    // Ledger Generate button trigger
    const btnGenerateLedger = document.getElementById("btn-generate-ledger");
    if (btnGenerateLedger) {
        btnGenerateLedger.addEventListener("click", () => {
            const customerName = document.getElementById("ledger-customer-name").innerText;
            const startDate = document.getElementById("ledger-start-date").value;
            const endDate = document.getElementById("ledger-end-date").value;
            if (!startDate || !endDate) {
                alert("Please select both start and end dates.");
                return;
            }
            renderLedger(customerName, startDate, endDate);
        });
    }

    // Print Ledger trigger
    const btnPrintLedger = document.getElementById("btn-print-ledger");
    if (btnPrintLedger) {
        btnPrintLedger.addEventListener("click", () => {
            const customerName = document.getElementById("ledger-customer-name").innerText;
            const startDate = document.getElementById("ledger-start-date").value;
            const endDate = document.getElementById("ledger-end-date").value;
            
            const data = getLedgerData(customerName, startDate, endDate);
            
            let rowsHtml = "";
            data.rows.forEach(item => {
                rowsHtml += `
                    <tr>
                        <td>${formatDateString(item.date)}</td>
                        <td>${item.particulars}</td>
                        <td class="text-right">${item.debit > 0 ? '₹' + item.debit.toFixed(2) : '-'}</td>
                        <td class="text-right">${item.credit > 0 ? '₹' + item.credit.toFixed(2) : '-'}</td>
                        <td class="text-right">₹${item.balance.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            printLedger(customerName, startDate, endDate, rowsHtml, data.openingBal, data.closingBal);
        });
    }

    // Export Ledger Excel trigger
    const btnExportLedgerExcel = document.getElementById("btn-export-ledger-excel");
    if (btnExportLedgerExcel) {
        btnExportLedgerExcel.addEventListener("click", () => {
            const customerName = document.getElementById("ledger-customer-name").innerText;
            const startDate = document.getElementById("ledger-start-date").value;
            const endDate = document.getElementById("ledger-end-date").value;
            
            const data = getLedgerData(customerName, startDate, endDate);
            
            const excelData = [];
            excelData.push({
                "Date": "-",
                "Particulars": "Opening Balance",
                "Debit (INR)": 0,
                "Credit (INR)": 0,
                "Balance (INR)": data.openingBal
            });
            
            data.rows.forEach(r => {
                excelData.push({
                    "Date": formatDateString(r.date),
                    "Particulars": r.particulars,
                    "Debit (INR)": r.debit,
                    "Credit (INR)": r.credit,
                    "Balance (INR)": r.balance
                });
            });
            
            const fileName = `Ledger_${customerName.replace(/[^a-zA-Z0-9]/g, "_")}_${startDate}_to_${endDate}.xlsx`;
            const sheetHeaders = ["Date", "Particulars", "Debit (INR)", "Credit (INR)", "Balance (INR)"];
            
            exportToExcel(excelData, fileName, sheetHeaders);
            showStatus(`Exported ledger for ${customerName}`);
        });
    }

    // Export Used Items Report Excel trigger
    const downloadReportBtn = document.getElementById("download-report-btn");
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener("click", () => {
            const reportData = getUsedItemsReportData();
            
            const excelData = reportData.map(item => ({
                "Item Name": item.name,
                "Size": item.size || "-",
                "Total Qty": item.qty
            }));
            
            const fileName = `Used_Items_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            const sheetHeaders = ["Item Name", "Size", "Total Qty"];
            
            exportToExcel(excelData, fileName, sheetHeaders);
            showStatus("Exported used items report");
        });
    }

    // Escape keys to close modals
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (viewCustomersModal && viewCustomersModal.classList.contains("active")) {
                closeViewCustModal();
            }
            if (ledgerModal && ledgerModal.classList.contains("active")) {
                closeLedger();
            }
        }
    });

    // Close modals on clicking backdrop
    if (viewCustomersModal) {
        viewCustomersModal.addEventListener("click", (e) => {
            if (e.target === viewCustomersModal) closeViewCustModal();
        });
    }
    if (addCustModal) {
        addCustModal.addEventListener("click", (e) => {
            if (e.target === addCustModal) closeCustModal();
        });
    }
    if (ledgerModal) {
        ledgerModal.addEventListener("click", (e) => {
            if (e.target === ledgerModal) closeLedger();
        });
    }

    // Settings Sidebar Collapsible Drawer Toggle
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const settingsToggleBtn = document.getElementById("settings-toggle-btn");
    const closeSidebarBtn = document.getElementById("close-sidebar-btn");

    const openSettings = () => {
        sidebar.classList.remove("collapsed");
        overlay.classList.add("active");
    };

    const closeSettings = () => {
        sidebar.classList.add("collapsed");
        overlay.classList.remove("active");
    };

    if (settingsToggleBtn) settingsToggleBtn.addEventListener("click", openSettings);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSettings);
    if (overlay) overlay.addEventListener("click", closeSettings);

    // Theme toggler
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const nextTheme = currentTheme === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", nextTheme);
            themeBtn.innerText = nextTheme === "dark" ? "☀️ Theme" : "🌙 Theme";
        });
    }

    // Template Selector
    const templateThemeSelect = document.getElementById("template-theme");
    if (templateThemeSelect) {
        templateThemeSelect.addEventListener("change", (e) => {
            const selected = e.target.value;
            const paper = document.getElementById("invoice-paper");
            paper.setAttribute("data-theme", selected);
        });
    }

    // Profile Inputs Sync
    ["name", "address", "contact", "gstin", "bank", "upi"].forEach(field => {
        const input = document.getElementById(`comp-${field}`);
        if (input) {
            input.addEventListener("input", (e) => {
                const val = e.target.value;
                state.companyProfile[field] = val;
                
                const preview = document.getElementById(`preview-comp-${field}`);
                if (preview) preview.innerText = val;
                
                if (field === "name") {
                    document.getElementById("preview-signature-comp").innerText = val;
                }
                
                localStorage.setItem("im_company_profile", JSON.stringify(state.companyProfile));
                if (field === "upi") updateUpiQrCode();
            });
        }
    });

    setupPaperEditableSync();
    // Client/Invoice Inputs Sync
    const syncClientInput = (inputId, stateKey, previewId, isDate = false) => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener("input", (e) => {
                const val = e.target.value;
                state.clientInfo[stateKey] = val;
                
                const preview = document.getElementById(previewId);
                if (preview) {
                    preview.innerText = isDate ? formatDateString(val) : val;
                }
                localStorage.setItem("im_client_info", JSON.stringify(state.clientInfo));
            });
        }
    };
    syncClientInput("client-name", "name", "preview-client-name");
    syncClientInput("client-address", "address", "preview-client-address");
    syncClientInput("client-mobile", "mobile", "preview-client-mobile");
    syncClientInput("client-email", "email", "preview-client-email");
    syncClientInput("inv-number", "invNumber", "preview-inv-number");
    syncClientInput("dc-number", "dcNumber", "preview-dc-number");
    syncClientInput("inv-date", "invDate", "preview-inv-date", true);


    // Customer Dropdown Selector
    const custSelector = document.getElementById("customer-selector");
    if (custSelector) {
        custSelector.addEventListener("change", (e) => {
            const idx = e.target.value;
            if (idx !== "") {
                preloadCustomer(state.customers[idx]);
            }
        });
    }

    const validateInvoice = () => {
        // 1. Validate Customer/Client Name
        const clientName = (state.clientInfo.name || "").trim();
        if (!clientName || clientName === "Customer Name" || clientName === "Hospital / Customer Name") {
            alert("Mandatory Error: Please click and enter a valid Client/Customer Name directly on the invoice sheet.");
            const previewEl = document.getElementById("preview-client-name");
            if (previewEl) previewEl.focus();
            return false;
        }

        // 2. Validate Invoice Number
        const invNum = (state.clientInfo.invNumber || "").trim();
        if (!invNum) {
            alert("Mandatory Error: Please click and enter an Invoice Number directly on the invoice sheet.");
            const previewEl = document.getElementById("preview-inv-number");
            if (previewEl) previewEl.focus();
            return false;
        }

        // 3. Validate Invoice Date
        const invDate = (state.clientInfo.invDate || "").trim();
        if (!invDate) {
            alert("Mandatory Error: Please select an Invoice Date.");
            const invDateEl = document.getElementById("inv-date");
            if (invDateEl) {
                const sidebar = document.getElementById("sidebar");
                if (sidebar && sidebar.classList.contains("collapsed")) {
                    document.getElementById("settings-toggle-btn").click();
                }
                invDateEl.focus();
            }
            return false;
        }

        // 4. Validate Invoice Items Presence
        const nonBlankItems = state.invoiceItems.filter(item => (item.description || "").trim() !== "");
        if (nonBlankItems.length === 0) {
            alert("Mandatory Error: The invoice must contain at least one item with a description.");
            const firstDescInput = document.querySelector("#invoice-tbody .desc-input");
            if (firstDescInput) firstDescInput.focus();
            return false;
        }

        // 5. Validate each item's details (Size, Qty, Rate)
        for (let i = 0; i < state.invoiceItems.length; i++) {
            const item = state.invoiceItems[i];
            const desc = (item.description || "").trim();
            if (!desc) continue; // skip completely blank lines

            // Check if catalog has sizes for this item description
            const hasCatalogSizes = state.priceList.some(p => 
                String(p.description || p.base_description || "").toLowerCase().trim() === desc.toLowerCase().trim() && 
                String(p.size || "").trim() !== ""
            );

            // Size validation
            if (hasCatalogSizes && (!item.size || item.size.trim() === "")) {
                alert(`Row ${i + 1}: Please select a size for "${desc}".`);
                const rows = document.querySelectorAll("#invoice-tbody tr");
                if (rows[i]) {
                    const sizeInput = rows[i].querySelector(".size-input");
                    if (sizeInput) sizeInput.focus();
                }
                return false;
            }

            // Qty validation
            const qty = parseInt(item.qty);
            if (isNaN(qty) || qty <= 0) {
                alert(`Row ${i + 1}: Quantity must be greater than 0 for "${desc}".`);
                const rows = document.querySelectorAll("#invoice-tbody tr");
                if (rows[i]) {
                    const qtyInput = rows[i].querySelector(".qty-input");
                    if (qtyInput) {
                        qtyInput.focus();
                        qtyInput.select();
                    }
                }
                return false;
            }

            // Price/Rate validation
            const rate = parseFloat(item.rate);
            if (isNaN(rate) || rate <= 0) {
                alert(`Row ${i + 1}: Price Rate must be greater than 0 for "${desc}".`);
                const rows = document.querySelectorAll("#invoice-tbody tr");
                if (rows[i]) {
                    const rateInput = rows[i].querySelector(".rate-input");
                    if (rateInput) {
                        rateInput.focus();
                        rateInput.select();
                    }
                }
                return false;
            }
        }

        return true;
    };

    // Reusable function to save the current invoice in the workspace
    const saveActiveInvoice = () => {
        if (!validateInvoice()) return;

        let subtotal = 0;
        state.invoiceItems.forEach(item => {
            subtotal += (item.qty || 0) * (item.rate || 0);
        });
        const flatDiscount = parseFloat(document.getElementById("discount-flat-input").value) || 0;
        const grandTotal = Math.round(subtotal - flatDiscount);
        
        const invoiceToSave = {
            invNumber: state.clientInfo.invNumber || getNextInvoiceNumber(),
            dcNumber: state.clientInfo.dcNumber || "",
            invDate: state.clientInfo.invDate || new Date().toISOString().split('T')[0],
            invDue: state.clientInfo.invDue || new Date().toISOString().split('T')[0],
            clientName: state.clientInfo.name || "Walk-in Customer",
            clientAddress: state.clientInfo.address || "",
            clientMobile: state.clientInfo.mobile || "",
            clientEmail: state.clientInfo.email || "",
            invoiceItems: JSON.parse(JSON.stringify(state.invoiceItems.filter(item => (item.description || "").trim() !== ""))),
            discount: flatDiscount,
            grandTotal: grandTotal,
            paymentReceived: 0,
            savedAt: new Date().getTime()
        };
        
        const existingIdx = state.savedInvoices.findIndex(inv => inv.invNumber === invoiceToSave.invNumber);
        if (existingIdx !== -1) {
            if (confirm(`Invoice ${invoiceToSave.invNumber} already exists. Do you want to update it?`)) {
                // Preserve paymentReceived from existing invoice
                invoiceToSave.paymentReceived = state.savedInvoices[existingIdx].paymentReceived || 0;
                state.savedInvoices[existingIdx] = invoiceToSave;
                showStatus(`Updated saved invoice: ${invoiceToSave.invNumber}`);
            } else {
                return;
            }
        } else {
            state.savedInvoices.push(invoiceToSave);
            showStatus(`Saved invoice: ${invoiceToSave.invNumber}`);
        }
        
        localStorage.setItem("im_saved_invoices", JSON.stringify(state.savedInvoices));
        renderSavedInvoicesList();
        switchDashboardTab("invoices");
        openInvoicesDashboard();

        // Background Google Drive sync
        if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
            syncInvoicesWithGDrive(true);
        }
    };

    const saveActiveInvoiceSilent = () => {
        if (!validateInvoice()) return false;

        let subtotal = 0;
        state.invoiceItems.forEach(item => {
            subtotal += (item.qty || 0) * (item.rate || 0);
        });
        const flatDiscount = parseFloat(document.getElementById("discount-flat-input").value) || 0;
        const grandTotal = Math.round(subtotal - flatDiscount);
        
        const invoiceToSave = {
            invNumber: state.clientInfo.invNumber || getNextInvoiceNumber(),
            dcNumber: state.clientInfo.dcNumber || "",
            invDate: state.clientInfo.invDate || new Date().toISOString().split('T')[0],
            invDue: state.clientInfo.invDue || new Date().toISOString().split('T')[0],
            clientName: state.clientInfo.name || "Walk-in Customer",
            clientAddress: state.clientInfo.address || "",
            clientMobile: state.clientInfo.mobile || "",
            clientEmail: state.clientInfo.email || "",
            invoiceItems: JSON.parse(JSON.stringify(state.invoiceItems.filter(item => (item.description || "").trim() !== ""))),
            discount: flatDiscount,
            grandTotal: grandTotal,
            paymentReceived: 0,
            savedAt: new Date().getTime()
        };
        
        const existingIdx = state.savedInvoices.findIndex(inv => inv.invNumber === invoiceToSave.invNumber);
        if (existingIdx !== -1) {
            invoiceToSave.paymentReceived = state.savedInvoices[existingIdx].paymentReceived || 0;
            state.savedInvoices[existingIdx] = invoiceToSave;
            showStatus(`Updated saved invoice: ${invoiceToSave.invNumber}`);
        } else {
            state.savedInvoices.push(invoiceToSave);
            showStatus(`Saved invoice: ${invoiceToSave.invNumber}`);
        }
        
        localStorage.setItem("im_saved_invoices", JSON.stringify(state.savedInvoices));
        renderSavedInvoicesList();

        // Background Google Drive sync
        if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
            syncInvoicesWithGDrive(true);
        }
        return true;
    };

    // Save and Save/Print click handlers
    const saveInvoiceBtn = document.getElementById("save-invoice-btn");
    if (saveInvoiceBtn) {
        saveInvoiceBtn.addEventListener("click", saveActiveInvoice);
    }
    const savePrintBtn = document.getElementById("save-print-btn");
    if (savePrintBtn) {
        savePrintBtn.addEventListener("click", () => {
            const saved = saveActiveInvoiceSilent();
            if (saved) {
                showStatus("Opening Print Dialog...");
                window.print();
            }
        });
    }

    // Add Row Click
    document.getElementById("add-row-btn").addEventListener("click", () => {
        state.invoiceItems.push({ description: "", sku: "", size: "", qty: 1, rate: 0 });
        renderInvoiceRows();
        saveItemsToDraft();
        
        // Focus the newly added row description input
        const rows = document.querySelectorAll("#invoice-tbody tr");
        if (rows.length > 0) {
            const lastRowInput = rows[rows.length - 1].querySelector(".desc-input");
            if (lastRowInput) lastRowInput.focus();
        }
    });

    // Flat Discount Input
    const discountFlatInput = document.getElementById("discount-flat-input");
    discountFlatInput.addEventListener("input", () => {
        updateCalculations();
    });

    const clearActiveInvoiceData = () => {
        state.invoiceItems = [{ description: "", sku: "", size: "", qty: 1, rate: 0 }];
        const discountInput = document.getElementById("discount-flat-input");
        if (discountInput) discountInput.value = 0;
        
        // Clear customer details
        state.clientInfo = {
            name: "",
            address: "",
            mobile: "",
            email: "",
            invNumber: getNextInvoiceNumber(),
            dcNumber: "",
            invDate: new Date().toISOString().split('T')[0],
            invDue: new Date().toISOString().split('T')[0]
        };
        
        // Reload input values safely
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal("client-name", "");
        setVal("client-address", "");
        setVal("client-mobile", "");
        setVal("client-email", "");
        setVal("inv-number", state.clientInfo.invNumber);
        setVal("dc-number", "");
        setVal("inv-date", state.clientInfo.invDate);
        const invDueEl = document.getElementById("inv-due");
        if (invDueEl) invDueEl.value = state.clientInfo.invDue;
        const custSelector = document.getElementById("customer-selector");
        if (custSelector) custSelector.value = "";
        
        // Reset preview texts
        const setInner = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };
        setInner("preview-client-name", "Click to enter Hospital / Customer Name");
        setInner("preview-client-address", "Click to enter Customer Address");
        setInner("preview-client-mobile", "+91 Mobile Number");
        setInner("preview-client-email", "customer@email.com");
        setInner("preview-inv-number", state.clientInfo.invNumber);
        setInner("preview-dc-number", "-");
        setInner("preview-inv-date", formatDateString(state.clientInfo.invDate));
        const previewInvDueEl = document.getElementById("preview-inv-due");
        if (previewInvDueEl) previewInvDueEl.innerText = formatDateString(state.clientInfo.invDue);
        
        renderInvoiceRows();
        updateCalculations();
        saveItemsToDraft();
        localStorage.setItem("im_client_info", JSON.stringify(state.clientInfo));
        showStatus("Invoice reset completed.");
    };

    // Clean All / Reset
    const clearAllBtn = document.getElementById("clear-all-btn");
    if (clearAllBtn) {
        clearAllBtn.onclick = function(e) {
            e.preventDefault();
            if (confirm("Are you sure you want to clear the active invoice items and customer details?")) {
                clearActiveInvoiceData();
            }
        };
    }

    // Add Invoice Click
    const addInvoiceOpt = document.getElementById("add-invoice-menu-opt");
    if (addInvoiceOpt) {
        addInvoiceOpt.addEventListener("click", () => {
            if (confirm("Are you sure you want to create a new invoice? This will clear the active sheet.")) {
                clearActiveInvoiceData();
                closeInvoicesDashboard();
                alert("New invoice loaded successfully!");
            }
        });
    }


    // Excel Drag & Drop setup (Catalog Upload)
    setupDragAndDrop(
        "price-list-dropzone", 
        "price-list-file", 
        (data, filename) => handleCatalogData(data, filename)
    );

    // Excel Drag & Drop setup (Invoice Items Import)
    setupDragAndDrop(
        "invoice-items-dropzone", 
        "invoice-items-file", 
        (data, filename) => handleInvoiceItemsImport(data, filename)
    );

    // Clear Price List Catalog
    document.getElementById("clear-catalog-btn").addEventListener("click", () => {
        if (confirm("Are you sure you want to remove the loaded Price List? The app will revert to sample implants suggestions.")) {
            state.priceList = [...SAMPLE_CATALOG];
            localStorage.removeItem("im_price_list");
            localStorage.removeItem("im_price_list_name");
            updateCatalogBadge(state.priceList.length, "Sample Implants Catalog");
            document.getElementById("catalog-status").style.display = "none";
            showStatus("Price list catalog removed. Defaulting to sample data.");

            // Background Google Drive sync
            if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                syncCatalogWithGDrive(true);
            }
        }
    });

    // Print / PDF Button
    document.getElementById("print-invoice-btn").addEventListener("click", () => {
        if (!validateInvoice()) return;
        showStatus("Opening Print Dialog...");
        window.print();
    });

    // Customer search on Client Name input in sidebar
    const clientNameInput = document.getElementById("client-name");
    const sidebarCustList = document.getElementById("sidebar-cust-rec-list");
    if (clientNameInput && sidebarCustList) {
        clientNameInput.addEventListener("input", (e) => {
            showCustomerRecommendations(e.target.value, sidebarCustList);
        });
        clientNameInput.addEventListener("focus", (e) => {
            closeAllRecommendationDropdowns();
            showCustomerRecommendations(e.target.value, sidebarCustList);
        });
    }

    // Customer search on A4 sheet preview name
    const previewClientName = document.getElementById("preview-client-name");
    const paperCustList = document.getElementById("paper-cust-rec-list");
    if (previewClientName && paperCustList) {
        previewClientName.addEventListener("input", () => {
            showCustomerRecommendations(previewClientName.innerText, paperCustList);
        });
        previewClientName.addEventListener("focus", () => {
            closeAllRecommendationDropdowns();
            showCustomerRecommendations(previewClientName.innerText, paperCustList);
        });
    }

    // Recommendation Dropdown outside clicks handler
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".autocomplete-container")) {
            closeAllRecommendationDropdowns();
        }
        if (!e.target.closest(".size-autocomplete")) {
            closeAllSizeDropdowns();
        }
        
        // Close customer dropdowns if clicked outside
        if (sidebarCustList && !e.target.closest("#sidebar-cust-rec-list") && e.target !== clientNameInput) {
            sidebarCustList.style.display = "none";
        }
        if (paperCustList && !e.target.closest("#paper-cust-rec-list") && e.target !== previewClientName) {
            paperCustList.style.display = "none";
        }
    });

    // Google Drive Sync UI Event Listeners
    const gdriveClientIdInput = document.getElementById("gdrive-client-id");
    if (gdriveClientIdInput) {
        gdriveClientIdInput.addEventListener("change", (e) => {
            const val = e.target.value.trim();
            state.gdriveClientId = val;
            localStorage.setItem("im_gdrive_client_id", val);
        });
    }

    const gdriveFolderIdInput = document.getElementById("gdrive-folder-id");
    if (gdriveFolderIdInput) {
        gdriveFolderIdInput.addEventListener("change", (e) => {
            const val = e.target.value.trim();
            state.gdriveFolderId = val;
            localStorage.setItem("im_gdrive_folder_id", val);
        });
    }

    const gdriveLoginBtn = document.getElementById("gdrive-login-btn");
    if (gdriveLoginBtn) {
        gdriveLoginBtn.addEventListener("click", () => {
            signInWithGoogle();
        });
    }

    const gdriveLogoutBtn = document.getElementById("gdrive-logout-btn");
    if (gdriveLogoutBtn) {
        gdriveLogoutBtn.addEventListener("click", () => {
            signOutWithGoogle();
        });
    }

    const gdriveSyncBtn = document.getElementById("gdrive-sync-btn");
    if (gdriveSyncBtn) {
        gdriveSyncBtn.addEventListener("click", () => {
            syncDataWithGDrive(false);
        });
    }
}

// Double way binding: Allow user to edit A4 page text directly and sync it to inputs
function setupPaperEditableSync() {
    const syncEdit = (previewId, inputId, storageKey, profileField = null) => {
        const preview = document.getElementById(previewId);
        if (preview) {
            preview.addEventListener("blur", () => {
                const val = preview.innerText;
                const input = document.getElementById(inputId);
                if (input) input.value = val;
                
                if (profileField) {
                    state.companyProfile[profileField] = val;
                    localStorage.setItem("im_company_profile", JSON.stringify(state.companyProfile));
                    if (profileField === "upi") updateUpiQrCode();
                } else if (storageKey) {
                    state.clientInfo[storageKey] = val;
                    localStorage.setItem("im_client_info", JSON.stringify(state.clientInfo));
                }
            });
            
            // Disable Enter key from adding linebreaks in single-line headers
            if (previewId !== "preview-comp-address" && previewId !== "preview-client-address" && previewId !== "preview-comp-bank") {
                preview.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        preview.blur();
                    }
                });
            }
        }
    };
    

    
    // Sync client items
    syncEdit("preview-client-name", "client-name", "name");
    syncEdit("preview-client-address", "client-address", "address");
    syncEdit("preview-client-mobile", "client-mobile", "mobile");
    syncEdit("preview-client-email", "client-email", "email");
    syncEdit("preview-inv-number", "inv-number", "invNumber");
    syncEdit("preview-dc-number", "dc-number", "dcNumber");
    syncEdit("preview-inv-date", "inv-date", "invDate");
}

// Drag and drop setup utility
function setupDragAndDrop(zoneId, inputId, onDataCallback) {
    const dropzone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    
    if (!dropzone || !input) return;

    // Direct click browse
    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        
        const file = e.dataTransfer.files[0];
        if (file) handleExcelFileReading(file, onDataCallback);
    });

    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) handleExcelFileReading(file, onDataCallback);
    });
}

// SheetJS File Reading logic
function handleExcelFileReading(file, callback) {
    const reader = new FileReader();
    showStatus(`Reading file: ${file.name}...`);
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Extract the first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            if (jsonData && jsonData.length > 0) {
                callback(jsonData, file.name);
            } else {
                alert("The Excel/CSV sheet seems empty or could not be parsed.");
                showStatus("Parsing failed: Empty sheet");
            }
        } catch (err) {
            console.error(err);
            alert("Error parsing file. Please verify it's a valid Excel or CSV sheet.");
            showStatus("Parsing failed: Error reading spreadsheet");
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Handle Custom Catalog Import
function handleCatalogData(data, filename) {
    // We need to parse headers to extract Code, Description, Size, Price
    const parsedCatalog = data.map(row => {
        const skuKey = findKey(row, ['sku', 'code', 'product id', 'product_id', 'item code', 'id', 'item_code', 'matched sku/code']);
        const descKey = findKey(row, ['description', 'desc', 'product name', 'product_name', 'item', 'item name', 'clean item name', 'product', 'name']);
        const sizeKey = findKey(row, ['size', 'specification', 'spec', 'dimension', 'size/specification', 'sizes']);
        const priceKey = findKey(row, ['sell price', 'price', 'rate', 'unit price', 'rate (unit price)', 'mrp', 'cost', 'sell_price', 'sell price (inc tax)']);

        return {
            sku: skuKey ? String(row[skuKey]).trim() : "",
            description: descKey ? String(row[descKey]).trim() : "",
            size: sizeKey ? String(row[sizeKey]).trim() : "",
            price: priceKey ? parseFloat(String(row[priceKey]).replace(/[^0-9.]/g, '')) || 0 : 0
        };
    }).filter(item => item.description !== ""); // Must have a description

    if (parsedCatalog.length === 0) {
        alert("Could not identify valid products in the price list. Please ensure there is a Description/Item Name column.");
        return;
    }

    state.priceList = parsedCatalog;
    localStorage.setItem("im_price_list", JSON.stringify(parsedCatalog));
    localStorage.setItem("im_price_list_name", filename);
    
    updateCatalogBadge(parsedCatalog.length, filename);
    
    // Show details
    document.getElementById("catalog-filename").innerText = filename;
    document.getElementById("catalog-status").style.display = "flex";
    
    showStatus(`Price list loaded: ${parsedCatalog.length} items from ${filename}`);

    // Background Google Drive sync
    if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
        syncCatalogWithGDrive(true);
    }
}

// Handle Invoice Items Import
function handleInvoiceItemsImport(data, filename) {
    // Extract billing rows
    const importedItems = data.map(row => {
        const descKey = findKey(row, ['description', 'desc', 'item', 'item name', 'clean item name', 'product', 'name', 'original invoice description']);
        const skuKey = findKey(row, ['sku', 'code', 'item code', 'id', 'item_code', 'matched sku/code']);
        const sizeKey = findKey(row, ['size', 'specification', 'spec', 'dimension', 'size/specification']);
        const qtyKey = findKey(row, ['qty', 'quantity', 'qnt']);
        const rateKey = findKey(row, ['price', 'rate', 'unit price', 'rate (unit price)', 'cost']);

        const qty = qtyKey ? parseInt(String(row[qtyKey]).replace(/[^0-9]/g, '')) || 1 : 1;
        const rate = rateKey ? parseFloat(String(row[priceKey] || row[rateKey]).replace(/[^0-9.]/g, '')) || 0 : 0;

        return {
            description: descKey ? String(row[descKey]).trim() : "Item",
            sku: skuKey ? String(row[skuKey]).trim() : "",
            size: sizeKey ? String(row[sizeKey]).trim() : "",
            qty: qty,
            rate: rate
        };
    }).filter(item => item.description !== "");

    if (importedItems.length === 0) {
        alert("No billable items could be parsed from this file.");
        return;
    }

    state.invoiceItems = importedItems;
    renderInvoiceRows();
    updateCalculations();
    saveItemsToDraft();
    showStatus(`Successfully imported ${importedItems.length} items from ${filename}`);
}

// Utility to find keys by multiple synonyms, prioritizing the order of synonyms in the list
function findKey(obj, synonyms) {
    const keys = Object.keys(obj);
    
    // 1. Exact priority match
    for (const syn of synonyms) {
        for (const key of keys) {
            if (key.toLowerCase().trim() === syn.toLowerCase().trim()) {
                return key;
            }
        }
    }
    
    // 2. Substring fallback match
    for (const syn of synonyms) {
        for (const key of keys) {
            const lowerKey = key.toLowerCase().trim();
            const lowerSyn = syn.toLowerCase().trim();
            if (lowerKey.includes(lowerSyn) || lowerSyn.includes(lowerKey)) {
                return key;
            }
        }
    }
    return null;
}

// Render dynamic table rows
function renderInvoiceRows() {
    const tbody = document.getElementById("invoice-tbody");
    tbody.innerHTML = "";

    state.invoiceItems.forEach((item, index) => {
        const tr = document.createElement("tr");
        
        // Check if there are catalog sizes for this item's description
        const description = (item.description || "").trim();
        const matchedCatalogItems = description ? state.priceList.filter(p => 
            String(p.description || p.base_description || "").toLowerCase().trim() === description.toLowerCase().trim()
        ) : [];
        const hasCatalogSizes = matchedCatalogItems.some(p => p.size && p.size.trim() !== "");

        let sizeCellHtml = `
            <div class="size-autocomplete">
                <input type="text" class="table-input size-input" value="${item.size || ''}" placeholder="${hasCatalogSizes ? 'Select Size' : 'Type/click for size...'}" autocomplete="off">
                <div class="size-recommendation-list" id="size-rec-list-${index}"></div>
            </div>
        `;

        tr.innerHTML = `
            <td style="text-align: center; color: #9ca3af; font-weight: 500;">${index + 1}</td>
            <td>
                <div class="autocomplete-container">
                    <textarea class="table-input desc-input" rows="1" placeholder="Type item name..." autocomplete="off">${item.description || ''}</textarea>
                    <div class="recommendation-list" id="rec-list-${index}"></div>
                </div>
            </td>
            <td>
                ${sizeCellHtml}
            </td>
            <td>
                <input type="number" class="table-input num-input qty-input center-input" value="${item.qty || 1}" min="1" step="1" autocomplete="off">
            </td>
            <td>
                <input type="number" class="table-input num-input rate-input" value="${item.rate || 0}" min="0" step="any" autocomplete="off">
            </td>
            <td>
                <input type="number" class="table-input num-input amount-input" value="${( (item.qty || 0) * (item.rate || 0) ).toFixed(2)}" min="0" step="any" style="font-weight: 600;" autocomplete="off">
            </td>
            <td class="actions-col" style="text-align: center;">
                <button type="button" class="btn-delete-row" title="Delete Row">×</button>
            </td>
        `;

        // Attach event listeners for inputs in this row
        const descInput = tr.querySelector(".desc-input");
        const sizeInput = tr.querySelector(".size-input");
        const qtyInput = tr.querySelector(".qty-input");
        const rateInput = tr.querySelector(".rate-input");
        const amountInput = tr.querySelector(".amount-input");
        const deleteBtn = tr.querySelector(".btn-delete-row");
        const recList = tr.querySelector(".recommendation-list");
        const sizeRecList = tr.querySelector(".size-recommendation-list");

        // Input change handlers
        const updateStateVal = (field, val) => {
            state.invoiceItems[index][field] = val;
            saveItemsToDraft();
        };

        if (sizeInput) {
            sizeInput.addEventListener("input", (e) => {
                const query = e.target.value;
                updateStateVal("size", query);
                showSizeRecommendations(query, sizeRecList, index, sizeInput, rateInput, tr);
            });

            sizeInput.addEventListener("focus", (e) => {
                closeAllRecommendationDropdowns();
                closeAllSizeDropdowns();
                state.activeSizeInput = sizeInput;
                const query = e.target.value;
                showSizeRecommendations(query, sizeRecList, index, sizeInput, rateInput, tr);
            });

            sizeInput.addEventListener("keydown", (e) => {
                const items = sizeRecList.querySelectorAll(".recommendation-item");
                if (sizeRecList.style.display === "block" && items.length > 0) {
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        state.activeSizeIndex = (state.activeSizeIndex + 1) % items.length;
                        highlightSizeRecommendation(items);
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        state.activeSizeIndex = (state.activeSizeIndex - 1 + items.length) % items.length;
                        highlightSizeRecommendation(items);
                    } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (state.activeSizeIndex >= 0 && state.activeSizeIndex < items.length) {
                            items[state.activeSizeIndex].click();
                        }
                    } else if (e.key === "Escape") {
                        sizeRecList.style.display = "none";
                        state.activeSizeIndex = -1;
                    }
                }
            });
        }
        
        // Math changes (Qty, Rate)
        qtyInput.addEventListener("input", (e) => {
            const qty = parseInt(e.target.value) || 0;
            updateStateVal("qty", qty);
            recalculateRowAmount(tr, qty, state.invoiceItems[index].rate);
            updateCalculations();
        });

        rateInput.addEventListener("input", (e) => {
            const rate = parseFloat(e.target.value) || 0;
            updateStateVal("rate", rate);
            recalculateRowAmount(tr, state.invoiceItems[index].qty, rate);
            updateCalculations();
        });

        amountInput.addEventListener("input", (e) => {
            const amount = parseFloat(e.target.value) || 0;
            const qty = parseInt(qtyInput.value) || 1;
            const rate = qty > 0 ? (amount / qty) : 0;
            
            state.invoiceItems[index].rate = rate;
            rateInput.value = rate.toFixed(2);
            
            updateCalculations();
            saveItemsToDraft();
        });

        // Delete Row Click
        deleteBtn.addEventListener("click", () => {
            if (state.invoiceItems.length === 1) {
                state.invoiceItems = [{ description: "", sku: "", size: "", qty: 1, rate: 0 }];
            } else {
                state.invoiceItems.splice(index, 1);
            }
            renderInvoiceRows();
            updateCalculations();
            saveItemsToDraft();
            showStatus("Line item removed.");
        });

        // Recommendation Keyboard and Typing Navigation
        descInput.addEventListener("input", (e) => {
            const query = e.target.value;
            updateStateVal("description", query);
            autoResizeTextarea(descInput);
            
            if (query.trim().length >= 2) {
                showRecommendations(query, recList, index, descInput);
            } else {
                recList.style.display = "none";
            }
        });

        descInput.addEventListener("keydown", (e) => {
            const items = recList.querySelectorAll(".recommendation-item");
            
            if (e.key === "Enter") {
                e.preventDefault(); // Prevent inserting newlines in the description field
                if (recList.style.display === "block" && items.length > 0) {
                    if (state.activeRecIndex >= 0 && state.activeRecIndex < items.length) {
                        selectRecommendation(items[state.activeRecIndex], index, tr);
                    }
                }
            } else if (recList.style.display === "block" && items.length > 0) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    state.activeRecIndex = (state.activeRecIndex + 1) % items.length;
                    highlightRecommendation(items);
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    state.activeRecIndex = (state.activeRecIndex - 1 + items.length) % items.length;
                    highlightRecommendation(items);
                } else if (e.key === "Escape") {
                    recList.style.display = "none";
                    state.activeRecIndex = -1;
                }
            }
        });

        // Focus event
        descInput.addEventListener("focus", (e) => {
            closeAllRecommendationDropdowns();
            closeAllSizeDropdowns();
            state.activeRecInput = descInput;
            autoResizeTextarea(descInput);
            const query = e.target.value;
            if (query.trim().length >= 2) {
                showRecommendations(query, recList, index, descInput);
            }
        });

        tbody.appendChild(tr);
        autoResizeTextarea(descInput);
    });
}

// Auto-resize textarea based on content height
function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

// Recalculate single row total display
function recalculateRowAmount(rowEl, qty, rate) {
    const amtEl = rowEl.querySelector(".amount-input");
    if (amtEl) {
        amtEl.value = (qty * rate).toFixed(2);
    }
}

// Real-time Autocomplete Recommendation Engine - Grouped by unique base product names
function showRecommendations(query, container, index, inputEl) {
    container.innerHTML = "";
    state.activeRecIndex = -1;
    
    const queryLower = query.toLowerCase();
    
    // Filter matching catalog items: group by unique base description/product name
    const uniqueMatches = new Map();
    for (const item of state.priceList) {
        const baseName = String(item.description || "");
        const skuStr = String(item.sku || "");
        const sizeStr = String(item.size || "");
        
        const descMatch = baseName.toLowerCase().includes(queryLower);
        const skuMatch = skuStr.toLowerCase().includes(queryLower);
        const sizeMatch = sizeStr.toLowerCase().includes(queryLower);
        
        if (descMatch || skuMatch || sizeMatch) {
            const key = baseName.toLowerCase().trim();
            if (!uniqueMatches.has(key)) {
                uniqueMatches.set(key, item);
            }
        }
        
        if (uniqueMatches.size >= 8) break; // Limit to 8 recommendations
    }

    if (uniqueMatches.size > 0) {
        uniqueMatches.forEach((match) => {
            const div = document.createElement("div");
            div.className = "recommendation-item";
            
            const baseName = String(match.description || "");
            
            // Format layout
            div.innerHTML = `
                <div class="rec-desc">${baseName}</div>
            `;

            // Data attachment
            div.dataset.sku = match.sku;
            div.dataset.description = baseName;
            div.dataset.size = match.size;
            div.dataset.price = match.price;
            div.dataset.gst = match.gst !== undefined ? match.gst : 12;

            div.addEventListener("click", () => {
                selectRecommendation(div, index, inputEl.closest("tr"));
            });

            container.appendChild(div);
        });
        container.style.display = "block";
    } else {
        container.style.display = "none";
    }
}

// Highlight suggestions during arrow key navigation
function highlightRecommendation(items) {
    items.forEach((item, idx) => {
        if (idx === state.activeRecIndex) {
            item.classList.add("active");
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove("active");
        }
    });
}

// Select recommendation item and auto-populate row, rendering sizes select box
function selectRecommendation(itemEl, index, rowEl) {
    const description = String(itemEl.dataset.description || "");
    
    // Find all matching size entries in priceList
    const matchedSizes = state.priceList.filter(p => {
        const pBase = String(p.description || p.base_description || "");
        return pBase.toLowerCase().trim() === description.toLowerCase().trim();
    });
    
    const hasCatalogSizes = matchedSizes.some(p => p.size && p.size.trim() !== "");

    if (hasCatalogSizes) {
        // By default show "Select Size" as the option, keeping size empty and rate 0
        state.invoiceItems[index].description = description;
        state.invoiceItems[index].size = "";
        state.invoiceItems[index].sku = "";
        state.invoiceItems[index].rate = 0;
    } else {
        // Fallback for custom items or items with no sizes
        state.invoiceItems[index].description = description;
        state.invoiceItems[index].sku = itemEl.dataset.sku || "";
        state.invoiceItems[index].size = itemEl.dataset.size || "";
        state.invoiceItems[index].rate = 0; // Manual input required
    }

    closeAllRecommendationDropdowns();
    renderInvoiceRows();
    updateCalculations();
    saveItemsToDraft();

    // Focus size element for quick selection
    setTimeout(() => {
        const rows = document.querySelectorAll("#invoice-tbody tr");
        if (rows[index]) {
            const sizeInput = rows[index].querySelector(".size-input");
            if (sizeInput) {
                sizeInput.focus();
                sizeInput.select();
            }
        }
    }, 50);

    showStatus(`Selected Product: ${description}. Choose size next.`);
}

// Helper to hide all lists
function closeAllRecommendationDropdowns() {
    document.querySelectorAll(".recommendation-list").forEach(list => {
        list.style.display = "none";
    });
    state.activeRecIndex = -1;
}

// Advanced mathematical calculations for the cash invoice (GST-free)
function updateCalculations() {
    let subtotal = 0;

    // Loop through each item
    state.invoiceItems.forEach(item => {
        const qty = item.qty || 0;
        const rate = item.rate || 0;
        
        const itemAmount = qty * rate;
        subtotal += itemAmount;
    });

    // Subtotal
    document.getElementById("calc-subtotal").innerText = `₹${subtotal.toFixed(2)}`;

    // Flat Discount
    const flatDiscountInput = document.getElementById("discount-flat-input");
    const flatDiscount = parseFloat(flatDiscountInput.value) || 0;

    // Grand total before rounding
    const rawGrandTotal = subtotal - flatDiscount;
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = roundedGrandTotal - rawGrandTotal;

    // Display round off and grand total
    document.getElementById("calc-roundoff").innerText = `₹${roundOff >= 0 ? '+' : ''}${roundOff.toFixed(2)}`;
    document.getElementById("calc-grandtotal").innerText = `₹${roundedGrandTotal.toFixed(2)}`;

    // Convert total to words
    const totalInWords = numberToEnglishWords(roundedGrandTotal);
    document.getElementById("amount-in-words").innerText = totalInWords;

    // Regenerate QR Sync
    updateUpiQrCode(roundedGrandTotal);
}

// Convert Number to English Words (INR Format: Rupees and Paisa)
function numberToEnglishWords(amount) {
    if (amount === 0) return "Zero Rupees Only";
    
    const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const doubleDigits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tensDigits = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    function convertUnderThousand(num) {
        let str = "";
        if (num >= 100) {
            str += singleDigits[Math.floor(num / 100)] + " Hundred ";
            num %= 100;
        }
        if (num >= 10 && num < 20) {
            str += doubleDigits[num - 10] + " ";
        } else if (num >= 20 || num === 10) {
            str += tensDigits[Math.floor(num / 10)] + " ";
            if (num % 10 > 0) {
                str += singleDigits[num % 10] + " ";
            }
        } else if (num > 0) {
            str += singleDigits[num] + " ";
        }
        return str;
    }

    let words = "";
    let integerPart = Math.floor(amount);
    
    if (integerPart >= 10000000) {
        words += convertUnderThousand(Math.floor(integerPart / 10000000)) + "Crore ";
        integerPart %= 10000000;
    }
    if (integerPart >= 100000) {
        words += convertUnderThousand(Math.floor(integerPart / 100000)) + "Lakh ";
        integerPart %= 100000;
    }
    if (integerPart >= 1000) {
        words += convertUnderThousand(Math.floor(integerPart / 1000)) + "Thousand ";
        integerPart %= 1000;
    }
    if (integerPart > 0) {
        words += convertUnderThousand(integerPart);
    }
    
    return words.trim() + " Rupees Only";
}

// Generate QR Code dynamically using dynamic API based on UPI ID and Amount
function updateUpiQrCode(amount = 0) {
    const upiId = state.companyProfile.upi;
    const companyName = state.companyProfile.name || "Surgical Implants Supplier";
    const upiBlock = document.getElementById("upi-block");
    const qrContainer = document.getElementById("upi-qr-container");

    if (!upiId || upiId.trim() === "") {
        upiBlock.style.display = "none";
        return;
    }

    // Display block
    upiBlock.style.display = "flex";
    document.getElementById("upi-display-id").innerText = upiId;

    if (amount <= 0) {
        qrContainer.innerHTML = '<div class="qr-loading">Waiting for amount...</div>';
        return;
    }

    // Generate UPI URL: upi://pay?pa=recipient@upi&pn=RecipientName&am=Amount&cu=INR
    const encodedName = encodeURIComponent(companyName);
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR`;
    
    // Call free QR code API
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(upiUrl)}`;
    
    // Set in container
    qrContainer.innerHTML = `<img src="${qrImgUrl}" alt="UPI payment QR Code" style="width: 100%; height: 100%; object-fit: contain;">`;
}

// Save items draft to localstorage
function saveItemsToDraft() {
    localStorage.setItem("im_invoice_items", JSON.stringify(state.invoiceItems));
}

// Update the loaded catalog badge in UI
function updateCatalogBadge(count, filename) {
    const badge = document.getElementById("catalog-count-badge");
    if (badge) {
        badge.innerText = `${count.toLocaleString()} Items`;
        badge.className = count > 0 ? "status-badge success" : "status-badge";
    }
}

let statusTimeout = null;
function showStatus(msg) {
    const statusText = document.getElementById("workspace-status");
    if (statusText) {
        statusText.innerText = msg;
        if (statusTimeout) clearTimeout(statusTimeout);
        statusTimeout = setTimeout(() => {
            statusText.innerText = "Ready";
        }, 3000);
    }
}

// Format dates nicely e.g., 2026-06-15 -> 15-Jun-2026
function formatDateString(dateStr) {
    if (!dateStr) return "-";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
}

// Real-time Size Search Recommendations Autocomplete
function showSizeRecommendations(query, container, idx, inputEl, rateInput, rowEl) {
    container.innerHTML = "";
    state.activeSizeIndex = -1;
    
    const itemDesc = state.invoiceItems[idx].description || "";
    if (!itemDesc) {
        container.style.display = "none";
        return;
    }

    // Filter matching catalog size items for this exact base description name
    const matchedCatalogItems = state.priceList.filter(p => 
        String(p.description || p.base_description || "").toLowerCase().trim() === itemDesc.toLowerCase().trim()
    );
    
    const queryLower = query.toLowerCase().trim();
    const filtered = matchedCatalogItems.filter(m => 
        String(m.size || "").toLowerCase().includes(queryLower)
    );
    
    if (filtered.length > 0) {
        filtered.forEach(match => {
            const div = document.createElement("div");
            div.className = "recommendation-item";
            div.style.padding = "6px 10px";
            div.innerHTML = `
                <div style="font-size:11px; font-weight:600; color:var(--paper-accent);">${match.size}</div>
            `;
            
            div.addEventListener("click", () => {
                state.invoiceItems[idx].size = match.size;
                state.invoiceItems[idx].sku = match.sku;
                state.invoiceItems[idx].rate = 0; // Manual input required
                
                inputEl.value = match.size;
                rateInput.value = 0; // Manual input required
                
                recalculateRowAmount(rowEl, state.invoiceItems[idx].qty, 0);
                updateCalculations();
                saveItemsToDraft();
                
                container.style.display = "none";
                showStatus(`Selected size: ${match.size}. Please enter price rate manually.`);
            });
            container.appendChild(div);
        });
        container.style.display = "block";
    } else {
        container.style.display = "none";
    }
}

// Highlight sizes list recommendations during key navigation
function highlightSizeRecommendation(items) {
    items.forEach((item, idx) => {
        if (idx === state.activeSizeIndex) {
            item.classList.add("active");
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove("active");
        }
    });
}

// Close all active size autocomplete dropdown lists
function closeAllSizeDropdowns() {
    document.querySelectorAll(".size-recommendation-list").forEach(list => {
        list.style.display = "none";
    });
    state.activeSizeIndex = -1;
}

// Render the Customer Directory lists inside settings side panel
function renderCustomerList() {
    const listEl = document.getElementById("saved-customers-list");
    if (!listEl) return;
    
    if (state.customers.length === 0) {
        listEl.innerHTML = '<p class="empty-msg">No customers saved.</p>';
        return;
    }
    
    listEl.innerHTML = "";
    state.customers.forEach((cust, idx) => {
        const item = document.createElement("div");
        item.className = "saved-customer-item";
        item.innerHTML = `
            <div class="item-details">
                <span class="item-name">${cust.name}</span>
                <span class="item-subtext">${cust.mobile || ''} | ${cust.email || ''}</span>
            </div>
            <button type="button" class="btn-delete-saved" title="Delete Customer">🗑️</button>
        `;
        
        item.addEventListener("click", (e) => {
            if (e.target.classList.contains("btn-delete-saved")) return;
            preloadCustomer(cust);
        });
        
        item.querySelector(".btn-delete-saved").addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete customer ${cust.name}?`)) {
                state.customers.splice(idx, 1);
                localStorage.setItem("im_customers", JSON.stringify(state.customers));
                renderCustomerList();
                populateCustomerSelector();
                showStatus(`Deleted customer ${cust.name}`);

                // Background Google Drive sync
                if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                    syncCustomersWithGDrive(true);
                }
            }
        });
        
        listEl.appendChild(item);
    });
}

// Populate the customer selector options in metadata sidepanel
function populateCustomerSelector() {
    const selector = document.getElementById("customer-selector");
    if (!selector) return;
    
    selector.innerHTML = '<option value="">-- Select Customer --</option>';
    state.customers.forEach((cust, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.innerText = cust.name;
        selector.appendChild(opt);
    });
}

// Load chosen customer directory info into active billing fields and preview sheet
function preloadCustomer(cust) {
    state.clientInfo.name = cust.name || "";
    state.clientInfo.address = cust.address || "";
    state.clientInfo.mobile = cust.mobile || "";
    state.clientInfo.email = cust.email || "";
    
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal("client-name", cust.name || "");
    setVal("client-address", cust.address || "");
    setVal("client-mobile", cust.mobile || "");
    setVal("client-email", cust.email || "");
    
    document.getElementById("preview-client-name").innerText = cust.name || "Click to enter Hospital / Customer Name";
    document.getElementById("preview-client-address").innerText = cust.address || "Click to enter Customer Address";
    document.getElementById("preview-client-mobile").innerText = cust.mobile || "+91 Mobile Number";
    document.getElementById("preview-client-email").innerText = cust.email || "customer@email.com";
    
    localStorage.setItem("im_client_info", JSON.stringify(state.clientInfo));
    showStatus(`Preloaded customer details for: ${cust.name}`);
    
    // Auto collapse sidebar
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar && overlay) {
        sidebar.classList.add("collapsed");
        overlay.classList.remove("active");
    }
}



// Helper to mark an invoice as fully paid quick-flow style
function quickPayInvoice(inv, originalIdx) {
    if (confirm("Payment received?")) {
        if (confirm("Are you sure?")) {
            const grandTotal = inv.grandTotal || 0;
            state.savedInvoices[originalIdx].paymentReceived = grandTotal;
            localStorage.setItem("im_saved_invoices", JSON.stringify(state.savedInvoices));
            
            renderSavedInvoicesList();
            
            const dashboardContainer = document.getElementById("invoices-dashboard-container");
            if (dashboardContainer && dashboardContainer.style.display !== "none") {
                const searchInput = document.getElementById("dashboard-inv-search");
                renderDashboardInvoicesList(searchInput ? searchInput.value : "");
            }
            
            showStatus(`Invoice ${inv.invNumber || 'Draft'} marked as fully paid.`);

            // Background Google Drive sync
            if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                syncInvoicesWithGDrive(true);
            }
        }
    }
}

// Render list of saved invoices drafts from browser storage
function renderSavedInvoicesList() {
    const listEl = document.getElementById("saved-invoices-list");
    if (!listEl) return;
    
    if (state.savedInvoices.length === 0) {
        listEl.innerHTML = '<p class="empty-msg">No saved invoices found.</p>';
        return;
    }
    
    listEl.innerHTML = "";
    state.savedInvoices.forEach((inv, idx) => {
        const item = document.createElement("div");
        item.className = "saved-invoice-item";
        item.innerHTML = `
            <div class="item-details">
                <span class="item-name" style="display: block; font-weight: 600;">${inv.invNumber || 'Draft'}</span>
                ${inv.dcNumber ? `<span class="item-dc" style="font-size: 10px; display: block; opacity: 0.8; margin-top: 1px; color: var(--text-muted);">DC No: ${inv.dcNumber}</span>` : ''}
                <span class="item-subtext" style="display: block; margin-top: 2px;">${inv.clientName || 'Walk-in Customer'} | ₹${parseFloat(inv.grandTotal || 0).toFixed(2)}</span>
                <span class="item-subtext" style="font-size: 8.5px; opacity: 0.8; display: block;">${formatDateString(inv.invDate) || ''}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" class="btn-pay-saved" title="Quick Pay (Mark Fully Paid)">
                    <svg class="pay-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                </button>
                <button type="button" class="btn-delete-saved" title="Delete Saved Invoice">🗑️</button>
            </div>
        `;
        
        item.addEventListener("click", (e) => {
            if (e.target.closest(".btn-delete-saved") || e.target.closest(".btn-pay-saved")) return;
            loadSavedInvoice(inv);
        });
        
        item.querySelector(".btn-pay-saved").addEventListener("click", (e) => {
            e.stopPropagation();
            quickPayInvoice(inv, idx);
        });
        
        item.querySelector(".btn-delete-saved").addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete invoice ${inv.invNumber || 'Draft'}?`)) {
                state.savedInvoices.splice(idx, 1);
                localStorage.setItem("im_saved_invoices", JSON.stringify(state.savedInvoices));
                renderSavedInvoicesList();
                showStatus(`Deleted invoice ${inv.invNumber || 'Draft'}`);
            }
        });
        
        listEl.appendChild(item);
    });
}

// Load selected invoice states into workspace and recalculate totals
function loadSavedInvoice(inv) {
    state.clientInfo = {
        name: inv.clientName || "",
        address: inv.clientAddress || "",
        mobile: inv.clientMobile || "",
        email: inv.clientEmail || "",
        invNumber: inv.invNumber || "",
        dcNumber: inv.dcNumber || "",
        invDate: inv.invDate || "",
        invDue: inv.invDue || ""
    };
    
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal("client-name", state.clientInfo.name);
    setVal("client-address", state.clientInfo.address);
    setVal("client-mobile", state.clientInfo.mobile);
    setVal("client-email", state.clientInfo.email);
    setVal("inv-number", state.clientInfo.invNumber);
    setVal("dc-number", state.clientInfo.dcNumber || "");
    setVal("inv-date", state.clientInfo.invDate);
    const invDueEl = document.getElementById("inv-due");
    if (invDueEl) invDueEl.value = state.clientInfo.invDue;
    
    document.getElementById("preview-client-name").innerText = state.clientInfo.name || "Customer Name";
    document.getElementById("preview-client-address").innerText = state.clientInfo.address || "Client Address";
    document.getElementById("preview-client-mobile").innerText = state.clientInfo.mobile || "";
    document.getElementById("preview-client-email").innerText = state.clientInfo.email || "";
    document.getElementById("preview-inv-number").innerText = state.clientInfo.invNumber;
    document.getElementById("preview-dc-number").innerText = state.clientInfo.dcNumber || "-";
    document.getElementById("preview-inv-date").innerText = formatDateString(state.clientInfo.invDate);
    const previewInvDueEl = document.getElementById("preview-inv-due");
    if (previewInvDueEl) previewInvDueEl.innerText = formatDateString(state.clientInfo.invDue);
    
    state.invoiceItems = JSON.parse(JSON.stringify(inv.invoiceItems || []));
    if (state.invoiceItems.length === 0) {
        state.invoiceItems = [{ description: "", sku: "", size: "", qty: 1, rate: 0 }];
    }
    
    document.getElementById("discount-flat-input").value = inv.discount || 0;
    
    localStorage.setItem("im_client_info", JSON.stringify(state.clientInfo));
    saveItemsToDraft();
    
    renderInvoiceRows();
    updateCalculations();
    showStatus(`Loaded invoice: ${inv.invNumber}`);
    
    // Collapse sidebar
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar && overlay) {
        sidebar.classList.add("collapsed");
        overlay.classList.remove("active");
    }
}

// Search and suggest saved customers based on query
function showCustomerRecommendations(query, container) {
    container.innerHTML = "";
    if (!query || query.trim().length === 0) {
        container.style.display = "none";
        return;
    }
    
    const queryLower = query.toLowerCase().trim();
    const matched = state.customers.filter(cust => 
        (cust.name && cust.name.toLowerCase().includes(queryLower)) ||
        (cust.mobile && cust.mobile.includes(queryLower)) ||
        (cust.address && cust.address.toLowerCase().includes(queryLower))
    );
    
    if (matched.length > 0) {
        matched.forEach(cust => {
            const div = document.createElement("div");
            div.className = "recommendation-item";
            div.style.padding = "8px 12px";
            div.style.cursor = "pointer";
            div.style.borderBottom = "1px solid var(--border-color, #f1f5f9)";
            div.style.background = "#ffffff";
            div.innerHTML = `
                <div style="font-weight: 600; font-size: 12px; color: #0f172a;">${cust.name}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                    ${cust.mobile ? `📞 ${cust.mobile}` : ''} ${cust.email ? ` | ✉️ ${cust.email}` : ''}
                </div>
                ${cust.address ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${cust.address}</div>` : ''}
            `;
            div.addEventListener("click", (e) => {
                e.stopPropagation();
                preloadCustomer(cust);
                container.style.display = "none";
            });
            container.appendChild(div);
        });
        container.style.display = "block";
    } else {
        container.style.display = "none";
    }
}

// Render the Customer list inside the View Customers Modal (with search support)
function renderModalCustomerList(filterText = "") {
    const listEl = document.getElementById("modal-customers-list");
    if (!listEl) return;
    
    const filter = filterText.toLowerCase().trim();
    const filtered = state.customers.filter(c => 
        (c.name && c.name.toLowerCase().includes(filter)) || 
        (c.mobile && c.mobile.includes(filter)) ||
        (c.email && c.email.toLowerCase().includes(filter))
    );
    
    if (filtered.length === 0) {
        listEl.innerHTML = `<p class="empty-msg" style="text-align:center; padding:20px 0;">${state.customers.length === 0 ? 'No saved customers found.' : 'No matching customers found.'}</p>`;
        return;
    }
    
    listEl.innerHTML = "";
    filtered.forEach((cust) => {
        // Find original index in state.customers to delete correctly
        const originalIdx = state.customers.findIndex(c => c.name === cust.name && c.mobile === cust.mobile);
        const outstanding = getCustomerOutstanding(cust.name);
        
        const item = document.createElement("div");
        item.className = "modal-customer-item";
        item.innerHTML = `
            <div class="item-details" style="display:flex; flex-direction:column; gap:4px; flex-grow:1;">
                <strong style="font-size:13px; color:var(--text-main);">${cust.name}</strong>
                <span style="font-size:11px; color:var(--text-muted);">
                    ${cust.mobile ? `📞 ${cust.mobile}` : ''} ${cust.email ? ` | ✉️ ${cust.email}` : ''}
                </span>
                ${cust.address ? `<span style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">📍 ${cust.address}</span>` : ''}
                <span style="font-size:11px; color:var(--text-muted); margin-top: 4px;">
                    Outstanding Balance: <strong style="color: ${outstanding > 0 ? '#ef4444' : '#10b981'};">₹${outstanding.toFixed(2)}</strong>
                </span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn btn-secondary btn-xs btn-ledger-saved" title="View Customer Ledger" style="padding: 6px 10px; font-size: 11px;">📄 Ledger</button>
                <button type="button" class="btn-delete-saved" title="Delete Customer" style="font-size: 16px; padding: 6px; background:transparent; border:none; cursor:pointer;">🗑️</button>
            </div>
        `;
        
        // Click item to load customer onto invoice
        item.addEventListener("click", (e) => {
            if (e.target.closest(".btn-delete-saved") || e.target.closest(".btn-ledger-saved")) return;
            preloadCustomer(cust);
            document.getElementById("view-customers-modal").classList.remove("active");
        });
        
        // Ledger handler
        item.querySelector(".btn-ledger-saved").addEventListener("click", (e) => {
            e.stopPropagation();
            openLedgerModal(cust.name);
        });
        
        // Delete handler
        item.querySelector(".btn-delete-saved").addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete customer ${cust.name}?`)) {
                state.customers.splice(originalIdx, 1);
                localStorage.setItem("im_customers", JSON.stringify(state.customers));
                renderModalCustomerList(filterText);
                populateCustomerSelector();
                showStatus(`Deleted customer ${cust.name}`);

                // Background Google Drive sync
                if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                    syncCustomersWithGDrive(true);
                }
            }
        });
        
        listEl.appendChild(item);
    });
}

// Render the Invoices list inside the Invoices Dashboard Page (with search & payment edit support)
function renderDashboardInvoicesList(filterText = "") {
    const tbody = document.getElementById("dashboard-invoices-tbody");
    if (!tbody) return;
    
    const filter = filterText.toLowerCase().trim();
    const filtered = state.savedInvoices.filter(inv => 
        (inv.invNumber && inv.invNumber.toLowerCase().includes(filter)) ||
        (inv.dcNumber && inv.dcNumber.toLowerCase().includes(filter)) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(filter))
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-msg" style="text-align:center; padding: 25px 0;">${state.savedInvoices.length === 0 ? 'No saved invoices found.' : 'No matching invoices found.'}</td></tr>`;
        return;
    }
    
    tbody.innerHTML = "";
    filtered.forEach((inv) => {
        const originalIdx = state.savedInvoices.findIndex(i => i.invNumber === inv.invNumber);
        
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--border-color)";
        
        const grandTotal = inv.grandTotal || 0;
        const paymentReceived = inv.paymentReceived || 0;
        const balanceDue = grandTotal - paymentReceived;
        
        let balanceHtml = "";
        if (balanceDue <= 0) {
            balanceHtml = `<span style="color: #10b981; font-weight: 700;">Paid</span>`;
        } else {
            balanceHtml = `<span style="color: #ef4444; font-weight: 700;">₹${balanceDue.toFixed(2)}</span>`;
        }
        
        tr.innerHTML = `
            <td style="padding: 14px 16px; font-weight: 600; color: var(--paper-accent);">${inv.invNumber} ${inv.dcNumber ? `<span style="font-size: 10px; color: var(--text-muted); font-weight: 500; display: block; margin-top: 2px;">DC: ${inv.dcNumber}</span>` : ''}</td>
            <td style="padding: 14px 16px; color: var(--text-muted); font-size:11px;">${formatDateString(inv.invDate)}</td>
            <td style="padding: 14px 16px; font-weight: 500;">${inv.clientName}</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 600;">₹${grandTotal.toFixed(2)}</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 500;">₹${paymentReceived.toFixed(2)}</td>
            <td style="padding: 14px 16px; text-align: right; font-weight: 600;" class="bal-due-cell">${balanceHtml}</td>
            <td style="padding: 14px 16px; text-align: center;">
                <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                    <button type="button" class="btn-pay-saved pay-quick-btn" title="Quick Pay (Mark Fully Paid)">
                        <svg class="pay-icon" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    </button>
                    <button type="button" class="btn btn-secondary btn-xs load-inv-btn" title="Load Invoice in Editor" style="padding: 6px 12px; font-size: 11px;">Load</button>
                    <button type="button" class="btn-delete-saved delete-inv-btn" title="Delete Invoice" style="font-size: 16px; padding: 6px; background:transparent; border:none; cursor:pointer;">🗑️</button>
                </div>
            </td>
        `;
        
        const quickPayBtn = tr.querySelector(".pay-quick-btn");
        const loadBtn = tr.querySelector(".load-inv-btn");
        const deleteBtn = tr.querySelector(".delete-inv-btn");
        const balCell = tr.querySelector(".bal-due-cell");
        
        if (quickPayBtn) {
            quickPayBtn.addEventListener("click", () => {
                quickPayInvoice(inv, originalIdx);
            });
        }
        
        loadBtn.addEventListener("click", () => {
            loadSavedInvoice(inv);
            closeInvoicesDashboard();
        });
        
        deleteBtn.addEventListener("click", () => {
            if (confirm(`Are you sure you want to delete invoice ${inv.invNumber}?`)) {
                state.savedInvoices.splice(originalIdx, 1);
                localStorage.setItem("im_saved_invoices", JSON.stringify(state.savedInvoices));
                renderDashboardInvoicesList(filterText);
                renderSavedInvoicesList();
                showStatus(`Deleted invoice ${inv.invNumber}`);

                // Background Google Drive sync
                if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                    syncInvoicesWithGDrive(true);
                }
            }
        });
        
        tbody.appendChild(tr);
    });
}

// Toggle Saved Invoices Dashboard view and visibility of editor controls
function openInvoicesDashboard() {
    const invoicesDashboardContainer = document.getElementById("invoices-dashboard-container");
    const invoiceEditorContainer = document.querySelector(".invoice-container");
    const saveInvoiceBtn = document.getElementById("save-invoice-btn");
    const bottomSaveBtn = document.getElementById("bottom-save-invoice-btn");
    const printBtn = document.getElementById("print-invoice-btn");
    const clearBtn = document.getElementById("clear-all-btn");

    if (invoicesDashboardContainer && invoiceEditorContainer) {
        invoiceEditorContainer.style.display = "none";
        invoicesDashboardContainer.style.display = "block";
        if (saveInvoiceBtn) saveInvoiceBtn.style.display = "none";
        if (bottomSaveBtn) bottomSaveBtn.style.display = "none";
        if (printBtn) printBtn.style.display = "none";
        if (clearBtn) clearBtn.style.display = "none";
        const floatingBar = document.getElementById("floating-bottom-bar");
        if (floatingBar) floatingBar.style.display = "none";
        
        // Delegate tab layout rendering and configuration to switchDashboardTab
        switchDashboardTab(activeDashboardTab);
        showStatus("Saved Invoices Dashboard opened.");
    }
}

function closeInvoicesDashboard() {
    const invoicesDashboardContainer = document.getElementById("invoices-dashboard-container");
    const invoiceEditorContainer = document.querySelector(".invoice-container");
    const saveInvoiceBtn = document.getElementById("save-invoice-btn");
    const bottomSaveBtn = document.getElementById("bottom-save-invoice-btn");
    const printBtn = document.getElementById("print-invoice-btn");
    const clearBtn = document.getElementById("clear-all-btn");

    if (invoicesDashboardContainer && invoiceEditorContainer) {
        invoicesDashboardContainer.style.display = "none";
        invoiceEditorContainer.style.display = "flex";
        if (saveInvoiceBtn) saveInvoiceBtn.style.display = "";
        if (bottomSaveBtn) bottomSaveBtn.style.display = "";
        if (printBtn) printBtn.style.display = "";
        if (clearBtn) clearBtn.style.display = "";
        const floatingBar = document.getElementById("floating-bottom-bar");
        if (floatingBar) floatingBar.style.display = "flex";
        showStatus("Invoice Editor opened.");
    }
}

// Group and aggregate invoice items from all saved invoices
function getUsedItemsReportData() {
    const reportMap = new Map();
    
    state.savedInvoices.forEach(inv => {
        const items = inv.invoiceItems || [];
        items.forEach(item => {
            const desc = (item.description || "").trim();
            const size = (item.size || "").trim();
            if (!desc) return; // skip empty rows
            
            const groupKey = `${desc.toLowerCase()}|||${size.toLowerCase()}`;
            
            if (reportMap.has(groupKey)) {
                const existing = reportMap.get(groupKey);
                existing.qty += parseInt(item.qty) || 0;
            } else {
                reportMap.set(groupKey, {
                    name: desc,
                    size: size,
                    qty: parseInt(item.qty) || 0
                });
            }
        });
    });
    
    return Array.from(reportMap.values());
}

// Render the Used Items Report table body
function renderDashboardReportsList(filterText = "") {
    const tbody = document.getElementById("dashboard-reports-tbody");
    if (!tbody) return;
    
    const data = getUsedItemsReportData();
    const filter = filterText.toLowerCase().trim();
    const filtered = data.filter(item => 
        item.name.toLowerCase().includes(filter) || 
        item.size.toLowerCase().includes(filter)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-msg" style="text-align:center; padding: 25px 0;">${data.length === 0 ? 'No used items found.' : 'No matching items found.'}</td></tr>`;
        return;
    }
    
    tbody.innerHTML = "";
    filtered.forEach(item => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--border-color)";
        tr.innerHTML = `
            <td style="padding: 14px 16px; font-weight: 500; color: var(--text-main);">${item.name}</td>
            <td style="padding: 14px 16px; color: var(--text-muted);">${item.size || '-'}</td>
            <td style="padding: 14px 16px; text-align: center; font-weight: 700; color: var(--primary);">${item.qty}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Switch between dashboard views (Invoices & Payments vs Used Items Report)
function switchDashboardTab(tab) {
    activeDashboardTab = tab;
    const invoicesContainer = document.getElementById("dashboard-invoices-container");
    const reportsContainer = document.getElementById("dashboard-reports-container");
    const searchInput = document.getElementById("dashboard-inv-search");
    const downloadReportBtn = document.getElementById("download-report-btn");
    const dashboardTitle = document.getElementById("dashboard-title");

    if (dashboardTitle) {
        dashboardTitle.innerText = tab === "invoices" ? "Saved Invoices & Payments" : "Used Items Report";
    }

    if (tab === "invoices") {
        if (invoicesContainer) invoicesContainer.style.display = "block";
        if (reportsContainer) reportsContainer.style.display = "none";
        if (downloadReportBtn) downloadReportBtn.style.display = "none";
        if (searchInput) {
            searchInput.placeholder = "Search invoice number or customer name...";
            searchInput.value = "";
        }
        renderDashboardInvoicesList();
    } else {
        if (invoicesContainer) invoicesContainer.style.display = "none";
        if (reportsContainer) reportsContainer.style.display = "block";
        if (downloadReportBtn) downloadReportBtn.style.display = "inline-block";
        if (searchInput) {
            searchInput.placeholder = "Search item name or size...";
            searchInput.value = "";
        }
        renderDashboardReportsList();
    }
}

// Calculate total outstanding balance for a customer
function getCustomerOutstanding(customerName) {
    if (!customerName) return 0;
    const nameLower = customerName.toLowerCase().trim();
    let outstanding = 0;
    state.savedInvoices.forEach(inv => {
        if (inv.clientName && inv.clientName.toLowerCase().trim() === nameLower) {
            const grandTotal = inv.grandTotal || 0;
            const paymentReceived = inv.paymentReceived || 0;
            outstanding += (grandTotal - paymentReceived);
        }
    });
    return outstanding;
}

// Open Ledger Modal for a selected customer
function openLedgerModal(customerName) {
    // Hide the Customer Directory modal first
    const viewCustomersModal = document.getElementById("view-customers-modal");
    if (viewCustomersModal) viewCustomersModal.classList.remove("active");
    
    const ledgerModal = document.getElementById("ledger-modal");
    if (!ledgerModal) return;
    
    // Set customer name
    document.getElementById("ledger-customer-name").innerText = customerName;
    
    // Set default dates: start of current year to today
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    
    document.getElementById("ledger-start-date").value = startOfYear.toISOString().split('T')[0];
    document.getElementById("ledger-end-date").value = today.toISOString().split('T')[0];
    
    // Render ledger
    renderLedger(customerName, startOfYear.toISOString().split('T')[0], today.toISOString().split('T')[0]);
    
    // Open Ledger modal
    ledgerModal.classList.add("active");
}

// Render ledger rows in table body
function renderLedger(customerName, startDate, endDate) {
    const tbody = document.getElementById("ledger-tbody");
    if (!tbody) return;
    
    const data = getLedgerData(customerName, startDate, endDate);
    
    tbody.innerHTML = "";
    
    // Render Opening Balance row
    const opTr = document.createElement("tr");
    opTr.style.borderBottom = "1px solid var(--border-color)";
    opTr.style.fontWeight = "600";
    opTr.style.background = "rgba(0,0,0,0.01)";
    opTr.innerHTML = `
        <td style="padding: 10px 12px;">-</td>
        <td style="padding: 10px 12px; font-weight: bold; color: var(--text-main);">Opening Balance</td>
        <td style="padding: 10px 12px; text-align: right;">-</td>
        <td style="padding: 10px 12px; text-align: right;">-</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: var(--text-main);">₹${data.openingBal.toFixed(2)}</td>
    `;
    tbody.appendChild(opTr);
    
    if (data.rows.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td colspan="5" style="text-align: center; padding: 15px 0; color: var(--text-muted);">No transactions found in this period.</td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    data.rows.forEach(item => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--border-color)";
        tr.innerHTML = `
            <td style="padding: 10px 12px; font-size: 11px; color: var(--text-muted);">${formatDateString(item.date)}</td>
            <td style="padding: 10px 12px; color: var(--text-main);">${item.particulars}</td>
            <td style="padding: 10px 12px; text-align: right; color: ${item.debit > 0 ? 'var(--danger)' : 'var(--text-main)'};">${item.debit > 0 ? '₹' + item.debit.toFixed(2) : '-'}</td>
            <td style="padding: 10px 12px; text-align: right; color: ${item.credit > 0 ? 'var(--success)' : 'var(--text-main)'};">${item.credit > 0 ? '₹' + item.credit.toFixed(2) : '-'}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: var(--text-main);">₹${item.balance.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Generate Ledger accounting calculations
function getLedgerData(customerName, startDateStr, endDateStr) {
    const invoices = state.savedInvoices.filter(inv => 
        inv.clientName && inv.clientName.toLowerCase().trim() === customerName.toLowerCase().trim()
    );

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    startDate.setHours(0,0,0,0);
    endDate.setHours(23,59,59,999);

    let openingBal = 0;
    const transactions = [];

    invoices.forEach(inv => {
        const invDate = new Date(inv.invDate);
        const debitAmt = inv.grandTotal || 0;
        const creditAmt = inv.paymentReceived || 0;

        if (invDate < startDate) {
            openingBal += (debitAmt - creditAmt);
        } else if (invDate >= startDate && invDate <= endDate) {
            transactions.push({
                date: invDate,
                dateStr: inv.invDate,
                particulars: `Invoice ${inv.invNumber}${inv.dcNumber ? ` (DC: ${inv.dcNumber})` : ''}`,
                debit: debitAmt,
                credit: 0
            });
            if (creditAmt > 0) {
                transactions.push({
                    date: invDate,
                    dateStr: inv.invDate,
                    particulars: `Payment Received (Invoice ${inv.invNumber}${inv.dcNumber ? ` - DC: ${inv.dcNumber}` : ''})`,
                    debit: 0,
                    credit: creditAmt
                });
            }
        }
    });

    transactions.sort((a, b) => a.date - b.date);

    let runningBal = openingBal;
    const ledgerRows = transactions.map(tx => {
        runningBal += (tx.debit - tx.credit);
        return {
            date: tx.dateStr,
            particulars: tx.particulars,
            debit: tx.debit,
            credit: tx.credit,
            balance: runningBal
        };
    });

    return {
        openingBal,
        closingBal: runningBal,
        rows: ledgerRows
    };
}

// Print customer ledger to printable popup window
function printLedger(customerName, startDate, endDate, rowsHtml, openingBal, closingBal) {
    const printWindow = window.open("", "_blank");
    const formattedStart = formatDateString(startDate);
    const formattedEnd = formatDateString(endDate);
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Ledger - ${customerName}</title>
            <style>
                body { font-family: 'Outfit', sans-serif; padding: 20px; color: #1f2937; }
                h1 { font-size: 20px; margin-bottom: 5px; }
                h2 { font-size: 14px; color: #4b5563; margin-top: 0; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                th { background: #f3f4f6; border-bottom: 2px solid #e5e7eb; padding: 8px; font-weight: bold; text-align: left; }
                td { border-bottom: 1px solid #e5e7eb; padding: 8px; }
                .text-right { text-align: right; }
                .summary-box { margin-top: 20px; display: flex; justify-content: flex-end; gap: 40px; font-size: 13px; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>CUSTOMER TRANSACTION LEDGER</h1>
            <h2>Customer: ${customerName} | Period: ${formattedStart} to ${formattedEnd}</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 15%;">DATE</th>
                        <th style="width: 45%;">PARTICULARS</th>
                        <th style="width: 12%; text-align: right;">DEBIT (₹)</th>
                        <th style="width: 12%; text-align: right;">CREDIT (₹)</th>
                        <th style="width: 16%; text-align: right;">BALANCE (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>-</td>
                        <td><strong>Opening Balance</strong></td>
                        <td class="text-right">-</td>
                        <td class="text-right">-</td>
                        <td class="text-right"><strong>₹${openingBal.toFixed(2)}</strong></td>
                    </tr>
                    ${rowsHtml}
                </tbody>
            </table>
            <div class="summary-box">
                <div>Outstanding Balance: <span style="color: ${closingBal > 0 ? '#ef4444' : '#10b981'};">₹${closingBal.toFixed(2)}</span></div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Client-side Excel export utility using SheetJS
function exportToExcel(data, fileName, headers) {
    const ws = XLSX.utils.json_to_sheet(data);
    
    if (headers) {
        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, fileName);
}

// =========================================================================
// 1. CREDENTIALS LOGIN GUARD (AUTH GATE)
// =========================================================================
function checkAuthGuard() {
    const overlay = document.getElementById("auth-gate-overlay");
    if (!overlay) return;

    if (sessionStorage.getItem("im_authorized") === "true") {
        overlay.style.display = "none";
        return;
    }

    // Read variables compiled from Vite config or process.env during build.
    // If not configured, fall back to "admin" / "password123"
    const correctUser = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_USERNAME) || "admin";
    const correctPass = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_PASSWORD) || "password123";

    const loginBtn = document.getElementById("auth-login-btn");
    const errorMsg = document.getElementById("auth-error-msg");
    const usernameInput = document.getElementById("auth-username");
    const passwordInput = document.getElementById("auth-password");

    const attemptLogin = () => {
        const enteredUser = usernameInput.value.trim();
        const enteredPass = passwordInput.value.trim();

        if (enteredUser === correctUser && enteredPass === correctPass) {
            sessionStorage.setItem("im_authorized", "true");
            overlay.style.opacity = "0";
            setTimeout(() => {
                overlay.style.display = "none";
            }, 300);
            showStatus("Access granted.");
        } else {
            errorMsg.style.display = "block";
            passwordInput.value = "";
            passwordInput.focus();
        }
    };

    if (loginBtn) loginBtn.addEventListener("click", attemptLogin);
    
    // Allow enter key submission
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && overlay.style.display !== "none") {
            attemptLogin();
        }
    });

    // Autofocus username
    if (usernameInput) usernameInput.focus();
}

// =========================================================================
// 2. GOOGLE DRIVE SYNC INTEGRATION
// =========================================================================

// Handle Google OAuth callback URL hash parsing
function handleGoogleOAuthRedirect() {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    try {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const expiresIn = params.get("expires_in") || "3600";

        if (accessToken) {
            localStorage.setItem("im_gdrive_access_token", accessToken);
            localStorage.setItem("im_gdrive_token_expiry", (Date.now() + parseInt(expiresIn) * 1000).toString());

            // Quietly fetch profile to get user email and name
            fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { "Authorization": `Bearer ${accessToken}` }
            })
            .then(res => res.json())
            .then(profile => {
                if (profile.email) {
                    localStorage.setItem("im_gdrive_user_email", profile.email);
                    localStorage.setItem("im_gdrive_user_name", profile.name || "");
                    
                    state.gdriveAccessToken = accessToken;
                    state.gdriveTokenExpiry = Date.now() + parseInt(expiresIn) * 1000;
                    state.gdriveUserEmail = profile.email;
                    state.gdriveUserName = profile.name || "";

                    updateGDriveUIStatus();
                    showStatus(`Google Drive Sync Connected: ${profile.email}`);
                    
                    // Trigger manual sync right after logging in
                    syncDataWithGDrive(false);
                }
            })
            .catch(err => console.error("Error fetching user profile:", err));
        }
    } catch (e) {
        console.error("OAuth redirect parse error:", e);
    } finally {
        // Clean URL hash so access token isn't visible in address bar
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
}

// Initialize GDrive quiet background sync on startup
function initGoogleDriveSyncQuietly() {
    const token = localStorage.getItem("im_gdrive_access_token");
    const expiry = parseInt(localStorage.getItem("im_gdrive_token_expiry")) || 0;

    if (token && Date.now() < expiry) {
        state.gdriveAccessToken = token;
        state.gdriveTokenExpiry = expiry;
        state.gdriveUserEmail = localStorage.getItem("im_gdrive_user_email") || "";
        state.gdriveUserName = localStorage.getItem("im_gdrive_user_name") || "";
        
        updateGDriveUIStatus();
        
        // Trigger quiet background sync
        syncDataWithGDrive(true);
    } else {
        // Clean expired token
        localStorage.removeItem("im_gdrive_access_token");
        localStorage.removeItem("im_gdrive_token_expiry");
        updateGDriveUIStatus();
    }
}

// Updates the settings card UI and status indicators
function updateGDriveUIStatus() {
    const badge = document.getElementById("gdrive-status-badge");
    const statusCard = document.getElementById("gdrive-status-card");
    const statusText = document.getElementById("gdrive-status-text");
    const statusDot = document.getElementById("gdrive-status-dot");
    const loginBtn = document.getElementById("gdrive-login-btn");
    const syncBtn = document.getElementById("gdrive-sync-btn");
    const logoutBtn = document.getElementById("gdrive-logout-btn");
    const headerBadge = document.getElementById("gdrive-header-sync-badge");

    const hasToken = state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry;

    if (hasToken && state.gdriveUserEmail) {
        if (badge) {
            badge.innerText = "Connected";
            badge.className = "status-badge success";
        }
        if (statusCard) statusCard.style.display = "flex";
        if (statusText) statusText.innerText = `Logged in as: ${state.gdriveUserEmail}`;
        if (statusDot) {
            statusDot.className = "gdrive-status-dot online";
        }
        if (loginBtn) loginBtn.style.display = "none";
        if (syncBtn) syncBtn.style.display = "flex";
        if (logoutBtn) logoutBtn.style.display = "flex";
        if (headerBadge) {
            headerBadge.style.display = "inline-flex";
            const headerText = document.getElementById("gdrive-header-sync-text");
            if (headerText) headerText.innerText = "GDrive Synced";
        }
    } else {
        if (badge) {
            badge.innerText = "Offline";
            badge.className = "status-badge";
        }
        if (statusCard) statusCard.style.display = "none";
        if (loginBtn) loginBtn.style.display = "flex";
        if (syncBtn) syncBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (headerBadge) headerBadge.style.display = "none";
    }
}

// Redirects user to Google OAuth2 consent screen
function signInWithGoogle() {
    const clientId = document.getElementById("gdrive-client-id").value.trim();
    const folderId = document.getElementById("gdrive-folder-id").value.trim();

    if (!clientId) {
        alert("Please enter a valid Google OAuth Client ID first!");
        const clientIdEl = document.getElementById("gdrive-client-id");
        if (clientIdEl) clientIdEl.focus();
        return;
    }

    // Persist folder ID and client ID locally
    localStorage.setItem("im_gdrive_client_id", clientId);
    localStorage.setItem("im_gdrive_folder_id", folderId);
    state.gdriveClientId = clientId;
    state.gdriveFolderId = folderId;

    // Use OAuth Implicit flow to redirect back to current URL
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile")}`;
    
    showStatus("Redirecting to Google Sign-In...");
    window.location.href = authUrl;
}

// Signs out of Google Drive Sync
function signOutWithGoogle() {
    localStorage.removeItem("im_gdrive_access_token");
    localStorage.removeItem("im_gdrive_token_expiry");
    localStorage.removeItem("im_gdrive_user_email");
    localStorage.removeItem("im_gdrive_user_name");

    state.gdriveAccessToken = "";
    state.gdriveTokenExpiry = 0;
    state.gdriveUserEmail = "";
    state.gdriveUserName = "";

    updateGDriveUIStatus();
    showStatus("Google Drive disconnected.");
}

// Sync all databases (invoices, customers, catalog) with Google Drive
async function syncDataWithGDrive(silent = false) {
    if (!state.gdriveAccessToken || Date.now() >= state.gdriveTokenExpiry) {
        if (!silent) alert("Please log in with Google to perform sync.");
        return;
    }

    const msgEl = document.getElementById("gdrive-sync-message");
    const syncBtn = document.getElementById("gdrive-sync-btn");
    
    if (msgEl) {
        msgEl.style.display = "block";
        msgEl.innerText = "Syncing with cloud...";
    }
    if (syncBtn) syncBtn.disabled = true;

    try {
        await syncInvoicesWithGDrive(silent);
        await syncCustomersWithGDrive(silent);
        
        // Sync catalog (will download if cloud file exists, or upload if custom local exists)
        await syncCatalogWithGDrive(silent);

        if (msgEl) {
            msgEl.innerText = "Cloud Sync completed successfully!";
            msgEl.style.color = "var(--success)";
            setTimeout(() => {
                msgEl.style.display = "none";
            }, 3000);
        }
        if (!silent) {
            alert("Sync completed successfully!\n\nAll invoices, payments, and customers have been synced with Google Drive.");
        }
    } catch (err) {
        console.error("Cloud Sync failed:", err);
        if (msgEl) {
            msgEl.innerText = "Cloud Sync failed: " + err.message;
            msgEl.style.color = "var(--danger)";
        }
        if (!silent) {
            alert("Cloud Sync failed:\n\n" + err.message);
        }
    } finally {
        if (syncBtn) syncBtn.disabled = false;
    }
}

// Search file on Google Drive
async function findFileOnGoogleDrive(token, filename, folderId) {
    let query = `name = '${filename.replace(/'/g, "\\'")}' and trashed = false`;
    if (folderId) {
        query += ` and '${folderId}' in parents`;
    } else {
        query += ` and 'root' in parents`;
    }
    
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`File search failed: ${err.error?.message || res.statusText}`);
    }
    
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
}

// Download file contents from Google Drive
async function downloadFileFromGoogleDrive(token, fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!res.ok) {
        throw new Error(`File download failed. Status: ${res.status}`);
    }
    
    return await res.json();
}

// Create new file on Google Drive
async function uploadFileToGoogleDrive(token, folderId, fileData, filename, mimeType) {
    const metadata = { name: filename };
    if (folderId) {
        metadata.parents = [folderId];
    }

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const encoder = new TextEncoder();
    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const mediaPartHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

    const mediaBytes = encoder.encode(typeof fileData === "string" ? fileData : JSON.stringify(fileData));
    const closePart = encoder.encode(closeDelimiter);
    const metadataBytes = encoder.encode(metadataPart);
    const mediaHeaderBytes = encoder.encode(mediaPartHeader);

    const totalLength = metadataBytes.length + mediaHeaderBytes.length + mediaBytes.length + closePart.length;
    const combined = new Uint8Array(totalLength);

    combined.set(metadataBytes, 0);
    combined.set(mediaHeaderBytes, metadataBytes.length);
    combined.set(mediaBytes, metadataBytes.length + mediaHeaderBytes.length);
    combined.set(closePart, metadataBytes.length + mediaHeaderBytes.length + mediaBytes.length);

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: combined
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "File upload failed.");
    }

    return await res.json();
}

// Update existing file on Google Drive
async function updateFileOnGoogleDrive(token, fileId, fileData, mimeType) {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": mimeType
        },
        body: typeof fileData === "string" ? fileData : JSON.stringify(fileData)
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`File update failed: ${err.error?.message || res.statusText}`);
    }
    
    return await res.json();
}

// Sync Invoices (Invoices List + Payments data)
async function syncInvoicesWithGDrive(silent = false) {
    const token = state.gdriveAccessToken;
    const folderId = state.gdriveFolderId;
    const filename = "invoice_maker_invoices.json";

    const existingFile = await findFileOnGoogleDrive(token, filename, folderId);

    if (existingFile) {
        try {
            // Download invoices from Drive and merge
            const cloudInvs = await downloadFileFromGoogleDrive(token, existingFile.id);
            if (Array.isArray(cloudInvs)) {
                let mergedCount = 0;
                cloudInvs.forEach(cloudInv => {
                    const localIdx = state.savedInvoices.findIndex(l => l.invNumber === cloudInv.invNumber);
                    if (localIdx === -1) {
                        state.savedInvoices.push(cloudInv);
                        mergedCount++;
                    } else {
                        // Conflict resolution: keep the one with payment received, or the one saved later
                        const localInv = state.savedInvoices[localIdx];
                        if (cloudInv.paymentReceived !== localInv.paymentReceived || (cloudInv.savedAt || 0) > (localInv.savedAt || 0)) {
                            state.savedInvoices[localIdx] = cloudInv;
                            mergedCount++;
                        }
                    }
                });

                if (mergedCount > 0) {
                    localStorage.setItem("im_saved_invoices", JSON.stringify(state.savedInvoices));
                    renderSavedInvoicesList();
                    // update dashboard if active
                    const searchInput = document.getElementById("dashboard-inv-search");
                    const dashboardContainer = document.getElementById("invoices-dashboard-container");
                    if (dashboardContainer && dashboardContainer.style.display !== "none") {
                        renderDashboardInvoicesList(searchInput ? searchInput.value : "");
                    }
                    console.log(`[GDrive] Merged ${mergedCount} cloud invoices.`);
                }
            }
        } catch (err) {
            console.error("Invoices download/merge failed, overwriting cloud:", err);
        }

        // Upload merged list back to cloud
        await updateFileOnGoogleDrive(token, existingFile.id, JSON.stringify(state.savedInvoices, null, 2), "application/json");
    } else {
        // Upload new file
        await uploadFileToGoogleDrive(token, folderId, JSON.stringify(state.savedInvoices, null, 2), filename, "application/json");
    }
}

// Sync Customer directory
async function syncCustomersWithGDrive(silent = false) {
    const token = state.gdriveAccessToken;
    const folderId = state.gdriveFolderId;
    const filename = "invoice_maker_customers.json";

    const existingFile = await findFileOnGoogleDrive(token, filename, folderId);

    if (existingFile) {
        try {
            const cloudCusts = await downloadFileFromGoogleDrive(token, existingFile.id);
            if (Array.isArray(cloudCusts)) {
                let mergedCount = 0;
                cloudCusts.forEach(cloudCust => {
                    const exists = state.customers.some(l => l.name === cloudCust.name);
                    if (!exists) {
                        state.customers.push(cloudCust);
                        mergedCount++;
                    }
                });

                if (mergedCount > 0) {
                    localStorage.setItem("im_customers", JSON.stringify(state.customers));
                    renderCustomerList();
                    populateCustomerSelector();
                    console.log(`[GDrive] Merged ${mergedCount} cloud customers.`);
                }
            }
        } catch (err) {
            console.error("Customers download/merge failed, overwriting cloud:", err);
        }

        // Upload merged list back to cloud
        await updateFileOnGoogleDrive(token, existingFile.id, JSON.stringify(state.customers, null, 2), "application/json");
    } else {
        // Upload new file
        await uploadFileToGoogleDrive(token, folderId, JSON.stringify(state.customers, null, 2), filename, "application/json");
    }
}

// Sync Price List Catalog
async function syncCatalogWithGDrive(silent = false) {
    const token = state.gdriveAccessToken;
    const folderId = state.gdriveFolderId;
    const filename = "invoice_maker_catalog.json";

    const existingFile = await findFileOnGoogleDrive(token, filename, folderId);

    if (existingFile) {
        try {
            const cloudCatalog = await downloadFileFromGoogleDrive(token, existingFile.id);
            if (Array.isArray(cloudCatalog)) {
                state.priceList = cloudCatalog;
                localStorage.setItem("im_price_list", JSON.stringify(state.priceList));
                localStorage.setItem("im_price_list_name", "Google Drive Catalog");
                updateCatalogBadge(state.priceList.length, "Google Drive Catalog");
                console.log(`[GDrive] Synced catalog (${state.priceList.length} items) from cloud.`);
            }
        } catch (err) {
            console.error("Catalog download failed, uploading local instead:", err);
            if (localStorage.getItem("im_price_list")) {
                await updateFileOnGoogleDrive(token, existingFile.id, JSON.stringify(state.priceList, null, 2), "application/json");
            }
        }
    } else {
        // Only upload to Google Drive if the user has a custom local catalog (not default sample)
        if (localStorage.getItem("im_price_list")) {
            await uploadFileToGoogleDrive(token, folderId, JSON.stringify(state.priceList, null, 2), filename, "application/json");
        }
    }
}




