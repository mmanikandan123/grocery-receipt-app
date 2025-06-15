// Check if the browser supports the Web Speech API
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!window.SpeechRecognition) {
    alert("Sorry, your browser does not support Speech Recognition. Please try Google Chrome.");
} else {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN'; // Set language to Tamil (India)
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const startBtn = document.getElementById('startBtn');
    const statusEl = document.getElementById('status');
    const itemTableBody = document.querySelector('#itemTable tbody');
    const grandTotalEl = document.getElementById('grandTotal');
    const printBtn = document.getElementById('printBtn');
    
    let groceryItems = []; // Array to store item objects

    startBtn.addEventListener('click', () => {
        recognition.start();
        statusEl.textContent = 'கேட்கிறேன்... (Listening...)';
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        statusEl.textContent = `You said: ${transcript}. Adding to list...`;
        parseAndAddItem(transcript);
    };

    recognition.onspeechend = () => {
        recognition.stop();
        statusEl.textContent = 'Press the button and speak...';
    };

    recognition.onerror = (event) => {
        statusEl.textContent = 'Error occurred in recognition: ' + event.error;
    };

    function parseAndAddItem(text) {
        // Simple Tamil number and unit parser
        const numberMap = {
            'ஒன்று': 1, 'ஒன்னு': 1, 'ஒரு': 1,
            'ரெண்டு': 2, 'இரண்டு': 2,
            'மூணு': 3, 'மூன்று': 3,
            'நாலு': 4, 'நான்கு': 4,
            'ஐந்து': 5, 'அஞ்சு': 5,
            'ஆறு': 6,
            'ஏழு': 7,
            'எட்டு': 8,
            'ஒன்பது': 9,
            'பத்து': 10,
            'அரை': 0.5, 'அர': 0.5
        };
        const units = ['கிலோ', 'கிராம்', 'லிட்டர்', 'பீஸ்', 'டஜன்', 'പാക്കറ്റ്']; // Add more units if needed

        let words = text.split(' ');
        let quantity = 1;
        let unit = 'piece'; // default unit
        let itemName = [];

        words.forEach(word => {
            if (numberMap[word]) {
                quantity = numberMap[word];
            } else if (!isNaN(parseFloat(word))) { // Check if the word is a number like "1", "2.5"
                quantity = parseFloat(word);
            } else if (units.includes(word)) {
                unit = word;
            } else {
                itemName.push(word);
            }
        });

        if (itemName.length > 0) {
            const newItem = {
                name: itemName.join(' '),
                quantity: `${quantity} ${unit}`,
                price: 0,
                total: 0
            };
            groceryItems.push(newItem);
            renderList();
        } else {
            statusEl.textContent = `Could not understand the item name from "${text}"`;
        }
    }

    function renderList() {
        itemTableBody.innerHTML = ''; // Clear existing table
        let grandTotal = 0;

        groceryItems.forEach((item, index) => {
            const row = document.createElement('tr');
            
        // --- START: MODIFIED LINE ---
        // We changed type="number" to type="text" and added inputmode="decimal" for mobile convenience.
        // We also added size="6" to keep the field small.
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td><input type="text" inputmode="decimal" size="6" class="price-input" data-index="${index}" value="${item.price > 0 ? item.price : ''}" placeholder="Enter price"></td>
            <td class="item-total">₹${item.total.toFixed(2)}</td>
            <td><button class="delete-btn" data-index="${index}">X</button></td>
        `;
        // --- END: MODIFIED LINE ---

            itemTableBody.appendChild(row);
            grandTotal += item.total;
        });

        grandTotalEl.textContent = `மொத்தத் தொகை (Grand Total): ₹${grandTotal.toFixed(2)}`;
        addEventListenersToInputs();
    }

// In script.js

function addEventListenersToInputs() {
    // --- START: MODIFIED CODE ---
    document.querySelectorAll('.price-input').forEach(input => {
        input.addEventListener('input', (e) => {
            // This line ensures only numbers and a single decimal point can be entered
            e.target.value = e.target.value.replace(/[^0-9.]/g, '');

            const index = e.target.dataset.index;
            const price = parseFloat(e.target.value) || 0; // Use the cleaned value
            groceryItems[index].price = price;
            
            // Extract the number from the quantity string e.g., "2 கிலோ" -> 2
            const quantityNum = parseFloat(groceryItems[index].quantity) || 1;
            groceryItems[index].total = price * quantityNum;
            
            // Re-render the list to update totals
            renderList();

            // After re-rendering, focus back on the input the user was editing
            const newInputs = document.querySelectorAll('.price-input');
            const targetInput = Array.from(newInputs).find(i => i.dataset.index === index);
            if (targetInput) {
                targetInput.focus();
                // Move cursor to the end
                targetInput.setSelectionRange(targetInput.value.length, targetInput.value.length);
            }
        });
    });
    // --- END: MODIFIED CODE ---

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.target.dataset.index;
            groceryItems.splice(index, 1); // Remove item from array
            renderList();
        });
    });
}

    printBtn.addEventListener('click', () => {
        const shopName = document.getElementById('shopName').value;
        const shopAddress = document.getElementById('shopAddress').value;
        const shopPhone = document.getElementById('shopPhone').value;

        // Populate the hidden receipt div
        const receiptHeader = document.getElementById('receipt-header');
        receiptHeader.innerHTML = `
            <h2>${shopName || 'Your Shop'}</h2>
            <p>${shopAddress || 'Your Address'}</p>
            <p>${shopPhone || 'Your Phone'}</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            <hr>
        `;
        
        const receiptTable = document.getElementById('receipt-table');
        receiptTable.innerHTML = `
            <thead>
                <tr><th>Item</th><th>Quantity</th><th>Price (₹)</th><th>Total (₹)</th></tr>
            </thead>
            <tbody>
                ${groceryItems.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>${item.total.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        document.getElementById('receipt-total').innerHTML = grandTotalEl.innerHTML;

        // Trigger the browser's print dialog
        window.print();
    });
}