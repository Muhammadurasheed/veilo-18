import React from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import HostSessionRecovery from '@/components/sanctuary/HostSessionRecovery';
import { SEOHead } from '@/components/seo/SEOHead';

const SanctuaryHostRecovery = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  
  // Get host token from URL params (recovery links)
  const urlParams = new URLSearchParams(window.location.search);
  const hostToken = urlParams.get('hostToken');

  if (!sessionId) {
    return (
      <Layout>
        <div className="container py-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Invalid Recovery Link</h1>
            <p className="text-muted-foreground">This recovery link is not valid.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead
        title="Sanctuary Host Recovery | Veilo"
        description="Recover access to your sanctuary host session"
        keywords="sanctuary recovery, host access, secure recovery"
      />
      <div className="container py-10">
        <HostSessionRecovery 
          sanctuaryId={sessionId} 
          hostToken={hostToken || undefined}
        />
      </div>
    </Layout>
  );
};

export default SanctuaryHostRecovery;