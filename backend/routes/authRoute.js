require('dotenv').config();
const express = require('express');
const passport = require('passport');
const { BearerStrategy } = require('passport-azure-ad');
const msal = require('@azure/msal-node');
const router = express.Router();

// MSAL config
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET
    }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// Passport strategy
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

// Microsoft login route
router.get('/login/microsoft', (req, res) => {
    const authCodeUrlParameters = {
        scopes: ['openid', 'profile', 'email'],
        redirectUri: 'http://localhost:5000/auth/microsoft/callback',
    };

    cca.getAuthCodeUrl(authCodeUrlParameters)
        .then((response) => {
            res.redirect(response);
        })
        .catch((error) => {
            console.log(error);
            res.status(500).send('Error generating auth URL');
        });
});

// Microsoft callback route (redirect to frontend)
router.get('/microsoft/callback', async (req, res) => {
    const tokenRequest = {
        code: req.query.code,
        scopes: ['openid', 'profile', 'email'],
        redirectUri: 'http://localhost:5000/auth/microsoft/callback',
    };

    try {
        const response = await cca.acquireTokenByCode(tokenRequest);
        req.session.token = response.accessToken;
        req.session.user = {
            id: response.account.homeAccountId,
            name: response.account.name,
            email: response.account.username
        };
        // Redirect to frontend with a success indicator
        res.redirect('http://localhost:5173/?auth=success');
    } catch (error) {
        console.log(error);
        res.redirect('http://localhost:5173/?auth=error');
    }
});

// API endpoint to get user data
router.get('/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

module.exports = router;