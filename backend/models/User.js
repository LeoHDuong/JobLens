const mongoose = require("mongoose");

// Define the User schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true }); // Adds createdAt and updatedAt timestamps automatically

// Export the User model
module.exports = mongoose.model("User", UserSchema);