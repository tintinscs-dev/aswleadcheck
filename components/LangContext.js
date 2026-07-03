'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TRANSLATIONS, tLang } from '../lib/i18n';

const LangContext = createContext({ lang: 'vi', setLang: () => {}, t: k => k });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('vi');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_lang');
      if (saved === 'en' || saved === 'vi') setLangState(saved);
    } catch (e) {}
  }, []);

  const setLang = useCallback(l => {
    setLangState(l);
    try { localStorage.setItem('app_lang', l); } catch (e) {}
  }, []);

  const t = useCallback(key => tLang(lang, key), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() { return useContext(LangContext); }
