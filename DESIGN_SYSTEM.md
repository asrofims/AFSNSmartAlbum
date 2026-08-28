# AFSNSmartAlbum — Design System

## Product Character

AFSNSmartAlbum is professional desktop creative software, not a generic SaaS dashboard.

Design goals:
- modern
- professional
- photo-first
- focused
- efficient
- calm
- predictable

## Avoid
- excessive cards
- excessive rounded corners
- excessive gradients
- random colors
- decorative UI without purpose
- oversized controls
- unnecessary dialogs
- generic dashboard patterns

## Workspace

Preferred structure:

```text
┌──────────────────────────────────────────────┐
│ Toolbar                                      │
├──────────────┬──────────────────┬────────────┤
│ Photo        │                  │ Properties │
│ Library      │     Canvas       │ / Settings │
│              │                  │            │
├──────────────┴──────────────────┴────────────┤
│ Status / Pages / Navigation                  │
└──────────────────────────────────────────────┘
```

## Design Tokens

Use centralized tokens for:
- colors
- typography
- spacing
- radius
- borders
- shadows
- focus states

Suggested spacing scale:
4 / 8 / 12 / 16 / 24 / 32

Do not invent random values unless there is a clear reason.

## Components

Prefer reusable:
- Button
- IconButton
- Toolbar
- Panel
- PanelHeader
- Input
- NumberInput
- UnitInput
- Select
- ColorPicker
- Dialog
- Tabs
- Tooltip
- ContextMenu
- StatusBar

## Interaction

Support desktop-first:
- mouse
- keyboard
- keyboard shortcuts
- drag & drop
- context menu

Icon-only controls need tooltips or accessible labels.

## Themes

Dark workspace should be prioritized. Light mode can be supported through shared tokens.

## About Panel

Provide:
Help → About AFSNSmartAlbum

It should show:
- AFSNSmartAlbum
- Professional Photo Album Layout Software
- application version
- build number
- platform
- license information
- credits
- open-source acknowledgements

Version/build must come from application configuration, not repeated hard-coded strings.
