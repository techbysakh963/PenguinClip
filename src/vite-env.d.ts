/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// @fontsource packages ship CSS for a side-effect import but no type declarations.
declare module '@fontsource-variable/inter'
