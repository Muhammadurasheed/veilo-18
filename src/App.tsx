
import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { UserProvider } from '@/contexts/UserContext';
import { VeiloDataProvider } from '@/contexts/VeiloDataContext';
import { SmartRouter } from '@/components/routing/SmartRouter';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ui/error-boundary';

import Index from '@/pages/Index';
import Feed from '@/pages/Feed';
import BeaconsList from '@/pages/BeaconsList';
import ExpertProfile from '@/pages/ExpertProfile';
import ExpertRegistration from '@/pages/ExpertRegistration';
import ExpertDashboard from '@/pages/ExpertDashboard';
import Chat from '@/pages/Chat';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import SessionHub from '@/pages/SessionHub';
import NotFound from '@/pages/NotFound';
import AdminPanel from '@/pages/AdminPanel';
import Sanctuary from '@/pages/Sanctuary';
import SanctuaryRecover from '@/pages/SanctuaryRecover';
import SanctuaryHostRecovery from '@/pages/SanctuaryHostRecovery';
import EnhancedSanctuary from '@/pages/EnhancedSanctuary';
import Phase4Test from '@/pages/Phase4Test';
import { SessionProvider } from '@/contexts/SessionContext';

import './App.css';

const UserErrorFallback = ({ error }: { error: Error }) => (
  <div className="min-h-screen flex items-center justify-center">
    <p>Unable to load user data. Please refresh the page.</p>
  </div>
);

const DataErrorFallback = ({ error }: { error: Error }) => (
  <div className="min-h-screen flex items-center justify-center">
    <p>Unable to load application data. Please refresh the page.</p>
  </div>
);

const App: React.FC = () => {
  // Initialize i18n and other global services
  useEffect(() => {
    // Set up any additional initialization here
    document.title = 'Veilo - Anonymous Support & Guidance';
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppStateProvider>
          <UserProvider>
            <ErrorBoundary fallback={UserErrorFallback}>
              <VeiloDataProvider>
                <ErrorBoundary fallback={DataErrorFallback}>
                  <SessionProvider>
                    <SmartRouter>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/feed" element={<Feed />} />
                        <Route path="/beacons" element={<BeaconsList />} />
                        <Route path="/expert/:expertId" element={<ExpertProfile />} />
                        <Route path="/chat/:sessionId?" element={<Chat />} />
                        <Route path="/sessions" element={<SessionHub />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/register-expert" element={<ExpertRegistration />} />
                        <Route path="/expert-dashboard" element={<ExpertDashboard />} />
                        <Route path="/admin/*" element={<AdminPanel />} />
                        <Route path="/sanctuary" element={<Sanctuary />} />
            <Route path="/sanctuary/recover" element={<SanctuaryRecover />} />
            <Route path="/sanctuary/recover/:sessionId" element={<SanctuaryHostRecovery />} />
                        <Route path="/sanctuary/:sessionId" element={<EnhancedSanctuary />} />
                        <Route path="/phase4-test" element={<Phase4Test />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </SmartRouter>
                    <Toaster />
                  </SessionProvider>
                </ErrorBoundary>
              </VeiloDataProvider>
            </ErrorBoundary>
          </UserProvider>
        </AppStateProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
