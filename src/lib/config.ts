// Base URL of spool-api, including the /api/v1 prefix.
// Set VITE_API_URL at build time (e.g. https://api.spool.zasstech.com/api/v1).
export const API_URL = (
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:3000/api/v1`
).replace(/\/+$/, '');
