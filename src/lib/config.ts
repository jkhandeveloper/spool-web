// Base URL of spool-api, including the /api/v1 prefix.
// Set VITE_API_URL at build time (e.g. https://api.spool.zasstech.com/api/v1).
const configuredUrl = import.meta.env.VITE_API_URL;
const productionUrl = 'https://api.spool.zasstech.com/api/v1';
const isProductionHost = window.location.hostname === 'web.spool.zasstech.com';

export const API_URL = (isProductionHost ? productionUrl : configuredUrl ?? `${window.location.protocol}//${window.location.hostname}:3000/api/v1`).replace(/\/+$/, '');
