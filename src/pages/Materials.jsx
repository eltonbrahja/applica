import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Materials() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('Tutti');

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState({ title: '', category: 'Dispensa', file: null });

    const categories = ['Tutti', 'Appunti', 'Esercizi', 'Protocolli', 'Dispensa', 'Audio/Video'];

    useEffect(() => {
        fetchMaterials();
    }, [user]);

    async function fetchMaterials() {
        if (!user) return;
        setLoading(true); setError('');
        try {
            const { data, error: err } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
            if (err) throw err;
            setMaterials(data || []);
        } catch (err) {
            console.error(err);
            setError('Impossibile caricare i materiali.');
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload(e) {
        e.preventDefault();
        if (!formData.file) return alert("Seleziona un file da caricare.");
        setError(''); setUploading(true);

        try {
            // 1. Get Psych ID
            const { data: psychData } = await supabase.from('psychologists').select('id').eq('supabase_tenant_id', user.id).single();
            if (!psychData) throw new Error("Profilo Dottore non trovato.");

            // 2. Upload to Supabase Storage 'materials' bucket
            const fileExt = formData.file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`; // isolate by auth.uid path if RLS on bucket

            const { error: uploadError } = await supabase.storage
                .from('materials')
                .upload(filePath, formData.file);

            if (uploadError) {
                throw new Error("Caricamento file fallito. Assicurati che il bucket 'materials' sia configurato nella dashboard Supabase Storage.");
            }

            const { data: publicUrlData } = supabase.storage.from('materials').getPublicUrl(filePath);
            const fileUrl = publicUrlData.publicUrl;

            // 3. Insert Database Record
            const payload = {
                psychologist_id: psychData.id,
                title: formData.title || formData.file.name,
                category: formData.category,
                file_url: fileUrl,
            };

            const { error: dbError } = await supabase.from('materials').insert([payload]);
            if (dbError) throw dbError;

            setShowUploadModal(false);
            setFormData({ title: '', category: 'Dispensa', file: null });
            fetchMaterials();
        } catch (err) {
            setError(err.message || "Errore durante il caricamento.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleDelete(id) {
        if (!confirm('Eliminare definitivamente questo materiale?')) return;
        try {
            // Ideally we should delete from storage too: `supabase.storage.from('materials').remove([filePath])`
            const { error } = await supabase.from('materials').delete().eq('id', id);
            if (error) throw error;
            fetchMaterials();
        } catch (err) { setError("Eliminazione fallita."); }
    }

    const filteredMaterials = materials.filter(m => {
        const matchesCategory = filterCategory === 'Tutti' || m.category === filterCategory;
        const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const getCategoryStyles = (cat) => {
        if (cat === 'Esercizi') return 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20';
        if (cat === 'Protocolli') return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
        if (cat === 'Dispensa') return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
    };

    if (loading && materials.length === 0) {
        return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Caricamento materiali..." /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in relative min-h-[500px]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="page-title">Libreria Materiali</h1>
                    <p className={`mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>Archivio risorse cliniche su Applica.</p>
                </div>
                <button onClick={() => setShowUploadModal(true)} className="btn-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Carica File
                </button>
            </div>

            {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>}

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="glass-card flex-1 p-2 pl-4 flex items-center gap-3">
                    <svg className={`w-5 h-5 ${isDark ? 'text-dark-400' : 'text-surface-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        type="text"
                        placeholder="Cerca materiali..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={`bg-transparent border-none focus:ring-0 w-full text-sm outline-none ${isDark ? 'text-white placeholder-dark-400' : 'text-surface-900 placeholder-surface-400'}`}
                    />
                </div>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filterCategory === cat ? (isDark ? 'bg-primary-600 text-white' : 'bg-primary-500 text-white shadow-md shadow-primary-500/20') : (isDark ? 'bg-dark-800 text-dark-300 hover:bg-dark-700' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMaterials.map(item => (
                    <div key={item.id} className="glass-card-hover flex flex-col group overflow-hidden">
                        <div className={`h-32 flex items-center justify-center relative ${isDark ? 'bg-dark-800' : 'bg-surface-100'}`}>
                            {/* Mock File Preview Icon */}
                            <svg className={`w-12 h-12 ${isDark ? 'text-dark-600' : 'text-surface-300'}`} fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2.5L18.5 10H13V4.5zM6 20V4h5v7h7v9H6z" />
                            </svg>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-colors text-white" title="Apri/Scarica">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </a>
                                <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg backdrop-blur-sm transition-colors text-white" title="Elimina">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col border-t border-surface-200 dark:border-dark-400/20">
                            <span className={`inline-block mb-2 px-2.5 py-0.5 text-[10px] font-semibold rounded-full border w-fit ${getCategoryStyles(item.category)}`}>
                                {item.category}
                            </span>
                            <h3 className={`font-semibold line-clamp-2 ${isDark ? 'text-white' : 'text-surface-900'}`}>{item.title}</h3>
                            <p className={`text-xs mt-auto pt-4 ${isDark ? 'text-dark-400' : 'text-surface-400'}`}>
                                {new Date(item.created_at).toLocaleDateString('it-IT')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {filteredMaterials.length === 0 && !loading && (
                <div className="py-12 text-center">
                    <svg className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-dark-600' : 'text-surface-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-surface-900'}`}>Nessun materiale trovato</h3>
                    <p className={`text-sm ${isDark ? 'text-dark-300' : 'text-surface-500'}`}>Trascina un file o clicca carica in alto.</p>
                </div>
            )}

            {/* UPLOAD MODAL */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card w-full max-w-md p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-surface-900'}`}>Carica Materiale</h3>
                            <button onClick={() => setShowUploadModal(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-dark-200 hover:text-white hover:bg-dark-500/50' : 'text-surface-400 hover:text-surface-900 hover:bg-surface-100'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Titolo <span className="text-xs font-normal text-surface-400 dark:text-dark-400">(opzionale)</span></label>
                                <input type="text" className="input-field" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Es. Protocollo CBT" />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>Categoria</label>
                                <select className="input-field" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                    {categories.filter(c => c !== 'Tutti').map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-dark-100' : 'text-surface-700'}`}>File</label>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={e => setFormData({ ...formData, file: e.target.files[0] })}
                                    className={`w-full text-sm ${isDark ? 'text-dark-200 file:text-dark-100 file:bg-dark-600 hover:file:bg-dark-500' : 'text-surface-600 file:text-surface-700 file:bg-surface-100 hover:file:bg-surface-200'} file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:transition-colors`}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary flex-1">Annulla</button>
                                <button type="submit" disabled={uploading || !formData.file} className="btn-primary flex-1">
                                    {uploading ? <LoadingSpinner size="sm" text="" /> : 'Carica'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
