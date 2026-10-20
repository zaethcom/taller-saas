/**
 * Qué impresora recibe cada trabajo. La traducción vive en
 * estacion/resolver.ts (la comparten la estación y la web, que la usa
 * para la app del puente con ?formato=bytes); este archivo queda para
 * no romper a quien ya lo importaba.
 */
export { resolverImpresion, type TrabajoPendiente } from "./resolver";
