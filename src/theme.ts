// A copy of the host's MUI theme (cytoscape-web/src/theme.ts — palettes,
// typography, and the component overrides relevant to this app's dialog).
// The dialog renders in the app's own React root (see dialogHost.tsx), and
// React context does not cross roots, so the host's CssVarsProvider cannot
// reach it — the copy is unavoidable and can drift if the host theme
// changes.
//
// Two things make the copy behave like the real thing:
//
//  - `cssVarPrefix: 'psicquic'`: both roots share the host's Emotion cache
//    (the @emotion/react singleton), so a second provider emitting the
//    default `--mui-*` variables would override the HOST's palette
//    document-wide. A unique prefix keeps our variables to ourselves.
//
//  - CSS-variable themes switch scheme via the `data-mui-color-scheme`
//    attribute on <html>, whose name is independent of the prefix. The
//    host's provider owns that attribute; our dark stylesheet keys off the
//    same attribute, so this root follows the host's light/dark toggle
//    automatically, with no mode-syncing code.
import { experimental_extendTheme as extendTheme } from '@mui/material'

const lightPalette = {
  primary: {
    main: '#3c7ab2',
    light: '#a5ccef',
    dark: '#264d6f',
  },
  secondary: {
    main: '#ea9123',
    light: '#f5c891',
    dark: '#754912',
  },
  background: {
    default: '#f5f5f5',
    paper: '#ffffff',
  },
  action: {
    hover: 'rgba(31, 120, 180, 0.1)',
    selected: 'rgba(31, 120, 180, 0.2)',
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.9)',
    secondary: 'rgba(0, 0, 0, 0.6)',
    disabled: 'rgba(0, 0, 0, 0.25)',
  },
}

const darkPalette = {
  primary: {
    main: '#3a88fe',
    light: '#a7c1de',
  },
  secondary: {
    main: '#3a88fe',
  },
  background: {
    default: '#1e1e1e',
    paper: '#252525',
  },
  action: {
    hover: 'rgba(167, 193, 222, 0.1)',
    selected: 'rgba(167, 193, 222, 0.2)',
  },
  divider: 'rgba(116, 116, 116, 0.4)',
  text: {
    primary: '#d5d5d5',
    secondary: 'rgba(255, 255, 255, 0.5)',
    disabled: 'rgba(255, 255, 255, 0.25)',
  },
}

export const psicquicTheme = extendTheme({
  cssVarPrefix: 'psicquic',
  colorSchemes: {
    light: { palette: lightPalette },
    dark: { palette: darkPalette },
  },
  typography: {
    fontFamily: 'Open Sans, Helvetica Neue, Helvetica, sans-serif',
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#3a88fe',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
  },
})
