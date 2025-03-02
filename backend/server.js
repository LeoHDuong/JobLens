require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const userRoutes = require("./routes/userRoute");

const app = express();

// Enable CORS
app.use(cors());

// Middleware
app.use(express.json());

// Define a GET route for "/"
app.get("/", (req, res) => {
  res.send("Welcome to API!");
});

// Mount user routes
app.use("/api/users", userRoutes);

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/mydatabase";

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));