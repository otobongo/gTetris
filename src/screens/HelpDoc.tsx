import { Screen, TopBar } from '../shared/ui';

/** Stub: the screens builder replaces this with the HelpDoc board (Terms of use and Privacy policy share it). */
export default function HelpDoc({ page }: { page: 'terms' | 'privacy' }) {
  return (
    <Screen>
      <TopBar title={page === 'terms' ? 'Terms of use' : 'Privacy policy'} subtitle="For grown-ups" back="/help" backLabel="Back to Support" />
    </Screen>
  );
}
