import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../api/client';

export interface BrandingData {
  acronym: string;
  display_name: string;
  legal_name: string;
  system_name: string;
  tagline: string;
  logo_url: string;
}

const DEFAULT_BRANDING: BrandingData = {
  acronym: 'PTS',
  display_name: 'Police Training School Rawat',
  legal_name: 'Police Training School, Rawat — Rawalpindi',
  system_name: 'Biometric Attendance Management System',
  tagline: 'Train to Serve',
  logo_url: '',
};

interface BrandingContextType {
  branding: BrandingData;
  loading: boolean;
  updateBranding: (data: Partial<BrandingData>) => void;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      if (res.data?.success && res.data?.data?.branding) {
        setBranding(prev => ({
          ...prev,
          ...res.data.data.branding,
        }));
      }
    } catch (err) {
      console.warn('Failed to load branding settings, using defaults', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  // Update document title and favicon dynamically
  useEffect(() => {
    if (branding.display_name) {
      document.title = `${branding.display_name} — ${branding.system_name || 'Biometric System'}`;
    }
    if (branding.logo_url) {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = branding.logo_url;
      }
    }
  }, [branding.display_name, branding.system_name, branding.logo_url]);

  const updateBranding = (data: Partial<BrandingData>) => {
    setBranding(prev => ({
      ...prev,
      ...data,
    }));
  };

  return (
    <BrandingContext.Provider value={{ branding, loading, updateBranding, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
