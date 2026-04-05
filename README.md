
# ZKP-BASED-MEDICAL-TRIAL-ELIGIBILITY-VERIFICATION-BY-BLOCKCHAIN
Privacy-preserving medical verification system using Zero-Knowledge Proofs and blockchain. Verified doctors issue signed credentials, and patients prove eligibility without revealing medical data. Ensures security, confidentiality, and tamper-proof verification in healthcare.
=======
# Medical Eligibility Verification System

A secure full-stack web application for medical eligibility verification with authentication, encrypted credentials, and password-protected ZIP downloads.

## 🏗️ Project Structure

```
web-app/
├── backend/                 # Node.js/Express API server
│   ├── data/               # Data storage
│   ├── keys/               # Security keys
│   ├── middleware/         # Custom middleware
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   ├── server.js           # Main server file
│   ├── .env                # Environment variables
│   └── package.json        # Backend dependencies
├── frontend/               # React frontend application
│   ├── public/             # Static assets
│   ├── src/                # React source code
│   └── package.json        # Frontend dependencies
└── README.md              # This file
```

## 🚀 Getting Started

### Download

You can get the project in either of these ways:

1. **Clone with git**
   ```bash
   git clone <repo-url>
   cd web-app
   ```

2. **Download as ZIP**
   - Click **Code** → **Download ZIP** in your repository host
   - Extract the ZIP
   - Open the extracted `web-app/` folder

### Prerequisites

- Node.js (v18 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone 
   cd web-app
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Environment Setup

1. **Backend Environment Variables**
   
   Navigate to the `backend` directory and create a `.env` file with the following variables:
   ```env
   JWT_SECRET=your_jwt_secret_key_here
   PORT=5000
   ```
   
   *Note: A `.env` file already exists with default values. Update the `JWT_SECRET` for production use.*

2. **NMC Registry Verification (Real)**

   The backend uses Puppeteer to verify doctors against the NMC Indian Medical Register page.
   By default it targets:

   - URL: `https://www.nmc.org.in/information-desk/indian-medical-register/`
   - NMC number input: `#doctorRegdNo`
   - Doctor name input: `#doctorName`
   - Submit button: `#doctor_advance_Details`
   - Results container: `#doct_info5_wrapper`

   If the site changes, override via env vars in `backend/.env`:

   ```env
   NMC_PUPPETEER_ENABLED=true
   NMC_REGISTRY_URL=https://www.nmc.org.in/information-desk/indian-medical-register/
   NMC_SEARCH_INPUT_SELECTOR=#doctorRegdNo
   NMC_DOCTOR_NAME_SELECTOR=#doctorName
   NMC_SEARCH_SUBMIT_SELECTOR=#doctor_advance_Details
   NMC_RESULT_CONTAINER_SELECTOR=#doct_info5_wrapper

   # Optional (only if a year dropdown is required)
   NMC_YEAR_DROPDOWN_SELECTOR=
   NMC_YEAR_OPTION_SELECTOR=

   # Optional login (only if registry requires it)
   NMC_LOGIN_URL=
   NMC_USERNAME=
   NMC_PASSWORD=
   NMC_USERNAME_SELECTOR=
   NMC_PASSWORD_SELECTOR=
   NMC_LOGIN_SUBMIT_SELECTOR=
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   The backend server will start on `http://localhost:5000`

2. **Start the Frontend Application**
   ```bash
   cd frontend
   npm start
   ```
   The frontend will open in your browser at `http://localhost:3000`

## ✅ How It Works

1. **Login / Register** as a doctor.
2. **Select one or more medical tests** and enter patient details.
3. **Tick any applicable eligibility criteria** (not all are required).
4. Generate a secure credential (AES-256-GCM + RSA signature).
5. Download the credential as a **password-protected ZIP**.

**Important:** The ZIP password is the doctor's login password used during credential generation.

**NMC Verification:** Doctor registration succeeds only when the NMC registry returns a match.

## 🧠 Storage Model

This project uses **in-memory storage only** on the frontend. No `localStorage` or `sessionStorage` is used.
This avoids browser storage restrictions and keeps data ephemeral.

## 🛡️ Security & Credential Flow

- AES-256-GCM encryption with PBKDF2 key derivation
- RSA-SHA256 digital signatures for tamper-proof credentials
- 90-day expiry, replay protection (nonce), and revocation checks
- Password-protected ZIP download for secure credential delivery

## ✅ Quick Test Flow

1. Register a doctor (NMC verification required)
2. Login
3. Select tests + checklist criteria
4. Generate secure credential
5. Download encrypted ZIP
6. Verify or revoke from the dashboard

## 🌐 Useful URLs

- App: http://localhost:3000
- Backend: http://localhost:5000
- Storage test page: http://localhost:3000/storage-test.html
- System test page: http://localhost:3000/test.html

## 📋 Available Scripts

### Backend Scripts
- `npm start` - Start the production server
- `npm run dev` - Start the development server with nodemon

### Frontend Scripts
- `npm start` - Start the development server
- `npm build` - Build the production bundle
- `npm test` - Run the test suite
- `npm eject` - Eject from Create React App (one-way operation)

## 🔧 Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management
- **express-validator** - Input validation
- **Puppeteer** - Automated NMC registry verification

### Frontend
- **React** - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client for API requests
- **Create React App** - Development environment

## 🌐 API Endpoints

### Authentication Routes (`/api/auth`)
- User registration and login functionality

### Eligibility Routes (`/api/eligibility`)
- `POST /secure-credential` - Generate encrypted credential
- `POST /secure-credential/zip` - Download password-protected ZIP
- `POST /verify-and-decrypt` - Verify and decrypt credential (API only)

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- AES-256-GCM encryption with PBKDF2 key derivation
- RSA-SHA256 signatures for tamper-proof credentials
- Password-protected ZIP delivery
- Input validation and CORS protection

## 📝 Development Notes

- The frontend is configured to proxy API requests to `http://localhost:5000`
- Backend runs on port 5000 by default
- Frontend runs on port 3000 by default
- Hot reload is enabled in development mode for both frontend and backend
- Background video is served from `frontend/public/background-video.mp4`

## 🚀 Deployment

### Backend Deployment
1. Set production environment variables
2. Run `npm start` to start the production server
3. Consider using a process manager like PM2 for production

### Frontend Deployment
1. Run `npm run build` to create the production build
2. Deploy the `build` folder to your hosting service
3. Configure your hosting to handle client-side routing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the PORT in the backend `.env` file
   - Kill the process using the port: `npx kill-port 5000` or `npx kill-port 3000`

2. **CORS errors**
   - Ensure the backend is running before starting the frontend
   - Check that the frontend proxy configuration matches the backend port

3. **Environment variables not loading**
   - Ensure the `.env` file exists in the backend directory
   - Restart the server after making changes to `.env`

4. **Dependency issues**
   - Delete `node_modules` and `package-lock.json`
   - Run `npm install` again

5. **NMC verification fails**
   - The registry page or selectors may have changed
   - Update selectors in `backend/.env` under **NMC Registry Verification (Real)**

### Getting Help

If you encounter any issues not covered here, please:
1. Check the console logs for detailed error messages
2. Ensure all dependencies are properly installed
3. Verify environment variables are correctly set
4. Check that both frontend and backend are running simultaneously
>>>>>>> 876870d4 (Initial commit)
