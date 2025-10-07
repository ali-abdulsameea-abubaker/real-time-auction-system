/*
StAuth10222: I Ali Abubaker, 000857347 certify that this material is my original work. 
No other person's work has been used without due acknowledgement. 
I have not made my work available to anyone else.
*/

import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// Needed for ES modules (__dirname replacement)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Home page route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Auctioneer and bidder routes
app.get("/auctioneer", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auctioneer.html"));
});
app.get("/bidder", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "bidder.html"));
});

// ---- Auction State ---- //
let auctionActive = false;
let currentAuction = null;
let bidders = {};
let bidHistory = [];

// ---- Socket.io Events ---- //
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Start auction (Auctioneer)
  socket.on("auction:start", (data) => {
    if (auctionActive) return;

    auctionActive = true;
    const endTime = Date.now() + data.timeLimitSeconds * 1000;

    currentAuction = {
      itemName: data.itemName,
      highestBid: parseFloat(data.startingPrice),
      highestBidder: "auctioneer",
      endTimestamp: endTime,
    };

    bidders = {};
    bidHistory = [];

    io.emit("auction:started", currentAuction);

    console.log(`Auction started for item: ${data.itemName}`);

    // End auction automatically
    setTimeout(() => {
      if (auctionActive) {
        auctionActive = false;
        io.emit("auction:ended", {
          winner: currentAuction.highestBidder,
          price: currentAuction.highestBid,
        });
        console.log("Auction ended automatically.");
      }
    }, data.timeLimitSeconds * 1000);
  });

  // Bidder joins
  socket.on("bidder:join", (data) => {
    socket.data.name = data.name;
    socket.emit("bidder:joined", { name: data.name });

    if (auctionActive && currentAuction) {
      socket.emit("auction:started", currentAuction);
    }
  });

  // Bidder submits bid
  socket.on("bid:submit", (data) => {
    if (!auctionActive || !currentAuction) return;
    const name = socket.data.name;
    const price = parseFloat(data.price);

    if (!name || isNaN(price)) return;

    if (price > currentAuction.highestBid) {
      currentAuction.highestBid = price;
      currentAuction.highestBidder = name;

      bidders[name] = bidders[name] || { highestBid: price, bidCount: 0 };
      bidders[name].highestBid = price;
      bidders[name].bidCount++;

      bidHistory.unshift({ name, price, timestamp: Date.now() });

      io.emit("auction:update", {
        highestBid: price,
        highestBidder: name,
        bidders,
        bidHistory,
      });

      socket.emit("bid:response", { success: true, message: "You are the highest bidder!" });
    } else {
      socket.emit("bid:response", { success: false, message: "Bid too low!" });
    }
  });

  // Auctioneer ends auction
  socket.on("auction:end", () => {
    if (!auctionActive) return;

    auctionActive = false;
    io.emit("auction:ended", {
      winner: currentAuction.highestBidder,
      price: currentAuction.highestBid,
    });
    console.log("Auction ended by auctioneer.");
  });

  // Auctioneer starts a new auction
  socket.on("auction:new", () => {
    auctionActive = false;
    currentAuction = null;
    bidders = {};
    bidHistory = [];
    io.emit("auction:reset");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ---- Start Server ---- //
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`Auctioneer: http://localhost:${PORT}/auctioneer`);
  console.log(`Bidder: http://localhost:${PORT}/bidder`);
});
