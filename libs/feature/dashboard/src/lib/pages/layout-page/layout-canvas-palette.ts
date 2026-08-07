export interface LayoutCanvasPalette {
  readonly grid: string;
  readonly labelText: string;
  readonly tableFill: string;
  readonly containerFill: string;
  readonly itemText: string;
  readonly itemBorder: string;
  readonly selection: string;
  readonly selectionAnchor: string;
  readonly link: string;
  readonly expiredFill: string;
  readonly expiredText: string;
  readonly tomorrowFill: string;
  readonly tomorrowText: string;
  readonly note: string;
  readonly noteText: string;
  readonly linkNeutral: string;
  readonly linkSuccess: string;
  readonly linkDanger: string;
  readonly linkLabelText: string;
}

const LIGHT_LAYOUT_CANVAS_PALETTE: LayoutCanvasPalette = {
  grid: '#e2e8f0',
  labelText: '#1e293b',
  tableFill: '#dbeafe',
  containerFill: '#f1f5f9',
  itemText: '#0f172a',
  itemBorder: '#94a3b8',
  selection: '#2563eb',
  selectionAnchor: '#dbeafe',
  link: '#94a3b8',
  expiredFill: '#fee2e2',
  expiredText: '#7f1d1d',
  tomorrowFill: '#fef3c7',
  tomorrowText: '#78350f',
  note: '#f59e0b',
  noteText: '#ffffff',
  linkNeutral: '#f59e0b',
  linkSuccess: '#16a34a',
  linkDanger: '#dc2626',
  linkLabelText: '#ffffff',
};

const DARK_LAYOUT_CANVAS_PALETTE: LayoutCanvasPalette = {
  grid: '#273142',
  labelText: '#cbd5e1',
  tableFill: '#1e344d',
  containerFill: '#202936',
  itemText: '#dbe4ef',
  itemBorder: '#64748b',
  selection: '#60a5fa',
  selectionAnchor: '#1e3a5f',
  link: '#64748b',
  expiredFill: '#4a2529',
  expiredText: '#fecaca',
  tomorrowFill: '#4a3b1d',
  tomorrowText: '#fde68a',
  note: '#b7791f',
  noteText: '#fff7ed',
  linkNeutral: '#d19a3c',
  linkSuccess: '#4caf74',
  linkDanger: '#e57373',
  linkLabelText: '#ffffff',
};

export function layoutCanvasPalette(darkMode: boolean): LayoutCanvasPalette {
  return darkMode ? DARK_LAYOUT_CANVAS_PALETTE : LIGHT_LAYOUT_CANVAS_PALETTE;
}
