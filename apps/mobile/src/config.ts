import { Platform } from 'react-native';

import appConfig from './app-config.json';

/**
 * API URL dolazi iz `src/app-config.json`, koji se generiše iz `DA_API_URL`
 * (`scripts/set-api-url.mjs`). Bez konfiguracije radi razvojni URL: Android emulator
 * vidi host mašinu na 10.0.2.2, iOS simulator na localhost.
 */
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const DEV_API_URL = `http://${DEV_HOST}:3001`;
const DEFAULT_WEB_URL = 'https://digitalni-asistent.ba';

/** Uklanja završne kose crte i prazan string zamjenjuje podrazumijevanom vrijednošću. */
export function normalizeUrl(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim();
  return (trimmed || fallback).replace(/\/+$/, '');
}

export const API_URL = normalizeUrl(appConfig.apiUrl, DEV_API_URL);
export const WEB_URL = normalizeUrl(appConfig.webUrl, DEFAULT_WEB_URL);

/**
 * Release ne smije da završi sa emulator/lokalnim URL-om: telefon tada ne vidi API.
 * Debug buildovi ostaju fleksibilni (LAN/staging), release mora https (cleartext je isključen).
 */
export const IS_DEV_API_URL = /^http:\/\/(10\.0\.2\.2|localhost)(?::|\/|$)/.test(API_URL);

if (!__DEV__ && IS_DEV_API_URL) {
  throw new Error(
    'API_URL nije konfigurisan za release build: postavi DA_API_URL i pokreni scripts/set-api-url.mjs.',
  );
}

export const PRIVACY_URL = `${WEB_URL}/privacy`;
export const TERMS_URL = `${WEB_URL}/terms`;
