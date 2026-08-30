'use client';

import { Children, createContext, Fragment, type HTMLAttributes, type ReactNode, useContext, useEffect } from 'react';
import { getLocaleDirection, type Locale, type LocaleDirection } from './config';
import { localizeDigits } from './numbers';

const NumberLocaleContext = createContext<Locale>('en');

interface LocalizedGameRootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  locale: Locale;
}

export function LocalizedGameRoot({ children, className, locale, ...props }: LocalizedGameRootProps) {
  const direction = getLocaleDirection(locale);

  useEffect(() => {
    const root = document.documentElement;
    const previousLanguage = root.lang;
    const previousDirection = root.dir;
    root.lang = locale;
    root.dir = direction;
    return () => {
      if (root.lang === locale) root.lang = previousLanguage;
      if (root.dir === direction) root.dir = previousDirection;
    };
  }, [direction, locale]);

  return (
    <NumberLocaleContext.Provider value={locale}>
      <div {...props} className={className} dir={direction} lang={locale}>
        {children}
      </div>
    </NumberLocaleContext.Provider>
  );
}

export function NumberLocaleProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  return <NumberLocaleContext.Provider value={locale}>{children}</NumberLocaleContext.Provider>;
}

export function useNumberLocale(): Locale {
  return useContext(NumberLocaleContext);
}

interface BidiValueProps {
  children: ReactNode;
  className?: string;
  direction?: LocaleDirection | 'auto';
}

export function BidiValue({ children, className, direction = 'auto' }: BidiValueProps) {
  const locale = useNumberLocale();
  const classes = ['bidi-value', direction === 'ltr' ? 'bidi-value--ltr' : '', className ?? ''].filter(Boolean).join(' ');
  return <bdi className={classes} dir={direction}>{localizeNumericChildren(children, locale)}</bdi>;
}

export interface BidiToken {
  direction?: LocaleDirection | 'auto';
  value: ReactNode;
}

interface BidiTemplateProps {
  template: string;
  values: Record<string, BidiToken | ReactNode>;
}

export function BidiTemplate({ template, values }: BidiTemplateProps) {
  return template.split(/(\{[a-zA-Z0-9_]+\})/u).map((part, index) => {
    const match = /^\{([a-zA-Z0-9_]+)\}$/u.exec(part);
    if (!match) return <Fragment key={`${index}-${part}`}>{part}</Fragment>;
    const token = values[match[1]];
    if (token === undefined) return <Fragment key={`${index}-${part}`}>{part}</Fragment>;
    const normalized = isBidiToken(token) ? token : { value: token };
    return <BidiValue direction={normalized.direction} key={`${index}-${match[1]}`}>{normalized.value}</BidiValue>;
  });
}

function isBidiToken(value: BidiToken | ReactNode): value is BidiToken {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'value' in value;
}

function localizeNumericChildren(children: ReactNode, locale: Locale): ReactNode {
  return Children.map(children, (child) => typeof child === 'string' || typeof child === 'number'
    ? localizeDigits(child, locale)
    : child);
}
