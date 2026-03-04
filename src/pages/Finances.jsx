import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Finances() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [invoices, setInvoices] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0 });

    const [showModal, setShowModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        patient_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        status: 'default'
    });

    useEffect(() => {
        fetchData();
    }, [user]);

    async function fetchData() {
        if (!user) return;
        setLoading(true); setError('');
        try {
            // Get patients for dropdown mapping
            const { data: pData, error: pErr } = await supabase.from('patients').select('id, anon_name');
            if (pErr) throw pErr;
            setPatients(pData || []);

            // Get invoices
            const { data: iData, error: iErr } = await supabase
                .from('invoices')
                .select('*')
                .order('date', { ascending: false });
            if (iErr) throw iErr;

            let tot = 0, pend = 0, pd = 0;
            const mapped = (iData || []).map(inv => {
                const amt = parseFloat(inv.amount);
                tot += amt;
                if (inv.status === 'paid') pd += amt;
                if (inv.status === 'sent') pend += amt;
                return {
                    ...inv,
                    patientName: pData?.find(p => p.id === inv.patient_id)?.anon_name || 'Sconosciuto'
                };
            });

            setInvoices(mapped);
            setStats({ total: tot, pending: pend, paid: pd });
        } catch (err) {
            console.error(err);
            setError('Impossibile caricare le fatture.');
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingInvoice(null);
        setFormData({ patient_id: '', amount: '', date: new Date().toISOString().split('T')[0], status: 'draft' });
        setShowModal(true);
    }

    function openEdit(inv) {
        setEditingInvoice(inv);
        setFormData({
            patient_id: inv.patient_id || '',
            amount: inv.amount || '',
            date: inv.date || new Date().toISOString().split('T')[0],
            status: inv.status || 'draft'
        });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault(); setError(''); setSubmitting(true);
        try {
            // Get Psych ID context safely
            const { data: psychData } = await supabase.from('psychologists').select('id').eq('supabase_tenant_id', user.id).single();
            if (!psychData) throw new Error("Errore associazione Dottore. Ri-effettua l'accesso.");

            const payload = {
                psychologist_id: psychData.id,
                patient_id: formData.patient_id,
                amount: parseFloat(formData.amount),
                date: formData.date,
                status: formData.status
            };

            if (editingInvoice) {
                const { error: updErr } = await supabase.from('invoices').update(payload).eq('id', editingInvoice.id);
                if (updErr) throw updErr;
            } else {
                const { error: insErr } = await supabase.from('invoices').insert([payload]);
                if (insErr) throw insErr;
            }
            setShowModal(false); fetchData();
        } catch (err) {
            setError(editingInvoice ? 'Aggiornamento fallito.' : 'Creazione fallita.');
        } finally { setSubmitting(false); }
    }

    async function handleDelete(id) {
        try {
            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) throw error;
            setDeleteConfirm(null); fetchData();
        } catch (err) {
            setError('Eliminazione fallita.');
        }
    }

    async function generatePdf(invoice) {
        alert("La generazione PDF richiede la configurazione di una Supabase Edge Function. La fattura verrà contrassegnata come 'Inviata'.");
        try {
            const { error } = await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id);
            if (error) throw error;
            fetchData();
        } catch (err) { console.error(err); }
    }

    const getStatusStyle = (status) => {
        switch (status) {
            case 'paid': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
            case 'sent': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
            case 'draft': return isDark ? 'bg-dark-700/50 text-dark-300 border-dark-400/20' : 'bg-surface-100 text-surface-600 border-surface-200';
            default: return isDark ? 'bg-dark-700/50 text-dark-300' : 'bg-surface-100 text-surface-600';
        }
    };

    if (loading && invoices.length === 0) {
        return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Caricamento finanze..." /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="page-title">Fatture e Finanze</h1>
                    <p className={`mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Gestisci pagamenti e fatturazione.</p>
                </div>
                <button onClick={openCreate} className="btn-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Crea Fattura
                </button>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-5">
                    <p className={`text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>Incasso Totale</p>
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-surface-900'}`}>€{stats.paid.toLocaleString('it-IT')}</p>
                </div>
                <div className="glass-card p-5">
                    <p className={`text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>In Sospeso (Inviate)</p>
                    <p className={`text-2xl font-bold text-blue-600 dark:text-blue-400`}>€{stats.pending.toLocaleString('it-IT')}</p>
                </div>
                <div className="glass-card p-5">
                    <p className={`text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>Fatturato Globale</p>
                    <p className={`text-2xl font-bold text-primary-600 dark:text-primary-400`}>€{stats.total.toLocaleString('it-IT')}</p>
                </div>
            </div>

            {/* Invoices List */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={`text-xs uppercase bg-surface-50/50 dark:bg-dark-800/50 border-b ${isDark ? 'border-dark-400/20 text-dark-300' : 'border-surface-200 text-surface-500'}`}>
                            <tr>
                                <th className="p-4 font-semibold">Paziente</th>
                                <th className="p-4 font-semibold">Data</th>
                                <th className="p-4 font-semibold">Importo</th>
                                <th className="p-4 font-semibold">Stato</th>
                                <th className="p-4 font-semibold text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-dark-400/10' : 'divide-surface-100'}`}>
                            {invoices.map(inv => (
                                <tr key={inv.id} className={`transition-colors hover:bg-surface-50/50 dark:hover:bg-dark-700/20`}>
                                    <td className="p-4 font-medium">{inv.patientName}</td>
                                    <td className="p-4">{new Date(inv.date).toLocaleDateString('it-IT')}</td>
                                    <td className="p-4 font-semibold text-primary-600 dark:text-primary-400">€{parseFloat(inv.amount).toLocaleString('it-IT')}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusStyle(inv.status)}`}>
                                            {inv.status === 'paid' ? 'Pagata' : inv.status === 'sent' ? 'Inviata' : 'Bozza'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button onClick={() => generatePdf(inv)} title="Genera PDF" className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-300 hover:text-primary-400 hover:bg-primary-500/10' : 'text-surface-400 hover:text-primary-600 hover:bg-primary-50'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </button>
                                        <button onClick={() => openEdit(inv)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-300 hover:text-primary-400 hover:bg-primary-500/10' : 'text-surface-400 hover:text-primary-600 hover:bg-primary-50'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => setDeleteConfirm(inv.id)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-300 hover:text-red-400 hover:bg-red-500/10' : 'text-surface-400 hover:text-red-600 hover:bg-red-50'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {invoices.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-sm text-surface-500 dark:text-dark-400">Nessuna fattura trovata.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-md p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-surface-900'}`}>{editingInvoice ? 'Modifica Fattura' : 'Nuova Fattura'}</h3>
                            <button onClick={() => setShowModal(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200 hover:text-white hover:bg-dark-500/50' : 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Paziente</label>
                                <select className="input-field" value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })} required>
                                    <option value="" disabled>Seleziona un paziente...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.anon_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Data</label>
                                    <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Importo (€)</label>
                                    <input type="number" step="0.01" className="input-field" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required placeholder="0.00" />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Stato</label>
                                <select className="input-field" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                    <option value="draft">Bozza</option>
                                    <option value="sent">Inviata</option>
                                    <option value="paid">Pagata</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annulla</button>
                                <button type="submit" disabled={submitting || patients.length === 0} className="btn-primary flex-1">{submitting ? <LoadingSpinner size="sm" text="" /> : (editingInvoice ? 'Salva' : 'Crea')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRM MODAL */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-sm p-6 animate-slide-up text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
                            <svg className={`w-7 h-7 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-surface-900'}`}>Eliminare Fattura?</h3>
                        <p className={`text-sm mb-6 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Questa azione non può essere annullata. La fattura verrà eliminata.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Annulla</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1">Elimina</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
