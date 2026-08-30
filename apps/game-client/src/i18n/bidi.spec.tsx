import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BidiTemplate, BidiValue, LocalizedGameRoot, NumberLocaleProvider } from './bidi';
import { getLocaleDirection } from './config';
import { fa } from './messages/fa';
import { parseLocalizedInteger } from './numbers';

describe('locale direction', () => {
  it('maps Persian to RTL and English to LTR', () => {
    expect(getLocaleDirection('fa')).toBe('rtl');
    expect(getLocaleDirection('en')).toBe('ltr');
  });

  it('renders Persian numerals while preserving isolated left-to-right numeric runs', () => {
    const html = renderToStaticMarkup(
      <NumberLocaleProvider locale="fa"><BidiValue direction="ltr">+12,500 · 03:07 · 18%</BidiValue></NumberLocaleProvider>,
    );
    expect(html).toContain('+۱۲,۵۰۰ · ۰۳:۰۷ · ۱۸%');
    expect(html).toContain('dir="ltr"');
  });

  it('parses Persian and Arabic-Indic quantity input without changing authority', () => {
    expect(parseLocalizedInteger('۲۵')).toBe(25);
    expect(parseLocalizedInteger('١٢')).toBe(12);
    expect(parseLocalizedInteger('12')).toBe(12);
    expect(parseLocalizedInteger('12x')).toBeNull();
  });

  it('places semantic language and direction on the game root', () => {
    const persian = renderToStaticMarkup(<LocalizedGameRoot locale="fa">پادشاهی</LocalizedGameRoot>);
    const english = renderToStaticMarkup(<LocalizedGameRoot locale="en">Kingdom</LocalizedGameRoot>);
    expect(persian).toContain('lang="fa"');
    expect(persian).toContain('dir="rtl"');
    expect(english).toContain('lang="en"');
    expect(english).toContain('dir="ltr"');
  });
});

describe('mixed-direction values', () => {
  it('isolates external names and numeric tokens with semantic bdi elements', () => {
    const markup = renderToStaticMarkup(
      <p dir="rtl">
        فرمانروا <BidiValue>Old_King-77</BidiValue> امتیاز <BidiValue direction="ltr">+18</BidiValue> گرفت.
      </p>,
    );
    expect(markup).toContain('<p dir="rtl">');
    expect(markup).toContain('<bdi class="bidi-value" dir="auto">Old_King-77</bdi>');
    expect(markup).toContain('<bdi class="bidi-value bidi-value--ltr" dir="ltr">+18</bdi>');
  });

  it('keeps localized sentence punctuation outside isolated placeholders', () => {
    const markup = renderToStaticMarkup(
      <p dir="rtl"><BidiTemplate template="بخش {section} تا {count} دقیقهٔ دیگر باز می‌شود." values={{ section: 'Raid', count: { direction: 'ltr', value: 15 } }} /></p>,
    );
    expect(markup).toContain('dir="auto">Raid</bdi>');
    expect(markup).toContain('dir="ltr">15</bdi> دقیقهٔ دیگر باز می‌شود.');
  });

  it('keeps Persian narrative and error copy terminal punctuation explicit', () => {
    const prose = [
      fa.comingSoonMessage,
      fa.kingdomLoadError,
      ...Object.values(fa.experience.sections).map((section) => section.body),
      ...Object.values(fa.economyErrors),
      ...Object.values(fa.heroErrors),
      ...Object.values(fa.raidErrors),
    ];
    expect(prose.every((line) => /[.؟…]$/u.test(line))).toBe(true);
  });
});
