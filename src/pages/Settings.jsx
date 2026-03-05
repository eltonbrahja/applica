import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

const DAY_LABELS = {
    monday: 'Lunedì', tuesday: 'Martedì', wednesday: 'Mercoledì',
    thursday: 'Giovedì', friday: 'Venerdì', saturday: 'Sabato', sunday: 'Domenica'
};

const DEFAULT_HOURS = {
    monday: { enabled: true, start: '09:00', end: '18:00' },
    tuesday: { enabled: true, start: '09:00', end: '18:00' },
    wednesday: { enabled: true, start: '09:00', end: '18:00' },
    thursday: { enabled: true, start: '09:00', end: '18:00' },
    friday: { enabled: true, start: '09:00', end: '18:00' },
    saturday: { enabled: false, start: '09:00', end: '13:00' },
    sunday: { enabled: false, start: '09:00', end: '13:00' },
};

export default function Settings() {
    const { user, isDemoMode, signOut } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [activeTab, setActiveTab] = useState('profile');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);

    // Profile data
    const [profile, setProfile] = useState({
        first_name: '', last_name: '', phone: '', gender: '', specialization: '',
        license_number: '', studio_name: '', studio_address: ''
    });

    // Working hours
    const [workingHours, setWorkingHours] = useState({ ...DEFAULT_HOURS });

    // Vacation dates
    const [vacationDates, setVacationDates] = useState([]);
    const [newVacationDate, setNewVacationDate] = useState('');
    const [newVacationReason, setNewVacationReason] = useState('');

    const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });

    // Load profile data on mount
    useEffect(() => {
        if (user) loadProfile();
    }, [user]);

    async function loadProfile() {
        setLoading(true);
        try {
            const { data: psych, error: pErr } = await supabase
                .from('psychologists')
                .select('*')
                .eq('supabase_tenant_id', user.id)
                .single();
            if (pErr) throw pErr;
            if (psych) {
                setProfile({
                    first_name: psych.first_name || '',
                    last_name: psych.last_name || '',
                    phone: psych.phone || '',
                    gender: psych.gender || '',
                    specialization: psych.specialization || '',
                    license_number: psych.license_number || '',
                    studio_name: psych.studio_name || '',
                    studio_address: psych.studio_address || '',
                });
                if (psych.working_hours) {
                    setWorkingHours({ ...DEFAULT_HOURS, ...psych.working_hours });
                }

                // Load vacation dates
                const { data: vDates } = await supabase
                    .from('psychologist_vacation_dates')
                    .select('*')
                    .eq('psychologist_id', psych.id)
                    .order('date', { ascending: true });
                setVacationDates(vDates || []);
            }
        } catch (err) {
        } finally { setLoading(false); }
    }

    async function handleProfileSave(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setSubmitting(true);
        try {
            const { error: updErr } = await supabase
                .from('psychologists')
                .update({
                    first_name: profile.first_name || null,
                    last_name: profile.last_name || null,
                    phone: profile.phone || null,
                    gender: profile.gender || null,
                    specialization: profile.specialization || null,
                    license_number: profile.license_number || null,
                    studio_name: profile.studio_name || null,
                    studio_address: profile.studio_address || null,
                })
                .eq('supabase_tenant_id', user.id);
            if (updErr) throw updErr;
            setSuccess('Profilo aggiornato con successo.');
        } catch (err) {
            setError(err.message || "Errore durante il salvataggio.");
        } finally { setSubmitting(false); }
    }

    async function handleWorkingHoursSave() {
        setError(''); setSuccess(''); setSubmitting(true);
        try {
            const { error: updErr } = await supabase
                .from('psychologists')
                .update({ working_hours: workingHours })
                .eq('supabase_tenant_id', user.id);
            if (updErr) throw updErr;
            setSuccess('Orari lavorativi salvati.');
        } catch (err) {
            setError(err.message || "Errore durante il salvataggio orari.");
        } finally { setSubmitting(false); }
    }

    async function handleAddVacation() {
        if (!newVacationDate) return;
        setError(''); setSubmitting(true);
        try {
            const { data: psych } = await supabase
                .from('psychologists').select('id')
                .eq('supabase_tenant_id', user.id).single();
            if (!psych) throw new Error("Profilo non trovato.");

            const { error: insErr } = await supabase
                .from('psychologist_vacation_dates')
                .insert([{ psychologist_id: psych.id, date: newVacationDate, reason: newVacationReason || null }]);
            if (insErr) throw insErr;

            setNewVacationDate('');
            setNewVacationReason('');
            loadProfile();
        } catch (err) {
            setError(err.message || "Errore aggiunta ferie.");
        } finally { setSubmitting(false); }
    }

    async function handleRemoveVacation(id) {
        try {
            const { error } = await supabase.from('psychologist_vacation_dates').delete().eq('id', id);
            if (error) throw error;
            setVacationDates(prev => prev.filter(v => v.id !== id));
        } catch (err) { setError("Errore rimozione data."); }
    }

    function updateDay(day, field, value) {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    }

    async function handlePasswordUpdate(e) {
        e.preventDefault();
        setError(''); setSuccess('');
        if (isDemoMode) { setError("Disabilitato in Demo."); return; }
        if (passwordData.new !== passwordData.confirm) { setError("Le password non coincidono."); return; }
        if (passwordData.new.length < 6) { setError("Minimo 6 caratteri."); return; }
        setSubmitting(true);
        try {
            const { error: updErr } = await supabase.auth.updateUser({ password: passwordData.new });
            if (updErr) throw updErr;
            setSuccess("Password aggiornata con successo.");
            setPasswordData({ new: '', confirm: '' });
        } catch (err) {
            setError(err.message || "Errore aggiornamento password.");
        } finally { setSubmitting(false); }
    }

    async function handleGoogleCalendarConnect() {
        if (isDemoMode) { alert("Disabilitata in Demo."); return; }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { scopes: 'https://www.googleapis.com/auth/calendar' },
        });
        if (error) setError(error.message);
    }

    async function handleDeleteAccount() {
        if (isDemoMode) { alert("Disabilitata in Demo."); return; }
        if (!confirm('ATTENZIONE: Stai per eliminare il tuo account e tutti i dati. Operazione irreversibile. Procedere?')) return;
        try {
            alert("L'eliminazione completa richiede una Edge Function con Service Role. Verrà effettuato il logout.");
            await signOut();
        } catch (err) { setError("Errore."); }
    }

    const labelClass = `block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`;

    const tabs = [
        { id: 'profile', label: 'Profilo Professionale' },
        { id: 'schedule', label: 'Orari e Ferie' },
        { id: 'security', label: 'Sicurezza' },
        { id: 'integrations', label: 'Integrazioni' },
        { id: 'gdpr', label: 'GDPR' },
    ];

    if (loading) {
        return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Caricamento impostazioni..." /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div>
                <h1 className="page-title">Impostazioni</h1>
                <p className={`mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Gestisci il tuo profilo, orari, integrazioni e conformità.</p>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm animate-fade-in">{error}</div>}
            {success && <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm animate-fade-in">{success}</div>}

            {/* Tabs */}
            <div className={`flex gap-2 p-1.5 rounded-2xl ${isDark ? 'bg-dark-800' : 'bg-surface-100'} overflow-x-auto hide-scrollbar`}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => { setActiveTab(t.id); setError(''); setSuccess(''); }}
                        className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap text-center ${activeTab === t.id
                            ? (isDark ? 'bg-dark-700 text-white shadow-sm' : 'bg-white text-surface-900 shadow-sm')
                            : (isDark ? 'text-dark-300 hover:text-white hover:bg-dark-700/50' : 'text-surface-500 hover:text-surface-900 hover:bg-white/50')}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="glass-card p-4 sm:p-6 md:p-8 animate-slide-up">

                {/* ── PROFILE TAB ── */}
                {activeTab === 'profile' && (
                    <form onSubmit={handleProfileSave} className="space-y-8">
                        <div>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Informazioni Personali</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Nome</label>
                                    <input type="text" className="input-field" value={profile.first_name} onChange={e => setProfile({ ...profile, first_name: e.target.value })} placeholder="Mario" />
                                </div>
                                <div>
                                    <label className={labelClass}>Cognome</label>
                                    <input type="text" className="input-field" value={profile.last_name} onChange={e => setProfile({ ...profile, last_name: e.target.value })} placeholder="Rossi" />
                                </div>
                                <div>
                                    <label className={labelClass}>Telefono</label>
                                    <input type="tel" className="input-field" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+39 333 1234567" />
                                </div>
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <input type="email" value={user?.email || ''} readOnly className="input-field bg-opacity-50 opacity-70 cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className={labelClass}>Genere</label>
                                    <select className="input-field" value={profile.gender} onChange={e => setProfile({ ...profile, gender: e.target.value })}>
                                        <option value="">Seleziona...</option>
                                        <option value="Maschio">Maschio</option>
                                        <option value="Femmina">Femmina</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <hr className={isDark ? 'border-dark-600' : 'border-surface-200'} />

                        <div>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Informazioni Professionali</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Specializzazione</label>
                                    <input type="text" className="input-field" value={profile.specialization} onChange={e => setProfile({ ...profile, specialization: e.target.value })} placeholder="Psicologia Clinica" />
                                </div>
                                <div>
                                    <label className={labelClass}>Numero Albo</label>
                                    <input type="text" className="input-field" value={profile.license_number} onChange={e => setProfile({ ...profile, license_number: e.target.value })} placeholder="12345" />
                                </div>
                                <div>
                                    <label className={labelClass}>Nome Studio</label>
                                    <input type="text" className="input-field" value={profile.studio_name} onChange={e => setProfile({ ...profile, studio_name: e.target.value })} placeholder="Studio Psicologico Rossi" />
                                </div>
                                <div>
                                    <label className={labelClass}>Indirizzo Studio</label>
                                    <input type="text" className="input-field" value={profile.studio_address} onChange={e => setProfile({ ...profile, studio_address: e.target.value })} placeholder="Via Roma 1, 00100 Roma" />
                                </div>
                            </div>
                        </div>

                        <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto shadow-md">
                            {submitting ? <LoadingSpinner size="sm" text="" /> : 'Salva Profilo'}
                        </button>
                    </form>
                )}

                {/* ── SCHEDULE TAB ── */}
                {activeTab === 'schedule' && (
                    <div className="space-y-8">
                        {/* Working Hours */}
                        <div>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Orari Lavorativi</h2>
                            <p className={`text-sm mb-6 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>Personalizza il tuo orario per ogni giorno della settimana.</p>
                            <div className="space-y-3">
                                {Object.entries(DAY_LABELS).map(([key, label]) => (
                                    <div key={key} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-xl border transition-colors ${workingHours[key]?.enabled
                                        ? (isDark ? 'border-primary-500/20 bg-primary-500/5' : 'border-primary-200 bg-primary-50/50')
                                        : (isDark ? 'border-dark-400/15 bg-dark-800/30' : 'border-surface-200 bg-surface-50')}`}>
                                        <div className="flex items-center gap-3 min-w-[140px]">
                                            <button type="button" onClick={() => updateDay(key, 'enabled', !workingHours[key]?.enabled)}
                                                className={`w-10 h-6 rounded-full relative transition-colors ${workingHours[key]?.enabled ? 'bg-primary-500' : (isDark ? 'bg-dark-600' : 'bg-surface-300')}`}>
                                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${workingHours[key]?.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                                            </button>
                                            <span className={`font-medium text-sm ${workingHours[key]?.enabled ? (isDark ? 'text-white' : 'text-surface-900') : (isDark ? 'text-dark-400' : 'text-surface-400')}`}>{label}</span>
                                        </div>
                                        {workingHours[key]?.enabled && (
                                            <div className="flex items-center gap-2 sm:ml-auto">
                                                <input type="time" className="input-field !py-2 !px-3 w-[110px] sm:w-[120px] text-sm" value={workingHours[key]?.start || '09:00'} onChange={e => updateDay(key, 'start', e.target.value)} />
                                                <span className={`text-sm ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>—</span>
                                                <input type="time" className="input-field !py-2 !px-3 w-[110px] sm:w-[120px] text-sm" value={workingHours[key]?.end || '18:00'} onChange={e => updateDay(key, 'end', e.target.value)} />
                                            </div>
                                        )}
                                        {!workingHours[key]?.enabled && (
                                            <span className={`ml-auto text-sm italic ${isDark ? 'text-dark-500' : 'text-surface-400'}`}>Non lavorativo</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleWorkingHoursSave} disabled={submitting} className="btn-primary mt-6 w-full sm:w-auto shadow-md">
                                {submitting ? <LoadingSpinner size="sm" text="" /> : 'Salva Orari'}
                            </button>
                        </div>

                        <hr className={isDark ? 'border-dark-600' : 'border-surface-200'} />

                        {/* Vacation Dates */}
                        <div>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Ferie e Assenze</h2>
                            <p className={`text-sm mb-6 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>Aggiungi le date in cui non sarai disponibile.</p>

                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                <input type="date" className="input-field flex-1" value={newVacationDate} onChange={e => setNewVacationDate(e.target.value)} />
                                <input type="text" className="input-field flex-1" value={newVacationReason} onChange={e => setNewVacationReason(e.target.value)} placeholder="Motivo (opzionale)" />
                                <button onClick={handleAddVacation} disabled={!newVacationDate || submitting} className="btn-primary whitespace-nowrap">
                                    + Aggiungi Data
                                </button>
                            </div>

                            {vacationDates.length > 0 ? (
                                <div className="space-y-2">
                                    {vacationDates.map(v => (
                                        <div key={v.id} className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'border-dark-400/15 bg-dark-800/30' : 'border-surface-200 bg-surface-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-500/15' : 'bg-accent-50'}`}>
                                                    <svg className={`w-5 h-5 ${isDark ? 'text-accent-400' : 'text-accent-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <div>
                                                    <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-surface-900'}`}>{new Date(v.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                                    {v.reason && <p className={`text-xs ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>{v.reason}</p>}
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveVacation(v.id)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-300 hover:text-red-400 hover:bg-red-500/10' : 'text-surface-400 hover:text-red-600 hover:bg-red-50'}`}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-sm text-center py-8 ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>Nessuna assenza programmata.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── SECURITY TAB ── */}
                {activeTab === 'security' && (
                    <div>
                        <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Cambia Password</h2>
                        <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-sm">
                            <div>
                                <label className={labelClass}>Nuova Password</label>
                                <input type="password" required minLength={6} value={passwordData.new} onChange={e => setPasswordData({ ...passwordData, new: e.target.value })} className="input-field" placeholder="••••••••" />
                            </div>
                            <div>
                                <label className={labelClass}>Conferma Password</label>
                                <input type="password" required minLength={6} value={passwordData.confirm} onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })} className="input-field" placeholder="••••••••" />
                            </div>
                            <button type="submit" disabled={submitting || isDemoMode} className="btn-primary w-full shadow-md">
                                {submitting ? <LoadingSpinner size="sm" text="" /> : 'Aggiorna Password'}
                            </button>
                        </form>
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
                                    <p className={`text-sm mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Sincronizza gli appuntamenti con il tuo calendario Google.</p>
                                </div>
                            </div>
                            <button onClick={handleGoogleCalendarConnect} className="btn-secondary whitespace-nowrap">Connetti Account</button>
                        </div>
                    </div>
                )}

                {/* ── GDPR TAB ── */}
                {activeTab === 'gdpr' && (
                    <div className="space-y-6">
                        <div className={`p-4 rounded-xl border-l-4 border-primary-500 ${isDark ? 'bg-primary-900/20' : 'bg-primary-50'}`}>
                            <h3 className={`font-bold mb-1 ${isDark ? 'text-primary-400' : 'text-primary-700'}`}>Isolamento Dati</h3>
                            <p className={`text-sm ${isDark ? 'text-dark-200' : 'text-primary-600'}`}>
                                I tuoi dati sono isolati con Row Level Security (RLS) di PostgreSQL.
                            </p>
                        </div>
                        <div className={`p-5 rounded-2xl border ${isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <svg className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                <h3 className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>Zona Pericolosa</h3>
                            </div>
                            <p className={`text-sm mb-4 ${isDark ? 'text-dark-200' : 'text-red-700/80'}`}>Elimina tutti i tuoi dati da Applica in modo permanente.</p>
                            <button onClick={handleDeleteAccount} className="btn-danger w-full sm:w-auto">Elimina Account e Dati</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
