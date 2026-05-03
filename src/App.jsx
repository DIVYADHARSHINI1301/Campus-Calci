import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase/config";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import LoadingScreen from "./components/LoadingScreen";
import UpdateNotification from "./components/UpdateNotification";
import { useVersionCheck } from "./hooks/useVersionCheck";

function ProtectedRoute({ user, role, requiredRole, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole)
    return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking auth
  const [role, setRole] = useState(undefined); // undefined = still checking role
  const [hasFirestoreDoc, setHasFirestoreDoc] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const { newVersionAvailable, updateVersion } = useVersionCheck();

  useEffect(() => {
    if (newVersionAvailable) {
      setShowUpdateNotification(true);
    }
  }, [newVersionAvailable]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));

          if (snap.exists()) {
            setRole(snap.data().role);
            setHasFirestoreDoc(true);
          } else {
            setRole(null);
            setHasFirestoreDoc(false);
          }
        } catch (err) {
          console.error(err);
          setRole(null);
        }

        setUser(u);
      } else {
        setUser(null);
        setRole(null);
        setHasFirestoreDoc(true);
      }
    });

    return unsub;
  }, []);

  // ✅ BLOCK everything until BOTH user + role resolved
  if (user === undefined || role === undefined) {
    return <LoadingScreen />;
  }

  return (
    <>
      {showUpdateNotification && (
        <UpdateNotification
          onUpdate={updateVersion}
          onDismiss={() => setShowUpdateNotification(false)}
        />
      )}
      <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            user && hasFirestoreDoc ? (
              <Navigate
                to={role === "admin" ? "/admin" : "/dashboard"}
                replace
              />
            ) : (
              <Login />
            )
          }
        />

        <Route
          path="/register"
          element={
            user && hasFirestoreDoc ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Register />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user} role={role}>
              <Dashboard darkMode={darkMode} setDarkMode={setDarkMode} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute user={user} role={role}>
              <Settings darkMode={darkMode} setDarkMode={setDarkMode} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute
              user={user}
              role={role}
              requiredRole="admin"
            >
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to={
                user
                  ? role === "admin"
                    ? "/admin"
                    : "/dashboard"
                  : "/login"
              }
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
    </>
  );
}