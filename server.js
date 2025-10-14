/*
Statement of Authorship
StAuth10222: I Ali Abubaker, 000857347 certify that this material is my original work. 
No other person's work has been used without due acknowledgement. 
I have not made my work available to anyone else.
*/

// action sysytem server.js
// main server action real timer for both actioner and bidder
// handle webStocket connection
// coomunication between actioner and bidder for price and letting both actioner and bdder to bid their price

import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// Required for ES modules (replacement of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the public directory to provide static files.
app.use(express.static(path.join(__dirname, "public")));

// Route for the home page: serve from the HTML folder
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "html", "index.html"));
});

// The html folder is used to serve the bidder and auctioneer routes.
app.get("/auctioneer", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "html", "auctioneer.html"));
});

app.get("/bidder", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "html", "bidder.html"));
});

// ----State of the Auction ---- //
let auctionActive = false;
let currentAuction = null;
let bidders = {};
let bidHistory = [];

// ---- Socket.io ---- //
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Auctioneer, start the auction
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

    // Automatically end the auction
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

  // The bidder enters
  socket.on("bidder:join", (data) => {
    socket.data.name = data.name;
    socket.emit("bidder:joined", { name: data.name });

    if (auctionActive && currentAuction) {
      socket.emit("auction:started", currentAuction);
    }
  });

  // The bidder makes a bid.
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

  // The auctioneer concludes the sale.
  socket.on("auction:end", () => {
    if (!auctionActive) return;

    auctionActive = false;
    io.emit("auction:ended", {
      winner: currentAuction.highestBidder,
      price: currentAuction.highestBid,
    });
    console.log("Auction ended by auctioneer.");
  });

  // A fresh auction is started by the auctioneer.
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


// ---- server starting---- //
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);  // CORRECT
  console.log(`Auctioneer: http://localhost:${PORT}/auctioneer`);  // CORRECT
  console.log(`Bidder: http://localhost:${PORT}/bidder`);  // CORRECT
});
