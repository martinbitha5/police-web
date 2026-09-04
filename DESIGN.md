# Design du back-office web, registre Uber

Même charte que l'application mobile (`apps/mobile/src/ui/GUIDE.md`) : noir et blanc
pour la structure, un seul accent bleu qui signale, rayon 8 ou pilule, Figtree pour
les titres et Inter pour le texte. Les tokens vivent dans `app/globals.css`, les
primitives dans `src/ui/theme.ts`. Aucune page ne code une couleur en dur.

## Tokens (`app/globals.css`)

| Token | Valeur | Rôle |
|---|---|---|
| `--content-primary` | `#000000` | texte principal, titres, icônes |
| `--content-secondary` | `#4B4B4B` | texte secondaire, entrées de nav au repos |
| `--content-tertiary` | `#757575` | légendes, dates, eyebrow |
| `--content-link` / `--content-link-hover` | `#0064D6` / `#004FA8` | liens |
| `--bg-screen` / `--bg-elevated` | `#FFFFFF` | fond de page, cartes, modales |
| `--bg-neutral` | `#F3F3F3` | champs, sections teintées, pied de page, pilules au repos |
| `--bg-neutral-hover` | `#E8E8E8` | boutons secondaires, entrée de nav active, piste des jauges |
| `--bg-neutral-active` | `#DCDCDC` | état pressé des aplats gris |
| `--border-neutral` | `#E2E2E2` | filet de structure (frise des étapes, bas de pied de page) |
| `--divider` | `#EEEEEE` | filet des cartes, lignes de tableau, séparateurs de sidebar |
| `--interactive-accent` (+ `-hover`, `-active`) | `#000` / `#333` / `#4B4B4B` | fond du bouton primaire |
| `--interactive-control` | `#FFFFFF` | texte du bouton primaire |
| `--interactive-primary` (+ `-hover`) | `#000` / `#333` | même encre, nom hérité |
| `--accent` / `--accent-soft` | `#0064D6` / `#EAF3FF` | icône de nav active, point de statut, arc des jauges |
| `--positive` / `--positive-bg` | `#067647` / `#E1EFE9` | statut réussi |
| `--negative` / `--negative-bg` | `#D3232F` / `#FAE5E6` | statut refusé, écart |
| `--warning` / `--warning-bg` / `--warning-content` | `#B25E09` / `#F6ECE1` / `#975008` | statut en attente |
| `--radius-sm` à `--radius-xl` | `8px` | tous les rayons ; `--radius-full` = pilule |
| `--shadow-card` | `0 0 8px rgba(0,0,0,.1), 0 4px 4px rgba(0,0,0,.04)` | cartes, barre du haut au défilement |
| `--shadow-pop` | `0 0 25px rgba(0,0,0,.1)` | modales, survol d'une tuile |
| `--font-display` / `--font-body` | Figtree / Inter | titres / texte |

`--brand-green` et `--brand-forest` valent `#000000` : ce sont des alias hérités du thème
précédent, à ne plus écrire. Le bloc « alias hérités » (`--bg`, `--surface`, `--text`,
`--primary`, `--brand-blue`...) n'existe que pour les styles inline pas encore nettoyés.

## Primitives (`src/ui/theme.ts`)

| Export | Quand l'utiliser |
|---|---|
| `card` | toute carte de contenu : blanc, filet `--divider`, rayon 8, `--shadow-card`, padding 20 |
| `cardTinted` | encart de mise en avant : aplat `--bg-neutral`, sans bordure ni ombre |
| `btnPrimary` | l'action principale de l'écran, une seule : pilule noire, 44 px |
| `btnSecondary` | les autres actions : pilule grise `--bg-neutral-hover`, texte noir |
| `btnGhost` | alias de `btnSecondary`, conservé pour les pages existantes |
| `btnText` | lien-bouton tertiaire : transparent, texte noir souligné |
| `input` | champ : fond gris, bordure transparente, rayon 8, 44 px mini ; le focus pose un filet noir |
| `label` | libellé de champ, 14 px poids 500 gris |
| `sectionHeading` | titre de section : Figtree 700, 20 px, `-0.02em`, casse normale |
| `eyebrow` | petit libellé en capitales gris 12 px, quand un titre serait trop lourd |
| `badge` | pilule de statut, casse normale ; surcharger `background`/`color` avec une paire sémantique |
| `modalOverlay` / `modalPanel` | voile `rgba(0,0,0,.45)` et panneau rayon 8 sous `--shadow-pop` |
| `ROLE_COLOR` / `ROLE_LABEL` | rôles des comptes : l'encre pour tous, le libellé porte l'information |

## Règles

- Noir et blanc pour la structure. Le bleu `--accent` signale (lien, état actif, arc de
  jauge) et n'est jamais un fond de bouton. Les sémantiques indiquent un statut, jamais
  une décoration.
- Un seul bouton primaire par écran, noir. Le reste en `btnSecondary` ou `btnText`.
- Rayon 8 pour les surfaces, pilule pour les boutons auto-dimensionnés et les badges.
  Aucune autre valeur. Le bouton de connexion (`.lg-btn`) est le seul rectangle 56 px.
- Une carte est portée par `--shadow-card` et un filet `--divider`, jamais par une
  bordure foncée. Les lignes de tableau se séparent par `--divider`.
- Titres en Figtree 700, `letter-spacing: -0.02em` : 52/64 (héros), 36/44 (section),
  20 (section du back-office). Corps Inter 16, secondaire 14. Chiffres qui changent en
  place en `tabular-nums`.
- Capitales réservées aux en-têtes de tableau et aux `eyebrow`. Badges et boutons en
  casse normale.
- Pas d'emoji, pas de tiret long dans un libellé, vouvoiement, pas de point
  d'exclamation. Un état vide décrit un fait.
- Aucune couleur codée en dur dans une page : toujours un token.

## Interdits

- Ne pas renommer une variable CSS, un export de `theme.ts` ni une classe : les pages
  et les autres agents s'y accrochent.
- Ne pas toucher à la mécanique du défilement : les classes `.pb-full`, `.pb-icons`,
  `.pb-icon*`, `.lp-topbar`, `.app-topbar`, l'attribut `data-scrolled`, les classes
  `.rv` / `.rv-in`, `js-reveal`, `data-rv-auto` et `RevealObserver`. On en change le
  dessin (couleur, ombre), jamais le `display`, les sélecteurs ni les transitions
  d'opacité et de translation.
- Ne pas poser de `display` inline sur un élément que ces classes doivent masquer.
