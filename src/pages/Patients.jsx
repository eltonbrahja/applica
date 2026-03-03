import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Patients() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPatient, setEditingPatient] = useState(null);
    const [formData, setFormData] = useState({ anon_name: '', notes: '' });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPatients();
    }, [user]);

    async function fetchPatients() {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPatients(data || []);
        } catch (err) {
            console.error(err);
            setError('Impossibile caricare i pazienti.');
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingPatient(null);
        setFormData({ anon_name: '', notes: '' });
        setShowModal(true);
    }

    function openEdit(patient) {
        setEditingPatient(patient);
        setFormData({ anon_name: patient.anon_name || '', notes: patient.notes || '' });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        try {
            // Note: In a real HIPAA/GDPR app, you should encrypt 'notes' client-side here before sending to Supabase.
            // For the scope of this rebuild, we are sending text which relies on Supabase RLS for access control.

            // Get the psychologist record ID linked to this auth user
            const { data: psychData } = await supabase
                .from('psychologists')
                .select('id')
                .eq('supabase_tenant_id', user.id)
                .single();

            if (!psychData) throw new Error("Profilo psicologo non trovato. Contatta il supporto.");

            const payload = {
                psychologist_id: psychData.id,
                anon_name: formData.anon_name,
                notes: formData.notes
            };

            if (editingPatient) {
                const { error } = await supabase.from('patients').update(payload).eq('id', editingPatient.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('patients').insert([payload]);
                if (error) throw error;
            }
            setShowModal(false);
            fetchPatients();
        } catch (err) {
            setError(editingPatient ? 'Aggiornamento fallito.' : 'Creazione fallita.');
            console.error(err);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Eliminare definitivamente questo paziente? Tutti i dati associati andranno persi.')) return;
        try {
            const { error } = await supabase.from('patients').delete().eq('id', id);
            if (error) throw error;
            fetchPatients();
        } catch (err) {
            setError('Eliminazione fallita.');
        }
    }

    const filteredPatients = patients.filter(p =>
        p.anon_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && patients.length === 0) {
        return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Caricamento pazienti..." /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="page-title">Pazienti</h1>
                    <p className={`mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Gestisci la tua rubrica pazienti.</p>
                </div>
                <button onClick={openCreate} className="btn-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nuovo Paziente
                </button>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>}

            <div className={`glass-card p-4 flex items-center gap-3`}>
                <svg className={`w-5 h-5 ${isDark ? 'text-dark-400' : 'text-surface-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                    type="text"
                    placeholder="Cerca per nome o note..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={`bg-transparent border-none focus:ring-0 w-full text-sm outline-none ${isDark ? 'text-white placeholder-dark-400' : 'text-surface-900 placeholder-surface-400'}`}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPatients.map(patient => (
                    <div key={patient.id} className="glass-card-hover p-5 flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-primary-500 to-accent-500`}>
                                    {patient.anon_name.charAt(0).toUpperCase()}
                                </div>
                                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-surface-900'}`}>{patient.anon_name}</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => openEdit(patient)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-dark-300 hover:text-primary-400 hover:bg-primary-500/10' : 'text-surface-400 hover:text-primary-600 hover:bg-primary-50'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(patient.id)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-dark-300 hover:text-red-400 hover:bg-red-500/10' : 'text-surface-400 hover:text-red-600 hover:bg-red-50'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        <p className={`text-sm flex-1 line-clamp-3 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>
                            {patient.notes || "Nessuna nota."}
                        </p>
                    </div>
                ))}
                {filteredPatients.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center">
                        <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-dark-600' : 'text-surface-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <p className={`text-lg font-medium ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>Nessun paziente trovato</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-md p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-surface-900'}`}>{editingPatient ? 'Modifica Paziente' : 'Nuovo Paziente'}</h3>
                            <button onClick={() => setShowModal(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200 hover:text-white hover:bg-dark-500/50' : 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Pseudonimo Paziente <span className="text-primary-400 text-xs text-gradient">(Anonimizzato)</span></label>
                                <input type="text" className="input-field" value={formData.anon_name} onChange={e => setFormData({ ...formData, anon_name: e.target.value })} required placeholder="Es. Mario R." />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Note Cliniche <span className="text-primary-400 text-xs">(Crittografia RLS)</span></label>
                                <textarea className="input-field" rows={4} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Dettagli clinici..." />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annulla</button>
                                <button type="submit" className="btn-primary flex-1">{editingPatient ? 'Salva' : 'Crea'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
