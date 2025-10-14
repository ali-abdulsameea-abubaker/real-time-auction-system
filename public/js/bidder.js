// public/bidder.js

// Bidder Client-Side Controller 
// Oversees WebSocket communication for live auction involvement and individual win history 
// Manages bidder registration, real-time bidding, and auction participation 

// Statement of Authorship
// StAuth10222: I Ali Abubaker, 000857347 certify that this material is my original work. No other person's work has been used without due acknowledgement.I have not made my work available to anyone else. 
const socket = io();

// DOM elemnts
const nameSection = document.getElementById('nameSection');
const joinBtn = document.getElementById('joinBtn');
const bidderNameInput = document.getElementById('bidderName');
const joinError = document.getElementById('joinError');

const waiting = document.getElementById('waiting');
const auctionSection = document.getElementById('auctionSection');
const itemNameEl = document.getElementById('itemName');
const currentHighest = document.getElementById('currentHighest');
const currentHighestBidder = document.getElementById('currentHighestBidder');
const timerEl = document.getElementById('timer');
const bidForm = document.getElementById('bidForm');
const bidPriceInput = document.getElementById('bidPrice');
const bidMsg = document.getElementById('bidMsg');
const bidSubmit = document.getElementById('bidSubmit');

// the winner elments the history
const winnerHistory = document.getElementById('winnerHistory');
const historyList = document.getElementById('historyList');

let auctionEndTimestamp = null;
let timerInterval = null;
let currentBidderName = '';
let myWinningHistory = []; // onlty winners will be stored in this array

// handling bidder registration
joinBtn.addEventListener('click', () => {
    const name = bidderNameInput.value.trim();
    if (!name) {
        joinError.textContent = 'Please enter your name';
        return;
    }
    currentBidderName = name;
    joinError.textContent = '';
    socket.emit('bidder:join', { name });
});

socket.on('bidder:joined', (data) => {
    nameSection.style.display = 'none';
    waiting.style.display = 'block';
    auctionSection.style.display = 'none';
    bidMsg.textContent = '';

    // If this bidder has won any auctions, only then will the winner history be displayed.
    if (myWinningHistory.length > 0) {
        winnerHistory.style.display = 'block';
        updateWinnerHistory();
    } else {
        winnerHistory.style.display = 'none';
    }
});

// starting action
socket.on('auction:started', (data) => {
    waiting.style.display = 'none';
    auctionSection.style.display = 'block';
    itemNameEl.textContent = data.itemName;
    currentHighest.textContent = Number(data.highestBid).toFixed(2);
    currentHighestBidder.textContent = data.highestBidder;
    auctionEndTimestamp = data.endTimestamp;
    startLocalTimer();
    bidSubmit.disabled = false;
    bidMsg.textContent = ''; // Delete all prior bid messages
});

socket.on('auction:update', (data) => {
    currentHighest.textContent = Number(data.highestBid).toFixed(2);
    currentHighestBidder.textContent = data.highestBidder;
});

socket.on('bid:response', (data) => {
    if (!data) return;
    if (data.success) {
        bidMsg.textContent = 'Bid accepted! You are highest';
        bidMsg.className = 'good';
    } else {
        if (data.message && data.message.includes('higher')) {
            bidMsg.textContent = 'Bid too low. Bid higher than current price.';
        } else if (data.message && data.message.includes('started')) {
            bidMsg.textContent = 'No auction active. Wait for next auction.';
        } else {
            bidMsg.textContent = 'Bid rejected. Try again.';
        }
        bidMsg.className = 'bad';
    }
});

bidForm.addEventListener('submit', (e) => {
    e.preventDefault();
    bidMsg.textContent = '';
    const price = Number(bidPriceInput.value);
    if (isNaN(price) || price <= 0) {
        bidMsg.textContent = 'Enter valid price > 0';
        bidMsg.className = 'bad';
        return;
    }

    const currentPrice = Number(currentHighest.textContent);
    if (price <= currentPrice) {
        bidMsg.textContent = 'Bid too low. Bid higher than current price.';
        bidMsg.className = 'bad';
        return;
    }

    socket.emit('bid:submit', { price });
    bidPriceInput.value = '';
});

socket.on('auction:ended', (data) => {
    currentHighest.textContent = Number(data.price).toFixed(2);
    currentHighestBidder.textContent = data.winner;

    // Check if current bidder is the winner
    const isWinner = (data.winner === currentBidderName);

    // Show winner message
    if (isWinner) {
        bidMsg.textContent = `Well done!  This auction was won by you for $${Number(data.price).toFixed(2)}!`;
        bidMsg.className = 'good';

        // Add to this bidder's personal winning history
        const winnerInfo = {
            item: itemNameEl.textContent,
            price: Number(data.price).toFixed(2),
            timestamp: new Date().toLocaleString()
        };

        myWinningHistory.unshift(winnerInfo); // Add to beginning of array
    } else {
        bidMsg.textContent = `Auction has been ended. Winner: ${data.winner} ($${Number(data.price).toFixed(2)})`;
        bidMsg.className = 'good';
    }

    bidSubmit.disabled = true;
    stopLocalTimer();

    setTimeout(() => {
        auctionSection.style.display = 'none';
        waiting.style.display = 'block';

        // If this bidder has won any auctions, only then will the winner history be displayed.
        if (myWinningHistory.length > 0) {
            winnerHistory.style.display = 'block';
            updateWinnerHistory();
        } else {
            winnerHistory.style.display = 'none';
        }
    }, 3000);
});

// reset action
socket.on('auction:reset', () => {
    auctionSection.style.display = 'none';
    waiting.style.display = 'block';
    stopLocalTimer();
    bidMsg.textContent = '';

    // If this bidder has won any auctions, only then will the winner history be displayed.
    if (myWinningHistory.length > 0) {
        winnerHistory.style.display = 'block';
        updateWinnerHistory();
    } else {
        winnerHistory.style.display = 'none';
    }
});

// updating winner history
function updateWinnerHistory() {
    historyList.innerHTML = '';

    myWinningHistory.forEach((history, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <strong>${history.item}</strong><br>
            Winning Price: $${history.price}<br>
            <small>${history.timestamp}</small>
        `;
        historyList.appendChild(historyItem);
    });
}

// start local timer
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
            bidSubmit.disabled = true;
        }
    }
    tick();
    timerInterval = setInterval(tick, 500);
}

// end and stop and clear timer
function stopLocalTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerEl.textContent = '--';
}