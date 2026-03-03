import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Settings() {
    const { user, isDemoMode, signOut } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [activeTab, setActiveTab] = useState('profile');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });

    async function handlePasswordUpdate(e) {
        e.preventDefault();
        setError(''); setSuccess('');

        if (isDemoMode) {
            setError("L'aggiornamento della password è disabilitato in modalità Demo.");
            return;
        }

        if (passwordData.new !== passwordData.confirm) {
            setError("Le password non coincidono.");
            return;
        }

        if (passwordData.new.length < 6) {
            setError("La password deve contenere almeno 6 caratteri.");
            return;
        }

        setSubmitting(true);
        try {
            const { error: updErr } = await supabase.auth.updateUser({ password: passwordData.new });
            if (updErr) throw updErr;

            setSuccess("Password aggiornata con successo.");
            setPasswordData({ new: '', confirm: '' });
        } catch (err) {
            setError(err.message || "Errore durante l'aggiornamento della password.");
        } finally { setSubmitting(false); }
    }

    async function handleGoogleCalendarConnect() {
        if (isDemoMode) {
            alert("Integrazione disabilitata in Demo.");
            return;
        }
        // Redirects to Google OAuth with specific scopes requested during sign-in
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/calendar',
                // redirectTo: 'https://your-vercel-domain.com/settings'
            },
        });
        if (error) setError(error.message);
    }

    async function handleDeleteAccount() {
        if (isDemoMode) {
            alert("Eliminazione account disabilitata in Demo.");
            return;
        }
        if (!confirm('ATTENZIONE: Stai per eliminare definitivamente il tuo account e tutti i dati associati (Art. 17 GDPR). L\'operazione è irreversibile. Procedere?')) return;

        try {
            // 1. You would ideally call an Edge Function to clean up Storage buckets
            // 2. Delete auth user (usually requires service role key in Edge Function, but if allowed by policies, can be done manually or cascades)
            // For this rebuild, we alert the user of the process for security reasons
            alert("Per motivi di sicurezza, l'eliminazione completa in Supabase richiede la chiamata ad una Edge Function con diritti di Service Role. Verrà simulato l'out dell'utente.");
            await signOut();
        } catch (err) { setError("Errore durante l'eliminazione."); }
    }


    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="page-title">Impostazioni</h1>
                <p className={`mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Gestisci il tuo profilo, le integrazioni e la conformità sui dati strutturata da Applica.</p>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm animate-fade-in">{error}</div>}
            {success && <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm animate-fade-in">{success}</div>}

            {/* Tabs */}
            <div className={`flex gap-2 p-1.5 rounded-2xl ${isDark ? 'bg-dark-800' : 'bg-surface-100'} overflow-x-auto hide-scrollbar`}>
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 lg:flex-none text-center ${activeTab === 'profile' ? (isDark ? 'bg-dark-700 text-white shadow-sm' : 'bg-white text-surface-900 shadow-sm') : (isDark ? 'text-dark-300 hover:text-white hover:bg-dark-700/50' : 'text-surface-500 hover:text-surface-900 hover:bg-white/50')}`}
                >
                    Profilo e Sicurezza
                </button>
                <button
                    onClick={() => setActiveTab('integrations')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 lg:flex-none text-center ${activeTab === 'integrations' ? (isDark ? 'bg-dark-700 text-white shadow-sm' : 'bg-white text-surface-900 shadow-sm') : (isDark ? 'text-dark-300 hover:text-white hover:bg-dark-700/50' : 'text-surface-500 hover:text-surface-900 hover:bg-white/50')}`}
                >
                    Integrazioni
                </button>
                <button
                    onClick={() => setActiveTab('gdpr')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 lg:flex-none text-center ${activeTab === 'gdpr' ? (isDark ? 'bg-dark-700 text-white shadow-sm' : 'bg-white text-surface-900 shadow-sm') : (isDark ? 'text-dark-300 hover:text-white hover:bg-dark-700/50' : 'text-surface-500 hover:text-surface-900 hover:bg-white/50')}`}
                >
                    Conformità GDPR
                </button>
            </div>

            <div className="glass-card p-6 md:p-8 animate-slide-up">
                {/* ── PROFILE TAB ── */}
                {activeTab === 'profile' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Informazioni Account</h2>
                            <div className="grid gap-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Email</label>
                                    <input type="email" value={user?.email || ''} readOnly className={`input-field bg-opacity-50 opacity-70 cursor-not-allowed`} />
                                    <p className={`mt-1 text-xs ${isDark ? 'text-dark-400' : 'text-surface-500'}`}>L'email è gestita tramite Supabase Auth. Per modificarla contatta il supporto.</p>
                                </div>
                            </div>
                        </div>

                        <hr className={isDark ? 'border-dark-600' : 'border-surface-200'} />

                        <div>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Cambia Password</h2>
                            <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-sm">
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Nuova Password</label>
                                    <input type="password" required minLength={6} value={passwordData.new} onChange={e => setPasswordData({ ...passwordData, new: e.target.value })} className="input-field" placeholder="••••••••" />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Conferma Password</label>
                                    <input type="password" required minLength={6} value={passwordData.confirm} onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })} className="input-field" placeholder="••••••••" />
                                </div>
                                <button type="submit" disabled={submitting || isDemoMode} className="btn-primary w-full shadow-md">
                                    {submitting ? <LoadingSpinner size="sm" text="" /> : 'Aggiorna Password'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── INTEGRATIONS TAB ── */}
                {activeTab === 'integrations' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-surface-200 dark:border-dark-600 bg-surface-50 dark:bg-dark-800">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-surface-900'}`}>Google Calendar</h3>
                                    <p className={`text-sm mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>
                                        Sincronizza automaticamente gli appuntamenti con il tuo calendario Google. (Richiede configurazione OAuth Provider in Supabase).
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleGoogleCalendarConnect} className="btn-secondary whitespace-nowrap">
                                Connetti Account
                            </button>
                        </div>
                    </div>
                )}

                {/* ── GDPR TAB ── */}
                {activeTab === 'gdpr' && (
                    <div className="space-y-6">
                        <div className={`p-4 rounded-xl border-l-4 border-primary-500 ${isDark ? 'bg-primary-900/20' : 'bg-primary-50'}`}>
                            <h3 className={`font-bold mb-1 ${isDark ? 'text-primary-400' : 'text-primary-700'}`}>Isolamento Dati (Tenant Isolation)</h3>
                            <p className={`text-sm ${isDark ? 'text-dark-200' : 'text-primary-600'}`}>
                                I tuoi dati sono isolati a livello di database utilizzando le Row Level Security (RLS) policies di PostgreSQL. Solo tu puoi accedere ai record associati al tuo ID Supabase.
                            </p>
                        </div>
                        <div className={`p-5 rounded-2xl border ${isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <svg className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                <h3 className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>Zona Pericolosa</h3>
                            </div>
                            <p className={`text-sm mb-4 ${isDark ? 'text-dark-200' : 'text-red-700/80'}`}>Questa azione cancellerà tutti i tuoi dati da Applica. Sarà necessario autorizzare da Supabase Edge Functions in prod.</p>
                            <button onClick={handleDeleteAccount} className="btn-danger w-full sm:w-auto">Elimina Account e Dati</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
