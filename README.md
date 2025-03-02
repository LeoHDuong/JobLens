# JobLens
 
**JobLens** is a web application designed to help users track job applications efficiently. It features user authentication (via username/password and Microsoft OAuth), a backend to process job posting links, and integration with the Gemini API to extract key job details (job title, company name, and location). Once processed, the application sends an email to the user's Microsoft email with these details.
 
## Features
- **User Authentication**:
  - Traditional login/register with username and password (JWT-based).
  - Microsoft OAuth login using Azure AD.
- **Job Link Processing**:
  - Submit a job posting URL to extract job title, company name, and location using the Gemini API.
  - Sends an email with job details to the authenticated user's Microsoft email.
- **Tech Stack**:
  - Backend: Node.js, Express.js, MongoDB, Mongoose, Passport.js, MSAL, Nodemailer, Axios.
  - Frontend: HTML, Tailwind CSS, JavaScript (Fetch API).
  - External APIs: Gemini API (Google Generative AI), Microsoft Azure AD.
 
## Prerequisites
Before running JobLens, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (local or cloud instance like MongoDB Atlas)
- A Gmail account for sending emails (or configure another email service with Nodemailer)
- A Microsoft Azure account with an Azure AD application registered
- A Gemini API key from Google
 
## Installation
 
### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/joblens.git
cd joblens
```
 
### 2. Install Backend Dependencies
Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```
 
### 3. Configure Environment Variables
Create a .env file in the root directory and add the following:
```bash
# Server Configuration
PORT=5000
EXPRESS_SESSION_SECRET=your_session_secret_here
MONGO_URI=mongodb://localhost:27017/joblens_db
 
# Email Configuration (Gmail example)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password # Use an App Password if 2FA is enabled
 
# Graph API
GRAPH_API_ENDPOINT="https://graph.microsoft.com/"
 
# Microsoft Azure AD Configuration
CLOUD_INSTANCE="https://login.microsoftonline.com/"
CLIENT_ID=your_azure_client_id
TENANT_ID=your_azure_tenant_id
CLIENT_SECRET=your_azure_client_secret
REDIRECT_URI="http://localhost:5000/auth/redirect"
POST_LOGOUT_REDIRECT_URI="http://localhost:5000"
 
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key
 
# JWT Secret (for username/password auth)
JWT_SECRET=secret
```
 
- MongoDB URI: Replace with your MongoDB connection string.
- Email: Set up a Gmail account and generate an App Password if using 2FA.
- Microsoft Azure AD: Register an app in Azure Portal to get CLIENT_ID, TENANT_ID, and CLIENT_SECRET. Set the redirect URI to http://localhost:5000/auth/microsoft/callback.
- Gemini API: Obtain an API key from the Gemini API provider.
 
### 4. Start MongoDB
Ensure MongoDB is running locally or accessible via your Atlas URI:
```bash
mongod
```
 
### 5. Run the Backend Server
Start the Node.js server:
```bash
npm start
```
 
The server will run on http://localhost:5000.
 
### 6. Serve the Frontend
The frontend consists of static HTML files (```index.html```, ```register.html```, ```login.html```). Serve them using a simple static server or open them directly in a browser:
 
Using ```live-server``` (install globally with ```npm install -g live-server```):
```bash
live-server --port=5173
```
Or, use any static file server pointing to the frontend directory.
The frontend will run on http://localhost:5173.
 
## Usage
### 1. Register or Login:
- Visit ```http://localhost:5173/register.html``` to create a username/password account.
- Visit ```http://localhost:5173/login.html``` to log in with username/password or Microsoft OAuth.
### 2. Microsoft Login:
Click "Login with Microsoft" to authenticate via Azure AD. After successful login, you'll be redirected back with a success message.
### 3. Submit a Job Link:
- After logging in, use the ```/api/process-link``` endpoint to submit a job URL.
- The backend will extract details and send an email to your Microsoft email (if authenticated via Microsoft).
### 4. Logout:
- Access ```http://localhost:5000/auth/logout``` to destroy the session and log out.
 
## API Endpoints
### User Routes (/api/users)
- POST /register: Register a new user.
- POST /login: Login and receive a JWT token.
### Auth Routes (/auth)
- GET /login/microsoft: Initiate Microsoft OAuth login.
- GET /microsoft/callback: Handle Microsoft OAuth callback.
- GET /user: Retrieve authenticated user data.
- GET /logout: Log out and destroy session.
- POST /api/process-link: Process a job link and send an email.
 
## License
This project is licensed under the MIT License - see the LICENSE file for details.