import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { isDemoMode } = useAuth();
    const { theme } = useTheme();

    return (
        <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-dark-900' : 'bg-surface-50'}`}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Demo mode banner */}
                {isDemoMode && (
                    <div className={`border-b px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium shrink-0 transition-colors ${theme === 'dark' ? 'bg-gradient-to-r from-accent-600/20 via-primary-600/20 to-accent-600/20 border-accent-500/20 text-accent-300' : 'bg-gradient-to-r from-accent-50 via-primary-50 to-accent-50 border-accent-200/50 text-accent-700'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Modalità Demo — I dati non vengono salvati e saranno persi al logout</span>
                    </div>
                )}

                {/* Top bar (mobile) */}
                <header className={`lg:hidden flex items-center justify-between px-4 py-3 backdrop-blur-md border-b transition-colors ${theme === 'dark' ? 'bg-dark-800/90 border-dark-400/20' : 'bg-white/90 border-surface-200'}`}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-dark-100 hover:text-white hover:bg-dark-500/50' : 'text-surface-500 hover:text-surface-900 hover:bg-surface-100'}`}
                        id="mobile-menu-btn"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>Applica</span>
                    </div>
                    <div className="w-10" />
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
