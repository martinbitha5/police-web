# Design du back-office web, registre Uber

MÃªme charte que l'application mobile (`apps/mobile/src/ui/GUIDE.md`) : noir et blanc
pour la structure, un seul accent bleu qui signale, rayon 8 ou pilule, Figtree pour
les titres et Inter pour le texte. Les tokens vivent dans `app/globals.css`, les
primitives dans `src/ui/theme.ts`. Aucune page ne code une couleur en dur.

## Tokens (`app/globals.css`)

| Token | Valeur | RÃ´le |
|---|---|---|
| `--content-primary` | `#000000` | texte principal, titres, icÃ´nes |
| `--content-secondary` | `#4B4B4B` | texte secondaire, entrÃ©es de nav au repos |
| `--content-tertiary` | `#757575` | lÃ©gendes, dates, eyebrow |
| `--content-link` / `--content-link-hover` | `#0064D6` / `#004FA8` | liens |
| `--bg-screen` / `--bg-elevated` | `#FFFFFF` | fond de page, cartes, modales |
| `--bg-neutral` | `#F3F3F3` | champs, sections teintÃ©es, pied de page, pilules au repos |
| `--bg-neutral-hover` | `#E8E8E8` | boutons secondaires, entrÃ©e de nav active, piste des jauges |
| `--bg-neutral-active` | `#DCDCDC` | Ã©tat pressÃ© des aplats gris |
| `--border-neutral` | `#E2E2E2` | filet de structure (frise des Ã©tapes, bas de pied de page) |
| `--divider` | `#EEEEEE` | filet des cartes, lignes de tableau, sÃ©parateurs de sidebar |
| `--interactive-accent` (+ `-hover`, `-active`) | `#000` / `#333` / `#4B4B4B` | fond du bouton primaire |
| `--interactive-control` | `#FFFFFF` | texte du bouton primaire |
| `--interactive-primary` (+ `-hover`) | `#000` / `#333` | mÃªme encre, nom hÃ©ritÃ© |
| `--accent` / `--accent-soft` | `#0064D6` / `#EAF3FF` | icÃ´ne de nav active, point de statut, arc des jauges |
| `--positive` / `--positive-bg` | `#067647` / `#E1EFE9` | statut rÃ©ussi |
| `--negative` / `--negative-bg` | `#D3232F` / `#FAE5E6` | statut refusÃ©, Ã©cart |
| `--warning` / `--warning-bg` / `--warning-content` | `#B25E09` / `#F6ECE1` / `#975008` | statut en attente |
| `--radius-sm` Ã  `--radius-xl` | `8px` | tous les rayons ; `--radius-full` = pilule |
| `--shadow-card` | `0 0 8px rgba(0,0,0,.1), 0 4px 4px rgba(0,0,0,.04)` | cartes, barre du haut au dÃ©filement |
| `--shadow-pop` | `0 0 25px rgba(0,0,0,.1)` | modales, survol d'une tuile |
| `--font-display` / `--font-body` | Figtree / Inter | titres / texte |

`--brand-green` et `--brand-forest` valent `#000000` : ce sont des alias hÃ©ritÃ©s du thÃ¨me
prÃ©cÃ©dent, Ã  ne plus Ã©crire. Le bloc Â« alias hÃ©ritÃ©s Â» (`--bg`, `--surface`, `--text`,
`--primary`, `--brand-blue`...) n'existe que pour les styles inline pas encore nettoyÃ©s.

## Primitives (`src/ui/theme.ts`)

| Export | Quand l'utiliser |
|---|---|
| `card` | toute carte de contenu : blanc, filet `--divider`, rayon 8, `--shadow-card`, padding 20 |
| `cardTinted` | encart de mise en avant : aplat `--bg-neutral`, sans bordure ni ombre |
| `btnPrimary` | l'action principale de l'Ã©cran, une seule : pilule noire, 44 px |
| `btnSecondary` | les autres actions : pilule grise `--bg-neutral-hover`, texte noir |
| `btnGhost` | alias de `btnSecondary`, conservÃ© pour les pages existantes |
| `btnText` | lien-bouton tertiaire : transparent, texte noir soulignÃ© |
| `input` | champ : fond gris, bordure transparente, rayon 8, 44 px mini ; le focus pose un filet noir |
| `label` | libellÃ© de champ, 14 px poids 500 gris |
| `sectionHeading` | titre de section : Figtree 700, 20 px, `-0.02em`, casse normale |
| `eyebrow` | petit libellÃ© en capitales gris 12 px, quand un titre serait trop lourd |
| `badge` | pilule de statut, casse normale ; surcharger `background`/`color` avec une paire sÃ©mantique |
| `modalOverlay` / `modalPanel` | voile `rgba(0,0,0,.45)` et panneau rayon 8 sous `--shadow-pop` |
| `ROLE_COLOR` / `ROLE_LABEL` | rÃ´les des comptes : l'encre pour tous, le libellÃ© porte l'information |

## RÃ¨gles

- Noir et blanc pour la structure. Le bleu `--accent` signale (lien, Ã©tat actif, arc de
  jauge) et n'est jamais un fond de bouton. Les sÃ©mantiques indiquent un statut, jamais
  une dÃ©coration.
- Un seul bouton primaire par Ã©cran, noir. Le reste en `btnSecondary` ou `btnText`.
- Rayon 8 pour les surfaces, pilule pour les boutons auto-dimensionnÃ©s et les badges.
  Aucune autre valeur. Le bouton de connexion (`.lg-btn`) est le seul rectangle 56 px.
- Une carte est portÃ©e par `--shadow-card` et un filet `--divider`, jamais par une
  bordure foncÃ©e. Les lignes de tableau se sÃ©parent par `--divider`.
- Titres en Figtree 700, `letter-spacing: -0.02em` : 52/64 (hÃ©ros), 36/44 (section),
  20 (section du back-office). Corps Inter 16, secondaire 14. Chiffres qui changent en
  place en `tabular-nums`.
- Capitales rÃ©servÃ©es aux en-tÃªtes de tableau et aux `eyebrow`. Badges et boutons en
  casse normale.
- Pas d'emoji, pas de tiret long dans un libellÃ©, vouvoiement, pas de point
  d'exclamation. Un Ã©tat vide dÃ©crit un fait.
- Aucune couleur codÃ©e en dur dans une page : toujours un token.

## Interdits

- Ne pas renommer une variable CSS, un export de `theme.ts` ni une classe : les pages
  et les autres agents s'y accrochent.
- Ne pas toucher Ã  la mÃ©canique du dÃ©filement : les classes `.pb-full`, `.pb-icons`,
  `.pb-icon*`, `.lp-topbar`, `.app-topbar`, l'attribut `data-scrolled`, les classes
  `.rv` / `.rv-in`, `js-reveal`, `data-rv-auto` et `RevealObserver`. On en change le
  dessin (couleur, ombre), jamais le `display`, les sÃ©lecteurs ni les transitions
  d'opacitÃ© et de translation.
- Ne pas poser de `display` inline sur un Ã©lÃ©ment que ces classes doivent masquer.
