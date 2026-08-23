import type { Dictionary, Locale } from '@/i18n/config';
import { KingdomPage } from '@/features/kingdom/components/kingdom-page';

interface GameShellProps {
  locale: Locale;
  dictionary: Dictionary;
}

export function GameShell({ locale, dictionary }: GameShellProps) {
  return <KingdomPage locale={locale} dictionary={dictionary} />;
}
