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
    initGoogleDriveSyncQuietly();

    // Handle incoming Firestore responses from top window frame
    window.addEventListener("message", (e) => {
        const { action, payload } = e.data || {};
        console.log("[CashInvoice Iframe] Received message:", action, payload);
        if (action === "FETCH_CASH_INVOICES_RESPONSE" && Array.isArray(payload)) {
            console.log("[CashInvoice Iframe] Setting savedInvoices from Firestore:", payload);
            state.savedInvoices = payload;
            // Assign the correct next invoice number now that we have real data
            const nextNum = getNextInvoiceNumber();
            const currentNum = (document.getElementById("inv-number") || {}).value || "";
            const currentPreview = (document.getElementById("preview-inv-number") || {}).innerText || "";
            // Only update if the current invoice hasn't been modified (still blank or auto-assigned)
            const isNewBlankInvoice = !state.clientInfo.clientSaved && !currentNum.trim();
            const isDefaultOrEmpty = !currentNum.trim() || currentNum.startsWith("SRR-2026-0001") || currentNum === state._autoAssignedNum;
            if (isDefaultOrEmpty) {
                state.clientInfo.invNumber = nextNum;
                state._autoAssignedNum = nextNum;
                const invEl = document.getElementById("inv-number");
                if (invEl) invEl.value = nextNum;
                const prevEl = document.getElementById("preview-inv-number");
                if (prevEl) prevEl.innerText = nextNum;
            }
            renderSavedInvoicesList();
            renderDashboardInvoicesList();
        } else if (action === "SAVE_CASH_INVOICE_RESPONSE") {
            renderSavedInvoicesList();
            renderDashboardInvoicesList();
        } else if (action === "FETCH_CASH_CUSTOMERS_RESPONSE" && Array.isArray(payload)) {
            if (payload.length > 0) {
                const existingMap = new Map();
                (state.customers || []).forEach(c => {
                    if (c && c.name) existingMap.set(c.name.toLowerCase().trim(), c);
                });
                payload.forEach(c => {
                    if (c && c.name) existingMap.set(c.name.toLowerCase().trim(), c);
                });
                state.customers = Array.from(existingMap.values());
                localStorage.setItem("im_saved_customers", JSON.stringify(state.customers));
                localStorage.setItem("im_customers", JSON.stringify(state.customers));
            }
            renderCustomerList();
            populateCustomerSelector();
        }
    });
});

// Load Data from LocalStorage & Firestore DB
function loadPersistedData() {
    // 1. Fetch Saved Invoices & Customers from Firestore DB via Parent React Window
    setTimeout(() => {
        console.log("[CashInvoice Iframe] Sending FETCH_CASH_INVOICES request to parent");
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ action: "FETCH_CASH_INVOICES" }, "*");
            window.parent.postMessage({ action: "FETCH_CASH_CUSTOMERS" }, "*");
        } else {
            window.postMessage({ action: "FETCH_CASH_INVOICES" }, "*");
            window.postMessage({ action: "FETCH_CASH_CUSTOMERS" }, "*");
        }
    }, 100);

    state.savedInvoices = []; // loaded from Firestore only
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

    // 3. Client & Invoice Info — always start fresh (new invoice on each page open)
    // Clear any previously saved client session so every open = new invoice
    localStorage.removeItem("im_client_info");
    state.clientInfo = { ...DEFAULT_CLIENT };
    // Tentative invoice number (will be corrected after Firestore data arrives)
    state.clientInfo.invNumber = "SRR-2026-0001";
    state._autoAssignedNum = "SRR-2026-0001";
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
    document.getElementById("preview-client-name").innerText = state.clientInfo.name || "";
    document.getElementById("preview-client-address").innerText = state.clientInfo.address || "";
    document.getElementById("preview-client-mobile").innerText = state.clientInfo.mobile || "";
    document.getElementById("preview-client-email").innerText = state.clientInfo.email || "";
    document.getElementById("preview-inv-number").innerText = state.clientInfo.invNumber || "";
    document.getElementById("preview-dc-number").innerText = state.clientInfo.dcNumber || "-";
    document.getElementById("preview-inv-date").innerText = formatDateString(state.clientInfo.invDate);
    const previewInvDueEl = document.getElementById("preview-inv-due");
    if (previewInvDueEl) previewInvDueEl.innerText = formatDateString(state.clientInfo.invDue);

    // 4. Price List Catalog
    loadProjectCatalogIfPresent();

    // 5. Invoice Draft Items
    const savedItems = localStorage.getItem("im_invoice_items");
    if (savedItems) {
        state.invoiceItems = JSON.parse(savedItems);
    } else {
        // Initial empty row
        state.invoiceItems = [{ description: "", sku: "", size: "", qty: 1, rate: 0 }];
    }

    // 6. Customer Directory
    const savedCustomers = localStorage.getItem("im_saved_customers") || localStorage.getItem("im_customers");
    if (savedCustomers) {
        try {
            state.customers = JSON.parse(savedCustomers);
        } catch (e) {
            state.customers = [];
        }
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
            localStorage.setItem("im_saved_customers", JSON.stringify(state.customers));
            localStorage.setItem("im_customers", JSON.stringify(state.customers));
            syncCustomerToFirestore(newCustomer);
            
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
            switchDashboardTab("customers");
            openInvoicesDashboard();
            const formCard = document.getElementById("dashboard-cust-form-card");
            if (formCard) formCard.style.display = "block";
            const nameInput = document.getElementById("dash-cust-name");
            if (nameInput) nameInput.focus();
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

    // Auto-close dropdown menus when selecting an option
    document.querySelectorAll(".dropdown-item").forEach(item => {
        item.addEventListener("click", () => {
            if (addDropdownMenu) addDropdownMenu.classList.remove("show");
            if (viewDropdownMenu) viewDropdownMenu.classList.remove("show");
        });
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
            switchDashboardTab("customers");
            openInvoicesDashboard();
        });
    }

    if (closeViewCustModalBtn) closeViewCustModalBtn.addEventListener("click", closeViewCustModal);
    if (closeViewCustModalBtn2) closeViewCustModalBtn2.addEventListener("click", closeViewCustModal);

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



    const tabInvoicesBtn = document.getElementById("tab-invoices-btn");
    if (tabInvoicesBtn) {
        tabInvoicesBtn.addEventListener("click", () => switchDashboardTab("invoices"));
    }

    const tabCustomersBtn = document.getElementById("tab-customers-btn");
    if (tabCustomersBtn) {
        tabCustomersBtn.addEventListener("click", () => switchDashboardTab("customers"));
    }

    const tabReportsBtn = document.getElementById("tab-reports-btn");
    if (tabReportsBtn) {
        tabReportsBtn.addEventListener("click", () => switchDashboardTab("reports"));
    }

    // Dashboard Inline Customer Creation Handlers
    const dashAddCustBtn = document.getElementById("dashboard-add-cust-btn");
    const dashCustFormCard = document.getElementById("dashboard-cust-form-card");
    const dashCancelCustBtn = document.getElementById("dash-cancel-cust-btn");
    const dashSaveCustBtn = document.getElementById("dash-save-cust-btn");

    if (dashAddCustBtn && dashCustFormCard) {
        dashAddCustBtn.addEventListener("click", () => {
            dashCustFormCard.style.display = dashCustFormCard.style.display === "none" ? "block" : "none";
            if (dashCustFormCard.style.display === "block") {
                const nameInput = document.getElementById("dash-cust-name");
                if (nameInput) nameInput.focus();
            }
        });
    }

    if (dashCancelCustBtn && dashCustFormCard) {
        dashCancelCustBtn.addEventListener("click", () => {
            dashCustFormCard.style.display = "none";
        });
    }

    if (dashSaveCustBtn) {
        dashSaveCustBtn.addEventListener("click", () => {
            const name = (document.getElementById("dash-cust-name")?.value || "").trim();
            const mobile = (document.getElementById("dash-cust-mobile")?.value || "").trim();
            const email = (document.getElementById("dash-cust-email")?.value || "").trim();
            const address = (document.getElementById("dash-cust-address")?.value || "").trim();

            if (!name) {
                alert("Customer name is required!");
                return;
            }

            const newCust = { name, mobile, email, address };
            state.customers.push(newCust);
            localStorage.setItem("im_saved_customers", JSON.stringify(state.customers));
            localStorage.setItem("im_customers", JSON.stringify(state.customers));
            syncCustomerToFirestore(newCust);

            renderDashboardCustomersList();
            renderCustomerList();
            populateCustomerSelector();

            // Clear inputs & hide form card
            document.getElementById("dash-cust-name").value = "";
            document.getElementById("dash-cust-mobile").value = "";
            document.getElementById("dash-cust-email").value = "";
            document.getElementById("dash-cust-address").value = "";
            if (dashCustFormCard) dashCustFormCard.style.display = "none";

            showStatus(`Added customer: ${name}`);

            // Background Google Drive sync
            if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                syncCustomersWithGDrive(true);
            }
        });
    }

    if (backToEditorBtn) {
        backToEditorBtn.addEventListener("click", closeInvoicesDashboard);
    }

    if (dashboardInvSearch) {
        dashboardInvSearch.addEventListener("input", (e) => {
            if (activeDashboardTab === "invoices") {
                renderDashboardInvoicesList(e.target.value);
            } else if (activeDashboardTab === "customers") {
                renderDashboardCustomersList(e.target.value);
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
        // 1. Validate Customer/Client Name — read from DOM or state
        const domClientName = (document.getElementById("preview-client-name")?.innerText || "").trim();
        const clientName = domClientName || (state.clientInfo.name || "").trim();
        // Sync into state in case only DOM was updated
        if (domClientName) state.clientInfo.name = domClientName;
        if (!clientName || clientName === "Customer Name" || clientName === "Hospital / Customer Name") {
            alert("Mandatory Error: Please click and enter a valid Client/Customer Name directly on the invoice sheet.");
            const previewEl = document.getElementById("preview-client-name");
            if (previewEl) previewEl.focus();
            return false;
        }

        // 2. Validate Invoice Number — read from DOM or state
        const domInvNum = (document.getElementById("preview-inv-number")?.innerText || "").trim();
        const invNum = domInvNum || (state.clientInfo.invNumber || "").trim();
        if (domInvNum) state.clientInfo.invNumber = domInvNum;
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

    const syncCustomerToFirestore = (cust) => {
        if (!cust || !cust.name) return;
        const targetWin = (window.parent && window.parent !== window) ? window.parent : window;
        targetWin.postMessage({
            action: "SAVE_CASH_CUSTOMER",
            payload: {
                id: cust.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'),
                name: cust.name.trim(),
                mobile: cust.mobile || "",
                email: cust.email || "",
                address: cust.address || ""
            }
        }, "*");
    };

    // Auto-save customer details into state, local storage & Firestore DB
    const autoSaveCustomer = (custData) => {
        if (!custData || !custData.name || !custData.name.trim()) return;
        const nameTrim = custData.name.trim();
        if (nameTrim.toLowerCase() === "walk-in customer") return;

        let custObj = {
            name: nameTrim,
            address: custData.address || "",
            mobile: custData.mobile || "",
            email: custData.email || ""
        };

        const existingIdx = state.customers.findIndex(c => (c.name || "").toLowerCase().trim() === nameTrim.toLowerCase());
        if (existingIdx !== -1) {
            if (custData.address) state.customers[existingIdx].address = custData.address;
            if (custData.mobile) state.customers[existingIdx].mobile = custData.mobile;
            if (custData.email) state.customers[existingIdx].email = custData.email;
            custObj = state.customers[existingIdx];
        } else {
            state.customers.push(custObj);
        }
        localStorage.setItem("im_saved_customers", JSON.stringify(state.customers));
        localStorage.setItem("im_customers", JSON.stringify(state.customers));

        // Sync to Firestore DB
        syncCustomerToFirestore(custObj);
    };

    // Reusable function to save the current invoice in the workspace
    const saveActiveInvoice = () => {
        // Sync DOM values into state before validation
        const domName = document.getElementById("preview-client-name")?.innerText.trim();
        const domAddress = document.getElementById("preview-client-address")?.innerText.trim();
        const domMobile = document.getElementById("preview-client-mobile")?.innerText.trim();
        const domEmail = document.getElementById("preview-client-email")?.innerText.trim();
        const domInvNum = document.getElementById("preview-inv-number")?.innerText.trim();
        if (domName) state.clientInfo.name = domName;
        if (domAddress) state.clientInfo.address = domAddress;
        if (domMobile) state.clientInfo.mobile = domMobile;
        if (domEmail) state.clientInfo.email = domEmail;
        if (domInvNum) state.clientInfo.invNumber = domInvNum;

        if (!validateInvoice()) return;

        // Auto-save customer details
        if (state.clientInfo.name) {
            autoSaveCustomer({
                name: state.clientInfo.name,
                address: state.clientInfo.address,
                mobile: state.clientInfo.mobile,
                email: state.clientInfo.email
            });
        }

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
            paymentReceived: grandTotal,
            savedAt: new Date().getTime()
        };

        const existingIdx = state.savedInvoices.findIndex(inv => inv.invNumber === invoiceToSave.invNumber);
        if (existingIdx !== -1) {
            if (confirm(`Invoice ${invoiceToSave.invNumber} already exists. Do you want to update it?`)) {
                invoiceToSave.paymentReceived = grandTotal;
                state.savedInvoices[existingIdx] = invoiceToSave;
                showStatus(`Updated saved invoice: ${invoiceToSave.invNumber}`);
            } else {
                return;
            }
        } else {
            state.savedInvoices.push(invoiceToSave);
            showStatus(`Saved invoice: ${invoiceToSave.invNumber}`);
        }
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ action: "SAVE_CASH_INVOICE", payload: invoiceToSave }, "*");
        }

        // Open dashboard first
        activeDashboardTab = "invoices";
        openInvoicesDashboard();

        // Clear active sheet so editor is refreshed for the next bill
        clearActiveInvoiceData();

        // Background Google Drive sync
        if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
            syncInvoicesWithGDrive(true);
        }
    };

    const saveActiveInvoiceSilent = () => {
        if (!validateInvoice()) return false;

        // Auto-save customer details
        if (state.clientInfo.name) {
            autoSaveCustomer({
                name: state.clientInfo.name,
                address: state.clientInfo.address,
                mobile: state.clientInfo.mobile,
                email: state.clientInfo.email
            });
        }

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
            paymentReceived: grandTotal,
            savedAt: new Date().getTime()
        };
        
        const existingIdx = state.savedInvoices.findIndex(inv => inv.invNumber === invoiceToSave.invNumber);
        if (existingIdx !== -1) {
            invoiceToSave.paymentReceived = grandTotal;
            state.savedInvoices[existingIdx] = invoiceToSave;
            showStatus(`Updated saved invoice: ${invoiceToSave.invNumber}`);
        } else {
            state.savedInvoices.push(invoiceToSave);
            showStatus(`Saved invoice: ${invoiceToSave.invNumber}`);
        }
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ action: "SAVE_CASH_INVOICE", payload: invoiceToSave }, "*");
        }
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
            if (!validateInvoice()) return;
            const invNum = state.clientInfo.invNumber || getNextInvoiceNumber();
            const saved = saveActiveInvoiceSilent();
            if (saved) {
                // Find saved invoice object
                const savedInv = state.savedInvoices.find(inv => inv.invNumber === invNum) || state.savedInvoices[state.savedInvoices.length - 1];

                // Clear active draft form
                clearActiveInvoiceData();

                // Switch to Saved Invoices tab and render list
                activeDashboardTab = "invoices";
                openInvoicesDashboard();
                renderSavedInvoicesList();

                // Open preview modal for the saved invoice and trigger print dialog
                if (savedInv) {
                    setTimeout(() => {
                        openViewInvoiceModal(savedInv, true);
                    }, 100);
                }
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
        setInner("preview-client-name", "");
        setInner("preview-client-address", "");
        setInner("preview-client-mobile", "");
        setInner("preview-client-email", "");
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
    const clearCatalogBtn = document.getElementById("clear-catalog-btn");
    if (clearCatalogBtn) {
        clearCatalogBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to remove the custom Price List? The app will revert to the default project catalog.")) {
                localStorage.removeItem("im_price_list");
                localStorage.removeItem("im_price_list_name");
                loadProjectCatalogIfPresent();
                const catStatus = document.getElementById("catalog-status");
                if (catStatus) catStatus.style.display = "none";
                showStatus("Custom price list removed. Reverted to default project catalog.");

                // Background Google Drive sync
                if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
                    syncCatalogWithGDrive(true);
                }
            }
        });
    }

    // Print / PDF Button
    const printInvoiceBtn = document.getElementById("print-invoice-btn");
    if (printInvoiceBtn) {
        printInvoiceBtn.addEventListener("click", () => {
            if (!validateInvoice()) return;
            const activeObj = getActiveInvoiceObj();
            openViewInvoiceModal(activeObj, true);
        });
    }

    window.addEventListener("beforeprint", syncAllPrintSpans);

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
        const handleCustomerSearch = () => {
            const rawText = previewClientName.textContent || previewClientName.innerText || "";
            const cleanText = rawText.replace(/\u00a0/g, " ").trim();
            showCustomerRecommendations(cleanText, paperCustList);
        };

        previewClientName.addEventListener("input", handleCustomerSearch);
        previewClientName.addEventListener("focus", () => {
            closeAllRecommendationDropdowns();
            closeAllSizeDropdowns();
            handleCustomerSearch();
        });
        previewClientName.addEventListener("click", () => {
            handleCustomerSearch();
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
        if (paperCustList && !e.target.closest("#paper-cust-rec-list") && e.target !== previewClientName && !previewClientName?.contains(e.target)) {
            paperCustList.style.display = "none";
            const billDetails = paperCustList.closest(".inv-bill-details");
            if (billDetails) billDetails.classList.remove("has-open-dropdown");
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
            const updateStateVal = () => {
                const val = preview.innerText.trim();
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
            };
            preview.addEventListener("input", updateStateVal);
            preview.addEventListener("blur", updateStateVal);
            
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

// Auto-load project folder catalog file (catalog.xlsx) if present and no local storage override exists
async function loadProjectCatalogIfPresent() {
    const savedPriceList = localStorage.getItem("im_price_list");
    const savedCatalogName = localStorage.getItem("im_price_list_name");
    
    if (savedPriceList) {
        try {
            state.priceList = JSON.parse(savedPriceList);
            updateCatalogBadge(state.priceList.length, savedCatalogName || "Loaded from storage");
            return;
        } catch (e) {
            console.error("Error loading saved price list", e);
        }
    }

    try {
        const res = await fetch("catalog.xlsx");
        if (res.ok) {
            const buf = await res.arrayBuffer();
            const data = new Uint8Array(buf);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            if (jsonData && jsonData.length > 0) {
                handleCatalogData(jsonData, "catalog.xlsx");
                showStatus(`Auto-loaded catalog from project folder (${jsonData.length} items)`);
                return;
            }
        }
    } catch (err) {
        // Fallback to sample catalog if catalog.xlsx is not present
    }

    // Default fallback
    state.priceList = [...SAMPLE_CATALOG];
    updateCatalogBadge(state.priceList.length, "Sample Implants Catalog");
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
        const rateKey = findKey(row, ['sell price', 'price', 'rate', 'unit price', 'rate (unit price)', 'cost', 'sell_price']);

        const qty = qtyKey ? parseInt(String(row[qtyKey]).replace(/[^0-9]/g, '')) || 1 : 1;
        const rate = rateKey ? parseFloat(String(row[rateKey]).replace(/[^0-9.]/g, '')) || 0 : 0;

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

        const descVal = item.description || '';
        const sizeVal = item.size || '-';
        const qtyVal = item.qty || 1;
        const rateVal = parseFloat(item.rate || 0).toFixed(2);
        const amountVal = ((item.qty || 0) * (item.rate || 0)).toFixed(2);

        let sizeCellHtml = `
            <div class="size-autocomplete">
                <input type="text" class="table-input size-input" value="${item.size || ''}" placeholder="${hasCatalogSizes ? 'Select Size' : 'Type/click for size...'}" autocomplete="off">
                <span class="print-text print-size">${sizeVal}</span>
                <div class="size-recommendation-list" id="size-rec-list-${index}"></div>
            </div>
        `;

        tr.innerHTML = `
            <td style="text-align: center; color: #9ca3af; font-weight: 500;">${index + 1}</td>
            <td>
                <div class="autocomplete-container">
                    <textarea class="table-input desc-input" rows="1" placeholder="Type item name..." autocomplete="off">${descVal}</textarea>
                    <span class="print-text print-desc">${descVal}</span>
                    <div class="recommendation-list" id="rec-list-${index}"></div>
                </div>
            </td>
            <td>
                ${sizeCellHtml}
            </td>
            <td>
                <input type="number" class="table-input num-input qty-input center-input" value="${qtyVal}" min="1" step="1" autocomplete="off">
                <span class="print-text print-qty" style="text-align:center;">${qtyVal}</span>
            </td>
            <td>
                <input type="number" class="table-input num-input rate-input" value="${item.rate || 0}" min="0" step="any" autocomplete="off">
                <span class="print-text print-rate" style="text-align:right;">₹${rateVal}</span>
            </td>
            <td>
                <input type="number" class="table-input num-input amount-input" value="${amountVal}" min="0" step="any" style="font-weight: 600;" autocomplete="off">
                <span class="print-text print-amount" style="text-align:right; font-weight:600;">₹${amountVal}</span>
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
    const amt = (qty * rate).toFixed(2);
    const amtEl = rowEl.querySelector(".amount-input");
    if (amtEl) {
        amtEl.value = amt;
    }
    const printQty = rowEl.querySelector(".print-qty");
    const printRate = rowEl.querySelector(".print-rate");
    const printAmt = rowEl.querySelector(".print-amount");
    if (printQty) printQty.innerText = qty;
    if (printRate) printRate.innerText = `₹${parseFloat(rate).toFixed(2)}`;
    if (printAmt) printAmt.innerText = `₹${amt}`;
}

// Synchronize all table inputs into print spans before printing
function syncAllPrintSpans() {
    const tbody = document.getElementById("invoice-tbody");
    if (!tbody) return;
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((tr, index) => {
        const item = state.invoiceItems[index];
        const descInput = tr.querySelector(".desc-input");
        const sizeInput = tr.querySelector(".size-input");
        const qtyInput = tr.querySelector(".qty-input");
        const rateInput = tr.querySelector(".rate-input");
        const amtInput = tr.querySelector(".amount-input");
        
        const descSpan = tr.querySelector(".print-desc");
        const sizeSpan = tr.querySelector(".print-size");
        const qtySpan = tr.querySelector(".print-qty");
        const rateSpan = tr.querySelector(".print-rate");
        const amtSpan = tr.querySelector(".print-amount");
        
        const descVal = descInput ? descInput.value : (item ? item.description : '');
        const sizeVal = sizeInput ? sizeInput.value : (item ? item.size : '-');
        const qtyVal = qtyInput ? qtyInput.value : (item ? item.qty : 1);
        const rateVal = rateInput ? parseFloat(rateInput.value || 0).toFixed(2) : (item ? parseFloat(item.rate || 0).toFixed(2) : '0.00');
        const amtVal = amtInput ? parseFloat(amtInput.value || 0).toFixed(2) : (item ? ((item.qty || 0) * (item.rate || 0)).toFixed(2) : '0.00');
        
        if (descSpan) descSpan.innerText = descVal;
        if (sizeSpan) sizeSpan.innerText = sizeVal || '-';
        if (qtySpan) qtySpan.innerText = qtyVal;
        if (rateSpan) rateSpan.innerText = `₹${rateVal}`;
        if (amtSpan) amtSpan.innerText = `₹${amtVal}`;
    });
    
    // Also sync discount span
    const flatDiscountInput = document.getElementById("discount-flat-input");
    const printDiscountEl = document.getElementById("print-discount-val");
    if (flatDiscountInput && printDiscountEl) {
        const flat = parseFloat(flatDiscountInput.value) || 0;
        printDiscountEl.innerText = flat > 0 ? `-₹${flat.toFixed(2)}` : `₹0.00`;
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
                <div class="rec-desc" style="line-height: 1.4;">${baseName}</div>
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
        const row = inputEl ? inputEl.closest("tr") : null;
        const tableWrapper = inputEl ? inputEl.closest(".table-wrapper") : null;
        if (row) row.classList.add("has-open-dropdown");
        if (container.parentElement) container.parentElement.classList.add("has-open-dropdown");
        if (tableWrapper) tableWrapper.classList.add("has-open-dropdown");
    } else {
        container.style.display = "none";
        const row = inputEl ? inputEl.closest("tr") : null;
        const tableWrapper = inputEl ? inputEl.closest(".table-wrapper") : null;
        if (row) row.classList.remove("has-open-dropdown");
        if (container.parentElement) container.parentElement.classList.remove("has-open-dropdown");
        if (tableWrapper) tableWrapper.classList.remove("has-open-dropdown");
    }
}

// Highlight suggestions during arrow key navigation
function highlightRecommendation(items) {
    items.forEach((item, idx) => {
        if (idx === state.activeRecIndex) {
            item.classList.add("active");
            const parent = item.parentElement;
            if (parent) {
                const itemTop = item.offsetTop;
                const itemBottom = itemTop + item.offsetHeight;
                const parentTop = parent.scrollTop;
                const parentBottom = parentTop + parent.clientHeight;
                if (itemTop < parentTop) {
                    parent.scrollTop = itemTop;
                } else if (itemBottom > parentBottom) {
                    parent.scrollTop = itemBottom - parent.clientHeight;
                }
            }
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
    document.querySelectorAll(".has-open-dropdown").forEach(el => {
        el.classList.remove("has-open-dropdown");
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
    const printDiscountEl = document.getElementById("print-discount-val");
    if (printDiscountEl) {
        printDiscountEl.innerText = flatDiscount > 0 ? `-₹${flatDiscount.toFixed(2)}` : `₹0.00`;
    }

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
        if (rowEl) rowEl.classList.remove("has-open-dropdown");
        if (container.parentElement) container.parentElement.classList.remove("has-open-dropdown");
        return;
    }

    // Filter matching catalog size items for this exact base description name (with fallback)
    let matchedCatalogItems = state.priceList.filter(p => 
        String(p.description || p.base_description || "").toLowerCase().trim() === itemDesc.toLowerCase().trim()
    );
    if (matchedCatalogItems.length === 0) {
        matchedCatalogItems = state.priceList.filter(p => {
            const desc = String(p.description || p.base_description || "").toLowerCase().trim();
            const queryD = itemDesc.toLowerCase().trim();
            return desc && queryD && (desc.includes(queryD) || queryD.includes(desc));
        });
    }
    
    const queryLower = query.toLowerCase().trim();
    const filtered = matchedCatalogItems.filter(m => 
        String(m.size || "").toLowerCase().includes(queryLower)
    );
    
    if (filtered.length > 0) {
        filtered.forEach(match => {
            const div = document.createElement("div");
            div.className = "recommendation-item";
            div.style.padding = "7px 10px";
            
            const itemPrice = (match.price !== undefined && match.price !== null && !isNaN(match.price)) ? parseFloat(match.price) : 0;
            const priceLabel = itemPrice > 0 ? ` <span style="color:#6b7280; font-weight:500;">(₹${itemPrice})</span>` : '';
            
            div.innerHTML = `
                <div style="font-size:11px; font-weight:600; color:var(--paper-accent); display:flex; justify-content:space-between; align-items:center; line-height: 1.4;">
                    <span>${match.size}</span>
                    ${priceLabel}
                </div>
            `;
            
            div.addEventListener("click", () => {
                state.invoiceItems[idx].size = match.size;
                state.invoiceItems[idx].sku = match.sku || "";
                state.invoiceItems[idx].rate = itemPrice;
                
                inputEl.value = match.size;
                rateInput.value = itemPrice;
                
                recalculateRowAmount(rowEl, state.invoiceItems[idx].qty, itemPrice);
                updateCalculations();
                saveItemsToDraft();
                
                container.style.display = "none";
                const tableWrapper = inputEl ? inputEl.closest(".table-wrapper") : null;
                if (rowEl) rowEl.classList.remove("has-open-dropdown");
                if (container.parentElement) container.parentElement.classList.remove("has-open-dropdown");
                if (tableWrapper) tableWrapper.classList.remove("has-open-dropdown");
                showStatus(`Selected size: ${match.size} ${itemPrice > 0 ? '(Rate: ₹' + itemPrice + ')' : ''}`);
            });
            container.appendChild(div);
        });
        container.style.display = "block";
        const tableWrapper = inputEl ? inputEl.closest(".table-wrapper") : null;
        if (rowEl) rowEl.classList.add("has-open-dropdown");
        if (container.parentElement) container.parentElement.classList.add("has-open-dropdown");
        if (tableWrapper) tableWrapper.classList.add("has-open-dropdown");
    } else {
        container.style.display = "none";
        const tableWrapper = inputEl ? inputEl.closest(".table-wrapper") : null;
        if (rowEl) rowEl.classList.remove("has-open-dropdown");
        if (container.parentElement) container.parentElement.classList.remove("has-open-dropdown");
        if (tableWrapper) tableWrapper.classList.remove("has-open-dropdown");
    }
}

// Highlight sizes list recommendations during key navigation
function highlightSizeRecommendation(items) {
    items.forEach((item, idx) => {
        if (idx === state.activeSizeIndex) {
            item.classList.add("active");
            const parent = item.parentElement;
            if (parent) {
                const itemTop = item.offsetTop;
                const itemBottom = itemTop + item.offsetHeight;
                const parentTop = parent.scrollTop;
                const parentBottom = parentTop + parent.clientHeight;
                if (itemTop < parentTop) {
                    parent.scrollTop = itemTop;
                } else if (itemBottom > parentBottom) {
                    parent.scrollTop = itemBottom - parent.clientHeight;
                }
            }
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
    document.querySelectorAll(".has-open-dropdown").forEach(el => {
        el.classList.remove("has-open-dropdown");
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
    
    document.getElementById("preview-client-name").innerText = cust.name || "";
    document.getElementById("preview-client-address").innerText = cust.address || "";
    document.getElementById("preview-client-mobile").innerText = cust.mobile || "";
    document.getElementById("preview-client-email").innerText = cust.email || "";
    
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
    const invNum = inv.invNumber || 'Draft';
    if (confirm(`Mark invoice ${invNum} as fully paid?`)) {
        const grandTotal = inv.grandTotal || 0;
        if (originalIdx >= 0 && originalIdx < state.savedInvoices.length) {
            state.savedInvoices[originalIdx].paymentReceived = grandTotal;
        } else {
            const foundIdx = state.savedInvoices.findIndex(i => i.invNumber === inv.invNumber);
            if (foundIdx !== -1) {
                state.savedInvoices[foundIdx].paymentReceived = grandTotal;
            }
        }
        
        // Persist to local storage
        localStorage.setItem("im_saved_invoices", JSON.stringify(state.savedInvoices));

        // Post to host application frame
        if (window.parent && window.parent !== window) {
            const updatedInv = state.savedInvoices[originalIdx] || inv;
            window.parent.postMessage({ action: 'SAVE_CASH_INVOICE', payload: updatedInv }, '*');
        }
        
        renderSavedInvoicesList();
        
        const dashboardContainer = document.getElementById("invoices-dashboard-container");
        if (dashboardContainer && dashboardContainer.style.display !== "none") {
            const searchInput = document.getElementById("dashboard-inv-search");
            renderDashboardInvoicesList(searchInput ? searchInput.value : "");
        }
        
        showStatus(`Invoice ${invNum} marked as fully paid.`);

        // Background Google Drive sync
        if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) {
            syncInvoicesWithGDrive(true);
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
    if (!container) return;
    container.innerHTML = "";
    const queryLower = (query || "").replace(/\u00a0/g, ' ').toLowerCase().trim();
    
    // Ensure state.customers has the latest data from localStorage if empty
    if (!state.customers || state.customers.length === 0) {
        try {
            const saved = localStorage.getItem("im_saved_customers") || localStorage.getItem("im_customers");
            if (saved) state.customers = JSON.parse(saved);
        } catch (e) {
            state.customers = [];
        }
    }

    const billDetails = container.closest(".inv-bill-details");
    
    // When query is empty, show up to 10 saved customers; otherwise filter
    const matched = queryLower === ""
        ? state.customers.slice(0, 10)
        : state.customers.filter(cust => 
            (cust.name && cust.name.toLowerCase().includes(queryLower)) ||
            (cust.mobile && String(cust.mobile).includes(queryLower)) ||
            (cust.address && cust.address.toLowerCase().includes(queryLower)) ||
            (cust.email && cust.email.toLowerCase().includes(queryLower))
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
                <div style="font-weight: 600; font-size: 12px; color: #0f172a; display: flex; justify-content: space-between; align-items: center;">
                    <span>${cust.name}</span>
                    <span style="font-size: 9.5px; color: var(--paper-accent, #0f766e); font-weight: 600;">Select</span>
                </div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                    ${cust.mobile ? `📞 ${cust.mobile}` : ''} ${cust.email ? ` | ✉️ ${cust.email}` : ''}
                </div>
                ${cust.address ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${cust.address}</div>` : ''}
            `;
            const selectCust = (e) => {
                e.preventDefault();
                e.stopPropagation();
                preloadCustomer(cust);
                container.style.display = "none";
                if (billDetails) billDetails.classList.remove("has-open-dropdown");
            };
            div.addEventListener("mousedown", selectCust);
            div.addEventListener("click", selectCust);
            container.appendChild(div);
        });
        container.style.display = "block";
        if (billDetails) billDetails.classList.add("has-open-dropdown");
    } else {
        container.style.display = "none";
        if (billDetails) billDetails.classList.remove("has-open-dropdown");
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
    if (!tbody) {
        console.warn("[CashInvoice] dashboard-invoices-tbody not found in DOM");
        return;
    }

    console.log("[CashInvoice] renderDashboardInvoicesList called, state.savedInvoices count:", state.savedInvoices.length);

    const filter = filterText.toLowerCase().trim();
    // When filter is empty, show ALL invoices
    const filtered = filter === "" ? [...state.savedInvoices] : state.savedInvoices.filter(inv =>
        (inv.invNumber && inv.invNumber.toLowerCase().includes(filter)) ||
        (inv.dcNumber && inv.dcNumber.toLowerCase().includes(filter)) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(filter))
    );

    console.log("[CashInvoice] filtered invoices count:", filtered.length);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-msg" style="text-align:center; padding: 25px 0;">${state.savedInvoices.length === 0 ? 'No saved invoices found.' : 'No matching invoices found.'}</td></tr>`;
        return;
    }
    
    tbody.innerHTML = "";
    filtered.forEach((inv) => {
        const originalIdx = state.savedInvoices.findIndex(i => i.invNumber === inv.invNumber);
        const grandTotal = parseFloat(inv.grandTotal) || 0;
        const paymentReceived = parseFloat(inv.paymentReceived) || 0;
        const balanceDue = grandTotal - paymentReceived;
        const balanceHtml = balanceDue <= 0
            ? '<span style="color:#10b981;font-weight:700;">Paid</span>'
            : '<span style="color:#ef4444;font-weight:700;">₹' + balanceDue.toFixed(2) + '</span>';
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f3f4f6';
        tr.onmouseenter = () => tr.style.background = '#f0fdf4';
        tr.onmouseleave = () => tr.style.background = '';
        tr.innerHTML = '<td style="padding:12px 16px;"><a href="#" class="inv-num-link" style="font-weight:700;color:#2a9d8f;font-size:13px;text-decoration:underline;cursor:pointer;">' + (inv.invNumber||'-') + '</a>' + (inv.dcNumber ? '<span style="display:block;font-size:11px;color:#9ca3af;margin-top:2px;">DC: ' + inv.dcNumber + '</span>' : '') + '</td><td style="padding:12px 16px;color:#6b7280;font-size:12px;">' + (formatDateString(inv.invDate)||'-') + '</td><td style="padding:12px 16px;font-weight:600;color:#111827;font-size:13px;">' + (inv.clientName||'Walk-in') + '</td><td style="padding:12px 16px;text-align:right;font-weight:700;color:#111827;">₹' + grandTotal.toFixed(2) + '</td><td style="padding:12px 16px;text-align:right;color:#6b7280;">₹' + paymentReceived.toFixed(2) + '</td><td style="padding:12px 16px;text-align:right;">' + balanceHtml + '</td><td style="padding:12px 16px;text-align:center;"><div style="display:flex;gap:6px;justify-content:center;align-items:center;"><button type="button" class="view-inv-btn" style="padding:5px 10px;border-radius:6px;border:1px solid #3b82f6;background:#eff6ff;color:#2563eb;font-size:11px;cursor:pointer;font-weight:600;">&#128065; View</button><button type="button" class="load-inv-btn" style="padding:5px 10px;border-radius:6px;border:1px solid #2a9d8f;background:#2a9d8f;color:#fff;font-size:11px;cursor:pointer;font-weight:600;">&#9998; Edit</button><button type="button" class="pay-quick-btn" style="padding:5px 10px;border-radius:6px;border:1px solid #d1d5db;background:#f9fafb;color:#374151;font-size:11px;cursor:pointer;font-weight:600;">&#128179; Pay</button><button type="button" class="delete-inv-btn" style="padding:5px 8px;border-radius:6px;border:1px solid #fca5a5;background:#fff;color:#ef4444;font-size:13px;cursor:pointer;">X</button></div></td>';
        const quickPayBtn = tr.querySelector('.pay-quick-btn');
        const loadBtn = tr.querySelector('.load-inv-btn');
        const deleteBtn = tr.querySelector('.delete-inv-btn');
        const viewBtn = tr.querySelector('.view-inv-btn');
        if (viewBtn) viewBtn.addEventListener('click', () => openViewInvoiceModal(inv));
        const invNumLink = tr.querySelector('.inv-num-link');
        if (invNumLink) invNumLink.addEventListener('click', (e) => { e.preventDefault(); openViewInvoiceModal(inv); });
        if (quickPayBtn) quickPayBtn.addEventListener('click', () => quickPayInvoice(inv, originalIdx));
        if (loadBtn) loadBtn.addEventListener('click', () => { loadSavedInvoice(inv); closeInvoicesDashboard(); });
        if (deleteBtn) deleteBtn.addEventListener('click', () => {
            if (confirm('Delete invoice ' + inv.invNumber + '?')) {
                state.savedInvoices.splice(originalIdx, 1);
                if (window.parent && window.parent !== window) window.parent.postMessage({ action: 'DELETE_CASH_INVOICE', payload: inv.invNumber }, '*');
                renderDashboardInvoicesList(filterText);
                renderSavedInvoicesList();
                showStatus('Deleted invoice ' + inv.invNumber);
                if (state.gdriveAccessToken && Date.now() < state.gdriveTokenExpiry) syncInvoicesWithGDrive(true);
            }
        });
        tbody.appendChild(tr);
    });
}

// Toggle Saved Invoices Dashboard view and visibility of editor controls
function openInvoicesDashboard() {
    const invoicesDashboardContainer = document.getElementById("invoices-dashboard-container");
    if (!invoicesDashboardContainer) {
        console.error("[DEBUG] invoices-dashboard-container not found!");
        return;
    }
    console.log("[DEBUG] openInvoicesDashboard: showing overlay, savedInvoices:", state.savedInvoices.length);
    invoicesDashboardContainer.style.display = "block";
    document.body.style.overflow = "hidden";
    renderSavedInvoicesList();
    switchDashboardTab(activeDashboardTab);
}

function closeInvoicesDashboard() {
    const invoicesDashboardContainer = document.getElementById("invoices-dashboard-container");
    if (invoicesDashboardContainer) invoicesDashboardContainer.style.display = "none";
    document.body.style.overflow = "";
    showStatus("Invoice Editor opened.");
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
        tr.style.borderBottom = "1px solid #f3f4f6";
        tr.onmouseenter = () => tr.style.background = "#f0fdf4";
        tr.onmouseleave = () => tr.style.background = "";
        tr.innerHTML = "<td style=\"padding:12px 16px;font-weight:600;color:#111827;font-size:13px;\">" + item.name + "</td><td style=\"padding:12px 16px;color:#6b7280;\">" + (item.size || "-") + "</td><td style=\"padding:12px 16px;text-align:center;font-weight:700;color:#2a9d8f;font-size:15px;\">" + item.qty + "</td>";
        tbody.appendChild(tr);
    });
}


// Helper to construct invoice object from active invoice form
function getActiveInvoiceObj() {
    const invNum = (document.getElementById("preview-inv-number")?.innerText || document.getElementById("inv-number")?.value || getNextInvoiceNumber()).trim();
    const dcNum = (document.getElementById("preview-dc-number")?.innerText || document.getElementById("dc-number")?.value || "-").trim();
    const invDate = state.clientInfo.invDate || new Date().toISOString().split('T')[0];
    const clientName = (document.getElementById("preview-client-name")?.innerText || state.clientInfo.name || "Walk-in Customer").replace(/\u00a0/g, ' ').trim();
    const clientAddr = (document.getElementById("preview-client-address")?.innerText || state.clientInfo.address || "").replace(/\u00a0/g, ' ').trim();
    const clientMob = (document.getElementById("preview-client-mobile")?.innerText || state.clientInfo.mobile || "").replace(/\u00a0/g, ' ').trim();
    const clientEmail = (document.getElementById("preview-client-email")?.innerText || state.clientInfo.email || "").replace(/\u00a0/g, ' ').trim();
    
    let subtotal = 0;
    const items = state.invoiceItems.map(item => {
        const qty = parseInt(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        subtotal += qty * rate;
        return {
            description: item.description || "",
            sku: item.sku || "",
            size: item.size || "",
            qty: qty,
            rate: rate
        };
    });
    
    const flatDiscountInput = document.getElementById("discount-flat-input");
    const discount = flatDiscountInput ? parseFloat(flatDiscountInput.value) || 0 : 0;
    const grandTotal = Math.round(subtotal - discount);
    
    return {
        invNumber: invNum,
        dcNumber: dcNum,
        invDate: invDate,
        clientName: clientName,
        clientAddress: clientAddr,
        clientMobile: clientMob,
        clientEmail: clientEmail,
        invoiceItems: items,
        discount: discount,
        grandTotal: grandTotal,
        paymentReceived: grandTotal
    };
}

// Open a read-only print view modal for a saved or active invoice
function openViewInvoiceModal(inv, autoPrint = false) {
    const modal = document.getElementById('view-invoice-modal');
    const content = document.getElementById('view-invoice-content');
    const printBtn = document.getElementById('view-modal-print-btn');
    const closeBtn = document.getElementById('view-modal-close-btn');
    if (!modal || !content) return;

    const items = (inv.invoiceItems || []).filter(i => (i.description||'').trim());
    const itemRows = items.map((item, idx) => {
        const amt = (parseFloat(item.qty)||0) * (parseFloat(item.rate)||0);
        return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:6px 8px;text-align:center;color:#64748b;font-size:11px;">${idx+1}</td>
            <td style="padding:6px 8px;font-weight:700;color:#0f172a;font-size:11px;">${item.description||''}${item.sku ? ' <span style="color:#64748b;font-size:10px;font-weight:400;">['+item.sku+']</span>' : ''}</td>
            <td style="padding:6px 8px;text-align:center;color:#475569;font-size:11px;">${item.size||'-'}</td>
            <td style="padding:6px 8px;text-align:center;font-weight:600;color:#0f172a;font-size:11px;">${item.qty||0}</td>
            <td style="padding:6px 8px;text-align:right;color:#334155;font-size:11px;">₹${parseFloat(item.rate||0).toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:700;color:#0f172a;font-size:11px;">₹${amt.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const grandTotal = parseFloat(inv.grandTotal)||0;
    const discount = parseFloat(inv.discount)||0;
    const subtotal = grandTotal + discount;
    const paid = parseFloat(inv.paymentReceived)||0;
    const balance = grandTotal - paid;

    const numberToWords = (num) => {
        return typeof numberToEnglishWords === 'function' ? numberToEnglishWords(num) : '';
    };

    const words = numberToWords(grandTotal);
    const amountInWordsHtml = words ? `<div style="margin-top:8px;font-size:11px;color:#334155;background:#f8fafc;padding:6px 10px;border-radius:6px;border-left:4px solid #0f766e;">Amount in Words: <strong style="color:#0f172a;">${words}</strong></div>` : '';

    content.innerHTML = `
    <div id="printable-inv-area" style="background:#fff;padding:24px 30px;border-radius:8px;font-family:'Outfit',sans-serif;max-width:800px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.08);color:#0f172a;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0f766e;margin-bottom:12px;">
            <div>
                <h2 style="font-size:20px;font-weight:800;color:#0f766e;margin:0 0 2px 0;">SRR ORTHO PLUS</h2>
                <p style="font-size:11px;color:#475569;margin:1px 0;">217, SIDDARTH NAGAR, HYDERABAD - 500038</p>
                <p style="font-size:11px;color:#475569;margin:1px 0;">Phone: 9396857455 | Email: srrorthoplus999@gmail.com</p>
                <p style="font-size:11px;color:#475569;margin:1px 0;">Website: srrorthoplus.com</p>
            </div>
            <div style="text-align:right;">
                <p style="font-size:20px;font-weight:900;color:#0f766e;margin:0 0 4px 0;letter-spacing:1px;text-transform:uppercase;">CASH MEMO</p>
                <table style="border-collapse:collapse;font-size:11px;margin-left:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;">
                    <tr><td style="font-weight:600;color:#475569;padding:2px 6px;text-align:right;">Bill No:</td><td style="font-weight:700;color:#0f172a;padding:2px 6px;text-align:left;">${inv.invNumber || '-'}</td></tr>
                    <tr><td style="font-weight:600;color:#475569;padding:2px 6px;text-align:right;">DC No:</td><td style="font-weight:700;color:#0f172a;padding:2px 6px;text-align:left;">${inv.dcNumber || '-'}</td></tr>
                    <tr><td style="font-weight:600;color:#475569;padding:2px 6px;text-align:right;">Date:</td><td style="font-weight:700;color:#0f172a;padding:2px 6px;text-align:left;">${formatDateString(inv.invDate) || '-'}</td></tr>
                </table>
            </div>
        </div>

        <!-- Bill To Section -->
        <div style="margin-bottom:12px;">
            <p style="font-size:11px;text-transform:uppercase;color:#0f766e;font-weight:700;margin:0 0 4px 0;letter-spacing:0.5px;">BILL TO:</p>
            <p style="font-size:13px;font-weight:700;color:#0f172a;background:#f8fafc;border:1px solid #cbd5e1;padding:3px 8px;border-radius:6px;display:inline-block;margin:0 0 4px 0;">${inv.clientName || 'Walk-in Customer'}</p>
            ${inv.clientAddress ? `<p style="font-size:11px;color:#475569;margin:2px 0;">Address: <strong style="color:#0f172a;">${inv.clientAddress}</strong></p>` : ''}
            ${inv.clientMobile ? `<p style="font-size:11px;color:#475569;margin:2px 0;">Mobile: <strong style="color:#0f172a;">${inv.clientMobile}</strong></p>` : ''}
            ${inv.clientEmail ? `<p style="font-size:11px;color:#475569;margin:2px 0;">Email: <strong style="color:#0f172a;">${inv.clientEmail}</strong></p>` : ''}
        </div>

        <!-- Items Table -->
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;border:1px solid #cbd5e1;">
            <thead>
                <tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;">
                    <th style="padding:6px 8px;text-align:center;color:#334155;font-weight:700;width:5%;">#</th>
                    <th style="padding:6px 8px;text-align:left;color:#334155;font-weight:700;width:40%;">ITEM DESCRIPTION</th>
                    <th style="padding:6px 8px;text-align:center;color:#334155;font-weight:700;width:15%;">SIZE</th>
                    <th style="padding:6px 8px;text-align:center;color:#334155;font-weight:700;width:10%;">QTY</th>
                    <th style="padding:6px 8px;text-align:right;color:#334155;font-weight:700;width:15%;">RATE (₹)</th>
                    <th style="padding:6px 8px;text-align:right;color:#334155;font-weight:700;width:15%;">AMOUNT (₹)</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
        </table>

        <!-- Summary: Left Bank/UPI + Right Totals -->
        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:10px;">
            <!-- Left Side: Bank Details & UPI QR -->
            <div style="width:55%;">
                <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:6px 10px;border-radius:6px;margin-bottom:6px;">
                    <p style="font-size:11px;font-weight:700;color:#0f766e;margin:0 0 2px 0;text-transform:uppercase;">BANK ACCOUNT DETAILS:</p>
                    <p style="font-size:11px;color:#334155;margin:0;line-height:1.4;">HDFC BANK, A/C: 5010023456789, IFSC: HDFC0001234, Hyderabad Branch</p>
                </div>
                <div style="display:flex;align-items:center;gap:10px;background:#f8fafc;padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;">
                    <div style="flex-grow:1;">
                        <p style="font-size:11px;font-weight:700;color:#0f766e;margin:0 0 2px 0;text-transform:uppercase;">SCAN TO PAY (UPI):</p>
                        <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 4px 0;">9396857455@ybl</p>
                        <div style="display:flex;gap:4px;align-items:center;">
                            <span style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:700;color:#5f259f;">PhonePe</span>
                            <span style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:700;color:#ea4335;">GPay</span>
                            <span style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:700;color:#00baf2;">Paytm</span>
                            <span style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;font-size:9.5px;font-weight:700;color:#000;">UPI</span>
                        </div>
                    </div>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=upi%3A%2F%2Fpay%3Fpa%3D9396857455%40ybl%26pn%3DSRR%2520ORTHO%2520PLUS" style="width:75px;height:75px;border-radius:4px;border:1px solid #cbd5e1;flex-shrink:0;" alt="UPI QR Code" />
                </div>
                ${amountInWordsHtml}
            </div>

            <!-- Right Side: Totals -->
            <div style="width:40%;">
                <table style="width:100%;font-size:11px;border-collapse:collapse;">
                    <tr><td style="padding:3px 4px;color:#475569;font-weight:600;text-align:right;">Subtotal:</td><td style="padding:3px 4px;text-align:right;font-weight:700;color:#0f172a;">₹${subtotal.toFixed(2)}</td></tr>
                    ${discount > 0 ? `<tr><td style="padding:3px 4px;color:#475569;font-weight:600;text-align:right;">Discount:</td><td style="padding:3px 4px;text-align:right;color:#ef4444;font-weight:700;">-₹${discount.toFixed(2)}</td></tr>` : ''}
                    <tr style="background:rgba(15, 118, 110, 0.06);">
                        <td style="padding:6px 6px;font-weight:800;font-size:12px;text-align:right;color:#0f766e;">Grand Total:</td>
                        <td style="padding:6px 6px;text-align:right;font-weight:800;font-size:12px;color:#0f766e;">₹${grandTotal.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Footer: Terms & Signature -->
        <div style="border-top:1px solid #cbd5e1;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;">
            <div style="font-size:11px;color:#475569;width:55%;">
                <p style="font-weight:700;margin:0 0 2px 0;text-transform:uppercase;color:#0f766e;">TERMS & CONDITIONS:</p>
                <ol style="margin:0;padding-left:14px;line-height:1.4;">
                    <li>Goods once sold will not be taken back or exchanged.</li>
                    <li>All disputes subject to local jurisdiction only.</li>
                </ol>
            </div>
            <div style="text-align:right;width:38%;">
                <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">For <strong>SRR ORTHO PLUS</strong></p>
                <div style="font-family:'Caveat',cursive;font-size:20px;font-weight:700;color:#1d4ed8;height:24px;display:flex;align-items:center;justify-content:flex-end;">A.SATYANARAYANA</div>
                <p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:2px 0 0 0;">Authorized Signatory</p>
            </div>
        </div>
    </div>`;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    if (closeBtn) {
        closeBtn.onclick = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
    }
    modal.onclick = (e) => { if (e.target === modal) { modal.style.display = 'none'; document.body.style.overflow = ''; } };
    
    if (printBtn) {
        printBtn.onclick = () => {
            const printArea = document.getElementById("printable-inv-area");
            if (!printArea) return;
            const printWin = window.open('', '_blank');
            if (!printWin) return;
            printWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>CASH MEMO - ${inv.invNumber || 'SRR'}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                    <style>
                        body { margin: 0; padding: 6mm 10mm; font-family: 'Outfit', sans-serif; background: #fff; color: #0f172a; font-size: 11px; }
                        @page { size: A4 portrait; margin: 6mm; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box !important; }
                    </style>
                </head>
                <body>
                    ${printArea.outerHTML}
                </body>
                </html>
            `);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => {
                printWin.print();
                printWin.close();
            }, 350);
        };
    }

    if (autoPrint && printBtn) {
        setTimeout(() => {
            printBtn.click();
        }, 150);
    }
}

// Render Saved Customers List in Dashboard
function renderDashboardCustomersList(filterText = "") {
    const tbody = document.getElementById("dashboard-customers-tbody");
    if (!tbody) return;

    const filter = filterText.toLowerCase().trim();
    const filtered = state.customers.filter(c => 
        (c.name && c.name.toLowerCase().includes(filter)) ||
        (c.mobile && c.mobile.includes(filter)) ||
        (c.address && c.address.toLowerCase().includes(filter)) ||
        (c.email && c.email.toLowerCase().includes(filter))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-msg" style="text-align:center; padding: 25px 0; color:#6b7280;">${state.customers.length === 0 ? 'No saved customers found. Click "+ Add New Customer" to create one.' : 'No matching customers found.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    filtered.forEach(cust => {
        const outstanding = getCustomerOutstanding(cust.name);
        const outstandingHtml = outstanding > 0 
            ? `<span style="color:#ef4444; font-weight:700;">₹${outstanding.toFixed(2)}</span>` 
            : `<span style="color:#10b981; font-weight:600;">₹0.00</span>`;

        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #f3f4f6";
        tr.onmouseenter = () => tr.style.background = "#f0fdf4";
        tr.onmouseleave = () => tr.style.background = "";
        
        tr.innerHTML = `
            <td style="padding:12px 16px; font-weight:700; color:#111827; font-size:13px;">${cust.name || 'Unnamed Customer'}</td>
            <td style="padding:12px 16px; color:#6b7280; font-size:12px;">
                ${cust.mobile ? `<div>📞 ${cust.mobile}</div>` : ''}
                ${cust.email ? `<div>✉️ ${cust.email}</div>` : ''}
                ${!cust.mobile && !cust.email ? '-' : ''}
            </td>
            <td style="padding:12px 16px; color:#6b7280; font-size:12px;">${cust.address || '-'}</td>
            <td style="padding:12px 16px; text-align:right;">${outstandingHtml}</td>
            <td style="padding:12px 16px; text-align:center;">
                <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <button type="button" class="load-cust-btn" style="padding:5px 10px; border-radius:6px; border:1px solid #2a9d8f; background:#2a9d8f; color:#fff; font-size:11px; cursor:pointer; font-weight:600;">⚡ Load to Invoice</button>
                    <button type="button" class="ledger-cust-btn" style="padding:5px 10px; border-radius:6px; border:1px solid #3b82f6; background:#eff6ff; color:#2563eb; font-size:11px; cursor:pointer; font-weight:600;" title="View Customer Transaction Ledger">📊 Ledger</button>
                    <button type="button" class="delete-cust-btn" style="padding:5px 8px; border-radius:6px; border:1px solid #fca5a5; background:#fff; color:#ef4444; font-size:13px; cursor:pointer;" title="Delete Customer">✕</button>
                </div>
            </td>
        `;

        const loadBtn = tr.querySelector(".load-cust-btn");
        const ledgerBtn = tr.querySelector(".ledger-cust-btn");
        const deleteBtn = tr.querySelector(".delete-cust-btn");

        if (loadBtn) {
            loadBtn.addEventListener("click", () => {
                preloadCustomer(cust);
                closeInvoicesDashboard();
                showStatus(`Loaded customer: ${cust.name}`);
            });
        }

        if (ledgerBtn) {
            ledgerBtn.addEventListener("click", () => {
                openLedgerModal(cust.name);
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => {
                if (confirm(`Delete customer "${cust.name}"?`)) {
                    const idx = state.customers.findIndex(c => c.name === cust.name && c.mobile === cust.mobile);
                    if (idx !== -1) {
                        state.customers.splice(idx, 1);
                        localStorage.setItem("im_saved_customers", JSON.stringify(state.customers));
                        renderDashboardCustomersList(filterText);
                        renderCustomerList();
                        populateCustomerSelector();
                        showStatus(`Deleted customer ${cust.name}`);
                    }
                }
            });
        }

        tbody.appendChild(tr);
    });
}

// Switch between dashboard views (Invoices & Payments vs Customers Directory vs Used Items Report)
function switchDashboardTab(tab) {
    activeDashboardTab = tab;
    const invoicesContainer = document.getElementById("dashboard-invoices-container");
    const customersContainer = document.getElementById("dashboard-customers-container");
    const reportsContainer = document.getElementById("dashboard-reports-container");
    const searchInput = document.getElementById("dashboard-inv-search");
    const downloadReportBtn = document.getElementById("download-report-btn");
    const dashboardTitle = document.getElementById("dashboard-title");
    const tabInvBtn = document.getElementById("tab-invoices-btn");
    const tabCustBtn = document.getElementById("tab-customers-btn");
    const tabRepBtn = document.getElementById("tab-reports-btn");

    if (dashboardTitle) {
        if (tab === "invoices") dashboardTitle.innerText = "Saved Invoices & Payments";
        else if (tab === "customers") dashboardTitle.innerText = "Saved Customers Directory";
        else dashboardTitle.innerText = "Used Items Report";
    }

    const setBtnStyle = (btn, active) => {
        if (!btn) return;
        btn.style.background = active ? "#2a9d8f" : "#fff";
        btn.style.color = active ? "#fff" : "#374151";
        btn.style.borderColor = active ? "#2a9d8f" : "#d1d5db";
    };

    setBtnStyle(tabInvBtn, tab === "invoices");
    setBtnStyle(tabCustBtn, tab === "customers");
    setBtnStyle(tabRepBtn, tab === "reports");

    if (invoicesContainer) invoicesContainer.style.display = tab === "invoices" ? "block" : "none";
    if (customersContainer) customersContainer.style.display = tab === "customers" ? "block" : "none";
    if (reportsContainer) reportsContainer.style.display = tab === "reports" ? "block" : "none";
    if (downloadReportBtn) downloadReportBtn.style.display = tab === "reports" ? "inline-block" : "none";

    if (searchInput) {
        searchInput.value = "";
        if (tab === "invoices") searchInput.placeholder = "Search invoice # or customer...";
        else if (tab === "customers") searchInput.placeholder = "Search customer name, phone or address...";
        else searchInput.placeholder = "Search item name or size...";
    }

    if (tab === "invoices") renderDashboardInvoicesList();
    else if (tab === "customers") renderDashboardCustomersList();
    else renderDashboardReportsList();
}
window.switchDashboardTab = switchDashboardTab;

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
    const cleanName = (customerName || '').replace(/\u00a0/g, ' ').trim();

    // Hide the Customer Directory modal first
    const viewCustomersModal = document.getElementById("view-customers-modal");
    if (viewCustomersModal) viewCustomersModal.classList.remove("active");
    
    const ledgerModal = document.getElementById("ledger-modal");
    if (!ledgerModal) return;
    
    // Set customer name
    const titleEl = document.getElementById("ledger-customer-name");
    if (titleEl) titleEl.innerText = cleanName;
    
    // Set default dates: 2020-01-01 to today so all historical transactions show up
    const today = new Date();
    const startDateStr = "2020-01-01";
    const endDateStr = today.toISOString().split('T')[0];
    
    const startDateEl = document.getElementById("ledger-start-date");
    const endDateEl = document.getElementById("ledger-end-date");
    if (startDateEl) startDateEl.value = startDateStr;
    if (endDateEl) endDateEl.value = endDateStr;
    
    // Render ledger
    renderLedger(cleanName, startDateStr, endDateStr);
    
    // Open Ledger modal on top of all layers
    ledgerModal.style.zIndex = "10000000";
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
    const norm = str => (str || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
    const targetNorm = norm(customerName);

    const invoices = state.savedInvoices.filter(inv => 
        inv.clientName && norm(inv.clientName) === targetNorm
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

    // Use OAuth Implicit flow to redirect back to top-level window URL
    let redirectUri = window.location.origin + window.location.pathname;
    try {
        if (window.parent && window.parent !== window) {
            redirectUri = window.parent.location.origin + window.parent.location.pathname;
        }
    } catch (e) {
        // Fallback to current window location if cross-origin
        redirectUri = window.location.origin + window.location.pathname;
    }
    const scopes = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ].join(" ");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}`;
    
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
                    // Sync merged GDrive invoices to Firestore DB
                    state.savedInvoices.forEach(inv => {
                        if (window.parent && window.parent !== window) {
                            window.parent.postMessage({ action: "SAVE_CASH_INVOICE", payload: inv }, "*");
                        }
                    });
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




