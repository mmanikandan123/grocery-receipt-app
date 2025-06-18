document.addEventListener('DOMContentLoaded', () => {
    // --- APP INITIALIZATION ---
    initializeApp();
});

// --- GLOBAL VARIABLES ---
let groceryItems = [];
let isListening = false;
let speechProcessingTimer = null;
let transcriptToProcess = '';
let translations = {};
let priceList = [];
const recognition = setupRecognition();

async function initializeApp() {
    try {
        const [langResponse, priceResponse] = await Promise.all([
            fetch('languages.json'),
            fetch('pricelist.json')
        ]);
        translations = await langResponse.json();
        priceList = await priceResponse.json();
        
        setupEventListeners();
        loadState();
    } catch (error) {
        console.error("Failed to load initial data:", error);
        alert("Error loading application data. Please refresh the page.");
    }
}

function setupRecognition() {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        alert("Sorry, your browser does not support Speech Recognition.");
        return null;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    return rec;
}

function setupEventListeners() {
    const allElements = getDOMElements();
    allElements.startBtn.addEventListener('click', () => { if (isListening) { isListening = false; recognition.stop(); } else { isListening = true; recognition.start(); } });
    allElements.undoBtn.addEventListener('click', () => { if (groceryItems.length > 0) { groceryItems.pop(); renderList(); } });
    allElements.languageSelector.addEventListener('change', (e) => { changeLanguage(e.target.value); localStorage.setItem('preferredLanguage', e.target.value); });
    allElements.gstCheckbox.addEventListener('change', renderList);
    allElements.manualForm.addEventListener('submit', handleManualFormSubmit);
    allElements.printBtn.addEventListener('click', handlePrint);

    recognition.onstart = () => { isListening = true; document.getElementById('startBtnText').textContent = getTranslation('stopListening'); allElements.startBtn.classList.add('listening'); allElements.statusEl.textContent = '...'; };
    recognition.onresult = handleSpeechResult;
    recognition.onend = () => { if (isListening) { recognition.start(); } else { document.getElementById('startBtnText').textContent = getTranslation('startListening'); allElements.startBtn.classList.remove('listening'); } };
    recognition.onerror = (event) => { if (event.error !== 'no-speech' && event.error !== 'audio-capture') { allElements.statusEl.textContent = 'Error: ' + event.error; } isListening = false; };
}

function getDOMElements() {
    return {
        startBtn: document.getElementById('startBtn'), startBtnText: document.getElementById('startBtnText'), statusEl: document.getElementById('status'), itemTableBody: document.querySelector('#itemTable tbody'), printBtn: document.getElementById('printBtn'), manualForm: document.getElementById('manualForm'), undoBtn: document.getElementById('undoBtn'), shopNameEl: document.getElementById('shopName'), shopAddressEl: document.getElementById('shopAddress'), shopPhoneEl: document.getElementById('shopPhone'), receiptNumberEl: document.getElementById('receiptNumber'), manualItemNameEl: document.getElementById('manualItemName'), manualItemQtyEl: document.getElementById('manualItemQty'), manualItemUnitEl: document.getElementById('manualItemUnit'), receiptToPrintEl: document.getElementById('receipt-to-print'), languageSelector: document.getElementById('languageSelector'), gstCheckbox: document.getElementById('gstCheckbox'), subTotalEl: document.getElementById('subTotal'), cgstTotalEl: document.getElementById('cgstTotal'), sgstTotalEl: document.getElementById('sgstTotal'), grandTotalEl: document.getElementById('grandTotal'),
    };
}

function handleSpeechResult(event) {
    let interimTranscript = '';
    let finalTranscriptThisTurn = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalTranscriptThisTurn += transcript;
        } else {
            interimTranscript += transcript;
        }
    }
    getDOMElements().statusEl.textContent = interimTranscript || 'Processing...';
    if (finalTranscriptThisTurn.trim()) {
        transcriptToProcess = finalTranscriptThisTurn.trim();
        clearTimeout(speechProcessingTimer);
        speechProcessingTimer = setTimeout(() => {
            const newItem = createItemFromText(transcriptToProcess);
            if (!newItem) return;
            const lastItem = groceryItems.length > 0 ? groceryItems[groceryItems.length - 1] : null;
            if (lastItem && lastItem.quantity.includes('piece') && newItem.name.toLowerCase().startsWith(lastItem.name.toLowerCase())) {
                groceryItems[groceryItems.length - 1] = newItem;
            } else {
                groceryItems.push(newItem);
            }
            renderList();
            getDOMElements().statusEl.textContent = `Added: ${transcriptToProcess}`;
        }, 250);
    }
}

function handleManualFormSubmit(e) {
    e.preventDefault();
    const allElements = getDOMElements();
    const itemName = allElements.manualItemNameEl.value.trim();
    if (itemName) {
        const newItem = createItemFromText(`${itemName} ${allElements.manualItemQtyEl.value} ${allElements.manualItemUnitEl.value}`);
        groceryItems.push(newItem);
        renderList();
        allElements.manualForm.reset();
        allElements.manualItemUnitEl.value = 'piece';
    }
}

function createItemFromText(text) {
    const parsed = parseTranscript(text);
    if (!parsed) return null;
    const priceInfo = findPrice(parsed.itemName);
    const newItem = {
        name: parsed.itemName,
        quantity: `${parsed.quantity} ${parsed.unit}`,
        price: priceInfo ? priceInfo.price : 0,
        total: 0,
    };
    newItem.total = calculateItemTotal(newItem, priceInfo ? priceInfo.baseUnit : null);
    return newItem;
}

function findPrice(itemName) {
    const searchTerm = itemName.toLowerCase();
    const foundEntry = priceList.find(p => p.name === searchTerm);
    if (!foundEntry) return null;
    if (foundEntry.price !== undefined) return foundEntry;
    if (foundEntry.mapsTo) {
        const targetName = foundEntry.mapsTo;
        return priceList.find(p => p.name === targetName && p.price !== undefined);
    }
    return null;
}

function parseTranscript(text) {
    const numberMap = { 'ஒன்று': 1, 'ഒന്ന്': 1, 'ఒకటి': 1, 'एक': 1, 'ரெண்டு': 2, 'രണ്ട്': 2, 'రెండు': 2, 'दो': 2, 'மூன்று': 3, 'മൂന്ന്': 3, 'మూడు': 3, 'तीन': 3, 'நான்கு': 4, 'നാല്': 4, 'నాలుగు': 4, 'चार': 4, 'ஐந்து': 5, 'അഞ്ച്': 5, 'ఐదు': 5, 'पांच': 5, 'ஒரு': 1, 'ஒண்ணு': 1, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10, 'அரை': 0.5, 'அர': 0.5, 'கால்': 0.25, 'முக்கால்': 0.75, 'ஒன்றரை': 1.5, 'paav': 0.25, 'आधा': 0.5, 'അര': 0.5 };
    const units = ['கிலோ', 'கிராம்', 'லிட்டர்', 'மில்லி', 'பீஸ்', 'டஜன்', 'പാക്കറ്റ്', 'kg', 'g', 'l', 'ml', 'kilo', 'gram', 'liter', 'किलो', 'ग्राम', 'लीटर', 'दर्जन', 'പീസ്', 'കിലോ', 'ഗ്രാം', 'కిలో', 'గ్రాము', 'లీటరు', 'పీస్', 'డజను'];
    let words = text.split(' ');
    let quantity = 1;
    let unit = 'piece';
    let itemNameParts = [];
    words.forEach(word => { let w = word.toLowerCase(); if (numberMap[w] !== undefined) { quantity = numberMap[w]; } else if (!isNaN(parseFloat(w))) { quantity = parseFloat(w); } else if (units.includes(w)) { unit = w; } else { itemNameParts.push(word); } });
    const itemName = itemNameParts.join(' ').trim();
    if (itemName) { return { itemName, quantity, unit }; }
    return null;
}

function calculateItemTotal(item, baseUnit = null) {
    const parts = item.quantity.toLowerCase().split(' ');
    const num = parseFloat(parts[0]) || 1;
    const unit = parts[1] || 'piece';
    const price = item.price || 0;
    if (baseUnit) {
        if (baseUnit === 'kg' && (unit === 'g' || unit === 'gram' || unit === 'கிராம்')) return (num / 1000) * price;
        if (baseUnit === 'liter' && (unit === 'ml' || unit === 'மில்லி')) return (num / 1000) * price;
        if (baseUnit === '100g' && (unit === 'g' || unit === 'gram' || unit === 'கிராம்')) return (num / 100) * price;
    }
    switch (unit) {
        case 'gram': case 'g': case 'கிராம்': return (num / 100) * price;
        case 'ml': case 'மில்லி': return (num / 100) * price;
    }
    return num * price;
}

function renderList() {
    const allElements = getDOMElements();
    allElements.itemTableBody.innerHTML = '';
    const langDict = getTranslation(null, true);
    groceryItems.forEach((item, index) => {
        const row = document.createElement('tr');
        const trashIcon = `<span class="material-symbols-outlined">delete</span>`;
        row.innerHTML = `<td data-label-mobile="${langDict.colSNo}">${index + 1}</td><td data-label-mobile="${langDict.colItem}">${item.name}</td><td data-label-mobile="${langDict.colQty}">${item.quantity}</td><td data-label-mobile="${langDict.colPrice}"><input type="text" inputmode="decimal" class="price-input" data-index="${index}" value="${item.price > 0 ? item.price : ''}" placeholder="${getPricePlaceholder(item.quantity)}"></td><td data-label-mobile="${langDict.colTotal}" class="item-total">₹${item.total.toFixed(2)}</td><td data-label-mobile="${langDict.colDelete}"><button class="delete-btn" data-index="${index}">${trashIcon}</button></td>`;
        allElements.itemTableBody.appendChild(row);
    });
    updateGrandTotal();
    addEventListenersToInputs();
    saveState();
}

function updateGrandTotal() {
    const allElements = getDOMElements();
    const subTotal = groceryItems.reduce((total, item) => total + item.total, 0);
    let cgst = 0, sgst = 0;
    if (allElements.gstCheckbox.checked) {
        cgst = subTotal * 0.09; sgst = subTotal * 0.09;
        allElements.subTotalEl.classList.remove('hidden');
        allElements.cgstTotalEl.classList.remove('hidden');
        allElements.sgstTotalEl.classList.remove('hidden');
    } else {
        allElements.subTotalEl.classList.add('hidden');
        allElements.cgstTotalEl.classList.add('hidden');
        allElements.sgstTotalEl.classList.add('hidden');
    }
    const grandTotal = subTotal + cgst + sgst;
    allElements.subTotalEl.textContent = `${getTranslation('subTotal')}: ₹${subTotal.toFixed(2)}`;
    allElements.cgstTotalEl.textContent = `${getTranslation('cgst')}: ₹${cgst.toFixed(2)}`;
    allElements.sgstTotalEl.textContent = `${getTranslation('sgst')}: ₹${sgst.toFixed(2)}`;
    allElements.grandTotalEl.textContent = `${getTranslation('grandTotal')}: ₹${grandTotal.toFixed(2)}`;
}

function addEventListenersToInputs() {
    const allElements = getDOMElements();
    allElements.itemTableBody.querySelectorAll('.price-input').forEach(input => { input.removeEventListener('input', handlePriceInput); input.addEventListener('input', handlePriceInput); });
    allElements.itemTableBody.querySelectorAll('.delete-btn').forEach(button => { button.removeEventListener('click', handleDeleteClick); button.addEventListener('click', handleDeleteClick); });
    [allElements.shopNameEl, allElements.shopAddressEl, allElements.shopPhoneEl, allElements.gstCheckbox].forEach(el => { el.removeEventListener('input', saveState); el.addEventListener('input', saveState); });
}

function handlePriceInput(e) {
    const index = e.target.dataset.index;
    const item = groceryItems[index];
    if (item) {
        item.price = parseFloat(e.target.value) || 0;
        item.total = calculateItemTotal(item);
        e.target.closest('tr').querySelector('.item-total').textContent = `₹${item.total.toFixed(2)}`;
        updateGrandTotal();
        saveState();
    }
}

function handleDeleteClick(e) {
    const row = e.currentTarget.closest('tr');
    if (row) {
        const index = Array.from(row.parentElement.children).indexOf(row);
        groceryItems.splice(index, 1);
        renderList();
    }
}

function getTranslation(key, returnFullDict = false) {
    const lang = recognition.lang || 'en-IN';
    const langDict = translations[lang] || translations['en-IN'];
    if (returnFullDict) return langDict;
    return langDict[key] || `[${key}]`; // Return key name if translation missing
}

function changeLanguage(lang) {
    if (!translations[lang]) return;
    const wasListening = isListening;
    if (wasListening) recognition.stop();
    recognition.lang = lang;
    document.documentElement.lang = lang.split('-')[0];
    const langDict = translations[lang];
    document.querySelectorAll('[data-lang-key]').forEach(el => { if (el.id !== 'startBtnText') { el.textContent = langDict[el.dataset.langKey] || ''; } });
    document.querySelectorAll('[data-lang-key-placeholder]').forEach(el => { el.placeholder = langDict[el.dataset.langKeyPlaceholder] || ''; });
    const startBtnSpan = document.getElementById('startBtnText');
    if (startBtnSpan) { startBtnSpan.textContent = isListening ? langDict.stopListening : langDict.startListening; }
    renderList();
    if (wasListening) setTimeout(() => recognition.start(), 100);
}

function handlePrint() {
    const allElements = getDOMElements();
    if (groceryItems.length === 0) { alert("The grocery list is empty."); return; }
    
    let totalsHtml = '';
    if (allElements.gstCheckbox.checked) {
        totalsHtml += `<h3>${allElements.subTotalEl.textContent}</h3>`;
        totalsHtml += `<h3>${allElements.cgstTotalEl.textContent}</h3>`;
        totalsHtml += `<h3>${allElements.sgstTotalEl.textContent}</h3>`;
    }
    totalsHtml += `<h3>${allElements.grandTotalEl.textContent}</h3>`;

    const logoSVG = `<span class="material-symbols-outlined brand-logo">shopping_cart</span>`;
    document.getElementById('receipt-logo-container').innerHTML = logoSVG;
    
    const receiptHeader = document.getElementById('receipt-header');
    receiptHeader.innerHTML = `<h2>${allElements.shopNameEl.value || 'Your Shop'}</h2><p>${allElements.shopAddressEl.value || 'Your Address'}</p><p>${allElements.shopPhoneEl.value || 'Your Phone'}</p><p>Date: ${new Date().toLocaleDateString('en-IN')} | Receipt No: ${allElements.receiptNumberEl.value}</p><hr>`;
    
    const receiptTable = document.getElementById('receipt-table');
    receiptTable.innerHTML = `<thead><tr><th>S.No.</th><th>Item</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>${groceryItems.map((item, index) => `<tr><td>${index + 1}</td><td>${item.name}</td><td>${item.quantity}</td><td>${item.price.toFixed(2)}</td><td>${item.total.toFixed(2)}</td></tr>`).join('')}</tbody>`;
    
    const receiptTotals = document.getElementById('receipt-totals-breakdown');
    receiptTotals.innerHTML = totalsHtml;
    
    allElements.receiptToPrintEl.classList.remove('hidden');
    window.print();
    allElements.receiptToPrintEl.classList.add('hidden');
    
    setTimeout(() => {
        if (confirm(getTranslation('clearListConfirm'))) {
            groceryItems = [];
            allElements.receiptNumberEl.value = generateReceiptNumber();
            renderList();
        }
    }, 500);
}

function loadState() { const savedState = JSON.parse(localStorage.getItem('groceryReceiptState')); const savedLang = localStorage.getItem('preferredLanguage') || 'ta-IN'; getDOMElements().languageSelector.value = savedLang; changeLanguage(savedLang); if (savedState) { groceryItems = savedState.items || []; if (savedState.shopDetails) { const { shopNameEl, shopAddressEl, shopPhoneEl, receiptNumberEl, gstCheckbox } = getDOMElements(); shopNameEl.value = savedState.shopDetails.name || ''; shopAddressEl.value = savedState.shopDetails.address || ''; shopPhoneEl.value = savedState.shopDetails.phone || ''; receiptNumberEl.value = savedState.shopDetails.receiptNo || generateReceiptNumber(); gstCheckbox.checked = savedState.shopDetails.gstEnabled || false; } } else { getDOMElements().receiptNumberEl.value = generateReceiptNumber(); } renderList(); }
function saveState() { const { shopNameEl, shopAddressEl, shopPhoneEl, receiptNumberEl, gstCheckbox } = getDOMElements(); const state = { items: groceryItems, shopDetails: { name: shopNameEl.value, address: shopAddressEl.value, phone: shopPhoneEl.value, receiptNo: receiptNumberEl.value, gstEnabled: gstCheckbox.checked, } }; localStorage.setItem('groceryReceiptState', JSON.stringify(state)); }
function getPricePlaceholder(quantityString) { const unit = (quantityString.split(' ')[1] || 'piece').toLowerCase(); switch (unit) { case 'gram': case 'g': case 'கிராம்': return "Price per 100g"; case 'ml': case 'மில்லி': return "Price per 100ml"; case 'kg': case 'கிலோ': case 'kilo': return "Price per kg"; case 'liter': case 'லிட்டர்': return "Price per liter"; default: return `Price per ${unit}`; } }
function generateReceiptNumber() { const now = new Date(); return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`; }