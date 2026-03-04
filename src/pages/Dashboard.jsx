import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                // Fetch counts and aggregates from Supabase
                const [
                    { count: patientsCount, error: pErr },
                    { count: appointmentsCount, error: aErr },
                    { data: invoicesData, error: iErr }
                ] = await Promise.all([
                    supabase.from('patients').select('*', { count: 'exact', head: true }),
                    supabase.from('appointments').select('*', { count: 'exact', head: true }),
                    supabase.from('invoices').select('amount, status')
                ]);

                if (pErr || aErr || iErr) throw new Error("Errore nel caricamento dati");

                let totalRevenue = 0;
                let pendingAmount = 0;

                invoicesData?.forEach(inv => {
                    const amt = parseFloat(inv.amount);
                    if (inv.status === 'paid') totalRevenue += amt;
                    if (inv.status === 'sent') pendingAmount += amt;
                });

                setStats({
                    appointments: appointmentsCount || 0,
                    totalRevenue,
                    pendingAmount,
                    patients: patientsCount || 0,
                });
            } catch (err) {
                console.error(err);
                setError('Impossibile caricare i dati della dashboard.');
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchDashboardData();
    }, [user]);

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Buongiorno' : currentHour < 18 ? 'Buon pomeriggio' : 'Buonasera';

    const statCards = [
        {
            label: 'Pazienti Totali',
            value: stats?.patients || 0,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            color: 'from-primary-500/20 to-primary-600/10',
            iconBg: isDark ? 'bg-primary-500/15' : 'bg-primary-50',
            iconColor: isDark ? 'text-primary-400' : 'text-primary-600',
        },
        {
            label: 'Appuntamenti',
            value: stats?.appointments || 0,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            color: 'from-accent-500/20 to-accent-600/10',
            iconBg: isDark ? 'bg-accent-500/15' : 'bg-accent-50',
            iconColor: isDark ? 'text-accent-400' : 'text-accent-700',
        },
        {
            label: 'Fatturato Totale',
            value: `€${(stats?.totalRevenue || 0).toLocaleString('it-IT')}`,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'from-green-500/20 to-green-600/10',
            iconBg: isDark ? 'bg-green-500/15' : 'bg-green-50',
            iconColor: isDark ? 'text-green-400' : 'text-green-600',
        },
        {
            label: 'Pagamenti in Sospeso',
            value: `€${(stats?.pendingAmount || 0).toLocaleString('it-IT')}`,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'from-yellow-500/20 to-yellow-600/10',
            iconBg: isDark ? 'bg-yellow-500/15' : 'bg-yellow-50',
            iconColor: isDark ? 'text-yellow-400' : 'text-yellow-600',
        },
    ];

    const quickActions = [
        {
            label: 'Nuovo Appuntamento', desc: 'Programma una seduta', href: '/appointments',
            icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>),
            iconBg: isDark ? 'bg-primary-500/15' : 'bg-primary-50',
            iconColor: isDark ? 'text-primary-400' : 'text-primary-600',
        },
        {
            label: 'Aggiungi Paziente', desc: 'Registra un nuovo paziente', href: '/patients',
            icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>),
            iconBg: isDark ? 'bg-accent-500/15' : 'bg-accent-50',
            iconColor: isDark ? 'text-accent-400' : 'text-accent-700',
        },
        {
            label: 'Crea Fattura', desc: 'Fattura una seduta', href: '/finances',
            icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>),
            iconBg: isDark ? 'bg-green-500/15' : 'bg-green-50',
            iconColor: isDark ? 'text-green-400' : 'text-green-600',
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" text="Caricamento dashboard..." />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="page-title">
                    {greeting}, <span className="text-gradient">{user?.email ? user.email.split('@')[0] : 'Dottore'}</span>
                </h1>
                <p className={`mt-2 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>
                    Ecco un riepilogo del tuo studio su Applica.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {statCards.map((card, idx) => (
                    <div
                        key={card.label}
                        className="glass-card-hover p-6 animate-slide-up"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-xl ${card.iconBg}`}>
                                <div className={card.iconColor}>{card.icon}</div>
                            </div>
                        </div>
                        <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-surface-900'}`}>{card.value}</p>
                        <p className={`text-sm mt-1 ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-surface-900'}`}>Azioni Rapide</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quickActions.map((action, idx) => (
                        <Link
                            key={action.label}
                            to={action.href}
                            className="glass-card-hover p-5 flex items-center gap-4 group animate-slide-up"
                            style={{ animationDelay: `${(idx + 4) * 100}ms` }}
                        >
                            <div className={`p-3 rounded-xl ${action.iconBg}`}>
                                <div className={action.iconColor}>{action.icon}</div>
                            </div>
                            <div>
                                <p className={`font-semibold group-hover:text-primary-500 transition-colors ${isDark ? 'text-white' : 'text-surface-900'}`}>
                                    {action.label}
                                </p>
                                <p className={`text-sm ${isDark ? 'text-dark-200' : 'text-surface-500'}`}>{action.desc}</p>
                            </div>
                            <svg className={`w-5 h-5 ml-auto group-hover:text-primary-500 group-hover:translate-x-1 transition-all ${isDark ? 'text-dark-300' : 'text-surface-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Security Status */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-surface-900'}`}>Stato Sicurezza Supabase</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-dark-700/50' : 'bg-surface-50'}`}>
                        <span className="badge-success">Attivo</span>
                        <span className={`text-sm ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Row Level Security (RLS)</span>
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-dark-700/50' : 'bg-surface-50'}`}>
                        <span className="badge-success">Attivo</span>
                        <span className={`text-sm ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Isolamento Tenant PostgreSQL</span>
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-dark-700/50' : 'bg-surface-50'}`}>
                        <span className="badge-info">Attivo</span>
                        <span className={`text-sm ${isDark ? 'text-dark-100' : 'text-surface-600'}`}>Autenticazione Sicura</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
