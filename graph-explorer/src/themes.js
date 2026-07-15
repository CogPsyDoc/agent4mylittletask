/**
 * Data-driven themes. A theme is only data — colors, fog, lights, bloom,
 * node palette — so adding a theme means adding an entry here, nothing else.
 */

export const THEMES = {
  deepSpace: {
    name: 'Deep Space',
    background: 0x020308,
    fog: { color: 0x020308, density: 0.0011 },
    lights: {
      hemiSky: 0x3a4a8a,
      hemiGround: 0x0a0a18,
      hemiIntensity: 0.9,
      dir: 0xaabbff,
      dirIntensity: 0.7,
    },
    stars: {
      colors: [0xffffff, 0x88aaff, 0xffd9a0, 0xa0fff2],
      count: 4500,
      twinkle: 0.55,
    },
    // Folder colors are picked from this palette by hashing the folder name.
    folderPalette: [
      0x4fc3f7, 0x81c784, 0xffb74d, 0xe57373, 0xba68c8,
      0x64b5f6, 0xaed581, 0xf06292, 0x4dd0e1, 0xfff176,
    ],
    rootFolderColor: 0x90a4ae,
    hubColor: 0xffffff,
    attachmentColor: 0x8d6e63,
    link: { color: 0x5577cc, opacity: 0.28, attachmentColor: 0x66584a },
    label: { color: '#dfe8ff', glow: 'rgba(90,130,255,0.9)' },
    bloom: { strength: 0.85, radius: 0.6, threshold: 0.18 },
    hyperTint: [0.75, 0.85, 1.0],
  },

  nebula: {
    name: 'Nebula',
    background: 0x0c0416,
    fog: { color: 0x1a0830, density: 0.0018 },
    lights: {
      hemiSky: 0x8a3aaa,
      hemiGround: 0x140428,
      hemiIntensity: 1.1,
      dir: 0xff88cc,
      dirIntensity: 0.6,
    },
    stars: {
      colors: [0xffc2f0, 0xc490ff, 0x90d4ff, 0xfff0c0],
      count: 6000,
      twinkle: 0.8,
    },
    folderPalette: [
      0xff80ab, 0xea80fc, 0xb388ff, 0x8c9eff, 0x80d8ff,
      0xa7ffeb, 0xffd180, 0xff9e80, 0xf48fb1, 0xce93d8,
    ],
    rootFolderColor: 0xb39ddb,
    hubColor: 0xfff59d,
    attachmentColor: 0x7e57c2,
    link: { color: 0xa050c0, opacity: 0.34, attachmentColor: 0x5a3a70 },
    label: { color: '#ffe6ff', glow: 'rgba(255,120,220,0.9)' },
    bloom: { strength: 1.25, radius: 0.75, threshold: 0.12 },
    hyperTint: [1.0, 0.8, 1.0],
  },
};

/** Stable folder-name → palette color. */
export function folderColor(theme, folder) {
  if (!folder) return theme.rootFolderColor;
  let h = 0;
  for (let i = 0; i < folder.length; i++) h = (h * 31 + folder.charCodeAt(i)) >>> 0;
  return theme.folderPalette[h % theme.folderPalette.length];
}

export function nodeColor(theme, node) {
  if (node.kind === 'hub') return theme.hubColor;
  if (node.kind === 'attachment') return theme.attachmentColor;
  return folderColor(theme, node.folder);
}
