import React, { createContext, useCallback, useContext, useState } from 'react';

export type Language = 'zh' | 'en';

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  tr: (zh: string, en: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('flow-lang');
    return saved === 'en' ? 'en' : 'zh';
  });

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    localStorage.setItem('flow-lang', next);
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Language = prev === 'zh' ? 'en' : 'zh';
      localStorage.setItem('flow-lang', next);
      document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
      return next;
    });
  }, []);

  const tr = useCallback(
    (zh: string, en: string) => (lang === 'en' ? en : zh),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, tr }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: 'zh',
      setLang: () => {},
      toggleLang: () => {},
      tr: (zh: string) => zh,
    };
  }
  return ctx;
}
