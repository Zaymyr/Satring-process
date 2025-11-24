import type { Route } from 'next';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export type NavigationLink = {
  href: Route;
  labelKey: keyof Dictionary['header']['navigation']['links'];
};

export const NAVIGATION_LINKS = [
  { href: '/', labelKey: 'home' },
  { href: '/raci', labelKey: 'raci' },
  { href: '/job-descriptions', labelKey: 'jobDescriptions' },
  { href: '/administration', labelKey: 'administration' }
] satisfies NavigationLink[];
