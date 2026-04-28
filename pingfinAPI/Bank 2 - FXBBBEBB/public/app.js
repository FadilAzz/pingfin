// ==========================================
// INSTELLINGEN
// ==========================================
const API_BASE = 'http://localhost:3001/api'; // Zorg dat dit 3001 is voor Bank 2!
const MY_BIC = 'FXBBBEBB'; // Zorg dat dit FXBBBEBB is voor Bank 2!

let myToken = ''; // Hier slaan we ons admin-pasje in op
let myIban = '';  // Hier slaan we de rekening van deze klant in op

// ==========================================
// OPSTARTEN VAN DE APP
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('bank-bic-display').innerText = `BIC: ${MY_BIC}`;
    
    // 1. Log stiekem in op de achtergrond
    await backgroundLogin();
    
    // 2. Haal gegevens op als het inloggen is gelukt
    if (myToken) {
        await loadAccountData();
        await loadTransactions();
    }
});

// ==========================================
// FUNCTIES
// ==========================================

// Functie om de JWT token op te halen
async function backgroundLogin() {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        const data = await res.json();
        if (data.token) {
            myToken = data.token;
        } else {
            console.error("Inloggen mislukt, controleer je database.");
        }
    } catch (err) {
        console.error("Kan de server niet bereiken:", err);
    }
}

// Functie om saldo en IBAN op te halen
async function loadAccountData() {
    try {
        // We halen alle rekeningen op (publieke route)
        const res = await fetch(`${API_BASE}/accounts`);
        const data = await res.json();
        
        if (data.data && data.data.length > 0) {
            // Voor deze demo pakken we de allereerste rekening in de database
            const account = data.data[0]; 
            myIban = account.id;
            
            document.getElementById('display-iban').innerText = myIban;
            // Zorg dat het mooi als een bedrag wordt getoond met 2 decimalen
            document.getElementById('display-balance').innerText = `€ ${parseFloat(account.balance).toFixed(2)}`;
        }
    } catch (err) {
        console.error("Fout bij ophalen account:", err);
    }
}

// Functie om transactiegeschiedenis op te halen
async function loadTransactions() {
    try {
        const res = await fetch(`${API_BASE}/transactions`, {
            headers: { 'Authorization': `Bearer ${myToken}` }
        });
        const json = await res.json();
        const tbody = document.getElementById('transactions-tbody');
        tbody.innerHTML = ''; // Maak tabel eerst leeg

        if (json.data && json.data.length > 0) {
            // Filter alleen transacties van ONZE geselecteerde rekening
            const myTx = json.data.filter(tx => tx.account_id === myIban);
            
            if (myTx.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nog geen transacties.</td></tr>';
                return;
            }

            myTx.forEach(tx => {
                const tr = document.createElement('tr');
                
                // Bepaal of het erbij of eraf is (groen/rood)
                const amountClass = parseFloat(tx.amount) >= 0 ? 'amount-positive' : 'amount-negative';
                const sign = parseFloat(tx.amount) >= 0 ? '+' : '';

                tr.innerHTML = `
                    <td>${new Date(tx.datetime).toLocaleString('nl-NL')}</td>
                    <td>${tx.po_id}</td>
                    <td>${tx.isvalid ? 'Voltooid' : 'Mislukt'}</td>
                    <td class="${amountClass}">${sign}€ ${Math.abs(tx.amount).toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Geen data gevonden.</td></tr>';
        }
    } catch (err) {
        console.error("Fout bij laden transacties:", err);
    }
}

// ==========================================
// FORMULIER VERZENDEN (GELD OVERMAKEN)
// ==========================================
document.getElementById('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Voorkom dat de pagina herlaadt
    
    const btn = document.getElementById('btn-submit');
    const msgBox = document.getElementById('transfer-message');
    
    const targetIban = document.getElementById('input-iban').value.trim();
    const amount = parseFloat(document.getElementById('input-amount').value);
    const message = document.getElementById('input-message').value.trim();

    btn.innerText = "Bezig met verzenden...";
    btn.disabled = true;
    msgBox.className = "hidden";

    // Uniek ID genereren voor de betaling
    const randomId = Math.random().toString(36).substr(2, 6);
    const po_id = `${MY_BIC}_GUI_${randomId}`;
    
    // We gaan ervan uit dat het naar Bank 2 gaat (FXBBBEBB) als test.
    // In een echte app zou je de BIC afleiden uit het IBAN-nummer.
    const targetBic = 'FXBBBEBB'; 
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const payload = {
        data: [{
            po_id: po_id,
            po_amount: amount,
            po_message: message || "Overschrijving via GUI",
            po_datetime: now,
            ob_id: MY_BIC,
            oa_id: myIban,
            bb_id: targetBic,
            ba_id: targetIban
        }]
    };

    try {
        // 1. Voeg toe aan database
        await fetch(`${API_BASE}/po_new_add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${myToken}` },
            body: JSON.stringify(payload)
        });

        // 2. Valideer lokaal (Geld afschrijven)
        await fetch(`${API_BASE}/po_new_process`, { headers: { 'Authorization': `Bearer ${myToken}` } });

        // 3. Verzend naar de docent
        await fetch(`${API_BASE}/po_out_send`, { headers: { 'Authorization': `Bearer ${myToken}` } });

        // Succes! Update de schermen
        msgBox.innerText = "Transactie succesvol verzonden!";
        msgBox.className = "msg-success";
        document.getElementById('transfer-form').reset();
        
        // Herlaad de data op het scherm
        await loadAccountData();
        await loadTransactions();

    } catch (err) {
        msgBox.innerText = "Er is een fout opgetreden.";
        msgBox.className = "msg-error";
        console.error(err);
    } finally {
        btn.innerText = "Verzenden";
        btn.disabled = false;
    }
});