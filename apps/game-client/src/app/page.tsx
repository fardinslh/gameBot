import { GameShell } from '@/components/game-shell';
import { getDictionary, normalizeLocale } from '@/i18n/config';

interface HomePageProps {
  searchParams: Promise<{ lang?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const locale = normalizeLocale(Array.isArray(params.lang) ? params.lang[0] : params.lang);
  const dictionary = getDictionary(locale);

  return <GameShell locale={locale} dictionary={dictionary} />;
}
