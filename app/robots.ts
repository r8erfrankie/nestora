import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/overview',
          '/tenants',
          '/properties',
          '/work-orders',
          '/teams',
          '/settings',
          '/tenant',
          '/contractor',
          '/select-role',
          '/landlord-onboarding',
          '/tenant-onboarding',
          '/contractor-onboarding',
          '/accept-invite',
          '/join',
          '/auth',
          '/login',
          '/sign-in',
        ],
      },
    ],
    sitemap: 'https://gonestora.app/sitemap.xml',
  };
}
