// public/auctioneer.js
const socket = io();

const createSection = document.getElementById('create-section');
const resultsSection = document.getElementById('results-section');
const startBtn = document.getElementById('startBtn');
const newAuctionBtn = document.getElementById('newAuctionBtn');
const timeLimitInput = document.getElementById('timeLimit');
const timeValue = document.getElementById('timeValue');
const itemNameInput = document.getElementById('itemName');
const startingPriceInput = document.getElementById('startingPrice');
const createError = document.getElementById('createError');

const resItem = document.getElementById('resItem');
const resHighest = document.getElementById('resHighest');
const resHighestBidder = document.getElementById('resHighestBidder');
const totalBids = document.getElementById('totalBids');
const biddersTableBody = document.querySelector('#biddersTable tbody');
const historyTableBody = document.querySelector('#historyTable tbody');
const timerEl = document.getElementById('timer');

let timerInterval = null;
let auctionEndTimestamp = null;

timeLimitInput.addEventListener('input', () => {
    timeValue.textContent = timeLimitInput.value;
});

startBtn.addEventListener('click', () => {
    createError.textContent = '';
    const name = itemNameInput.value.trim();
    const startingPrice = Number(startingPriceInput.value);
    const timeLimit = Number(timeLimitInput.value);
    if (!name) { createError.textContent = 'Item name required'; return; }
    if (isNaN(startingPrice) || startingPrice <= 0) { createError.textContent = 'Starting price must be > 0'; return; }
    socket.emit('auction:start', { itemName: name, startingPrice: startingPrice, timeLimitSeconds: timeLimit });
});

socket.on('auction:started', (data) => {
    createSection.style.display = 'none';
    resultsSection.style.display = 'block';
    newAuctionBtn.disabled = true;

    resItem.textContent = data.itemName;
    resHighest.textContent = data.highestBid.toFixed(2);
    resHighestBidder.textContent = data.highestBidder;
    totalBids.textContent = 0;
    biddersTableBody.innerHTML = '';
    historyTableBody.innerHTML = '';

    auctionEndTimestamp = data.endTimestamp;
    startLocalTimer();
});

socket.on('auction:update', (data) => {
    resHighest.textContent = Number(data.highestBid).toFixed(2);
    resHighestBidder.textContent = data.highestBidder;
    totalBids.textContent = data.bidHistory ? data.bidHistory.length : 0;

    const bidders = data.bidders || {};
    biddersTableBody.innerHTML = '';
    for (const name in bidders) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${name}</td><td>${Number(bidders[name].highestBid).toFixed(2)}</td><td>${bidders[name].bidCount}</td>`;
        biddersTableBody.appendChild(row);
    }

    historyTableBody.innerHTML = '';
    const history = data.bidHistory || [];
    for (const h of history) {
        const tr = document.createElement('tr');
        const t = new Date(h.timestamp || Date.now()).toLocaleTimeString();
        tr.innerHTML = `<td>${h.name}</td><td>${Number(h.price).toFixed(2)}</td><td>${t}</td>`;
        historyTableBody.appendChild(tr);
    }
});

socket.on('auction:ended', (data) => {
    timerEl.textContent = '00:00';
    newAuctionBtn.disabled = false;
    resHighest.textContent = Number(data.price).toFixed(2);
    resHighestBidder.textContent = data.winner;
    stopLocalTimer();
    
});

socket.on('auction:reset', () => {
    resultsSection.style.display = 'none';
    createSection.style.display = 'block';
    itemNameInput.value = '';
    startingPriceInput.value = '';
    timeLimitInput.value = 30;
    timeValue.textContent = 30;
    stopLocalTimer();
});

newAuctionBtn.addEventListener('click', () => {
    socket.emit('auction:new', {});
});

socket.on('error', (e) => {
    console.error('server error', e);
    if (e && e.message) createError.textContent = e.message;
});

function startLocalTimer() {
    stopLocalTimer();
    if (!auctionEndTimestamp) {
        timerEl.textContent = '--';
        return;
    }
    function tick() {
        const remaining = Math.max(0, Math.ceil((auctionEndTimestamp - Date.now()) / 1000));
        const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
        const ss = String(remaining % 60).padStart(2, '0');
        timerEl.textContent = `${mm}:${ss}`;
        if (remaining <= 0) {
            stopLocalTimer();
            newAuctionBtn.disabled = false;
        }
    }
    tick();
    timerInterval = setInterval(tick, 500);
}

function stopLocalTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}