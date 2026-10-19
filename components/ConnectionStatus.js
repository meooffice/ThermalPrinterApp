// components/itemIcon.js
// Material icon name for a catalog item (display only, nothing is stored).
// Same matching rules as itemEmoji() in services/ItemModel.js: item name first, then its type.
const ICON_RULES = [
  [/shoe|sandal|chappal|boot/i, 'shoe-sneaker'],
  [/sock/i, 'foot-print'],
  [/bag|kit\b/i, 'bag-personal-outline'],
  [/note\s*book|notebook|long\s*book|exercise|copy|ruled/i, 'notebook-outline'],
  [/dictionar/i, 'book-alphabet'],
  [/atlas|map/i, 'map-outline'],
  [/geometry|compass|scale|ruler/i, 'ruler-square-compass'],
  [/pencil|pen\b|crayon|color|colour/i, 'lead-pencil'],
  [/uniform|shirt|dress/i, 'tshirt-crew-outline'],
  [/pant|trouser|short/i, 'hanger'],
  [/skirt|frock|pinafore/i, 'hanger'],
  [/tie\b|belt/i, 'tie'],
  [/sweater|jacket/i, 'tshirt-crew-outline'],
  [/cap\b|hat/i, 'hat-fedora'],
  [/bottle|tiffin|lunch/i, 'food-variant'],
  [/hs\s*text|high\s*school/i, 'book-multiple-outline'],
  [/text\s*book|textbook|\btb\b|prime|workbook|guide/i, 'book-open-page-variant-outline'],
];

const ICON_BY_TYPE = {
  'prime textbook': 'book-open-page-variant-outline',
  'hs text books':  'book-multiple-outline',
  'notebooks':      'notebook-outline',
  'kits':           'bag-personal-outline',
  'shoes':          'shoe-sneaker',
};

export function itemIconName(item) {
  const name = String(item?.name || '');
  for (const [re, ic] of ICON_RULES) if (re.test(name)) return ic;
  const byType = ICON_BY_TYPE[String(item?.category || '').trim().toLowerCase()];
  if (byType) return byType;
  for (const [re, ic] of ICON_RULES) if (re.test(String(item?.category || ''))) return ic;
  return 'package-variant-closed';
}