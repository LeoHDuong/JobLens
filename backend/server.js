require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const { BearerStrategy } = require("passport-azure-ad");
const msal = require("@azure/msal-node");
const userRoutes = require("./routes/userRoute");
const authRoutes = require("./routes/authRoute"); // Add your OAuth routes

const app = express();

// Enable CORS for frontend on port 5173
app.use(cors({
    origin: 'http://localhost:5173', // Match frontend port
    credentials: true // Allow cookies/session to be sent
}));

// Middleware
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret', // Use env var or fallback
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// MSAL config (moved here to ensure it's only defined once)
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET
    }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// Passport strategy for Microsoft OAuth
passport.use(new BearerStrategy({
    identityMetadata: `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.CLIENT_ID,
    audience: process.env.CLIENT_ID,
    issuer: `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`,
    validateIssuer: true,
    passReqToCallback: false,
}, (token, done) => {
    return done(null, { id: token.oid, name: token.name, email: token.email });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Define a GET route for "/"
app.get("/", (req, res) => {
    res.send("Welcome to API!");
});

// Mount user routes
app.use("/api/users", userRoutes);

// Mount OAuth routes
app.use("/auth", authRoutes);

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI;

mongoose
    .connect(mongoURI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Error handling (optional but recommended)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));