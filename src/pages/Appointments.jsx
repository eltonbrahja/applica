import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00

const STATUS_COLORS = {
    confirmed: { bg: 'bg-primary-600/20', border: 'border-primary-500/30', text: 'text-primary-600 dark:text-primary-300', badge: 'badge-info' },
    cancelled: { bg: 'bg-red-600/15', border: 'border-red-500/25', text: 'text-red-600 dark:text-red-300', badge: 'badge-warning text-red-500' },
};

const TYPE_LABELS = {
    session: 'Seduta', 'first-visit': 'Prima Visita', 'follow-up': 'Controllo', assessment: 'Valutazione',
};

function getWeekStart(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
    date.setHours(0, 0, 0, 0);
    return date;
}

export default function Appointments() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Calendar view state
    const [view, setView] = useState('week');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingAppt, setEditingAppt] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        patient_id: '', date: '', time: '09:00', duration: 50, type: 'session', status: 'confirmed'
    });

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true); setError('');
        try {
            // First get patients for the dropdown and display names
            const { data: patsData, error: patsErr } = await supabase.from('patients').select('id, anon_name');
            if (patsErr) throw patsErr;
            setPatients(patsData || []);

            // Base date calculation for filtering
            let startDate, endDate;
            if (view === 'month') {
                const y = currentDate.getFullYear(), m = currentDate.getMonth();
                startDate = new Date(y, m, 1).toISOString();
                endDate = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
            } else {
                const ws = getWeekStart(currentDate);
                startDate = ws.toISOString();
                const we = new Date(ws); we.setDate(we.getDate() + 6); we.setHours(23, 59, 59);
                endDate = we.toISOString();
            }

            // Fetch appointments in range
            const { data: apptData, error: apptErr } = await supabase
                .from('appointments')
                .select('*')
                .gte('datetime', startDate)
                .lte('datetime', endDate);

            if (apptErr) throw apptErr;

            // Map the parsed dates and patient names into the objects for easier rendering
            const mappedAppts = (apptData || []).map(a => {
                const dt = new Date(a.datetime);
                const patName = patsData?.find(p => p.id === a.patient_id)?.anon_name || 'Sconosciuto';
                return {
                    ...a,
                    patientName: patName,
                    dateStr: dt.toISOString().split('T')[0],
                    timeStr: dt.toTimeString().substring(0, 5)
                };
            });

            setAppointments(mappedAppts);
        } catch (err) {
            setError('Caricamento fallito.');
        } finally { setLoading(false); }
    }, [currentDate, view, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    function openCreate() {
        setEditingAppt(null);
        setFormData({ patient_id: '', date: '', time: '09:00', duration: 50, type: 'session', status: 'confirmed' });
        setShowModal(true);
    }

    function openEdit(appt) {
        setEditingAppt(appt);
        setFormData({
            patient_id: appt.patient_id || '',
            date: appt.dateStr || '',
            time: appt.timeStr || '09:00',
            duration: appt.duration || 50,
            type: appt.type || 'session',
            status: appt.status || 'confirmed',
        });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setSubmitting(true);
        try {
            if (!formData.patient_id) throw new Error("Seleziona un paziente dal menu.");

            // Combine date + time
            const timestamp = new Date(`${formData.date}T${formData.time}:00`).toISOString();

            // Get psych ID context safely
            const { data: psychData } = await supabase.from('psychologists').select('id').eq('supabase_tenant_id', user.id).single();
            if (!psychData) throw new Error("Errore associazione Dottore. Ri-effettua l'accesso.");

            const payload = {
                psychologist_id: psychData.id,
                patient_id: formData.patient_id,
                datetime: timestamp,
                duration: formData.duration,
                type: formData.type,
                status: formData.status
            };

            if (editingAppt) {
                const { error: updErr } = await supabase.from('appointments').update(payload).eq('id', editingAppt.id);
                if (updErr) throw updErr;
            } else {
                const { error: insErr } = await supabase.from('appointments').insert([payload]);
                if (insErr) throw insErr;
            }
            setShowModal(false); fetchData();
        } catch (err) {
            setError(err.message || (editingAppt ? 'Aggiornamento fallito.' : 'Creazione fallita.'));
        } finally { setSubmitting(false); }
    }

    async function handleDelete(id) {
        try {
            const { error: delErr } = await supabase.from('appointments').delete().eq('id', id);
            if (delErr) throw delErr;
            setDeleteConfirm(null); fetchData();
        } catch (err) { setError('Eliminazione fallita.'); }
    }

    async function handleStatusToggle(appt) {
        const newStatus = appt.status === 'confirmed' ? 'cancelled' : 'confirmed';
        try {
            const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appt.id);
            if (error) throw error;
            fetchData();
        } catch (err) { setError('Aggiornamento stato fallito.'); }
    }

    function navigate(dir) {
        const d = new Date(currentDate);
        if (view === 'month') d.setMonth(d.getMonth() + dir);
        else d.setDate(d.getDate() + dir * 7);
        setCurrentDate(d);
    }

    // Calendar Calculations
    const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
    const weekDates = useMemo(() => DAYS.map((day, i) => {
        const d = new Date(weekStart); d.setDate(d.getDate() + i);
        return {
            day, num: d.getDate(), month: d.toLocaleDateString('it-IT', { month: 'short' }),
            full: d.toISOString().split('T')[0], isToday: d.toDateString() === new Date().toDateString()
        };
    }), [weekStart]);

    const monthDays = useMemo(() => {
        if (view !== 'month') return [];
        const y = currentDate.getFullYear(), m = currentDate.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const offset = firstDay === 0 ? 6 : firstDay - 1;
        const cells = [];
        for (let i = 0; i < offset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m, d);
            date.setHours(12); // avoid timezone boundary shifts
            cells.push({ num: d, full: date.toISOString().split('T')[0], isToday: date.toDateString() === new Date().toDateString() });
        }
        return cells;
    }, [currentDate, view]);

    const headerLabel = view === 'month'
        ? currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
        : `${weekDates[0]?.num} ${weekDates[0]?.month} — ${weekDates[6]?.num} ${weekDates[6]?.month} ${weekStart.getFullYear()}`;

    if (loading && appointments.length === 0) {
        return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Caricamento calendario..." /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="page-title">Appuntamenti</h1>
                    <p className={`mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Gestisci il tuo calendario con Supabase Cursors.</p>
                </div>
                <button onClick={openCreate} className="btn-primary" id="new-appointment-btn">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nuovo Appuntamento
                </button>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>}

            {/* View switcher + navigation */}
            <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className={`flex gap-1 rounded-xl p-1 ${isDark ? 'bg-dark-700/60' : 'bg-surface-100'}`}>
                    {[{ id: 'week', label: 'Settimana' }, { id: 'month', label: 'Mese' }, { id: 'list', label: 'Lista' }].map(v => (
                        <button key={v.id} onClick={() => setView(v.id)} id={`view-${v.id}-btn`}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === v.id ? (isDark ? 'bg-primary-600/30 text-primary-400' : 'bg-white text-primary-600 shadow-sm') + ' shadow' : (isDark ? 'text-dark-200 hover:text-white' : 'text-surface-500 hover:text-surface-800')}`}>
                            {v.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200 hover:text-white hover:bg-dark-500/50' : 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'}`} id="nav-prev">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className={`text-lg font-semibold min-w-[220px] text-center capitalize ${isDark ? 'text-white' : 'text-surface-900'}`}>{headerLabel}</span>
                    <button onClick={() => navigate(1)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200 hover:text-white hover:bg-dark-500/50' : 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'}`} id="nav-next">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'text-primary-400 bg-primary-600/15 hover:bg-primary-600/25' : 'text-primary-600 bg-primary-50 hover:bg-primary-100'}`} id="today-btn">Oggi</button>
                </div>
            </div>

            {/* ── WEEK VIEW ── */}
            {view === 'week' && (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="min-w-[750px]">
                            <div className={`grid grid-cols-8 border-b ${isDark ? 'border-dark-400/20' : 'border-surface-200'}`}>
                                <div className={`p-3 text-xs text-center font-medium ${isDark ? 'text-dark-300' : 'text-surface-400'}`}>Ora</div>
                                {weekDates.map(d => (
                                    <div key={d.full} className={`p-3 text-center border-l ${isDark ? 'border-dark-400/20' : 'border-surface-200'} ${d.isToday ? (isDark ? 'bg-primary-600/10' : 'bg-primary-50') : ''}`}>
                                        <p className={`text-xs font-medium ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>{d.day}</p>
                                        <p className={`text-lg font-bold ${d.isToday ? 'text-primary-500' : (isDark ? 'text-white' : 'text-surface-900')}`}>{d.num}</p>
                                    </div>
                                ))}
                            </div>
                            {HOURS.map(hour => (
                                <div key={hour} className={`grid grid-cols-8 border-b group transition-colors ${isDark ? 'border-dark-400/10 hover:bg-dark-700/20' : 'border-surface-100 hover:bg-surface-50'}`}>
                                    <div className={`p-2 text-xs text-center border-r ${isDark ? 'text-dark-300 border-dark-400/10' : 'text-surface-500 border-surface-100'}`}>{String(hour).padStart(2, '0')}:00</div>
                                    {weekDates.map(d => {
                                        const slots = appointments.filter(a => a.dateStr === d.full && parseInt(a.timeStr.split(':')[0]) === hour);
                                        return (
                                            <div key={`${d.full}-${hour}`} className={`p-0.5 border-l min-h-[52px] ${isDark ? 'border-dark-400/10' : 'border-surface-100'}`}>
                                                {slots.map(appt => {
                                                    const sc = STATUS_COLORS[appt.status] || STATUS_COLORS.confirmed;
                                                    return (
                                                        <div key={appt.id} onClick={() => openEdit(appt)} title={`${appt.patientName} — ${appt.duration}min`}
                                                            className={`p-1.5 rounded-lg ${sc.bg} border ${sc.border} text-xs cursor-pointer hover:brightness-125 transition-all mb-0.5`}>
                                                            <p className={`font-medium ${sc.text} truncate`}>{appt.patientName || TYPE_LABELS[appt.type]}</p>
                                                            <p className={`truncate ${isDark ? 'text-dark-200' : 'text-surface-600 opacity-80'}`}>{appt.timeStr} · {appt.duration}m</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── MONTH VIEW ── */}
            {view === 'month' && (
                <div className="glass-card overflow-hidden p-4">
                    <div className="grid grid-cols-7 gap-px mb-2">
                        {DAYS.map(d => <div key={d} className={`text-center text-xs font-medium py-2 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {monthDays.map((cell, i) => {
                            if (!cell) return <div key={`empty-${i}`} />;
                            const dayAppts = appointments.filter(a => a.dateStr === cell.full);
                            return (
                                <div key={cell.full} className={`min-h-[90px] rounded-xl p-2 border transition-colors ${cell.isToday ? (isDark ? 'border-primary-500/40 bg-primary-600/10' : 'border-primary-300 bg-primary-50') : (isDark ? 'border-dark-400/15 hover:border-dark-400/30 bg-dark-700/20' : 'border-surface-200 hover:border-surface-300 bg-surface-50/50')}`}>
                                    <p className={`text-sm font-medium mb-1 ${cell.isToday ? 'text-primary-500' : (isDark ? 'text-dark-100' : 'text-surface-700')}`}>{cell.num}</p>
                                    <div className="space-y-0.5">
                                        {dayAppts.slice(0, 3).map(appt => {
                                            const sc = STATUS_COLORS[appt.status] || STATUS_COLORS.confirmed;
                                            return (
                                                <div key={appt.id} onClick={() => openEdit(appt)}
                                                    className={`px-1.5 py-0.5 rounded ${sc.bg} cursor-pointer hover:brightness-125 transition-all`}>
                                                    <p className={`text-[10px] ${sc.text} truncate`}>{appt.timeStr} {appt.patientName || TYPE_LABELS[appt.type]}</p>
                                                </div>
                                            );
                                        })}
                                        {dayAppts.length > 3 && <p className={`text-[10px] pl-1 ${isDark ? 'text-dark-300' : 'text-surface-400'}`}>+{dayAppts.length - 3} altri</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── LIST VIEW ── */}
            {view === 'list' && (
                <div className="space-y-3">
                    {appointments.length > 0 ? appointments.map(appt => {
                        const sc = STATUS_COLORS[appt.status] || STATUS_COLORS.confirmed;
                        return (
                            <div key={appt.id} className="glass-card-hover p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${appt.status === 'cancelled' ? 'bg-red-500/15' : 'bg-primary-500/15'}`}>
                                    <svg className={`w-6 h-6 ${appt.status === 'cancelled' ? 'text-red-500 dark:text-red-400' : 'text-primary-500 dark:text-primary-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-surface-900'}`}>{appt.patientName}</p>
                                        <span className={`${sc.badge} inline-flex items-center`}>{appt.status === 'confirmed' ? 'Confermato' : 'Annullato'}</span>
                                    </div>
                                    <p className={`text-sm ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>
                                        {new Date(appt.datetime).toLocaleDateString('it-IT')} alle {appt.timeStr} · {appt.duration} min · {TYPE_LABELS[appt.type] || appt.type}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleStatusToggle(appt)} title={appt.status === 'confirmed' ? 'Annulla' : 'Conferma'}
                                        className={`p-2 rounded-lg transition-colors ${appt.status === 'confirmed' ? (isDark ? 'text-dark-200' : 'text-surface-400') + ' hover:text-red-500 hover:bg-red-500/10' : (isDark ? 'text-dark-200' : 'text-surface-400') + ' hover:text-accent-500 hover:bg-accent-500/10'}`}>
                                        {appt.status === 'confirmed' ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        )}
                                    </button>
                                    <button onClick={() => openEdit(appt)} title="Modifica"
                                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200' : 'text-surface-400'} hover:text-primary-500 hover:bg-primary-500/10`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button onClick={() => setDeleteConfirm(appt.id)} title="Elimina"
                                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200' : 'text-surface-400'} hover:text-red-500 hover:bg-red-500/10`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="col-span-full py-12 text-center">
                            <svg className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-dark-600' : 'text-surface-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-surface-900'}`}>Nessun appuntamento trovato</h3>
                            <button onClick={openCreate} className="btn-primary mx-auto mt-4">Programma Appuntamento</button>
                        </div>
                    )}
                </div>
            )}

            {/* ── CREATE/EDIT MODAL ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-surface-900'}`}>{editingAppt ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}</h3>
                            <button onClick={() => setShowModal(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200 hover:text-white hover:bg-dark-500/50' : 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'}`} id="close-modal">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Paziente</label>
                                {patients.length > 0 ? (
                                    <select className="input-field" value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })} required>
                                        <option value="" disabled>Seleziona un paziente...</option>
                                        {patients.map(p => (
                                            <option key={p.id} value={p.id}>{p.anon_name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="p-3 bg-red-500/10 text-red-500 rounded-xl text-sm">Registra prima almeno un paziente per poter creare appuntamenti.</div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Data</label>
                                    <input type="date" className="input-field" value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Ora</label>
                                    <input type="time" className="input-field" value={formData.time}
                                        onChange={e => setFormData({ ...formData, time: e.target.value })} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Durata</label>
                                    <select className="input-field" value={formData.duration}
                                        onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}>
                                        {[30, 45, 50, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Tipo</label>
                                    <select className="input-field" value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="session">Seduta</option>
                                        <option value="first-visit">Prima Visita</option>
                                        <option value="follow-up">Controllo</option>
                                        <option value="assessment">Valutazione</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Stato</label>
                                    <select className="input-field" value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="confirmed">Confermato</option>
                                        <option value="cancelled">Annullato</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annulla</button>
                                <button type="submit" disabled={submitting || patients.length === 0} className="btn-primary flex-1" id="submit-appointment">{submitting ? <LoadingSpinner size="sm" text="" /> : (editingAppt ? 'Aggiorna' : 'Crea')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── DELETE CONFIRM MODAL ── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-sm p-6 animate-slide-up text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
                            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-surface-900'}`}>Eliminare Appuntamento?</h3>
                        <p className={`text-sm mb-6 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>L'appuntamento sarà eliminato permanentemente dal database.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Annulla</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1" id="confirm-delete-btn">Elimina</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
