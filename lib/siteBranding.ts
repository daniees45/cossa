export type SiteBranding = {
  siteTitle: string
  siteSubtitle: string
  logoUrl: string
  lightBackground: string
  darkBackground: string
}

export type SiteBrandingRow = {
  site_title: string
  site_subtitle: string
  logo_url: string
  light_background: string
  dark_background: string
}

export const DEFAULT_SITE_BRANDING: SiteBranding = {
  siteTitle: 'COSSA',
  siteSubtitle: 'VVU CS Assoc.',
  logoUrl: '',
  lightBackground: '#f8fafc',
  darkBackground: '#020617',
}

export function brandingFromRow(row: Partial<SiteBrandingRow> | null | undefined): SiteBranding {
  if (!row) return DEFAULT_SITE_BRANDING
  return {
    siteTitle: row.site_title?.trim() || DEFAULT_SITE_BRANDING.siteTitle,
    siteSubtitle: row.site_subtitle?.trim() || DEFAULT_SITE_BRANDING.siteSubtitle,
    logoUrl: row.logo_url?.trim() || '',
    lightBackground: row.light_background || DEFAULT_SITE_BRANDING.lightBackground,
    darkBackground: row.dark_background || DEFAULT_SITE_BRANDING.darkBackground,
  }
}

export function brandingToRow(next: SiteBranding): SiteBrandingRow {
  return {
    site_title: next.siteTitle.trim() || DEFAULT_SITE_BRANDING.siteTitle,
    site_subtitle: next.siteSubtitle.trim() || DEFAULT_SITE_BRANDING.siteSubtitle,
    logo_url: next.logoUrl.trim(),
    light_background: next.lightBackground,
    dark_background: next.darkBackground,
  }
}
