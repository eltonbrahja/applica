import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const EMPTY_FORM = {
    first_name: '', last_name: '', anon_name: '', email: '', phone: '',
    date_of_birth: '', fiscal_code: '', gender: '', address: '',
    emergency_contact: '', therapy_type: '', session_frequency: '',
    start_date: '', status: 'active', notes: ''
};

const THERAPY_TYPES = ['Cognitivo-Comportamentale', 'Psicodinamica', 'Sistemico-Relazionale', 'EMDR', 'Gestalt', 'Umanistica', 'Altro'];
const FREQUENCIES = ['Settimanale', 'Bisettimanale', 'Quindicinale', 'Mensile', 'Al bisogno'];
const GENDERS = ['Maschio', 'Femmina', 'Non specificato'];

export default function Patients() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPatient, setEditingPatient] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [expandedPatient, setExpandedPatient] = useState(null);

    useEffect(() => { fetchPatients(); }, [user]);

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
        } finally { setLoading(false); }
    }

    function getDisplayName(p) {
        if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
        if (p.first_name) return p.first_name;
        return p.anon_name || 'Sconosciuto';
    }

    function openCreate() {
        setEditingPatient(null);
        setFormData({ ...EMPTY_FORM });
        setShowModal(true);
    }

    function openEdit(patient) {
        setEditingPatient(patient);
        setFormData({
            first_name: patient.first_name || '',
            last_name: patient.last_name || '',
            anon_name: patient.anon_name || '',
            email: patient.email || '',
            phone: patient.phone || '',
            date_of_birth: patient.date_of_birth || '',
            fiscal_code: patient.fiscal_code || '',
            gender: patient.gender || '',
            address: patient.address || '',
            emergency_contact: patient.emergency_contact || '',
            therapy_type: patient.therapy_type || '',
            session_frequency: patient.session_frequency || '',
            start_date: patient.start_date || '',
            status: patient.status || 'active',
            notes: patient.notes || '',
        });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        try {
            const { data: psychData } = await supabase
                .from('psychologists').select('id')
                .eq('supabase_tenant_id', user.id).single();
            if (!psychData) throw new Error("Profilo psicologo non trovato.");

            const anonName = formData.anon_name || `${formData.first_name} ${formData.last_name?.charAt(0) || ''}.`.trim();

            const payload = {
                psychologist_id: psychData.id,
                anon_name: anonName,
                first_name: formData.first_name || null,
                last_name: formData.last_name || null,
                email: formData.email || null,
                phone: formData.phone || null,
                date_of_birth: formData.date_of_birth || null,
                fiscal_code: formData.fiscal_code || null,
                gender: formData.gender || null,
                address: formData.address || null,
                emergency_contact: formData.emergency_contact || null,
                therapy_type: formData.therapy_type || null,
                session_frequency: formData.session_frequency || null,
                start_date: formData.start_date || null,
                status: formData.status,
                notes: formData.notes || null,
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
            if (expandedPatient === id) setExpandedPatient(null);
            fetchPatients();
        } catch (err) { setError('Eliminazione fallita.'); }
    }

    const filteredPatients = patients.filter(p => {
        const matchesStatus = statusFilter === 'all' || (p.status || 'active') === statusFilter;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            (p.anon_name || '').toLowerCase().includes(searchLower) ||
            (p.first_name || '').toLowerCase().includes(searchLower) ||
            (p.last_name || '').toLowerCase().includes(searchLower) ||
            (p.email || '').toLowerCase().includes(searchLower) ||
            (p.phone || '').toLowerCase().includes(searchLower) ||
            (p.fiscal_code || '').toLowerCase().includes(searchLower) ||
            (p.therapy_type || '').toLowerCase().includes(searchLower) ||
            (p.notes || '').toLowerCase().includes(searchLower);
        return matchesStatus && matchesSearch;
    });

    if (loading && patients.length === 0) {
        return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Caricamento pazienti..." /></div>;
    }

    const labelClass = `block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="page-title">Pazienti</h1>
                    <p className={`mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Gestisci la tua rubrica pazienti.</p>
                </div>
                <button onClick={openCreate} className="btn-primary" id="new-patient-btn">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nuovo Paziente
                </button>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>}

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className={`glass-card p-3 sm:p-4 flex items-center gap-3 flex-1`}>
                    <svg className={`w-5 h-5 ${isDark ? 'text-dark-400' : 'text-surface-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Cerca per nome, email, telefono, codice fiscale..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className={`bg-transparent border-none focus:ring-0 w-full text-sm outline-none ${isDark ? 'text-white placeholder-dark-400' : 'text-surface-900 placeholder-surface-400'}`} />
                </div>
                <div className={`flex gap-1 rounded-xl p-1 ${isDark ? 'bg-dark-700/60' : 'bg-surface-100'} self-start`}>
                    {[{ id: 'active', label: 'Attivi' }, { id: 'archived', label: 'Archiviati' }, { id: 'all', label: 'Tutti' }].map(f => (
                        <button key={f.id} onClick={() => setStatusFilter(f.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === f.id
                                ? (isDark ? 'bg-primary-600/30 text-primary-400 shadow' : 'bg-white text-primary-600 shadow-sm')
                                : (isDark ? 'text-dark-200 hover:text-white' : 'text-surface-500 hover:text-surface-800')}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Patient Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredPatients.map(patient => (
                    <div key={patient.id} className="glass-card-hover flex flex-col">
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-primary-500 to-accent-500 shrink-0">
                                        {(patient.first_name || patient.anon_name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-surface-900'}`}>{getDisplayName(patient)}</h3>
                                        {patient.therapy_type && (
                                            <p className={`text-xs mt-0.5 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>{patient.therapy_type}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 items-center">
                                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${(patient.status || 'active') === 'active'
                                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                                        : 'bg-surface-100 text-surface-500 dark:bg-dark-700 dark:text-dark-300 border-surface-200 dark:border-dark-600'
                                        }`}>
                                        {(patient.status || 'active') === 'active' ? 'Attivo' : 'Archiviato'}
                                    </span>
                                </div>
                            </div>

                            {/* Quick info */}
                            <div className={`grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-3 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>
                                {patient.phone && <p>📱 {patient.phone}</p>}
                                {patient.email && <p className="truncate">✉️ {patient.email}</p>}
                                {patient.session_frequency && <p>🔄 {patient.session_frequency}</p>}
                                {patient.start_date && <p>📅 Dal {new Date(patient.start_date).toLocaleDateString('it-IT')}</p>}
                            </div>

                            {patient.notes && (
                                <p className={`text-xs mt-3 line-clamp-2 ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>
                                    {patient.notes}
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className={`flex border-t ${isDark ? 'border-dark-400/20' : 'border-surface-200'}`}>
                            <button onClick={() => setExpandedPatient(expandedPatient === patient.id ? null : patient.id)}
                                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${isDark ? 'text-dark-300 hover:text-primary-400 hover:bg-primary-500/5' : 'text-surface-400 hover:text-primary-600 hover:bg-primary-50'}`}>
                                {expandedPatient === patient.id ? 'Chiudi' : 'Dettagli'}
                            </button>
                            <button onClick={() => openEdit(patient)}
                                className={`flex-1 py-2.5 text-xs font-medium border-l transition-colors ${isDark ? 'border-dark-400/20 text-dark-300 hover:text-primary-400 hover:bg-primary-500/5' : 'border-surface-200 text-surface-400 hover:text-primary-600 hover:bg-primary-50'}`}>
                                Modifica
                            </button>
                            <button onClick={() => handleDelete(patient.id)}
                                className={`flex-1 py-2.5 text-xs font-medium border-l transition-colors ${isDark ? 'border-dark-400/20 text-dark-300 hover:text-red-400 hover:bg-red-500/5' : 'border-surface-200 text-surface-400 hover:text-red-600 hover:bg-red-50'}`}>
                                Elimina
                            </button>
                        </div>

                        {/* Expanded Detail */}
                        {expandedPatient === patient.id && (
                            <div className={`p-5 border-t animate-fade-in ${isDark ? 'border-dark-400/20 bg-dark-800/50' : 'border-surface-200 bg-surface-50/50'}`}>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {patient.fiscal_code && <div><span className={`text-xs font-medium ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>Codice Fiscale</span><p className={isDark ? 'text-dark-100' : 'text-surface-800'}>{patient.fiscal_code}</p></div>}
                                    {patient.gender && <div><span className={`text-xs font-medium ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>Genere</span><p className={isDark ? 'text-dark-100' : 'text-surface-800'}>{patient.gender}</p></div>}
                                    {patient.date_of_birth && <div><span className={`text-xs font-medium ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>Data di Nascita</span><p className={isDark ? 'text-dark-100' : 'text-surface-800'}>{new Date(patient.date_of_birth).toLocaleDateString('it-IT')}</p></div>}
                                    {patient.address && <div className="col-span-2"><span className={`text-xs font-medium ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>Indirizzo</span><p className={isDark ? 'text-dark-100' : 'text-surface-800'}>{patient.address}</p></div>}
                                    {patient.emergency_contact && <div className="col-span-2"><span className={`text-xs font-medium ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>Contatto di Emergenza</span><p className={isDark ? 'text-dark-100' : 'text-surface-800'}>{patient.emergency_contact}</p></div>}
                                    {patient.notes && <div className="col-span-2"><span className={`text-xs font-medium ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>Note Cliniche</span><p className={`${isDark ? 'text-dark-100' : 'text-surface-800'} whitespace-pre-wrap`}>{patient.notes}</p></div>}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {filteredPatients.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center">
                        <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-dark-600' : 'text-surface-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <p className={`text-lg font-medium ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>Nessun paziente trovato</p>
                    </div>
                )}
            </div>

            {/* ── CREATE/EDIT MODAL ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-surface-900'}`}>{editingPatient ? 'Modifica Paziente' : 'Nuovo Paziente'}</h3>
                            <button onClick={() => setShowModal(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200 hover:text-white hover:bg-dark-500/50' : 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Sezione Anagrafica */}
                            <div>
                                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>Anagrafica</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Nome *</label>
                                        <input type="text" className="input-field" required value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder="Mario" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Cognome *</label>
                                        <input type="text" className="input-field" required value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder="Rossi" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Email</label>
                                        <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="mario@email.it" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Telefono</label>
                                        <input type="tel" className="input-field" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+39 333 1234567" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Data di Nascita</label>
                                        <input type="date" className="input-field" value={formData.date_of_birth} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Codice Fiscale</label>
                                        <input type="text" className="input-field" value={formData.fiscal_code} onChange={e => setFormData({ ...formData, fiscal_code: e.target.value.toUpperCase() })} placeholder="RSSMRA80A01H501U" maxLength={16} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Genere</label>
                                        <select className="input-field" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                            <option value="">Seleziona...</option>
                                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Indirizzo</label>
                                        <input type="text" className="input-field" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Via Roma 1, Milano" />
                                    </div>
                                </div>
                            </div>

                            {/* Contatto Emergenza */}
                            <div>
                                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>Contatto di Emergenza</h4>
                                <input type="text" className="input-field" value={formData.emergency_contact} onChange={e => setFormData({ ...formData, emergency_contact: e.target.value })} placeholder="Nome e numero di telefono" />
                            </div>

                            {/* Sezione Terapia */}
                            <div>
                                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>Terapia</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Tipo di Terapia</label>
                                        <select className="input-field" value={formData.therapy_type} onChange={e => setFormData({ ...formData, therapy_type: e.target.value })}>
                                            <option value="">Seleziona...</option>
                                            {THERAPY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Frequenza Sedute</label>
                                        <select className="input-field" value={formData.session_frequency} onChange={e => setFormData({ ...formData, session_frequency: e.target.value })}>
                                            <option value="">Seleziona...</option>
                                            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Data Inizio Percorso</label>
                                        <input type="date" className="input-field" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Stato</label>
                                        <select className="input-field" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                            <option value="active">Attivo</option>
                                            <option value="archived">Archiviato</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Pseudonimo */}
                            <div>
                                <label className={labelClass}>Pseudonimo <span className="text-primary-400 text-xs">(generato automaticamente se vuoto)</span></label>
                                <input type="text" className="input-field" value={formData.anon_name} onChange={e => setFormData({ ...formData, anon_name: e.target.value })} placeholder="Es. Mario R." />
                            </div>

                            {/* Note Cliniche */}
                            <div>
                                <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>Note Cliniche</h4>
                                <textarea className="input-field" rows={4} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Anamnesi, diagnosi, osservazioni cliniche..." />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annulla</button>
                                <button type="submit" className="btn-primary flex-1" id="submit-patient">{editingPatient ? 'Salva Modifiche' : 'Crea Paziente'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
