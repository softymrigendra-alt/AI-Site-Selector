// White-label config — set VITE_COMPANY_NAME env var to customize
export const branding = {
  companyName: import.meta.env.VITE_COMPANY_NAME || 'EV Site Selector',
  tagline: 'AI-Powered Charging Site Selection & Revenue Forecasting',
  colors: {
    primary: '#1A2332',
    accent:  '#2563EB',
    light:   '#EFF6FF',
    success: '#16A34A',
    warning: '#D97706',
    danger:  '#DC2626',
  },
};
