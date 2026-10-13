// One entry per scent. `css` keys become CSS variables (accent → --accent); `glow` also tints the
// 3D rim lights and the halo behind the bottle. The page background stays dark for every scent.
// All names, claims and ingredient lists are placeholders — replace with your real product data.
export const VARIANTS = {
  aloe: {
    id: 'aloe',
    no: '01',
    name: 'Aloe & Cucumber',
    claims: 'SULFATE-FREE  ·  PH 5.5',
    bottle: '#79ae8f',
    cap: '#ecebe4',
    capMetal: 0,
    label: '#f3efe6',
    labelInk: '#1d3d2c',
    labelAccent: '#3f8a60',
    glow: '#3f8a60',
    inci:
      'Aqua, Aloe Barbadensis Leaf Juice, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Glycerin, ' +
      'Avena Sativa (Oat) Kernel Flour, Cucumis Sativus (Cucumber) Fruit Extract, Sodium Chloride, ' +
      'Citric Acid, Sodium Benzoate, Parfum.',
    css: { accent: '#a8d8bb', glow: '#3f8a60' },
  },
  rose: {
    id: 'rose',
    no: '02',
    name: 'Rose & Hibiscus',
    claims: 'SULFATE-FREE  ·  PH 5.5',
    bottle: '#d68e9d',
    cap: '#f6efe9',
    capMetal: 0,
    label: '#fbf5f1',
    labelInk: '#5e1a2c',
    labelAccent: '#c4566f',
    glow: '#a8455c',
    inci:
      'Aqua, Rosa Damascena Flower Water, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Glycerin, ' +
      'Hibiscus Sabdariffa Flower Extract, Avena Sativa (Oat) Kernel Flour, Sodium Chloride, ' +
      'Citric Acid, Sodium Benzoate, Parfum.',
    css: { accent: '#f2b3c0', glow: '#a8455c' },
  },
  charcoal: {
    id: 'charcoal',
    no: '03',
    name: 'Charcoal & Mint',
    claims: 'SULFATE-FREE  ·  PH 5.5',
    bottle: '#2a2d31',
    cap: '#c8a96a',
    capMetal: 1,
    label: '#17191b',
    labelInk: '#dcc490',
    labelAccent: '#9cc7b1',
    glow: '#8a7444',
    inci:
      'Aqua, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Glycerin, Charcoal Powder, ' +
      'Mentha Piperita (Peppermint) Oil, Eucalyptus Globulus Leaf Oil, Sodium Chloride, ' +
      'Citric Acid, Sodium Benzoate, Parfum.',
    css: { accent: '#dcc490', glow: '#8a7444' },
  },
};

export const VARIANT_ORDER = ['aloe', 'rose', 'charcoal'];

export const SIZES = {
  250: { label: '250 ML  ·  8.4 FL OZ', price: '₹499', scale: 1 },
  500: { label: '500 ML  ·  16.9 FL OZ', price: '₹849', scale: 1.1 },
};
