// Vitest corre en Node, no en el runtime de Next.js, así que el import
// "server-only" (que solo existe para romper el build si algo del
// servidor se cuela al cliente) se sustituye por un no-op en las pruebas.
export {};
