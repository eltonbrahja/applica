import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import Finances from './pages/Finances';
import Materials from './pages/Materials';
import Settings from './pages/Settings';
import LoadingSpinner from './components/LoadingSpinner';

function RequireAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
    return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={<Dashboard />} />
                            <Route path="patients" element={<Patients />} />
                            <Route path="appointments" element={<Appointments />} />
                            <Route path="finances" element={<Finances />} />
                            <Route path="materials" element={<Materials />} />
                            <Route path="settings" element={<Settings />} />
                        </Route>
                    </Routes>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}
