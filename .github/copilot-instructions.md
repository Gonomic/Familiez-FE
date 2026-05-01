# Copilot Instructions — Familiez Frontend (FE)

## Technologie
- React 18 met JSX, Vite, Material UI (MUI), React Router v6
- Geen TypeScript — puur JavaScript/JSX
- Package manager: npm

## Projectstructuur
- `src/services/` — API-communicatie: `authService.js`, `familyDataService.js`
- `src/components/` — herbruikbare componenten (bijv. `FamilyTreeCanvas.jsx`, `PersonEditForm.jsx`)
- `src/pages/` — paginacomponenten (bijv. `LoginPage.jsx`, `AuthCallback.jsx`)
- `src/constants/` — gedeelde constanten

## Authenticatie
- Auth-state beheren via `getStoredToken()` en `hasServerSession()` uit `authService.js`
- Beveiligde routes wrappen met de `<RequireAuth>` component
- Nooit zelf `Authorization` headers zetten op `<img src>` of `window.open` — dit werkt niet in browsers
- File-URL's altijd bouwen via `buildFileAccessUrl()` (voegt `?token=` toe als query-param)

## API-communicatie
- Alle backend-calls lopen via functies in `familyDataService.js` of `authService.js`
- Geen directe `fetch`/`axios` calls in componenten — gebruik de servicelaag
- Basis-URL via Vite env-variabele (`import.meta.env.VITE_API_URL`)

## Conventies
- Componentnamen in PascalCase, bestanden matchen de componentnaam
- Gebruik MUI-componenten (`Alert`, `Snackbar`, `Drawer`, etc.) — geen eigen CSS-framework
- `useEffect`-cleanups altijd implementeren (bijv. `isMounted`-vlag) om memory leaks te voorkomen

## Testen
- Testbestanden staan in `src/test/`
- Gebruik Vitest (via Vite)
