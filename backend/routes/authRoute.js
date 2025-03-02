require('dotenv').config();
const express = require('express');
const passport = require('passport');
const { BearerStrategy } = require('passport-azure-ad');
const msal = require('@azure/msal-node');
const router = express.Router();
const nodemailer = require('nodemailer');
const axios = require('axios');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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

// Logout API endpoint
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log('Error destroying session:', err);
            res.status(500).json({ error: 'Failed to logout' });
        } else {
            // Redirect to login page on frontend
            res.json({ redirect: 'http://localhost:5173/login.html' });
        }
    });
});

// New endpoint to process link and send email with Gemini API
router.post('/api/process-link', async (req, res) => {
    const { link } = req.body;

    if (!link || !isValidUrl(link)) {
        return res.status(400).json({ error: 'Invalid URL provided' });
    }

    let jobTitle = 'Unknown Job'; // Default title if extraction fails
    let companyName = 'Unknown Company'; // Default company name if extraction fails
    let companyLocation = 'Unknown Location'; // Default location if extraction fails

    try {
        // Fetch the webpage content
        console.log(`Attempting to fetch content from: ${link}`);
        const webResponse = await axios.get(link, {
            headers: {
                'User-Agent': 'JobLens/1.0 (https://yourdomain.com)'
            },
            timeout: 10000 // 10-second timeout
        });
        console.log('Webpage fetched successfully, content length:', webResponse.data.length);

        // Limit HTML content to avoid exceeding API payload
        let truncatedHtml = webResponse.data;
        if (typeof truncatedHtml !== 'string') {
            console.error('Unexpected response type:', typeof truncatedHtml, 'Content:', webResponse.data);
            throw new Error('Invalid response type from webpage fetch');
        }
        truncatedHtml = truncatedHtml.substring(0, 10000);
        console.log('Truncated HTML length:', truncatedHtml.length);

        // Validate Gemini API key
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new Error('Gemini API key is missing in environment variables');
        }
        console.log('Gemini API key validated');

        // Call Gemini API to extract job title
        console.log('Sending request to Gemini API for job title...');
        const jobTitleResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
                contents: [{
                    parts: [{
                        text: `Extract the job title from this HTML content. If no clear job title is found, return 'Unknown Job'. HTML: ${truncatedHtml}`
                    }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000 // 10-second timeout
            }
        );
        console.log('Job title Gemini API response received:', JSON.stringify(jobTitleResponse.data, null, 2));

        // Parse job title response
        const jobTitleData = jobTitleResponse.data;
        if (jobTitleData.candidates && jobTitleData.candidates.length > 0 && jobTitleData.candidates[0].content?.parts) {
            jobTitle = jobTitleData.candidates[0].content.parts[0].text.trim() || 'Unknown Job';
            console.log('Extracted job title:', jobTitle);
        } else {
            console.log('No valid candidates for job title:', JSON.stringify(jobTitleData, null, 2));
        }

        // Call Gemini API to extract company name
        console.log('Sending request to Gemini API for company name...');
        const companyResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
                contents: [{
                    parts: [{
                        text: `Extract the company name from this HTML content, looking for the employer's name or organization. If no clear company name is found, return 'Unknown Company'. HTML: ${truncatedHtml}`
                    }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000 // 10-second timeout
            }
        );
        console.log('Company name Gemini API response received:', JSON.stringify(companyResponse.data, null, 2));

        // Parse company name response
        const companyData = companyResponse.data;
        if (companyData.candidates && companyData.candidates.length > 0 && companyData.candidates[0].content?.parts) {
            companyName = companyData.candidates[0].content.parts[0].text.trim() || 'Unknown Company';
            console.log('Extracted company name:', companyName);
        } else {
            console.log('No valid candidates for company name:', JSON.stringify(companyData, null, 2));
        }

        // Call Gemini API to extract company location
        console.log('Sending request to Gemini API for company location...');
        const locationResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
                contents: [{
                    parts: [{
                        text: `Extract the company location from this HTML content, looking for the city, state, or country associated with the employer. If no clear location is found, return 'Unknown Location'. HTML: ${truncatedHtml}`
                    }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000 // 10-second timeout
            }
        );
        console.log('Company location Gemini API response received:', JSON.stringify(locationResponse.data, null, 2));

        // Parse company location response
        const locationData = locationResponse.data;
        if (locationData.candidates && locationData.candidates.length > 0 && locationData.candidates[0].content?.parts) {
            companyLocation = locationData.candidates[0].content.parts[0].text.trim() || 'Unknown Location';
            console.log('Extracted company location:', companyLocation);
        } else {
            console.log('No valid candidates for company location:', JSON.stringify(locationData, null, 2));
        }

        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: req.session.user.email,
            subject: `Application submitted to ${companyName}`,
            text: `Job Application Details:\n\nJob Title: ${jobTitle}\nCompany: ${companyName}\nLocation: ${companyLocation}\nLink: ${link}\n\nThis is an automated message from JobLens.`
        };
        console.log('Attempting to send email to:', req.session.user.email);
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
        res.json({ message: 'Email sent successfully with job title, company name, and location' });
    } catch (error) {
        console.error('Error processing link or sending email:', error.stack || error.message);
        if (error.response) {
            console.error('Detailed Gemini API Error:', {
                status: error.response.status,
                data: error.response.data
            });
            if (error.response.status === 400) {
                return res.status(400).json({ error: 'Bad request to Gemini API', details: error.response.data });
            } else if (error.response.status === 403) {
                return res.status(403).json({ error: 'Invalid or unauthorized Gemini API key', details: error.response.data });
            } else if (error.response.status === 429) {
                return res.status(429).json({ error: 'Rate limit exceeded for Gemini API', details: error.response.data });
            } else {
                return res.status(error.response.status).json({ error: `Gemini API error: ${error.message}`, details: error.response.data });
            }
        } else if (error.code === 'EAUTH') {
            console.error('Email authentication failed:', error.response || error.message);
            return res.status(500).json({ error: 'Email authentication failed. Check credentials.', details: error.message });
        } else if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Backend or external service unreachable', details: error.message });
        } else if (error.message.includes('timeout')) {
            return res.status(504).json({ error: 'Request timed out', details: error.message });
        } else if (error.message.includes('ENOTFOUND')) {
            return res.status(404).json({ error: 'URL not found', details: error.message });
        } else if (error.message.includes('request entity too large')) {
            return res.status(413).json({ error: 'Request payload too large', details: error.message });
        }
        return res.status(500).json({ error: 'Failed to process link or send email', details: error.stack || error.message });
    }
});

// Basic URL validation function
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = router;