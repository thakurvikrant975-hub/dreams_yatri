// Stylesheets are handled by the bundler, not by TypeScript. Next only ships
// declarations for CSS Modules (`*.module.css`), so a side-effect import of a
// plain stylesheet has no type to resolve to and editors running with
// `noUncheckedSideEffectImports` flag it. These declarations cover that case;
// the more specific `*.module.css` declarations from Next still win.
declare module "*.css";
declare module "*.scss";
declare module "*.sass";
