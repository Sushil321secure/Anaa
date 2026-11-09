import { brandPaths } from './brandIcons.js';
// Small inline SVG icon set (decorative; always aria-hidden).
const paths = {
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7',
  users: 'M16 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0M5 20c0-3 3-5 8-5s8 2 8 5M7 9a2.5 2.5 0 1 0-4 0',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21c0-4 3.5-6 8-6s8 2 8 6',
  dumbbell: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  video: 'M3 7h12v10H3zM15 11l6-3v8l-6-3',
  book: 'M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-7a3 3 0 0 0-3 3',
  check: 'M5 12l5 5 9-10',
  play: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M10 8.5l5 3.5-5 3.5z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M6 9l6 6 6-6',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  file: 'M7 3h7l4 4v14H7zM14 3v4h4M9 13h6M9 17h6',
  gift: 'M4 11h16v9H4zM3 8h18v3H3zM12 8v12M12 8c-3 0-4-4-1-4 2 0 2 3 1 4zM12 8c3 0 4-4 1-4-2 0-2 3-1 4z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12l2-1-1-3-2 .5a7 7 0 0 0-1.5-1.5L17 4l-3-1-1 2a7 7 0 0 0-2 0L10 3 7 4l.5 2.5A7 7 0 0 0 6 8l-2-.5-1 3 2 1a7 7 0 0 0 0 2l-2 1 1 3 2-.5a7 7 0 0 0 1.5 1.5L7 20l3 1 1-2a7 7 0 0 0 2 0l1 2 3-1-.5-2.5A7 7 0 0 0 18 16l2 .5 1-3-2-1a7 7 0 0 0 0-1',
  logout: 'M10 4H5v16h5M16 8l4 4-4 4M20 12H9',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  plus: 'M12 5v14M5 12h14',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  flip: 'M4 8h13l-3-3M20 16H7l3 3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  package: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  stethoscope: 'M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-1M20 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
};

export default function Icon({ name, size = 22 }) {
  if (brandPaths[name]) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <path d={brandPaths[name]} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
