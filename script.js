document.addEventListener('DOMContentLoaded', () => {

    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!window.SpeechRecognition) {
        alert("Sorry, your browser does not support Speech Recognition. Please try Google Chrome.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    // DOM Elements
    const startBtn = document.getElementById('startBtn');
    const statusEl = document.getElementById('status');
    const itemTableBody = document.querySelector('#itemTable tbody');
    const grandTotalEl = document.getElementById('grandTotal');
    const printBtn = document.getElementById('printBtn');
    const manualForm = document.getElementById('manualForm');
    const undoBtn = document.getElementById('undoBtn');
    const shopNameEl = document.getElementById('shopName');
    const shopAddressEl = document.getElementById('shopAddress');
    const shopPhoneEl = document.getElementById('shopPhone');
    const receiptNumberEl = document.getElementById('receiptNumber');
    const manualItemUnitEl = document.getElementById('manualItemUnit');
    const receiptToPrintEl = document.getElementById('receipt-to-print');

    let groceryItems = [];
    let isListening = false;
    
    // --- START: The Definitive Speech Recognition Logic Variables ---
    let speechProcessingTimer = null;
    let transcriptToProcess = '';
    // --- END: Speech Recognition Logic Variables ---
    
    // --- Event Listeners ---

    startBtn.addEventListener('click', () => {
        if (isListening) {
            isListening = false;
            recognition.stop();
        } else {
            isListening = true;
            recognition.start();
        }
    });

    undoBtn.addEventListener('click', () => {
        if (groceryItems.length > 0) {
            groceryItems.pop();
            renderList();
        }
    });

    recognition.onstart = () => {
        startBtn.textContent = '🛑 நிறுத்த (Stop Listening)';
        startBtn.classList.add('listening');
        statusEl.textContent = 'கேட்கிறேன்... (Listening...)';
    };

    // --- START: THE DEFINITIVE FIX FOR MOBILE DUPLICATES ---
    recognition.onresult = (event) => {
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
        
        statusEl.textContent = interimTranscript || 'Processing...';

        if (finalTranscriptThisTurn.trim()) {
            transcriptToProcess = finalTranscriptThisTurn.trim();

            clearTimeout(speechProcessingTimer);
            speechProcessingTimer = setTimeout(() => {
                const lastItem = groceryItems.length > 0 ? groceryItems[groceryItems.length - 1] : null;
                const newItem = parseTranscript(transcriptToProcess);

                if (!newItem) return; // If parsing fails, do nothing.

                // THE MAGIC LOGIC: Check if this is an "upgrade" of the previous item.
                // This happens when the new item name starts with the last item name, 
                // but is longer (e.g., "sugar 1 kg" is an upgrade of "sugar").
                if (lastItem && lastItem.quantity.includes('piece') && newItem.name.toLowerCase().startsWith(lastItem.name.toLowerCase())) {
                    // It's an upgrade. Replace the last item.
                    groceryItems[groceryItems.length - 1] = newItem;
                } else {
                    // It's a completely new item. Add it.
                    groceryItems.push(newItem);
                }
                
                renderList(); // Update the UI
                statusEl.textContent = `Added: ${transcriptToProcess}`;

            }, 250); // A very short "settling" timer
        }
    };
    // --- END: THE DEFINITIVE FIX ---

    recognition.onend = () => {
        if (isListening) {
            recognition.start();
        } else {
            startBtn.textContent = '🎤 பேசத் தொடங்கு (Start Listening)';
            startBtn.classList.remove('listening');
            statusEl.textContent = 'Press the button to start continuous listening...';
        }
    };

    recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'audio-capture') {
            statusEl.textContent = 'Error: ' + event.error;
        }
        isListening = false;
    };
    
    // --- Helper function for parsing speech text ---
    function parseTranscript(text) {
        const numberMap = { 'ஒன்று': 1, 'ஒன்னு': 1, 'ஒரு': 1, 'ரெண்டு': 2, 'இரண்டு': 2, 'மூணு': 3, 'மூன்று': 3, 'நாலு': 4, 'நான்கு': 4, 'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10, 'அரை': 0.5, 'அர': 0.5 };
        const units = ['கிலோ', 'கிராம்', 'லிட்டர்', 'மில்லி', 'பீஸ்', 'டஜன்', 'പാക്കറ്റ്', 'kg', 'g', 'l', 'ml'];
        let words = text.split(' ');
        let quantity = 1;
        let unit = 'piece';
        let itemName = [];

        words.forEach(word => {
            word = word.toLowerCase();
            if (numberMap[word]) {
                quantity = numberMap[word];
            } else if (!isNaN(parseFloat(word))) {
                quantity = parseFloat(word);
            } else if (units.includes(word)) {
                unit = word;
            } else {
                itemName.push(word);
            }
        });

        if (itemName.length === 0 && text.trim().length > 0) {
            itemName.push(text.trim());
        }

        if (itemName.length > 0) {
            return {
                name: itemName.join(' '),
                quantity: `${quantity} ${unit}`,
                price: 0,
                total: 0
            };
        }
        return null; // Return null if no valid item name is found
    }

    // --- Other Core Functions (Unchanged) ---
    printBtn.addEventListener('click', () => { if (groceryItems.length === 0) { alert("The grocery list is empty. Please add items before printing."); return; } const logoSVG = document.querySelector('.brand-logo').outerHTML; document.getElementById('receipt-logo-container').innerHTML = logoSVG; const receiptHeader = document.getElementById('receipt-header'); receiptHeader.innerHTML = `<h2>${shopNameEl.value || 'Your Shop'}</h2><p>${shopAddressEl.value || 'Your Address'}</p><p>${shopPhoneEl.value || 'Your Phone'}</p><p>Date: ${new Date().toLocaleDateString('en-IN')} | Receipt No: ${receiptNumberEl.value}</p><hr>`; const receiptTable = document.getElementById('receipt-table'); receiptTable.innerHTML = `<thead><tr><th>S.No.</th><th>Item</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>${groceryItems.map((item, index) => `<tr><td>${index + 1}</td><td>${item.name}</td><td>${item.quantity}</td><td>${item.price.toFixed(2)}</td><td>${item.total.toFixed(2)}</td></tr>`).join('')}</tbody>`; document.getElementById('receipt-total').innerHTML = grandTotalEl.innerHTML; receiptToPrintEl.classList.remove('hidden'); window.print(); receiptToPrintEl.classList.add('hidden'); setTimeout(() => { if (confirm("Do you want to clear the list for a new receipt?")) { groceryItems = []; receiptNumberEl.value = generateReceiptNumber(); renderList(); } }, 500); });
    manualForm.addEventListener('submit', (e) => { e.preventDefault(); const itemName = document.getElementById('manualItemName').value.trim(); const quantity = document.getElementById('manualItemQty').value; const unit = manualItemUnitEl.value; if (itemName) { const newItem = { name: itemName, quantity: `${quantity} ${unit}`, price: 0, total: 0 }; groceryItems.push(newItem); renderList(); manualForm.reset(); manualItemUnitEl.value = 'piece'; } });
    function generateReceiptNumber() { const now = new Date(); const year = now.getFullYear(); const month = (now.getMonth() + 1).toString().padStart(2, '0'); const day = now.getDate().toString().padStart(2, '0'); const hours = now.getHours().toString().padStart(2, '0'); const minutes = now.getMinutes().toString().padStart(2, '0'); return `${year}${month}${day}-${hours}${minutes}`; }
    function saveState() { const state = { items: groceryItems, shopDetails: { name: shopNameEl.value, address: shopAddressEl.value, phone: shopPhoneEl.value, receiptNo: receiptNumberEl.value, } }; localStorage.setItem('groceryReceiptState', JSON.stringify(state)); }
    function loadState() { const savedState = localStorage.getItem('groceryReceiptState'); if (savedState) { const state = JSON.parse(savedState); groceryItems = state.items || []; if (state.shopDetails) { shopNameEl.value = state.shopDetails.name || ''; shopAddressEl.value = state.shopDetails.address || ''; shopPhoneEl.value = state.shopDetails.phone || ''; receiptNumberEl.value = state.shopDetails.receiptNo || generateReceiptNumber(); } renderList(); } else { receiptNumberEl.value = generateReceiptNumber(); } }
    function getPricePlaceholder(quantityString) { const unit = (quantityString.split(' ')[1] || 'piece').toLowerCase(); switch (unit) { case 'gram': case 'g': case 'கிராம்': return "Price per 100g"; case 'ml': case 'மில்லி': return "Price per 100ml"; case 'kg': case 'க கிலோ': return "Price per kg"; case 'liter': case 'லிட்டர்': return "Price per liter"; default: return `Price per ${unit}`; } }
    function calculateItemTotal(item) { const parts = item.quantity.toLowerCase().split(' '); const num = parseFloat(parts[0]) || 1; const unit = parts[1] || 'piece'; const price = item.price || 0; switch (unit) { case 'gram': case 'g': case 'கிராம்': return (num / 100) * price; case 'ml': case 'மில்லி': return (num / 100) * price; default: return num * price; } }
    function renderList() { itemTableBody.innerHTML = ''; let grandTotal = 0; groceryItems.forEach((item, index) => { const row = document.createElement('tr'); const placeholder = getPricePlaceholder(item.quantity); row.innerHTML = `<td data-label="S.No.">${index + 1}</td><td data-label="பொருள் (Item)">${item.name}</td><td data-label="அளவு (Quantity)">${item.quantity}</td><td data-label="விலை (Price ₹)"><input type="text" inputmode="decimal" class="price-input" data-index="${index}" value="${item.price > 0 ? item.price : ''}" placeholder="${placeholder}"></td><td data-label="மொத்தம் (Total ₹)" class="item-total">₹${item.total.toFixed(2)}</td><td data-label="நீக்கு (Delete)"><button class="delete-btn" data-index="${index}">X</button></td>`; itemTableBody.appendChild(row); grandTotal += item.total; }); grandTotalEl.textContent = `மொத்தத் தொகை (Grand Total): ₹${grandTotal.toFixed(2)}`; addEventListenersToInputs(); saveState(); }
    function addEventListenersToInputs() { document.querySelectorAll('.price-input').forEach(input => { input.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1'); const index = e.target.dataset.index; const price = parseFloat(e.target.value) || 0; const item = groceryItems[index]; item.price = price; item.total = calculateItemTotal(item); renderList(); const newInputs = document.querySelectorAll('.price-input'); const targetInput = Array.from(newInputs).find(i => i.dataset.index === index); if (targetInput) { targetInput.focus(); targetInput.setSelectionRange(targetInput.value.length, targetInput.value.length); } }); }); document.querySelectorAll('.delete-btn').forEach(button => { button.addEventListener('click', (e) => { const index = e.target.dataset.index; groceryItems.splice(index, 1); renderList(); }); }); [shopNameEl, shopAddressEl, shopPhoneEl].forEach(el => { el.addEventListener('input', saveState); }); }

    // Initial load
    loadState();
});
