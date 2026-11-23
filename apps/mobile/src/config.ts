import { Platform } from 'react-native';

/**
 * API URL za razvoj.
 * Android emulator vidi host mašinu na 10.0.2.2, iOS simulator na localhost.
 * Produkcijski URL dolazi uz release konfiguraciju (Sprint 8).
 */
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_URL = `http://${DEV_HOST}:3001`;

/**
 * Javni web URL za pravne stranice (Play listing traži URL politike privatnosti).
 * Placeholder do finalnog domena — zamijeniti prije objave (vidi `docs/PLAY_RELEASE.md`).
 */
export const WEB_URL = 'https://digitalni-asistent.ba';

export const PRIVACY_URL = `${WEB_URL}/privacy`;
export const TERMS_URL = `${WEB_URL}/terms`;
