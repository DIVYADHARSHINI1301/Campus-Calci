# CGPA Calculator Setup Guide

## 🔥 Firebase Setup Required

This project uses Firebase for authentication and database. You need to set up your own Firebase project.

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name and follow the setup wizard
4. Enable Google Analytics (optional)

### Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication
3. Enable **Google** authentication (optional)

### Step 3: Create Firestore Database

1. Go to **Firestore Database** → **Create database**
2. Start in **production mode** or **test mode**
3. Choose your region

### Step 4: Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click **Web** icon (</>) to add a web app
4. Register your app
5. Copy the `firebaseConfig` object

### Step 5: Update Configuration

Replace the Firebase config in `src/firebase/config.js` with your own:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Step 6: Install Dependencies

```bash
npm install
```

### Step 7: Run Development Server

```bash
npm run dev
```

### Step 8: Build for Production

```bash
npm run build
```

## 📝 Optional: OpenAI Integration

If you want to use AI features (if any), create a `.env` file:

```bash
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

## 🚀 Deployment

Deploy to Firebase Hosting:

```bash
npm run build
firebase login
firebase init hosting
firebase deploy
```

## ⚠️ Important Notes

- Never commit your actual Firebase credentials to public repos
- Keep your `.env` file private
- Use Firebase Security Rules to protect your database
- Enable Firebase Authentication for user management

## 📧 Support

For issues or questions, please open an issue on GitHub.
