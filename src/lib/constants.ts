export const PRODUCT_TYPES = ['Tehla', 'Pásik', 'Rohovka'] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

export const PRODUCT_COLORS = [
  'Červená', 
  'Biela', 
  'Čierna', 
  'Hnedá', 
  'Béžová', 
  'Sivá', 
  'Žltá', 
  'Multicolor'
] as const;
export type ProductColor = typeof PRODUCT_COLORS[number];

export const PRODUCT_SURFACES = [
  'Hladký', 
  'Rustikálny', 
  'Pieskovaný', 
  'Rýhovaný', 
  'Štruktúrovaný'
] as const;
export type ProductSurface = typeof PRODUCT_SURFACES[number];

// Unikátne hodnoty Výrobcov vyextrahované priamo zo zdrojového CSV
export const PRODUCT_MANUFACTURERS = [
  'ABC Klinker',
  'Caprice',
  'Feldhaus Accudo',
  'Feldhaus Bacco',
  'Feldhaus Carbona',
  'Feldhaus Classic',
  'Feldhaus Galena',
  'Feldhaus Romero',
  'Feldhaus Sintra',
  'Feldhaus Vario',
  'Feldhaus Vascu',
  'Muhr Emmerich',
  'Muhr Lichterfeld',
  'Nelissen',
  'Rodruza',
  'S.Anselmo',
  'TERCA',
  'TERCA - B - OUT',
  'TERCA - BRICKER',
  'TERCA - OUT'
] as const;
export type ProductManufacturer = typeof PRODUCT_MANUFACTURERS[number];

export const FABRICK_CATEGORIES = ['Premium', 'Standard', 'Economy', 'Exclusive'] as const;
export type FabrickCategory = typeof FABRICK_CATEGORIES[number];

export const PRICE_LEVELS = ['Nízka', 'Stredná', 'Vysoká'] as const;
export type PriceLevel = typeof PRICE_LEVELS[number];
