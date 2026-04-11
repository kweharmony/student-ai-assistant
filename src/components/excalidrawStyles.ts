/**
 * CSS overrides for Excalidraw to match the site's design.
 * Inject via <style>{excalidrawStyles}</style> inside the canvas container.
 */
const excalidrawStyles = `
  /* ── Font & accent ── */
  .excalidraw {
    --color-primary: #82AA82;
    --color-primary-darker: #6a9470;
    --color-primary-darkest: #527a5a;
    --color-primary-light: rgba(130,170,130,0.18);
    --default-font-family: Georgia, "Times New Roman", serif;
    font-family: Georgia, "Times New Roman", serif !important;
  }

  /* ── Light theme ── */
  .excalidraw.theme--light {
    --color-surface-primary: #fffff0;
    --color-surface-secondary: #f5f3e8;
    --color-surface-tertiary: #ede9d8;
    --color-surface-low: #f8f7ef;
    --color-surface-mid: #e8e5d5;
    --color-surface-high: #d8d4c5;
    --color-text-primary: #44292b;
    --color-text-secondary: #7a5a5c;
    --color-icon-fill: rgba(68,41,43,0.75);
    --color-icon-fill-muted: rgba(68,41,43,0.4);
    --island-shadow: 0 4px 20px rgba(68,41,43,0.12);
    background: #fffff0;
  }

  /* ── Dark theme ── */
  .excalidraw.theme--dark {
    --color-surface-primary: #1f1516;
    --color-surface-secondary: #2a1d1e;
    --color-surface-tertiary: #352426;
    --color-surface-low: #261a1b;
    --color-surface-mid: #3a2a2b;
    --color-surface-high: #4a3738;
    --color-text-primary: #fffff0;
    --color-text-secondary: #c8c8b0;
    --color-icon-fill: rgba(255,255,240,0.8);
    --color-icon-fill-muted: rgba(255,255,240,0.4);
    --island-shadow: 0 4px 20px rgba(0,0,0,0.4);
    background: #1f1516;
  }

  /* ── Toolbar & Islands ── */
  .excalidraw .App-toolbar,
  .excalidraw .Island {
    border-radius: 12px !important;
    box-shadow: var(--island-shadow) !important;
    font-family: Georgia, serif !important;
  }
  .excalidraw.theme--light .App-toolbar,
  .excalidraw.theme--light .Island {
    background: #fffff0 !important;
    border: 1px solid rgba(68,41,43,0.12) !important;
  }
  .excalidraw.theme--dark .App-toolbar,
  .excalidraw.theme--dark .Island {
    background: #2a1d1e !important;
    border: 1px solid rgba(255,255,240,0.08) !important;
  }

  /* ── Toolbar buttons ── */
  .excalidraw .ToolIcon_type_button,
  .excalidraw .ToolIcon__keybinding {
    border-radius: 8px !important;
    font-family: Georgia, serif !important;
    transition: background 0.15s !important;
  }
  .excalidraw.theme--light .ToolIcon_type_button:hover,
  .excalidraw.theme--light .ToolIcon_type_button.active,
  .excalidraw.theme--light .ToolIcon_type_button--selected {
    background: rgba(68,41,43,0.07) !important;
  }
  .excalidraw.theme--dark .ToolIcon_type_button:hover,
  .excalidraw.theme--dark .ToolIcon_type_button.active,
  .excalidraw.theme--dark .ToolIcon_type_button--selected {
    background: rgba(255,255,240,0.07) !important;
  }

  /* ── Context menu / popover ── */
  .excalidraw .context-menu,
  .excalidraw .popover {
    border-radius: 10px !important;
    font-family: Georgia, serif !important;
    font-size: 13px !important;
  }
  .excalidraw.theme--light .context-menu,
  .excalidraw.theme--light .popover {
    background: #fffff0 !important;
    border: 1px solid rgba(68,41,43,0.12) !important;
    box-shadow: 0 8px 24px rgba(68,41,43,0.12) !important;
  }
  .excalidraw.theme--dark .context-menu,
  .excalidraw.theme--dark .popover {
    background: #2a1d1e !important;
    border: 1px solid rgba(255,255,240,0.08) !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
  }

  /* ── Modals ── */
  .excalidraw .Modal__background { border-radius: 16px !important; }
  .excalidraw.theme--light .Modal__background {
    background: #fffff0 !important;
    border: 1px solid rgba(68,41,43,0.12) !important;
  }
  .excalidraw.theme--dark .Modal__background {
    background: #1f1516 !important;
    border: 1px solid rgba(255,255,240,0.08) !important;
  }

  /* ── Inputs ── */
  .excalidraw input, .excalidraw textarea, .excalidraw select {
    border-radius: 8px !important;
    font-family: Georgia, serif !important;
    font-size: 13px !important;
  }
  .excalidraw.theme--light input, .excalidraw.theme--light textarea {
    background: #f5f3e8 !important;
    border-color: rgba(68,41,43,0.2) !important;
    color: #44292b !important;
  }
  .excalidraw.theme--dark input, .excalidraw.theme--dark textarea {
    background: #2a1d1e !important;
    border-color: rgba(255,255,240,0.1) !important;
    color: #fffff0 !important;
  }

  /* ── Scrollbars ── */
  .excalidraw ::-webkit-scrollbar { width: 6px; height: 6px; }
  .excalidraw.theme--light ::-webkit-scrollbar-thumb { background: rgba(68,41,43,0.2); border-radius: 3px; }
  .excalidraw.theme--dark ::-webkit-scrollbar-thumb { background: rgba(255,255,240,0.15); border-radius: 3px; }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .excalidraw .App-toolbar { border-radius: 16px !important; padding: 4px 8px !important; }
    .excalidraw .ToolIcon_type_button { min-width: 36px !important; min-height: 36px !important; }
    .excalidraw .layer-ui__wrapper__footer-right { bottom: 70px !important; }
  }

  /* ── Hide hamburger / main menu button ── */
  .excalidraw .App-menu_top__left,
  .excalidraw .hamburger-menu,
  .excalidraw .App-menu__burger,
  .excalidraw [aria-label="Menu"],
  .excalidraw [aria-label="Меню"],
  .excalidraw [title="Menu"],
  .excalidraw [title="Меню"] { display: none !important; }

  /* ── Hide library toolbar button (we use our own panel button) ── */
  .excalidraw .ToolIcon__library,
  .excalidraw [title="Library"],
  .excalidraw [title="Библиотека"],
  .excalidraw [aria-label="Library"],
  .excalidraw [aria-label="Библиотека"],
  .excalidraw [data-testid="toolbar-library"] { display: none !important; }
`;

export default excalidrawStyles;
