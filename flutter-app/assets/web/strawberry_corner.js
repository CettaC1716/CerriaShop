import * as THREE from 'three';
import { storeCatalog, submitOrder } from './js/store-data-manager.js?v=124';
import { UI_ONLY, mountStaticProductArt } from './js/ui-mode.js?v=124';
import { attachCustomModel3DToGroup } from './js/custom-model-loader.js?v=1';

// ============================================================================
// STRAWBERRY CORNER (toko5 · LOT 5 → stores[5])
// 1:1 STORYBOOK WATERCOLOR DIORAMA, 5-STATE CAMERA CHOREOGRAPHY & INTERACTIVE UI
// States: HOME | MENU_GRID | PRODUCT_3D | EVENTS | MY_BAG | PARK_MATCH
// ============================================================================

export const SC_CATALOG = storeCatalog('toko5');

// Exact 1:1 Menu Catalog from the "Strawberry Corner — Cafe & Little Things" Reference Video
export const SC_MENU = [
  {
    id: 'latte',
    name: 'Strawberry Latte',
    sub: 'ESPRESSO · HOUSE SYRUP',
    cat: 'DRINKS',
    basePrice: 4.50,
    desc: 'A double shot pulled over steamed milk and our house-made strawberry syrup, finished with a little foam heart.',
    tags: ['ESPRESSO', 'HOUSE SYRUP', 'OAT OR WHOLE MILK'],
    sizes: [
      { label: 'Small 8oz', price: 3.90, mult: 3.90 / 4.50, scale: 0.90 },
      { label: 'Regular 12oz', price: 4.50, mult: 1.0, scale: 1.0 },
      { label: 'Large 16oz', price: 5.20, mult: 5.20 / 4.50, scale: 1.12 }
    ]
  },
  {
    id: 'cake',
    name: 'Strawberry Cake',
    sub: 'THREE LAYERS · CREAM',
    cat: 'SWEETS',
    basePrice: 5.20,
    desc: 'Light vanilla sponge layered three high with whipped cream and fresh halved strawberries, baked every morning at seven.',
    tags: ['VANILLA SPONGE', 'FRESH CREAM', 'LOCAL BERRIES'],
    sizes: [
      { label: 'Slice', price: 5.20, mult: 1.0, scale: 1.0 },
      { label: 'Two slices', price: 9.80, mult: 9.80 / 5.20, scale: 1.04 },
      { label: 'Whole cake', price: 32.00, mult: 32.00 / 5.20, scale: 1.06 }
    ]
  },
  {
    id: 'soda',
    name: 'Berry Soda',
    sub: 'SPARKLING · CRUSHED',
    cat: 'DRINKS',
    basePrice: 4.80,
    desc: 'Crushed ripe strawberries muddled with lemon juice, topped with cold sparkling water and a cloud of whipped cream.',
    tags: ['CRUSHED BERRY', 'SPARKLING WATER', 'WHIPPED TOP'],
    sizes: [
      { label: 'Small', price: 4.20, mult: 4.20 / 4.80, scale: 0.90 },
      { label: 'Regular', price: 4.80, mult: 1.0, scale: 1.0 },
      { label: 'Float', price: 5.60, mult: 5.60 / 4.80, scale: 1.12 }
    ]
  },
  {
    id: 'jam',
    name: 'Homemade Jam',
    sub: 'SMALL BATCH · ZEST',
    cat: 'JARS',
    basePrice: 6.90,
    desc: 'Cooked slowly in copper pans every Tuesday morning with whole berries, a squeeze of lemon zest, and a pinch of vanilla.',
    tags: ['SMALL BATCH', 'LEMON ZEST', 'NO PECTIN'],
    sizes: [
      { label: 'Mini 120g', price: 4.90, mult: 4.90 / 6.90, scale: 0.88 },
      { label: 'Jar 250g', price: 6.90, mult: 1.0, scale: 1.0 },
      { label: 'Gift Pair', price: 12.80, mult: 12.80 / 6.90, scale: 1.12 }
    ]
  },
  {
    id: 'matcha',
    name: 'Matcha Berry Latte',
    sub: 'UJI MATCHA · LAYERED',
    cat: 'DRINKS',
    basePrice: 5.40,
    desc: 'Hand-whisked ceremonial Uji matcha poured gently over cold milk and sweet muddled strawberries at the bottom of the glass.',
    tags: ['UJI MATCHA', 'STRAWBERRY PURÉE', 'ICED ONLY'],
    sizes: [
      { label: 'Small', price: 4.80, mult: 4.80 / 5.40, scale: 0.90 },
      { label: 'Regular', price: 5.40, mult: 1.0, scale: 1.0 },
      { label: 'Large', price: 6.10, mult: 6.10 / 5.40, scale: 1.12 }
    ]
  },
  {
    id: 'tart',
    name: 'Strawberry Tart',
    sub: 'CUSTARD · CRISP SHELL',
    cat: 'SWEETS',
    basePrice: 5.80,
    desc: 'A crisp buttery almond pâte sucrée shell filled with vanilla bean pastry cream and crowned with glazed whole strawberries.',
    tags: ['ALMOND CRUST', 'PASTRY CREAM', 'GLAZED BERRIES'],
    sizes: [
      { label: 'Single', price: 5.80, mult: 1.0, scale: 1.0 },
      { label: 'Pair', price: 10.80, mult: 10.80 / 5.80, scale: 1.08 },
      { label: 'Box of 4', price: 20.50, mult: 20.50 / 5.80, scale: 1.14 }
    ]
  },
  {
    id: 'milkshake',
    name: 'Berry Milkshake',
    sub: 'VANILLA BEAN · THICK',
    cat: 'DRINKS',
    basePrice: 5.20,
    desc: 'Hand-spun vanilla bean ice cream blended thick with roasted strawberries, served in a chilled parfait glass with a cherry-berry top.',
    tags: ['VANILLA ICE CREAM', 'ROASTED BERRIES', 'WHIPPED CREAM'],
    sizes: [
      { label: 'Mini', price: 4.40, mult: 4.40 / 5.20, scale: 0.90 },
      { label: 'Regular', price: 5.20, mult: 1.0, scale: 1.0 },
      { label: 'Tall', price: 6.00, mult: 6.00 / 5.20, scale: 1.12 }
    ]
  },
  {
    id: 'macarons',
    name: 'Berry Macarons',
    sub: 'SET OF 3 · ROSE JAM',
    cat: 'SWEETS',
    basePrice: 4.90,
    desc: 'Crisp French almond meringue shells sandwiched with white chocolate strawberry ganache and a center of rose-berry jam.',
    tags: ['ALMOND SHELLS', 'ROSE GANACHE', 'BOX OF 3'],
    sizes: [
      { label: 'Set of 3', price: 4.90, mult: 1.0, scale: 1.0 },
      { label: 'Box of 6', price: 9.20, mult: 9.20 / 4.90, scale: 1.08 },
      { label: 'Gift Tin 12', price: 17.50, mult: 17.50 / 4.90, scale: 1.14 }
    ]
  }
];

export const SC_GOODS = [
  { id: 'tote', name: 'Tote Bag', price: 14.00, targetProd: 'latte' },
  { id: 'mug', name: 'Enamel Mug', price: 12.00, targetProd: 'cake' },
  { id: 'blanket', name: 'Picnic Blanket', price: 28.00, targetProd: 'soda' },
  { id: 'tin', name: 'Recipe Tin', price: 16.00, targetProd: 'jam' }
];

export const SC_EVENTS = {
  '2026-10': {
    label: 'October',
    shortMonth: 'OCT',
    year: '2026',
    offset: 3, // Oct 1, 2026 is Thursday (MON=0, TUE=1, WED=2, THU=3)
    days: 31,
    items: [
      {
        day: 3,
        dow: 'SAT',
        short: 'Pour-Over',
        icon: 'cup',
        title: 'Pour-Over Morning',
        time: '09:30 – 11:00',
        host: 'Front Counter',
        desc: 'Taste three single-origin Ethiopian beans brewed slow alongside warm strawberry scones.',
        seatsLeft: 6,
        seatsTotal: 10
      },
      {
        day: 7,
        dow: 'WED',
        short: 'Jam Making',
        icon: 'jam',
        title: 'Jam Making Evening',
        time: '18:30 – 20:00',
        host: 'Back Kitchen',
        desc: 'Simmer copper pots of autumn strawberries with lemon zest and take home your own warm jar.',
        seatsLeft: 4,
        seatsTotal: 10
      },
      {
        day: 10,
        dow: 'SAT',
        short: 'Acoustic Jam',
        icon: 'music',
        title: 'Acoustic Jam on the Steps',
        time: '17:00 – 19:00',
        host: 'Corner Steps',
        desc: 'Two guitars, a cello, and a basket of warm scones passed around as the sun goes down.',
        seatsLeft: 4,
        seatsTotal: 8
      },
      {
        day: 14,
        dow: 'WED',
        short: 'Book Club',
        icon: 'book',
        title: 'Midnight Book Club',
        time: '19:00 – 20:30',
        host: 'Upstairs Room',
        desc: "This month we're reading short stories about small towns. Tea and jam tarts on the table.",
        seatsLeft: 2,
        seatsTotal: 10
      },
      {
        day: 18,
        dow: 'SUN',
        short: 'Berry Picnic',
        icon: 'picnic',
        title: 'Sunday Berry Picnic',
        time: '11:00 – 15:00',
        host: 'Corner Garden',
        desc: 'Borrow a gingham blanket and a wicker basket for the park across the lane.',
        seatsLeft: 5,
        seatsTotal: 10
      },
      {
        day: 21,
        dow: 'WED',
        short: 'Sketching',
        icon: 'art',
        title: 'Watercolor & Latte Night',
        time: '18:30 – 20:00',
        host: 'Balcony Table',
        desc: 'Bring a sketchbook or use our paper and paints while we pour warm strawberry lattes.',
        seatsLeft: 7,
        seatsTotal: 10
      },
      {
        day: 24,
        dow: 'SAT',
        short: 'Shortcake',
        icon: 'cake',
        title: 'Shortcake Layering Class',
        time: '14:00 – 16:00',
        host: 'Bakery Table',
        desc: 'Learn to whip Chantilly cream to soft peaks and frost a three-layer sponge cake.',
        seatsLeft: 3,
        seatsTotal: 8
      },
      {
        day: 31,
        dow: 'SAT',
        short: 'Lanterns',
        icon: 'lantern',
        title: 'Autumn Lantern Dusk',
        time: '17:30 – 20:00',
        host: 'Rooftop Garden',
        desc: 'Paper lanterns lit along the rooftop railing with spiced berry cider and roasted chestnuts.',
        seatsLeft: 5,
        seatsTotal: 12
      }
    ]
  },
  '2026-11': {
    label: 'November',
    shortMonth: 'NOV',
    year: '2026',
    offset: 6, // Nov 1, 2026 is Sunday (MON=0 .. SUN=6)
    days: 30,
    items: [
      {
        day: 4,
        dow: 'WED',
        short: 'Jam Making',
        icon: 'jam',
        title: 'Spiced Berry Preserve',
        time: '18:30 – 20:00',
        host: 'Back Kitchen',
        desc: 'Slow-cooked November berries with cinnamon sticks, star anise, and orange peel.',
        seatsLeft: 5,
        seatsTotal: 10
      },
      {
        day: 7,
        dow: 'SAT',
        short: 'Acoustic Jam',
        icon: 'music',
        title: 'Rainy Afternoon Strings',
        time: '16:30 – 18:30',
        host: 'Upstairs Room',
        desc: 'Cozy acoustic duets by the arched window with hot strawberry cocoa and macarons.',
        seatsLeft: 3,
        seatsTotal: 8
      },
      {
        day: 14,
        dow: 'SAT',
        short: 'Tart Baking',
        icon: 'cake',
        title: 'Almond Tart Workshop',
        time: '14:00 – 16:00',
        host: 'Bakery Table',
        desc: 'Roll out buttery pâte sucrée shells and glaze fresh greenhouse strawberries.',
        seatsLeft: 4,
        seatsTotal: 8
      },
      {
        day: 18,
        dow: 'WED',
        short: 'Book Club',
        icon: 'book',
        title: 'Autumn Poetry Circle',
        time: '19:00 – 20:30',
        host: 'Upstairs Room',
        desc: 'Bring a favorite poem or letter to read aloud over pots of roasted barley and berry tea.',
        seatsLeft: 6,
        seatsTotal: 10
      },
      {
        day: 22,
        dow: 'SUN',
        short: 'Tea Tasting',
        icon: 'cup',
        title: 'Roaster & Berry Pairing',
        time: '11:00 – 13:00',
        host: 'Front Counter',
        desc: 'Small-batch espresso flights paired with mini strawberry tarts and rose macarons.',
        seatsLeft: 5,
        seatsTotal: 10
      },
      {
        day: 28,
        dow: 'SAT',
        short: 'Lanterns',
        icon: 'lantern',
        title: 'First Frost Lightings',
        time: '17:00 – 19:30',
        host: 'Corner Steps',
        desc: 'We light the winter garlands along the awning and serve warm mulled strawberry juice.',
        seatsLeft: 4,
        seatsTotal: 10
      }
    ]
  },
  '2026-12': {
    label: 'December',
    shortMonth: 'DEC',
    year: '2026',
    offset: 1, // Dec 1, 2026 is Tuesday (MON=0, TUE=1)
    days: 31,
    items: [
      {
        day: 2,
        dow: 'WED',
        short: 'Wreath & Jam',
        icon: 'jam',
        title: 'Holiday Wreath & Jam',
        time: '18:30 – 20:30',
        host: 'Upstairs Room',
        desc: 'Tie a small cedar wreath for your door and take home a ribboned jar of winter jam.',
        seatsLeft: 3,
        seatsTotal: 8
      },
      {
        day: 5,
        dow: 'SAT',
        short: 'Vinyl & Cocoa',
        icon: 'music',
        title: 'Vinyl & Berry Cocoa',
        time: '17:00 – 19:00',
        host: 'Upstairs Room',
        desc: 'Spinning old jazz records while pouring thick dark hot chocolate topped with strawberry cream.',
        seatsLeft: 5,
        seatsTotal: 10
      },
      {
        day: 12,
        dow: 'SAT',
        short: 'Shortcake',
        icon: 'cake',
        title: 'Winter Shortcake Bake',
        time: '14:00 – 16:30',
        host: 'Bakery Table',
        desc: 'Decorate a festive holiday strawberry shortcake to bring home for the weekend.',
        seatsLeft: 2,
        seatsTotal: 8
      },
      {
        day: 16,
        dow: 'WED',
        short: 'Book Club',
        icon: 'book',
        title: 'Year-End Book Swap',
        time: '19:00 – 20:30',
        host: 'Upstairs Room',
        desc: 'Wrap a favorite book in brown paper with a handwritten note and trade over warm lattes.',
        seatsLeft: 4,
        seatsTotal: 10
      },
      {
        day: 24,
        dow: 'THU',
        short: 'Lantern Eve',
        icon: 'lantern',
        title: 'Christmas Eve Candlelight',
        time: '16:00 – 19:00',
        host: 'Corner Steps',
        desc: 'Whole cakes pick-up, warm spiced berry cider on the house, and carols under the awning.',
        seatsLeft: 6,
        seatsTotal: 12
      }
    ]
  }
};

const formatUSD = v => `$ ${Number(v || 0).toFixed(2)}`;

function getCustomModelUrlForProduct(id) {
  const liveList = SC_CATALOG?.menu;
  if (Array.isArray(liveList)) {
    const found = liveList.find(it => it.id === id);
    if (found?.model3dUrl) return found.model3dUrl;
  }
  return null;
}

// Hand-crafted vector illustrations matching the storybook ink + watercolor aesthetic
export function renderProductSVG(id) {
  switch (id) {
    case 'latte':
      return `<svg viewBox="0 0 160 125" fill="none">
        <ellipse cx="80" cy="96" rx="56" ry="16" fill="#FAF4E8" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M114 60c14 0 18 16 4 21" stroke="#FAF4E8" stroke-width="6" stroke-linecap="round"/>
        <path d="M114 60c14 0 18 16 4 21" stroke="#2B1E18" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M44 50h72c-2 26-12 42-36 42S46 76 44 50z" fill="#FAF4E8" stroke="#2B1E18" stroke-width="2.2"/>
        <ellipse cx="80" cy="50" rx="36" ry="10" fill="#F3A6A1" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M80 53c-5-4-9-2-9 1 0 3 9 6 9 6s9-3 9-6c0-3-4-5-9-1z" fill="#FFFDF9"/>
        <circle cx="80" cy="74" r="5" fill="#D93829"/><path d="M77 69h6" stroke="#3E7B3B" stroke-width="2"/>
        <ellipse cx="38" cy="86" rx="11" ry="9" transform="rotate(-20 38 86)" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="106" cy="92" r="9" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
    case 'cake':
      return `<svg viewBox="0 0 160 125" fill="none">
        <ellipse cx="80" cy="95" rx="54" ry="15" fill="#FAF4E8" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M52 50l58-16v48l-58 12V50z" fill="#F5DFB8" stroke="#2B1E18" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M52 62l58-14v8L52 70v-8zm0 16l58-13v8L52 86v-8z" fill="#FFFDF8" stroke="#2B1E18" stroke-width="1.6"/>
        <path d="M52 50l28-22 30 6-58 16z" fill="#FFFDF8" stroke="#2B1E18" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="76" cy="34" r="9" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="91" cy="36" r="10" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="42" cy="88" r="7" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
    case 'soda':
      return `<svg viewBox="0 0 160 125" fill="none">
        <ellipse cx="80" cy="100" rx="34" ry="9" fill="#D7A97C" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M62 38h36l-4 58H66l-4-58z" fill="#F47C7C" stroke="#2B1E18" stroke-width="2.2"/>
        <ellipse cx="80" cy="38" rx="20" ry="8" fill="#FFFDF8" stroke="#2B1E18" stroke-width="1.8"/>
        <path d="M90 18l-5 22" stroke="#4D8B55" stroke-width="4" stroke-linecap="round"/>
        <circle cx="79" cy="28" r="8" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
    case 'jam':
      return `<svg viewBox="0 0 160 125" fill="none">
        <rect x="54" y="44" width="52" height="54" rx="12" fill="#C92E27" stroke="#2B1E18" stroke-width="2.2"/>
        <rect x="58" y="60" width="44" height="24" rx="4" fill="#FAF2E1" stroke="#2B1E18" stroke-width="1.6"/>
        <path d="M80 75c-4-3-7-1-7 1 0 3 7 5 7 5s7-2 7-5c0-2-3-4-7-1z" fill="#C92E27"/>
        <path d="M48 44c4-14 60-14 64 0l-4 8H52l-4-8z" fill="#E66C64" stroke="#2B1E18" stroke-width="2.2"/>
        <circle cx="114" cy="92" r="11" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
    case 'matcha':
      return `<svg viewBox="0 0 160 125" fill="none">
        <ellipse cx="80" cy="100" rx="34" ry="9" fill="#D7A97C" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M60 36h40l-4 60H64l-4-60z" fill="#FAF2E4" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M61 40h38l-1.5 20H62.5L61 40z" fill="#88B66C"/>
        <path d="M63 74h34l-1.5 21H64.5L63 74z" fill="#F29393"/>
        <path d="M68 18l6 22" stroke="#4D8B55" stroke-width="4" stroke-linecap="round"/>
        <circle cx="98" cy="34" r="9" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
    case 'tart':
      return `<svg viewBox="0 0 160 125" fill="none">
        <ellipse cx="80" cy="94" rx="54" ry="15" fill="#FAF4E8" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M44 74h72l-6 16H50l-6-16z" fill="#DFAA64" stroke="#2B1E18" stroke-width="2.2"/>
        <circle cx="64" cy="68" r="10" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="80" cy="64" r="11" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="96" cy="68" r="10" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="72" cy="73" r="9" fill="#E4493A" stroke="#2B1E18" stroke-width="1.6"/>
        <circle cx="88" cy="73" r="9" fill="#E4493A" stroke="#2B1E18" stroke-width="1.6"/>
      </svg>`;
    case 'milkshake':
      return `<svg viewBox="0 0 160 125" fill="none">
        <ellipse cx="80" cy="102" rx="22" ry="6" fill="#FAF4E8" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M80 82v18" stroke="#2B1E18" stroke-width="4"/>
        <path d="M58 46h44c-2 22-10 36-22 36S60 68 58 46z" fill="#F4A4AC" stroke="#2B1E18" stroke-width="2.2"/>
        <path d="M58 46c4-14 40-14 44 0H58z" fill="#FFFDF8" stroke="#2B1E18" stroke-width="2.2"/>
        <circle cx="80" cy="28" r="8" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
    case 'macarons':
    default:
      return `<svg viewBox="0 0 160 125" fill="none">
        <ellipse cx="80" cy="95" rx="54" ry="14" fill="#FAF4E8" stroke="#2B1E18" stroke-width="2.2"/>
        <ellipse cx="76" cy="82" rx="20" ry="8" fill="#E58C8A" stroke="#2B1E18" stroke-width="1.8"/>
        <ellipse cx="76" cy="69" rx="20" ry="8" fill="#F5DFC6" stroke="#2B1E18" stroke-width="1.8"/>
        <ellipse cx="76" cy="56" rx="20" ry="8" fill="#E65A65" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="98" cy="82" r="14" fill="#F4A8B0" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="42" cy="84" r="8" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
  }
}

function renderGoodsSVG(id) {
  if (id === 'mug') {
    return `<svg viewBox="0 0 120 96" fill="none">
      <rect x="30" y="24" width="48" height="52" rx="8" fill="#FFFDF8" stroke="#2B1E18" stroke-width="2.2"/>
      <path d="M30 28h48" stroke="#D84B4B" stroke-width="3.5"/>
      <path d="M78 36c12 0 14 24 0 26" stroke="#2B1E18" stroke-width="2.5"/>
      <circle cx="54" cy="52" r="8" fill="#D93829" stroke="#2B1E18" stroke-width="1.6"/>
      <path d="M51 43c2 1 3 2 3 2s1-1 3-2" stroke="#3E7B3B" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }
  if (id === 'tote') {
    return `<svg viewBox="0 0 120 96" fill="none">
      <path d="M45 32c0-15 30-15 30 0" stroke="#2B1E18" stroke-width="2.4"/>
      <path d="M32 32h56l4 50H28l4-50z" fill="#F5EBDC" stroke="#2B1E18" stroke-width="2.2"/>
      <circle cx="60" cy="57" r="11" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
      <path d="M55 45c3 1 5 3 5 3s2-2 5-3" stroke="#3E7B3B" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;
  }
  if (id === 'blanket') {
    return `<svg viewBox="0 0 120 96" fill="none">
      <rect x="24" y="38" width="72" height="28" rx="14" fill="#E05A52" stroke="#2B1E18" stroke-width="2.2"/>
      <path d="M42 38v28M78 38v28" stroke="#6E4730" stroke-width="5"/>
      <path d="M60 38v28" stroke="#FAF2E1" stroke-width="6" stroke-opacity="0.65"/>
      <path d="M36 28h48" stroke="#6E4730" stroke-width="2.4" stroke-linecap="round"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 120 96" fill="none">
    <rect x="30" y="28" width="60" height="46" rx="7" fill="#FAF3E3" stroke="#2B1E18" stroke-width="2.2"/>
    <rect x="27" y="24" width="66" height="9" rx="4" fill="#D84B4B" stroke="#2B1E18" stroke-width="2"/>
    <circle cx="60" cy="52" r="9" fill="#D93829" stroke="#2B1E18" stroke-width="1.8"/>
    <path d="M56 42c2 1 4 2 4 2s2-1 4-2" stroke="#3E7B3B" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function renderEventIconSVG(icon) {
  switch (icon) {
    case 'music':
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <path d="M14 25V10l12-3v15" stroke="#2B1E18" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="11" cy="25" r="3.5" fill="#D84B4B" stroke="#2B1E18" stroke-width="1.8"/>
        <circle cx="23" cy="22" r="3.5" fill="#F4C44E" stroke="#2B1E18" stroke-width="1.8"/>
      </svg>`;
    case 'book':
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <path d="M7 10c4-2 8-1 11 2 3-3 7-4 11-2v16c-4-2-8-1-11 2-3-3-7-4-11-2V10z" fill="#FAF2E1" stroke="#2B1E18" stroke-width="2" stroke-linejoin="round"/>
        <path d="M18 12v16" stroke="#D84B4B" stroke-width="2"/>
      </svg>`;
    case 'picnic':
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <path d="M12 15c0-5 12-5 12 0" stroke="#2B1E18" stroke-width="2"/>
        <path d="M8 15h20l-2.5 12h-15L8 15z" fill="#E3B178" stroke="#2B1E18" stroke-width="2" stroke-linejoin="round"/>
        <path d="M7 15h22v3H7z" fill="#D84B4B" stroke="#2B1E18" stroke-width="1.6"/>
      </svg>`;
    case 'cake':
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <path d="M9 17l18-5v12L9 28V17z" fill="#F5DFB8" stroke="#2B1E18" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="18" cy="11" r="3.5" fill="#D84B4B" stroke="#2B1E18" stroke-width="1.6"/>
      </svg>`;
    case 'jam':
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <rect x="11" y="12" width="14" height="16" rx="4" fill="#D84B4B" stroke="#2B1E18" stroke-width="2"/>
        <rect x="13" y="17" width="10" height="7" rx="1.5" fill="#FAF2E1"/>
        <path d="M10 11h16" stroke="#2B1E18" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    case 'lantern':
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <ellipse cx="18" cy="19" rx="7" ry="8" fill="#F4C44E" stroke="#2B1E18" stroke-width="2"/>
        <path d="M14 11h8M15 27h6" stroke="#2B1E18" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
    case 'art':
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <circle cx="18" cy="18" r="10" fill="#F5E6CC" stroke="#2B1E18" stroke-width="2"/>
        <circle cx="14" cy="15" r="2" fill="#D84B4B"/>
        <circle cx="20" cy="14" r="2" fill="#5C9B6B"/>
        <circle cx="22" cy="19" r="2" fill="#F4C44E"/>
      </svg>`;
    case 'cup':
    default:
      return `<svg viewBox="0 0 36 36" width="24" height="24" fill="none">
        <path d="M9 14h14c-1 8-3 12-7 12s-6-4-7-12z" fill="#FAF2E1" stroke="#2B1E18" stroke-width="2"/>
        <path d="M23 16c4 0 4 6 0 6" stroke="#2B1E18" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="16" cy="14" rx="7" ry="2.2" fill="#F3A6A1" stroke="#2B1E18" stroke-width="1.6"/>
      </svg>`;
  }
}

// ============================================================================
// SECOND THREE.JS SCENE: 360° TOON + INK OUTLINE PRODUCT SHOWCASE (STATE 3)
// ============================================================================
const INK_MAT = new THREE.MeshBasicMaterial({ color: '#2B1E18', side: THREE.BackSide });

const toonRampTex = (() => {
  const data = new Uint8Array([
    195, 185, 175, 255,
    232, 225, 216, 255,
    255, 252, 247, 255
  ]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

function makeToonMat(color) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRampTex
  });
}

function addToonPart(group, geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, outline = 0.025 } = {}) {
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.set(rx, ry, rz);
  holder.scale.set(sx, sy, sz);

  const mesh = new THREE.Mesh(geo, makeToonMat(color));
  holder.add(mesh);

  if (outline > 0) {
    const outGeo = geo.clone();
    outGeo.computeVertexNormals();
    const pos = outGeo.attributes.position;
    const nrm = outGeo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + nrm.getX(i) * outline,
        pos.getY(i) + nrm.getY(i) * outline,
        pos.getZ(i) + nrm.getZ(i) * outline
      );
    }
    const inkMesh = new THREE.Mesh(outGeo, INK_MAT);
    holder.add(inkMesh);
  }
  group.add(holder);
  return holder;
}

function addMiniStrawberry3D(group, x, y, z, scale = 1, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  g.scale.setScalar(scale);

  const pts = [
    [0, 0], [0.12, 0.03], [0.22, 0.11], [0.26, 0.24], [0.22, 0.36], [0.12, 0.44], [0, 0.46]
  ].map(([r, h]) => new THREE.Vector2(r, h));
  addToonPart(g, new THREE.LatheGeometry(pts, 20), '#e03426', { y: -0.22, outline: 0.018 });

  const seedGeo = new THREE.SphereGeometry(0.018, 6, 6);
  const seedMat = new THREE.MeshBasicMaterial({ color: '#f9e38e' });
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const h = -0.14 + (i / 18) * 0.28;
    const r = 0.22 * Math.sin(((i + 2) / 21) * Math.PI);
    const sm = new THREE.Mesh(seedGeo, seedMat);
    sm.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
    g.add(sm);
  }
  const leafGeo = new THREE.BoxGeometry(0.12, 0.03, 0.22);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    addToonPart(g, leafGeo, '#3e803b', {
      x: Math.cos(a) * 0.08,
      y: 0.23,
      z: Math.sin(a) * 0.08,
      ry: a,
      rx: 0.25,
      outline: 0.012
    });
  }
  group.add(g);
}

function addCakeSliceToGroup(targetGroup, offsetX = 0, offsetZ = 0, rotY = 0, scale = 1) {
  const sliceGroup = new THREE.Group();
  sliceGroup.position.set(offsetX, 0, offsetZ);
  sliceGroup.rotation.y = rotY;
  sliceGroup.scale.setScalar(scale);

  const wedge = new THREE.Shape();
  wedge.moveTo(-0.85, -0.55);
  wedge.lineTo(0.85, -0.1);
  wedge.lineTo(-0.55, 0.65);
  wedge.closePath();

  const layers = [
    [-0.52, 0.22, '#f4d59e'],
    [-0.3, 0.14, '#fffdf8'],
    [-0.16, 0.22, '#f4d59e'],
    [0.06, 0.14, '#fffdf8'],
    [0.2, 0.22, '#f4d59e'],
    [0.42, 0.1, '#fffdf8']
  ];
  layers.forEach(([ly, lh, col]) => {
    const g = new THREE.ExtrudeGeometry(wedge, { depth: lh, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    addToonPart(sliceGroup, g, col, { y: ly, outline: 0.02 });
  });
  addMiniStrawberry3D(sliceGroup, -0.32, 0.68, 0.08, 1.02, 0.1, 0.2, 0);
  addMiniStrawberry3D(sliceGroup, 0.08, 0.66, -0.05, 0.96, -0.1, -0.3, 0.1);
  targetGroup.add(sliceGroup);
}

export function buildProduct3DModel(id, sizeIdx = 1) {
  const root = new THREE.Group();

  // Soft warm shadow disc underneath
  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#dfd0bc',
    transparent: true,
    opacity: 0.58
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.58, 36), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.68;
  root.add(shadow);

  if (id === 'latte') {
    const saucerPts = [[0, 0], [0.95, 0], [1.45, 0.14], [1.48, 0.19], [0.85, 0.06], [0, 0.06]].map(
      ([r, y]) => new THREE.Vector2(r, y)
    );
    addToonPart(root, new THREE.LatheGeometry(saucerPts, 36), '#f8f1e3', { y: -0.65, outline: 0.025 });

    const cupScale = sizeIdx === 0 ? 0.90 : sizeIdx === 2 ? 1.10 : 1.0;
    const cupGroup = new THREE.Group();
    cupGroup.scale.set(cupScale, cupScale, cupScale);
    root.add(cupGroup);

    const cupPts = [[0, 0], [0.58, 0], [0.76, 0.35], [0.88, 0.88], [0.9, 0.96], [0.82, 0.96], [0.72, 0.4], [0, 0.4]].map(
      ([r, y]) => new THREE.Vector2(r, y)
    );
    addToonPart(cupGroup, new THREE.LatheGeometry(cupPts, 36), '#faf3e6', { y: -0.58, outline: 0.026 });

    addToonPart(cupGroup, new THREE.TorusGeometry(0.28, 0.075, 12, 24, Math.PI * 1.15), '#faf3e6', {
      x: 0.84, y: -0.12, z: 0, rz: -Math.PI / 2, outline: 0.022
    });

    addToonPart(cupGroup, new THREE.CylinderGeometry(0.81, 0.81, 0.08, 32), '#f29594', { y: 0.28, outline: 0.015 });

    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.16);
    heartShape.bezierCurveTo(0.24, -0.02, 0.28, 0.2, 0.13, 0.24);
    heartShape.bezierCurveTo(0.04, 0.26, 0, 0.16, 0, 0.12);
    heartShape.bezierCurveTo(0, 0.16, -0.04, 0.26, -0.13, 0.24);
    heartShape.bezierCurveTo(-0.28, 0.2, -0.24, -0.02, 0, -0.16);
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.025, bevelEnabled: false });
    heartGeo.rotateX(-Math.PI / 2);
    addToonPart(cupGroup, heartGeo, '#fffdf9', { y: 0.32, outline: 0 });

    addToonPart(cupGroup, new THREE.SphereGeometry(0.11, 14, 12), '#d93829', { x: 0, y: -0.2, z: 0.78, sz: 0.4, outline: 0.012 });
    addToonPart(cupGroup, new THREE.BoxGeometry(0.14, 0.04, 0.04), '#3e803b', { x: 0, y: -0.09, z: 0.8, outline: 0 });

    addMiniStrawberry3D(root, -1.08, -0.34, 0.35, 1.25, 0.4, 0.3, -0.5);
    addMiniStrawberry3D(root, 0.65, -0.36, 0.88, 1.18, -0.3, -0.4, 0.35);
  } else if (id === 'cake') {
    // Plate
    addToonPart(root, new THREE.CylinderGeometry(1.48, 1.18, 0.12, 36), '#faf3e6', { y: -0.6, outline: 0.025 });
    if (sizeIdx >= 1) {
      // Dynamic 1:1 Video Feature (00:18-00:20): Two slices on the plate when "Two slices" or "Whole cake" is selected!
      addCakeSliceToGroup(root, -0.24, -0.18, 0.12, 0.86);
      addCakeSliceToGroup(root, 0.34, 0.34, -0.38, 0.84);
      addMiniStrawberry3D(root, -0.98, -0.38, 0.48, 0.92, 0.3, 0.4, -0.4);
    } else {
      addCakeSliceToGroup(root, 0, 0, 0, 1.0);
      addMiniStrawberry3D(root, -0.95, -0.38, 0.45, 0.9, 0.3, 0.4, -0.4);
    }
  } else if (id === 'soda') {
    addToonPart(root, new THREE.CylinderGeometry(0.95, 0.95, 0.12, 32), '#d7a26c', { y: -0.6, outline: 0.025 });
    addToonPart(root, new THREE.CylinderGeometry(0.68, 0.56, 1.48, 32), '#f2797b', { y: 0.2, outline: 0.025 });
    addToonPart(root, new THREE.SphereGeometry(0.64, 24, 18), '#fffdf8', { y: 0.94, sy: 0.52, outline: 0.022 });
    addToonPart(root, new THREE.CylinderGeometry(0.055, 0.055, 1.1, 14), '#4c8e54', { x: 0.28, y: 1.15, z: 0, rz: -0.22, outline: 0.016 });
    addMiniStrawberry3D(root, -0.05, 1.24, 0.05, 1.05, 0.1, 0, -0.15);
  } else if (id === 'jam') {
    addToonPart(root, new THREE.CylinderGeometry(0.78, 0.74, 1.24, 32), '#c72c25', { y: -0.02, outline: 0.026 });
    addToonPart(root, new THREE.CylinderGeometry(0.8, 0.78, 0.58, 32, 1, true, -0.9, 1.8), '#faf1df', { y: -0.02, outline: 0.015 });
    addToonPart(root, new THREE.CylinderGeometry(0.86, 0.94, 0.34, 32), '#e86860', { y: 0.68, outline: 0.025 });
    addToonPart(root, new THREE.TorusGeometry(0.84, 0.045, 10, 32), '#c89b6e', { y: 0.58, rx: Math.PI / 2, outline: 0.014 });
    addMiniStrawberry3D(root, 0.98, -0.4, 0.35, 1.15, 0.2, -0.4, -0.3);
  } else if (id === 'matcha') {
    addToonPart(root, new THREE.CylinderGeometry(0.95, 0.95, 0.12, 32), '#d7a26c', { y: -0.6, outline: 0.025 });
    addToonPart(root, new THREE.CylinderGeometry(0.61, 0.56, 0.48, 32), '#f28d8f', { y: -0.3, outline: 0.024 });
    addToonPart(root, new THREE.CylinderGeometry(0.66, 0.61, 0.52, 32), '#faf2e4', { y: 0.2, outline: 0.024 });
    addToonPart(root, new THREE.CylinderGeometry(0.7, 0.66, 0.48, 32), '#84b468', { y: 0.7, outline: 0.024 });
    addToonPart(root, new THREE.CylinderGeometry(0.055, 0.055, 1.15, 14), '#4c8e54', { x: -0.25, y: 1.05, z: 0, rz: 0.2, outline: 0.016 });
    addMiniStrawberry3D(root, 0.58, 0.98, 0.1, 0.95, 0, 0, -0.35);
  } else if (id === 'tart') {
    addToonPart(root, new THREE.CylinderGeometry(1.42, 1.15, 0.12, 36), '#faf3e6', { y: -0.6, outline: 0.025 });
    addToonPart(root, new THREE.CylinderGeometry(1.06, 0.92, 0.34, 24), '#dfaa62', { y: -0.36, outline: 0.025 });
    addToonPart(root, new THREE.CylinderGeometry(0.96, 0.96, 0.08, 24), '#fae6a8', { y: -0.18, outline: 0.014 });
    addMiniStrawberry3D(root, 0, 0.05, 0, 1.1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      addMiniStrawberry3D(root, Math.cos(a) * 0.52, -0.02, Math.sin(a) * 0.52, 0.95, Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
    }
  } else if (id === 'milkshake') {
    addToonPart(root, new THREE.CylinderGeometry(0.55, 0.62, 0.1, 28), '#faf3e6', { y: -0.6, outline: 0.022 });
    addToonPart(root, new THREE.CylinderGeometry(0.12, 0.14, 0.45, 20), '#faf3e6', { y: -0.35, outline: 0.022 });
    const cupPts = [[0, 0], [0.22, 0.05], [0.58, 0.45], [0.72, 1.05], [0, 1.05]].map(([r, y]) => new THREE.Vector2(r, y));
    addToonPart(root, new THREE.LatheGeometry(cupPts, 32), '#f49ca6', { y: -0.15, outline: 0.025 });
    addToonPart(root, new THREE.SphereGeometry(0.64, 24, 18), '#fffdf8', { y: 0.92, sy: 0.55, outline: 0.022 });
    addToonPart(root, new THREE.SphereGeometry(0.42, 20, 16), '#fffdf8', { y: 1.15, sy: 0.55, outline: 0.02 });
    addToonPart(root, new THREE.CylinderGeometry(0.05, 0.05, 0.95, 14), '#e05347', { x: 0.26, y: 1.15, z: -0.1, rz: -0.25, outline: 0.015 });
    addMiniStrawberry3D(root, -0.04, 1.38, 0, 0.92);
  } else {
    addToonPart(root, new THREE.CylinderGeometry(1.42, 1.15, 0.12, 36), '#faf3e6', { y: -0.6, outline: 0.025 });
    const macColors = ['#e58686', '#f5dcc4', '#e05260'];
    macColors.forEach((col, idx) => {
      const by = -0.4 + idx * 0.34;
      addToonPart(root, new THREE.CylinderGeometry(0.52, 0.54, 0.12, 28), col, { x: -0.15, y: by, z: 0, outline: 0.02 });
      addToonPart(root, new THREE.CylinderGeometry(0.49, 0.49, 0.08, 28), '#fff8ee', { x: -0.15, y: by + 0.09, z: 0, outline: 0.015 });
      addToonPart(root, new THREE.CylinderGeometry(0.54, 0.52, 0.12, 28), col, { x: -0.15, y: by + 0.18, z: 0, outline: 0.02 });
    });
    addToonPart(root, new THREE.CylinderGeometry(0.48, 0.48, 0.24, 28), '#f4a4b0', {
      x: 0.58, y: -0.22, z: 0.28, rx: 0.3, rz: 1.15, outline: 0.022
    });
    addMiniStrawberry3D(root, -0.92, -0.36, 0.35, 0.98, 0.2, 0.3, -0.35);
  }

  return root;
}

// ============================================================================
// MAIN STRAWBERRY CORNER CONTROLLER
// ============================================================================
export function createStrawberryCornerSystem({
  camera,
  controls,
  stores,
  slotAngle,
  chime,
  getPocketParkMatchmaking,
  onParkModeChange
}) {
  let active = false;
  let state = 'HOME'; // 'HOME' | 'MENU_GRID' | 'PRODUCT_3D' | 'EVENTS' | 'MY_BAG' | 'PARK_MATCH'
  let menuFilter = 'ALL';
  let currentProductId = 'latte';
  let selectedSizeIdx = 1; // Regular default (or index 0 for Slice on Cake)
  let selectedQty = 1;
  let currentMonth = '2026-10';
  let selectedEventIdx = 4; // Defaults to Sun Oct 18 "Sunday Berry Picnic" (matching 00:38 of the video!)
  const reservedEvents = new Set();
  let checkoutComplete = false;
  let soundMuted = false;
  let berryPoints = 24;
  let heartLikes = 12;

  // Seated Park Matchmaking & 05:00 Chat State (at Scenic Fish Pond Bench)
  const PARK_PARTNERS = [
    {
      name: 'Nadya',
      role: 'Pecinta Strawberry Latte & Buku Puisi',
      greeting: 'Hai! Senang bisa duduk bareng di bangku tepi kolam ikan ini 🌸 Lihat ikan koi-nya berenang lucu banget ya!',
      replies: [
        'Wah setuju banget! Duduk di tepi kolam ikan sambil lihat daun teratai dan ikan koi berenang bikin hati adem sekali ✨',
        'Aku tadi baru pesan Strawberry Latte hangat! Foam hatinya lucu banget, cocok diminum sore-sore di tepi kolam ini ☕🍓',
        'Apalagi pendar lampu taman hangat di tepi kolam ini bikin suasana ngobrol makin syahdu ya, apalagi pas malam hari 🏮✨',
        'Kalau nanti ada waktu, ikut acara Acoustic Jam di tangga kafe hari Sabtu yuk! 🎶🍰',
        'Haha asyik banget ngobrol sama kamu! Jangan lupa klik Perpanjang +5 Menit ❤️ kalau masih mau lanjut cerita ya 😊'
      ]
    },
    {
      name: 'Raka',
      role: 'Ilustrator & Penggemar Shortcake',
      greeting: 'Halo! Kebetulan banget bangku di tepi kolam ikan ini kosong sebelah 🌸 Pemandangan kolamnya asri banget ya!',
      replies: [
        'Iya nih! Ikan koi dan ikan mas kecil yang berenang memutar di depan bangku kita ini bikin betah duduk lama-lama 🐟✨',
        'Rekomendasi nomor satuku jelas Strawberry Cake tiga lapis! Krim vanilanya lembut banget 🍰🍓',
        'Aku sering bawa buku sketsa ke bangku kolam ikan ini, soalnya pantulan lampu taman hangat di air kolamnya cantik banget 🏮🌿',
        'Senang banget bisa kenal teman baru di Strawberry Corner! Taman ini memang spot paling tenang buat ngobrol 🚶‍♂️🌸',
        'Wah waktu 5 menit terasa cepat kalau obrolannya seru! Kita bisa tambah +5 menit lagi kapan saja ❤️'
      ]
    }
  ];
  let parkMatchStatus = 'WAITING';
  let parkPartnerIdx = 0;
  let parkTimerSec = 300;
  let parkTimerMax = 300;
  const RADIAL_CIRCUMFERENCE = +(2 * Math.PI * 23).toFixed(2);
  let parkMatchTimeoutId = null;
  let parkCountdownIntervalId = null;
  let parkReplyTimeoutId = null;
  let userBubbleText = '';
  let userBubbleUntil = 0;
  let partnerBubbleText = '';
  let partnerBubbleUntil = 0;
  let partnerReplyCursor = 0;
  let parkChatHistory = [];
  let parkOrbitUnlocked = false;

  function playChime(freq, dur) {
    if (!soundMuted) {
      chime?.(freq, dur);
    }
  }

  function formatParkTimer(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function getRadialDashOffset() {
    const progress = Math.max(0, Math.min(1, parkTimerSec / Math.max(1, parkTimerMax)));
    return +(RADIAL_CIRCUMFERENCE * (1 - progress)).toFixed(2);
  }

  function updateRadialTimerDOM() {
    const timerValEl = overlay.querySelector('#sc-park-timer-val');
    if (timerValEl) {
      timerValEl.textContent = formatParkTimer(parkTimerSec);
    }
    const ringEl = overlay.querySelector('#sc-radial-ring');
    if (ringEl) {
      ringEl.style.strokeDashoffset = `${getRadialDashOffset()}`;
    }
  }

  function spawnRadialLoveParticles() {
    const host = overlay.querySelector('#sc-love-particles');
    const btn = overlay.querySelector('#sc-park-extend-btn');
    if (btn) {
      btn.classList.remove('pulse-burst');
      void btn.offsetWidth;
      btn.classList.add('pulse-burst');
    }
    if (!host) return;
    const icons = ['❤️', '💖', '💗', '❤️', '✨', '💖', '❤️', '💗'];
    for (let i = 0; i < icons.length; i++) {
      const p = document.createElement('span');
      p.className = 'sc-love-particle';
      p.textContent = icons[i];
      const ang = (i / icons.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const dist = 26 + Math.random() * 22;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 18;
      p.style.setProperty('--dx', `${Math.round(dx)}px`);
      p.style.setProperty('--dy', `${Math.round(dy)}px`);
      p.style.animationDelay = `${(i * 0.03).toFixed(2)}s`;
      host.appendChild(p);
      setTimeout(() => p.remove(), 950);
    }
  }

  function clearParkTimers() {
    if (parkMatchTimeoutId) {
      clearTimeout(parkMatchTimeoutId);
      parkMatchTimeoutId = null;
    }
    if (parkCountdownIntervalId) {
      clearInterval(parkCountdownIntervalId);
      parkCountdownIntervalId = null;
    }
    if (parkReplyTimeoutId) {
      clearTimeout(parkReplyTimeoutId);
      parkReplyTimeoutId = null;
    }
  }

  // Basket starts with the classic treats from the video so MY_BAG is immediately rich & interactive
  const basket = [
    { id: 'latte', sizeLabel: 'Regular 12oz', unitPrice: 4.50, qty: 1 },
    { id: 'cake', sizeLabel: 'Whole cake', unitPrice: 32.00, qty: 1 },
    { id: 'milkshake', sizeLabel: 'Regular', unitPrice: 5.20, qty: 1 }
  ];

  // 700ms Cubic-Bezier (0.22, 1, 0.36, 1) Camera Choreography + ViewOffset State
  let savedVillageRotY = null;
  let cachedCenter = new THREE.Vector3();
  let cachedMaxY = 9.15;

  const camAnim = {
    t0: 0,
    dur: 700,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    curPos: new THREE.Vector3(),
    curTarget: new THREE.Vector3(),
    fromOffsetX: 0,
    toOffsetX: 0,
    curOffsetX: 0,
    fromOffsetY: 0,
    toOffsetY: 0,
    curOffsetY: 0
  };

  function cubicBezierEase(t) {
    return 1 - Math.pow(1 - t, 3.4);
  }

  function applyCurrentViewOffset() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (Math.abs(camAnim.curOffsetX) < 0.0005 && Math.abs(camAnim.curOffsetY) < 0.0005) {
      camera.clearViewOffset();
    } else {
      camera.setViewOffset(
        W,
        H,
        W * camAnim.curOffsetX,
        H * camAnim.curOffsetY,
        W,
        H
      );
    }
  }

  function updateStrawberryCamera(targetState, instant = false) {
    const strawberryBuildingGroup = stores[5].g;
    parkOrbitUnlocked = false;
    controls.enabled = false;

    if (targetState === 'PARK_MATCH') {
      strawberryBuildingGroup.scale.set(1, 1, 1);
      if (savedVillageRotY !== null) {
        strawberryBuildingGroup.rotation.y = savedVillageRotY;
      }
      strawberryBuildingGroup.updateMatrixWorld(true);

      const mm = getPocketParkMatchmaking?.();
      const pose = mm ? mm.getCameraPose() : {
        camPos: new THREE.Vector3(38.95, 2.08, -22.63),
        lookAt: new THREE.Vector3(44.04, 0.76, -22.18)
      };
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 4;
      controls.maxDistance = 18;
      controls.minPolarAngle = 0.20;
      controls.maxPolarAngle = Math.PI / 2.15;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      camAnim.dur = 1150;
      camAnim.fromPos.copy(camAnim.curPos);
      camAnim.fromTarget.copy(camAnim.curTarget);
      camAnim.toPos.copy(pose.camPos);
      camAnim.toTarget.copy(pose.lookAt);
      camAnim.fromOffsetX = camAnim.curOffsetX;
      camAnim.toOffsetX = 0;
      camAnim.fromOffsetY = camAnim.curOffsetY;
      camAnim.toOffsetY = 0;
      camAnim.t0 = performance.now();
      return;
    }

    camAnim.dur = 680;

    if (stores[5].windAffectedMeshes) {
      for (const m of stores[5].windAffectedMeshes) {
        const ud = m.userData;
        m.position.set(ud.basePosX, ud.basePosY, ud.basePosZ);
        m.rotation.set(ud.baseRotX, ud.baseRotY, ud.baseRotZ);
        m.scale.set(ud.baseScaleX, ud.baseScaleY, ud.baseScaleZ);
      }
    }
    if (stores[5].rooftopBirds) {
      for (const b of stores[5].rooftopBirds) {
        const ud = b.userData;
        b.position.set(ud.baseX, ud.baseY, ud.baseZ);
        b.rotation.set(0, ud.baseRotY, 0);
      }
    }

    // 1. Keep building group at scale (1, 1, 1) and set 3/4 Right-Front orientation (0.92 rad)
    strawberryBuildingGroup.scale.set(1, 1, 1);
    strawberryBuildingGroup.rotation.y = 0.92;
    strawberryBuildingGroup.updateMatrixWorld(true);

    // 2. Bounding Box from Sidewalk Curb to Rooftop Giant Strawberry
    const box = new THREE.Box3().setFromObject(strawberryBuildingGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    cachedCenter.copy(center);
    cachedMaxY = box.max.y;

    // 3. Exact Camera Distance & ViewOffset per State matching the Reference Video (00:00 - 01:02)
    const maxDim = Math.max(size.x, size.y, size.z);
    const fovRad = camera.fov * (Math.PI / 180);
    const baseDist = (maxDim / 2) / Math.tan(fovRad / 2);

    let dist = baseDist * 1.56;
    let targetOffsetX = 0.04;
    let targetOffsetY = -0.01;

    if (targetState === 'HOME' || targetState === 'MY_BAG' || targetState === 'RECEIPT') {
      // STATE HOME & MY_BAG (00:00, 00:35, 00:51): Full 3D Diorama Building centered between Left & Right columns!
      dist = baseDist * 1.56;
      targetOffsetX = 0.04;
      targetOffsetY = -0.01;
    } else if (targetState === 'MENU_GRID' || targetState === 'PRODUCT_3D') {
      // STATE MENU & PRODUCT_3D (00:03 - 00:33): Miniature 3D Diorama Building in Bottom-Left Corner below "you are here"
      dist = baseDist * 2.55;
      targetOffsetX = 0.37;
      targetOffsetY = -0.19;
    } else if (targetState === 'EVENTS') {
      // STATE EVENTS (00:37 - 00:48): Miniature 3D Diorama Building in Bottom-Right Corner below "ON THE DAY" card
      dist = baseDist * 2.68;
      targetOffsetX = -0.35;
      targetOffsetY = -0.21;
    }

    const targetCamPos = new THREE.Vector3(
      center.x + dist * 0.55,
      center.y + size.y * 0.08,
      center.z + dist * 0.85
    );
    const targetLookAt = new THREE.Vector3(
      center.x,
      center.y + size.y * 0.04,
      center.z
    );

    if (instant) {
      camAnim.fromPos.copy(targetCamPos);
      camAnim.toPos.copy(targetCamPos);
      camAnim.curPos.copy(targetCamPos);
      camAnim.fromTarget.copy(targetLookAt);
      camAnim.toTarget.copy(targetLookAt);
      camAnim.curTarget.copy(targetLookAt);
      camAnim.fromOffsetX = camAnim.toOffsetX = camAnim.curOffsetX = targetOffsetX;
      camAnim.fromOffsetY = camAnim.toOffsetY = camAnim.curOffsetY = targetOffsetY;
      camAnim.t0 = performance.now() - 1000;
      camera.position.copy(targetCamPos);
      controls.target.copy(targetLookAt);
      applyCurrentViewOffset();
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
    } else {
      camAnim.fromPos.copy(camAnim.curPos);
      camAnim.fromTarget.copy(camAnim.curTarget);
      camAnim.toPos.copy(targetCamPos);
      camAnim.toTarget.copy(targetLookAt);
      camAnim.fromOffsetX = camAnim.curOffsetX;
      camAnim.toOffsetX = targetOffsetX;
      camAnim.fromOffsetY = camAnim.curOffsetY;
      camAnim.toOffsetY = targetOffsetY;
      camAnim.t0 = performance.now();
    }
  }

  // Create Overlay DOM
  const overlay = document.createElement('div');
  overlay.id = 'strawberry-overlay';
  overlay.className = 'sc-overlay';
  overlay.dataset.store = 'toko5';
  overlay.style.display = 'none';
  document.getElementById('app').appendChild(overlay);

  // Second Three.js Renderer for State 3 Product 3D Showcase (Open Stage Turntable + Horizontal Slide Transition)
  let prodRenderer = null;
  let prodScene = null;
  let prodCam = null;
  let prodModel = null;
  let outgoingProdModel = null;
  let prodSlideT0 = 0;
  let prodSlideDir = 1;
  const PROD_SLIDE_DUR = 360;
  let prodDragging = false;
  let prodLastX = 0;
  let prodLastY = 0;
  let prodRotY = 0.35;
  let prodRotX = 0.16;

  let staticArtHost = null;
  function ensureProductRenderer(hostEl) {
    if (UI_ONLY) {
      staticArtHost = hostEl;
      return;
    }
    if (!prodRenderer) {
      const isMobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.innerWidth < 1024 ||
        Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      prodRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      prodRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0));
      prodRenderer.outputColorSpace = THREE.SRGBColorSpace;
      prodScene = new THREE.Scene();
      prodCam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
      prodCam.position.set(0, 1.32, 4.95);
      prodCam.lookAt(0, -0.05, 0);

      const amb = new THREE.AmbientLight('#fff6ea', 1.68);
      const dir1 = new THREE.DirectionalLight('#fff2dd', 1.48);
      dir1.position.set(3, 5, 4);
      const dir2 = new THREE.DirectionalLight('#ffd7cb', 0.68);
      dir2.position.set(-4, 2, -2);
      prodScene.add(amb, dir1, dir2);

      const dom = prodRenderer.domElement;
      dom.className = 'sc-prod-webgl';
      dom.addEventListener('pointerdown', e => {
        prodDragging = true;
        prodLastX = e.clientX;
        prodLastY = e.clientY;
        dom.setPointerCapture(e.pointerId);
      });
      dom.addEventListener('pointermove', e => {
        if (!prodDragging) return;
        const dx = e.clientX - prodLastX;
        const dy = e.clientY - prodLastY;
        prodLastX = e.clientX;
        prodLastY = e.clientY;
        prodRotY += dx * 0.012;
        prodRotX = Math.max(-0.35, Math.min(0.65, prodRotX + dy * 0.008));
      });
      const stopDrag = () => { prodDragging = false; };
      dom.addEventListener('pointerup', stopDrag);
      dom.addEventListener('pointercancel', stopDrag);
    }
    hostEl.innerHTML = '';
    hostEl.appendChild(prodRenderer.domElement);
    const rect = hostEl.getBoundingClientRect();
    const w = Math.max(300, rect.width || 420);
    const h = Math.max(280, rect.height || 360);
    prodRenderer.setSize(w, h);
    prodCam.aspect = w / h;
    prodCam.updateProjectionMatrix();
  }

  function loadProduct3D(id, { animateSlide = false, slideDir = 1, keepRotation = false } = {}) {
    if (UI_ONLY) {
      mountStaticProductArt(staticArtHost, renderProductSVG(id));
      return;
    }
    if (!prodScene) return;

    if (outgoingProdModel) {
      prodScene.remove(outgoingProdModel);
      outgoingProdModel = null;
    }

    if (prodModel) {
      if (animateSlide) {
        outgoingProdModel = prodModel;
        prodSlideT0 = performance.now();
        prodSlideDir = slideDir >= 0 ? 1 : -1;
      } else {
        prodScene.remove(prodModel);
      }
    }

    prodModel = buildProduct3DModel(id, selectedSizeIdx);
    const customUrl = getCustomModelUrlForProduct(id);
    if (customUrl) {
      attachCustomModel3DToGroup(prodModel, customUrl, 1.7);
    }
    if (!keepRotation) {
      prodRotY = 0.35;
      prodRotX = 0.16;
    }
    prodModel.rotation.set(prodRotX, prodRotY, 0);
    if (animateSlide && outgoingProdModel) {
      prodModel.position.x = prodSlideDir * 3.1;
    } else {
      prodModel.position.x = 0;
    }
    prodScene.add(prodModel);
  }

  function totalBagCount() {
    return basket.reduce((sum, item) => sum + item.qty, 0);
  }

  function startParkMatchSession() {
    clearParkTimers();
    const modalEl = document.getElementById('module-modal');
    if (modalEl && modalEl.open) modalEl.close();

    parkMatchStatus = 'WAITING';
    parkPartnerIdx = (parkPartnerIdx + 1) % PARK_PARTNERS.length;
    parkTimerSec = 300;
    parkTimerMax = 300;
    partnerReplyCursor = 0;
    userBubbleText = '';
    userBubbleUntil = 0;
    partnerBubbleText = '';
    partnerBubbleUntil = 0;
    parkChatHistory = [
      { sender: 'system', text: 'Kamu duduk santai di Bangku Tepi Kolam Ikan…' }
    ];

    onParkModeChange?.(true);
    const mm = getPocketParkMatchmaking?.();
    mm?.setSessionState(true, false);

    state = 'PARK_MATCH';
    updateStrawberryCamera('PARK_MATCH', false);
    renderUI();
    playChime(580, 0.1);

    parkMatchTimeoutId = setTimeout(() => {
      if (!active || state !== 'PARK_MATCH') return;
      parkMatchStatus = 'MATCHED';
      const partner = PARK_PARTNERS[parkPartnerIdx];
      const mmNow = getPocketParkMatchmaking?.();
      mmNow?.setSessionState(true, true);
      mmNow?.triggerTalkLook(3.2);
      playChime(680, 0.14);

      partnerBubbleText = partner.greeting;
      partnerBubbleUntil = performance.now() + 9500;
      parkChatHistory.push({
        sender: 'partner',
        name: partner.name,
        text: partner.greeting
      });
      renderUI();
      const inputEl = overlay.querySelector('#sc-park-chat-input');
      inputEl?.focus();

      parkCountdownIntervalId = setInterval(() => {
        if (!active || state !== 'PARK_MATCH') {
          clearParkTimers();
          return;
        }
        parkTimerSec = Math.max(0, parkTimerSec - 1);
        updateRadialTimerDOM();
        if (parkTimerSec <= 0) {
          clearParkTimers();
          leaveParkMatchToStore();
        }
      }, 1000);
    }, 3200);
  }

  function leaveParkMatchToStore() {
    clearParkTimers();
    const mm = getPocketParkMatchmaking?.();
    mm?.setSessionState(false, false);
    onParkModeChange?.(false);
    setState('HOME', { instant: false });
  }

  function sendParkChatMessage(rawText) {
    const text = (rawText || '').trim();
    if (!text || state !== 'PARK_MATCH') return;
    const mm = getPocketParkMatchmaking?.();

    userBubbleText = text;
    userBubbleUntil = performance.now() + 7500;
    parkChatHistory.push({ sender: 'user', name: 'Kamu', text });
    mm?.triggerTalkLook(2.8);
    playChime(560, 0.06);
    updateParkBubbleDOM();

    const inputEl = overlay.querySelector('#sc-park-chat-input');
    if (inputEl) inputEl.focus();

    if (parkMatchStatus === 'MATCHED') {
      if (parkReplyTimeoutId) clearTimeout(parkReplyTimeoutId);
      const partner = PARK_PARTNERS[parkPartnerIdx];
      partnerBubbleText = '•••';
      partnerBubbleUntil = performance.now() + 2000;
      updateParkBubbleDOM();

      parkReplyTimeoutId = setTimeout(() => {
        if (!active || state !== 'PARK_MATCH') return;
        const reply = partner.replies[partnerReplyCursor % partner.replies.length];
        partnerReplyCursor++;
        partnerBubbleText = reply;
        partnerBubbleUntil = performance.now() + 8500;
        parkChatHistory.push({ sender: 'partner', name: partner.name, text: reply });
        mm?.triggerTalkLook(3.0);
        playChime(640, 0.08);
        updateParkBubbleDOM();
        const inp = overlay.querySelector('#sc-park-chat-input');
        if (inp) inp.focus();
      }, 1350);
    }
  }

  function extendParkTimer5Min() {
    parkTimerSec = 300;
    parkTimerMax = 300;
    const mm = getPocketParkMatchmaking?.();
    mm?.triggerTalkLook(2.8);
    playChime(740, 0.12);
    const partner = PARK_PARTNERS[parkPartnerIdx];
    if (parkMatchStatus === 'MATCHED') {
      partnerBubbleText = 'Yeay! Waktu ngobrol kita diperpanjang +5 menit ❤️ Senang bisa lanjut cerita!';
      partnerBubbleUntil = performance.now() + 7500;
      parkChatHistory.push({
        sender: 'system',
        text: `❤️ Waktu ngobrol diperpanjang +5 menit bersama ${partner.name}!`
      });
    }
    updateRadialTimerDOM();
    updateParkBubbleDOM();
    spawnRadialLoveParticles();
  }

  function updateParkBubbleDOM() {
    const nowMs = performance.now();
    const uBub = overlay.querySelector('#sc-bubble-user');
    const pBub = overlay.querySelector('#sc-bubble-partner');
    if (uBub) {
      const showU = userBubbleText && nowMs < userBubbleUntil;
      uBub.classList.toggle('on', !!showU);
      const span = uBub.querySelector('p');
      if (span && showU) span.textContent = userBubbleText;
    }
    if (pBub) {
      const showP = parkMatchStatus === 'MATCHED' && partnerBubbleText && nowMs < partnerBubbleUntil;
      pBub.classList.toggle('on', !!showP);
      const span = pBub.querySelector('p');
      if (span && showP) span.textContent = partnerBubbleText;
    }
  }

  function getDefaultSizeIdxForProduct(prodId) {
    // In the reference video (00:16), Strawberry Cake defaults to "Slice" (idx 0), while drinks default to "Regular" (idx 1)
    if (prodId === 'cake' || prodId === 'tart' || prodId === 'macarons') return 0;
    return 1;
  }

  function setState(nextState, opts = {}) {
    if (nextState === 'PARK_MATCH') {
      startParkMatchSession();
      return;
    }
    if (state === 'PARK_MATCH' && nextState !== 'PARK_MATCH') {
      clearParkTimers();
      const mm = getPocketParkMatchmaking?.();
      mm?.setSessionState(false, false);
      onParkModeChange?.(false);
    }
    state = nextState;
    if (opts.productId) {
      currentProductId = opts.productId;
      selectedSizeIdx = getDefaultSizeIdxForProduct(currentProductId);
      selectedQty = 1;
    }
    if (opts.filter) {
      menuFilter = opts.filter;
    }
    if (nextState !== 'MY_BAG') {
      checkoutComplete = false;
    }
    updateStrawberryCamera(state, !!opts.instant);
    renderUI();
    if (!opts.instant) playChime(540, 0.08);
  }

  function addToBasket(prodId, sizeIdx, qty) {
    const prod = SC_MENU.find(m => m.id === prodId) || SC_MENU[0];
    const sz = prod.sizes[sizeIdx] || prod.sizes[0];
    const unitPrice = Number(sz.price ?? (prod.basePrice * (sz.mult || 1)));
    const existing = basket.find(b => b.id === prodId && b.sizeLabel === sz.label);
    if (existing) {
      existing.qty += qty;
    } else {
      basket.push({ id: prodId, sizeLabel: sz.label, unitPrice, qty });
    }
    playChime(660, 0.1);
  }

  function renderLeftHomeColumn(activeNav) {
    const bagCount = totalBagCount();
    return `
      <aside class="sc-left-home">
        <h1 class="sc-calligraphy">Good<br>Things<br>Happen Here</h1>
        <p class="sc-kicker">COFFEE &nbsp;·&nbsp; STRAWBERRIES &nbsp;·&nbsp; A BRIGHTER DAY</p>

        <div class="sc-vmenu">
          <button type="button" class="sc-vbtn ${activeNav === 'HOME' ? 'on' : ''}" data-nav="HOME">
            <span class="sc-vbtn-left"><i class="sc-vbtn-ico">⌂</i> HOME</span>
            <i class="sc-vbtn-arr">→</i>
          </button>
          <button type="button" class="sc-vbtn ${activeNav === 'MENU_GRID' ? 'on' : ''}" data-nav="MENU_GRID">
            <span class="sc-vbtn-left"><i class="sc-vbtn-ico">☕</i> MENU</span>
            <i class="sc-vbtn-arr">→</i>
          </button>
          <button type="button" class="sc-vbtn ${activeNav === 'PRODUCT_3D' ? 'on' : ''}" data-nav="PRODUCT_3D">
            <span class="sc-vbtn-left"><i class="sc-vbtn-ico">🛍</i> SHOP</span>
            <i class="sc-vbtn-arr">→</i>
          </button>
          <button type="button" class="sc-vbtn ${activeNav === 'EVENTS' ? 'on' : ''}" data-nav="EVENTS">
            <span class="sc-vbtn-left"><i class="sc-vbtn-ico">📅</i> EVENTS</span>
            <i class="sc-vbtn-arr">→</i>
          </button>
          <button type="button" class="sc-vbtn ${activeNav === 'MY_BAG' ? 'on' : ''}" data-nav="MY_BAG">
            <span class="sc-vbtn-left">
              <i class="sc-vbtn-ico">🧺</i> MY BAG
              ${bagCount > 0 ? `<em class="sc-vbtn-badge">${bagCount}</em>` : ''}
            </span>
            <i class="sc-vbtn-arr">→</i>
          </button>
        </div>

        <button type="button" class="sc-note-card sc-note-btn" id="sc-note-strawberry-card" title="Small Strawberries, Brighter Days">
          <div class="sc-note-pin"></div>
          <div class="sc-note-berry-art" aria-hidden="true">
            <svg viewBox="0 0 84 84" width="66" height="66" fill="none">
              <path d="M42 16c10-7 22-4 25 5-6 4-6 9-2 12 11 5 14 19 9 31-5 10-18 13-32 13S15 74 10 64C5 52 8 38 19 33c4-3 4-8-2-12 3-9 15-12 25-5z" fill="#D93829" stroke="#2B1E18" stroke-width="2.6"/>
              <path d="M28 16c7 3 14 8 14 8s7-5 14-8" stroke="#3E7B3B" stroke-width="4.2" stroke-linecap="round"/>
              <path d="M42 8v14" stroke="#3E7B3B" stroke-width="3.8" stroke-linecap="round"/>
              <circle cx="33" cy="37" r="2.2" fill="#F9E38E"/><circle cx="49" cy="36" r="2.2" fill="#F9E38E"/>
              <circle cx="41" cy="46" r="2.2" fill="#F9E38E"/><circle cx="28" cy="51" r="2.2" fill="#F9E38E"/>
              <circle cx="53" cy="50" r="2.2" fill="#F9E38E"/><circle cx="36" cy="60" r="2.2" fill="#F9E38E"/>
              <circle cx="47" cy="61" r="2.2" fill="#F9E38E"/>
            </svg>
          </div>
          <div class="sc-note-copy">
            <b>Small</b>
            <b>Strawberries <span class="sc-heart-icon">♥</span></b>
            <b class="sc-note-cta">Brighter Days</b>
          </div>
        </button>
      </aside>
    `;
  }

  function renderUI() {
    const bagCount = totalBagCount();
    const isBottomLeft = state === 'MENU_GRID' || state === 'PRODUCT_3D';
    const isBottomRight = state === 'EVENTS';
    const isHomeOrBag = state === 'HOME' || state === 'MY_BAG';

    overlay.dataset.state = state;

    if (state === 'PARK_MATCH') {
      const partner = PARK_PARTNERS[parkPartnerIdx];
      const isMatched = parkMatchStatus === 'MATCHED';
      const nowMs = performance.now();
      const showU = userBubbleText && nowMs < userBubbleUntil;
      const showP = isMatched && partnerBubbleText && nowMs < partnerBubbleUntil;

      overlay.innerHTML = `
        <div class="sc-park-backdrop"></div>
        <header class="sc-park-topbar">
          <button type="button" class="sc-park-back-btn" id="sc-park-back-store">
            ← Back to Strawberry Corner 🍓
          </button>
          <div class="sc-radial-love-wrap" title="Click ❤️ to extend chat +5 minutes">
            <span class="sc-radial-hover-hint">+5m</span>
            <button type="button" class="sc-radial-love-btn" id="sc-park-extend-btn" aria-label="Extend 5 minutes">
              <svg class="sc-radial-svg" viewBox="0 0 56 56" aria-hidden="true">
                <circle class="sc-radial-track" cx="28" cy="28" r="23" />
                <circle
                  class="sc-radial-ring"
                  id="sc-radial-ring"
                  cx="28"
                  cy="28"
                  r="23"
                  stroke-dasharray="${RADIAL_CIRCUMFERENCE}"
                  stroke-dashoffset="${getRadialDashOffset()}"
                />
              </svg>
              <span class="sc-radial-heart" aria-hidden="true">❤️</span>
            </button>
            <span class="sc-radial-time" id="sc-park-timer-val">${formatParkTimer(parkTimerSec)}</span>
            <div class="sc-love-particles" id="sc-love-particles" aria-hidden="true"></div>
          </div>
        </header>

        <div class="sc-park-3d-layer">
          <div class="sc-npc-bubble user ${showU ? 'on' : ''}" id="sc-bubble-user">
            <span class="sc-bubble-name">You</span>
            <p>${userBubbleText || ''}</p>
          </div>
          <div class="sc-npc-bubble partner ${showP ? 'on' : ''}" id="sc-bubble-partner">
            <span class="sc-bubble-name">${partner.name}</span>
            <p>${partnerBubbleText || ''}</p>
          </div>
        </div>

        <footer class="sc-park-chatdock">
          <div class="sc-park-quick-row">
            <button type="button" class="sc-park-chip" data-quick-chat="Halo! Suka menu apa di Strawberry Corner? 🍓">Halo! Suka menu apa? 🍓</button>
            <button type="button" class="sc-park-chip" data-quick-chat="Ikan koi di kolam depan bangku kita ini berenangnya tenang banget ya 🐟✨">Ikan koi-nya lucu 🐟</button>
            <button type="button" class="sc-park-chip" data-quick-chat="Pendar lampu taman di tepi kolam ikan ini bikin suasana ngobrol syahdu banget 🏮🌸">Suasana kolam syahdu ✨</button>
          </div>
          <form class="sc-park-chat-form" id="sc-park-chat-form">
            <span class="sc-park-status-dot ${isMatched ? 'matched' : 'waiting'}"></span>
            <input
              type="text"
              id="sc-park-chat-input"
              class="sc-park-chat-input"
              placeholder="${isMatched ? `Chat with ${partner.name}…` : 'Waiting for a friend on the bench…'}"
              autocomplete="off"
              maxlength="140"
            />
            <button type="submit" class="sc-park-send-btn" aria-label="Send">↑</button>
          </form>
        </footer>
      `;
      bindOverlayEvents();
      return;
    }

    overlay.innerHTML = `
      <div class="sc-backdrop ${isBottomLeft ? 'mode-bl' : isBottomRight ? 'mode-br' : 'mode-center'}"></div>

      <!-- Top Header Navigation (1:1 Reference Video) -->
      <header class="sc-topbar">
        <div class="sc-brand-wrap">
          <div class="sc-logo" id="sc-logo-home" title="Strawberry Corner — Home">
            <span class="sc-logo-berry">
              <svg viewBox="0 0 32 32" width="24" height="24">
                <path d="M16 6c4-3 9-2 10 2-3 2-3 4-1 5 5 2 6 8 4 13-2 4-7 5-13 5S5 30 3 26c-2-5-1-11 4-13 2-1 2-3-1-5 1-4 6-5 10-2z" fill="#D93829" stroke="#2B1E18" stroke-width="1.5"/>
                <path d="M11 6c3 1 5 3 5 3s2-2 5-3" stroke="#3E7B3B" stroke-width="2.4" stroke-linecap="round"/>
                <circle cx="13" cy="15" r="1.1" fill="#F9E38E"/><circle cx="19" cy="15" r="1.1" fill="#F9E38E"/>
                <circle cx="16" cy="20" r="1.1" fill="#F9E38E"/><circle cx="12" cy="22" r="1.1" fill="#F9E38E"/><circle cx="20" cy="22" r="1.1" fill="#F9E38E"/>
              </svg>
            </span>
            <div>
              <strong>Strawberry Corner</strong>
              <small>CAFE &amp; LITTLE THINGS</small>
            </div>
          </div>
        </div>

        <nav class="sc-topnav sc-topnav-clean" aria-label="Strawberry Corner Navigation">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-nav="HOME">${state === 'HOME' ? '• ' : ''}HOME</button>
          <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-nav="MENU_GRID">${state === 'MENU_GRID' ? '• ' : ''}MENU</button>
          <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-nav="PRODUCT_3D">${state === 'PRODUCT_3D' ? '• ' : ''}SHOP</button>
          <button type="button" class="${state === 'EVENTS' ? 'on' : ''}" data-nav="EVENTS">${state === 'EVENTS' ? '• ' : ''}STORY</button>
          <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-nav="MY_BAG">${state === 'MY_BAG' ? '• ' : ''}GALLERY</button>
        </nav>

        <div class="sc-top-stats">
          <button type="button" class="sc-sound-btn" id="sc-sound-toggle" title="Toggle Sound">
            ${soundMuted ? '🔇' : '🔊'}
          </button>
          <button type="button" class="sc-stat-pill" id="sc-berry-pill" title="Strawberry Points">
            <i class="sc-mini-berry">🍓</i> <span>${berryPoints.toLocaleString('en-US')}</span>
          </button>
          <button type="button" class="sc-stat-pill" id="sc-heart-pill" title="Corner Likes">
            <i class="sc-dot-heart">♥</i> <span>${heartLikes}</span>
          </button>
          <span class="sc-theme-dot" title="Storybook Cream Theme"></span>
        </div>
      </header>

      <!-- Floating "[ ☕ ♥ ]" Speech Bubble above the Seated Couple at the Outdoor Cafe Table (00:00, 00:35, 00:50) -->
      <div class="sc-couple-bubble ${isHomeOrBag ? 'on' : ''}" id="sc-couple-bubble">
        <span>☕</span> <i class="sc-cb-heart">♥</i>
      </div>

      <!-- Floating "you are here ↙" indicator + Clickable Hitbox for Miniature 3D Building (State 2 & State 3) -->
      <div class="sc-you-are-here ${isBottomLeft ? 'on' : ''}" id="sc-here-marker">
        <span>you are here</span>
        <svg viewBox="0 0 54 52" width="38" height="36" fill="none">
          <path d="M22 4c12 8 15 22 10 38" stroke="#D84B4B" stroke-width="2.2" stroke-dasharray="4 3" stroke-linecap="round"/>
          <path d="M26 36l6 7 7-5" stroke="#D84B4B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      ${isBottomLeft ? `<button type="button" class="sc-mini-building-hit pos-bl" id="sc-mini-building-home" title="Back to the Corner"></button>` : ''}
      ${isBottomRight ? `<button type="button" class="sc-mini-building-hit pos-br" id="sc-mini-building-home" title="Back to the Corner"></button>` : ''}

      <!-- Main Stage Area -->
      <div class="sc-stage" data-stage-state="${state}">
        ${renderStateContent()}
      </div>

      <!-- Bottom Bar (1:1 Reference Video) -->
      <footer class="sc-bottombar">
        <div class="sc-foot-brand" id="sc-foot-home">
          <span class="sc-foot-berry">🍓</span>
          <b>Strawberry Corner</b>
          <span class="sc-foot-sep">|</span>
          <small>CAFE &amp; LITTLE THINGS</small>
        </div>

        <p class="sc-foot-quote">Coffee, Strawberries, and a kinder day. <span>♥</span></p>

        <div class="sc-foot-right">
          <div class="sc-credit-pill">
            <span class="sc-credit-label">DESIGNED BY</span>
            <b>x.com/OilcanSanjaya</b>
            <span class="sc-credit-avatar">🍓</span>
          </div>
          <div class="sc-foot-icons">
            <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-nav="HOME" title="Home">⌂</button>
            <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-nav="MENU_GRID" title="Menu">☕</button>
            <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-nav="PRODUCT_3D" title="Shop">🛍</button>
            <button type="button" class="${state === 'EVENTS' ? 'on' : ''}" data-nav="EVENTS" title="Events">📅</button>
            <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-nav="MY_BAG" title="My Bag">
              🧺
              ${bagCount > 0 ? `<em class="sc-foot-bag-dot">${bagCount}</em>` : ''}
            </button>
          </div>
        </div>
      </footer>
    `;

    bindOverlayEvents();

    if (state === 'PRODUCT_3D') {
      const host = overlay.querySelector('#sc-product-canvas-host');
      if (host) {
        ensureProductRenderer(host);
        loadProduct3D(currentProductId);
      }
    }
  }

  function renderStateContent() {
    // ========================================================================
    // STATE 1: HOME (00:00 - 00:02, 00:35 - 00:36, 00:49 - 00:50, 01:00 - 01:02)
    // ========================================================================
    if (state === 'HOME') {
      const bestsellers = SC_MENU.slice(0, 4);
      return `
        ${renderLeftHomeColumn('HOME')}

        <section class="sc-right-home">
          <!-- Card 1: Season Special -->
          <div class="sc-card sc-hero-card">
            <div class="sc-hero-copy">
              <span class="sc-eyebrow">• SEASON SPECIAL</span>
              <h2>Strawberry<br>Moments <span>♥</span></h2>
              <p>SWEET RECIPES FOR A BRIGHTER DAY</p>
              <button type="button" class="sc-pill-cta" id="sc-see-menu">SEE MENU &nbsp;→</button>
            </div>
            <div class="sc-hero-art">
              ${renderProductSVG('cake')}
            </div>
          </div>

          <!-- Card 2: Our Bestsellers -->
          <div class="sc-card">
            <div class="sc-card-head">
              <span>OUR BESTSELLERS</span>
              <button type="button" class="sc-link-btn" data-nav="MENU_GRID">VIEW ALL →</button>
            </div>
            <div class="sc-mini-grid">
              ${bestsellers.map(item => `
                <button type="button" class="sc-mini-item" data-open-prod="${item.id}">
                  <div class="sc-mini-thumb">${renderProductSVG(item.id)}</div>
                  <b>${item.name}</b>
                  <small>${formatUSD(item.basePrice)}</small>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Card 3: Strawberry Goods -->
          <div class="sc-card">
            <div class="sc-card-head">
              <span>STRAWBERRY GOODS</span>
              <button type="button" class="sc-link-btn" data-nav="MENU_GRID">SHOP NOW →</button>
            </div>
            <div class="sc-mini-grid">
              ${SC_GOODS.map(g => `
                <button type="button" class="sc-mini-item sc-good-tile" data-open-prod="${g.targetProd}">
                  <div class="sc-mini-thumb sc-good-bg">${renderGoodsSVG(g.id)}</div>
                  <b>${g.name}</b>
                </button>
              `).join('')}
            </div>
          </div>
        </section>
      `;
    }

    // ========================================================================
    // STATE 2: MENU_GRID (00:03 - 00:06)
    // ========================================================================
    if (state === 'MENU_GRID') {
      const filtered = menuFilter === 'ALL'
        ? SC_MENU
        : SC_MENU.filter(item => item.cat === menuFilter);

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-nav="HOME">← BACK TO THE CORNER</button>
          <h1 class="sc-calligraphy-sm">Our Menu</h1>
          <p class="sc-kicker">BAKED THIS MORNING &nbsp;·&nbsp; POURED WITH LOVE</p>
        </aside>

        <section class="sc-right-panel sc-card sc-menu-panel">
          <div class="sc-menu-bar">
            <span class="sc-section-tag"><i class="sc-tag-circle">⌄</i> OUR MENU</span>
            <div class="sc-filter-pills">
              <button type="button" class="${menuFilter === 'ALL' ? 'on' : ''}" data-filter="ALL">ALL <b>8</b></button>
              <button type="button" class="${menuFilter === 'DRINKS' ? 'on' : ''}" data-filter="DRINKS">DRINKS</button>
              <button type="button" class="${menuFilter === 'SWEETS' ? 'on' : ''}" data-filter="SWEETS">SWEETS</button>
              <button type="button" class="${menuFilter === 'JARS' ? 'on' : ''}" data-filter="JARS">JARS</button>
            </div>
          </div>

          <div class="sc-menu-grid">
            ${filtered.map(item => `
              <article class="sc-menu-card" data-open-prod="${item.id}">
                <div class="sc-menu-art">${renderProductSVG(item.id)}</div>
                <h3>${item.name}</h3>
                <p>${item.sub}</p>
                <div class="sc-menu-foot">
                  <strong>${formatUSD(item.basePrice)}</strong>
                  <button type="button" class="sc-plus-btn" data-quick-add="${item.id}" title="Add ${item.name} to bag">+</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      `;
    }

    // ========================================================================
    // STATE 3: PRODUCT_3D — OPEN CENTER TURNTABLE STAGE (00:07 - 00:33)
    // ========================================================================
    if (state === 'PRODUCT_3D') {
      const prod = SC_MENU.find(m => m.id === currentProductId) || SC_MENU[0];
      const sz = prod.sizes[selectedSizeIdx] || prod.sizes[0];
      const unitPrice = Number(sz.price ?? (prod.basePrice * (sz.mult || 1)));
      const totalPrice = unitPrice * selectedQty;

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-nav="HOME">← BACK TO THE CORNER</button>
          <h1 class="sc-calligraphy-sm">Our Menu</h1>
          <p class="sc-kicker">BAKED THIS MORNING &nbsp;·&nbsp; POURED WITH LOVE</p>
        </aside>

        <!-- Open Center 3D Product Turntable + Bottom 8-Thumbnail Strip (No boxy card around 3D model!) -->
        <div class="sc-prod-open-center">
          <div class="sc-open-canvas-wrap" id="sc-product-canvas-host"></div>
          <div class="sc-drag-hint-row">
            <span class="sc-drag-Hint">↻ &nbsp; Drag to turn it around</span>
          </div>
          <div class="sc-thumb-carousel-row">
            <button type="button" class="sc-thumb-nav-arrow" id="sc-prod-prev" aria-label="Previous Treat">‹</button>
            <div class="sc-thumb-strip">
              ${SC_MENU.map(item => `
                <button type="button" class="sc-thumb-btn ${item.id === prod.id ? 'on' : ''}" data-switch-prod="${item.id}" title="${item.name}">
                  <span class="sc-thumb-art">${renderProductSVG(item.id)}</span>
                </button>
              `).join('')}
            </div>
            <button type="button" class="sc-thumb-nav-arrow" id="sc-prod-next" aria-label="Next Treat">›</button>
          </div>
        </div>

        <!-- Right Product Detail Column -->
        <aside class="sc-prod-detail-col">
          <button type="button" class="sc-back-treats" data-nav="MENU_GRID">← ALL TREATS</button>
          <span class="sc-prod-cat">• ${prod.cat}</span>
          <h2 class="sc-prod-title">${prod.name}</h2>
          <strong class="sc-prod-price" id="sc-live-price">${formatUSD(totalPrice)}</strong>
          <p class="sc-prod-desc">${prod.desc}</p>

          <div class="sc-prod-tags">
            ${prod.tags.map(t => `<span>${t}</span>`).join('')}
          </div>

          <div class="sc-size-row">
            ${prod.sizes.map((s, idx) => `
              <button type="button" class="sc-size-btn ${idx === selectedSizeIdx ? 'on' : ''}" data-size-idx="${idx}">
                ${s.label}
              </button>
            `).join('')}
          </div>

          <div class="sc-buy-row">
            <div class="sc-qty-box">
              <button type="button" id="sc-qty-minus">−</button>
              <span id="sc-qty-val">${selectedQty}</span>
              <button type="button" id="sc-qty-plus">+</button>
            </div>
            <button type="button" class="sc-add-bag-btn" id="sc-add-bag">ADD TO BAG &nbsp;🛍</button>
          </div>
        </aside>
      `;
    }

    // ========================================================================
    // STATE 4: EVENTS — SPIRAL NOTEBOOK CALENDAR & ON THE DAY (00:37 - 00:48)
    // ========================================================================
    if (state === 'EVENTS') {
      const mData = SC_EVENTS[currentMonth] || SC_EVENTS['2026-10'];
      const evIdx = Math.min(selectedEventIdx, mData.items.length - 1);
      const ev = mData.items[evIdx] || mData.items[0];
      const eventKey = `${currentMonth}-${ev.day}`;
      const isReserved = reservedEvents.has(eventKey);
      const seatsLeftNow = Math.max(0, ev.seatsLeft - (isReserved ? 1 : 0));

      const cells = [];
      for (let i = 0; i < mData.offset; i++) {
        cells.push(`<div class="sc-cal-cell empty"></div>`);
      }
      for (let d = 1; d <= mData.days; d++) {
        const foundIdx = mData.items.findIndex(it => it.day === d);
        if (foundIdx >= 0) {
          const it = mData.items[foundIdx];
          const isSel = foundIdx === evIdx;
          const res = reservedEvents.has(`${currentMonth}-${d}`);
          cells.push(`
            <button type="button" class="sc-cal-cell event ${isSel ? 'sel' : ''} ${res ? 'reserved' : ''}" data-ev-idx="${foundIdx}">
              <div class="sc-cal-cell-top">
                <b>${d}</b>
                ${res ? `<span class="sc-cal-heart">♥</span>` : isSel ? `<span class="sc-cal-dot"></span>` : ''}
              </div>
              <div class="sc-cal-ico">${renderEventIconSVG(it.icon)}</div>
              <small>${it.short}</small>
            </button>
          `);
        } else {
          cells.push(`<div class="sc-cal-cell"><div class="sc-cal-cell-top"><b>${d}</b></div></div>`);
        }
      }
      while (cells.length % 7 !== 0) {
        cells.push(`<div class="sc-cal-cell empty"></div>`);
      }

      const seatDots = [];
      for (let s = 0; s < ev.seatsTotal; s++) {
        const filled = s < (ev.seatsTotal - seatsLeftNow);
        seatDots.push(`<i class="sc-seat-dot ${filled ? 'taken' : 'open'}"></i>`);
      }

      return `
        <!-- Left/Center: Spiral-Notebook Monthly Calendar (October - December 2026) -->
        <section class="sc-events-left sc-card sc-notebook-cal">
          <div class="sc-spiral-rings" aria-hidden="true">
            ${Array.from({ length: 14 }, () => `<span></span>`).join('')}
          </div>

          <div class="sc-cal-header">
            <div class="sc-cal-month-nav">
              <button type="button" class="sc-month-arrow" id="sc-month-prev" aria-label="Previous Month">‹</button>
              <h2 class="sc-cal-month-title"><em>${mData.label}</em> <span>${mData.year}</span></h2>
              <button type="button" class="sc-month-arrow" id="sc-month-next" aria-label="Next Month">›</button>
            </div>
            <p class="sc-cal-kicker">LITTLE GATHERINGS AT THE CORNER</p>
          </div>

          <div class="sc-cal-weekdays">
            <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span class="wknd">SAT</span><span class="wknd">SUN</span>
          </div>

          <div class="sc-cal-grid">
            ${cells.join('')}
          </div>

          <div class="sc-cal-footer">
            <span>🍓 Wednesday evenings &amp; Saturdays · seats are free, the kettle is on.</span>
          </div>
        </section>

        <!-- Right-Top Side (Above Miniature 3D Building in Bottom-Right): ON THE DAY Card -->
        <aside class="sc-events-right">
          <div class="sc-card sc-ontheday-card">
            <div class="sc-otd-top-row">
              <span class="sc-eyebrow">• ON THE DAY</span>
              <span class="sc-otd-counter">${evIdx + 1} / ${mData.items.length}</span>
            </div>

            <div class="sc-otd-body">
              <div class="sc-otd-date-badge">
                <small>${ev.dow}</small>
                <strong>${ev.day}</strong>
                <span>${mData.shortMonth}</span>
              </div>
              <div class="sc-otd-info">
                <h3>${ev.title}</h3>
                <p class="sc-otd-meta">🕒 ${ev.time} &nbsp;·&nbsp; ${ev.host}</p>
                <p class="sc-otd-desc">${ev.desc}</p>
              </div>
            </div>

            <div class="sc-otd-foot">
              <div class="sc-otd-seats">
                <div class="sc-seat-dots">${seatDots.join('')}</div>
                <small>${seatsLeftNow} of ${ev.seatsTotal} seats left</small>
              </div>
              <button type="button" class="sc-save-seat-btn ${isReserved ? 'reserved-stamp' : ''}" id="sc-save-seat" data-ev-key="${eventKey}">
                ${isReserved
                  ? `<span>♥ RESERVED</span><small>CANCEL ANYWAY</small>`
                  : `SAVE A SEAT`}
              </button>
            </div>
          </div>
        </aside>
      `;
    }

    // ========================================================================
    // STATE 5: MY_BAG ("Your little basket") & ORDER PLACED ("Thank you!") (00:51 - 00:59)
    // ========================================================================
    const bagCount = totalBagCount();
    const subtotal = basket.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);

    if (checkoutComplete) {
      return `
        ${renderLeftHomeColumn('MY_BAG')}

        <section class="sc-right-bag">
          <div class="sc-card sc-receipt-card">
            <div class="sc-receipt-check">✓</div>
            <span class="sc-receipt-eyebrow">ORDER PLACED</span>
            <h2 class="sc-receipt-title">Thank you!</h2>
            <p class="sc-receipt-sub">Your treats will be ready at the corner in 15 minutes.</p>

            <div class="sc-receipt-box">
              <div class="sc-receipt-box-head">
                <span>ORDER NO. #214</span>
                <span>OCT 18</span>
              </div>
              <div class="sc-receipt-items">
                ${basket.map(it => {
                  const prod = SC_MENU.find(m => m.id === it.id) || SC_MENU[0];
                  return `
                    <div class="sc-receipt-row">
                      <span>${it.qty}× ${prod.name} <em>(${it.sizeLabel})</em></span>
                      <b>${formatUSD(it.unitPrice * it.qty)}</b>
                    </div>
                  `;
                }).join('')}
                <div class="sc-receipt-row gift">
                  <span>1× Berry Macaron <em>(On us ♥)</em></span>
                  <b>Free</b>
                </div>
              </div>
              <div class="sc-receipt-total-row">
                <span>Total</span>
                <strong>${formatUSD(subtotal)}</strong>
              </div>
            </div>

            <div class="sc-made-with-love-stamp">MADE WITH LOVE ♥</div>

            <button type="button" class="sc-back-corner-btn" id="sc-receipt-done">
              BACK TO THE CORNER
            </button>
          </div>
        </section>
      `;
    }

    return `
      ${renderLeftHomeColumn('MY_BAG')}

      <section class="sc-right-bag">
        <div class="sc-card sc-basket-card">
          <div class="sc-basket-head">
            <div>
              <span class="sc-eyebrow">🛍 MY BAG &nbsp;(${bagCount} ${bagCount === 1 ? 'TREAT' : 'TREATS'})</span>
              <h2 class="sc-basket-title">Your little basket</h2>
            </div>
            <button type="button" class="sc-link-btn" data-nav="MENU_GRID">ADD MORE →</button>
          </div>

          <div class="sc-basket-list">
            ${basket.length === 0 ? `
              <div class="sc-basket-empty">
                <p>Your basket is empty — pick a treat from the corner!</p>
              </div>
            ` : basket.map((it, idx) => {
              const prod = SC_MENU.find(m => m.id === it.id) || SC_MENU[0];
              return `
                <div class="sc-basket-row">
                  <div class="sc-basket-thumb">${renderProductSVG(prod.id)}</div>
                  <div class="sc-basket-info">
                    <b>${prod.name}</b>
                    <small>${it.sizeLabel.toUpperCase()} · ${formatUSD(it.unitPrice)} EACH</small>
                  </div>
                  <div class="sc-basket-qty">
                    <button type="button" data-bag-dec="${idx}">−</button>
                    <span>${it.qty}</span>
                    <button type="button" data-bag-inc="${idx}">+</button>
                  </div>
                  <strong class="sc-basket-price">${formatUSD(it.unitPrice * it.qty)}</strong>
                  <button type="button" class="sc-basket-del" data-bag-del="${idx}" title="Remove">×</button>
                </div>
              `;
            }).join('')}

            <!-- Complimentary Berry Macaron Dashed Box (00:52 - 00:56) -->
            <div class="sc-basket-gift-box">
              <div class="sc-basket-thumb">${renderProductSVG('macarons')}</div>
              <div class="sc-basket-info">
                <div class="sc-gift-title-row">
                  <b>Berry Macaron</b>
                  <span class="sc-on-us-pill">ON US ♥</span>
                </div>
                <small>A LITTLE THANK YOU, ON US</small>
              </div>
              <strong class="sc-gift-free">Free</strong>
            </div>
          </div>

          <p class="sc-basket-sweet-note">🍓 A Berry Macaron is tucked into your bag, on us ♥</p>

          <div class="sc-basket-summary">
            <div class="sc-sum-row">
              <span>Treats</span>
              <b>${formatUSD(subtotal)}</b>
            </div>
            <div class="sc-sum-row free">
              <span>Berry Macaron</span>
              <b>Free</b>
            </div>
            <div class="sc-sum-row free">
              <span>Little gift · Seed packet</span>
              <b>Free</b>
            </div>
            <div class="sc-sum-total">
              <span>TOTAL</span>
              <strong>${formatUSD(subtotal)}</strong>
            </div>
          </div>

          <button type="button" class="sc-checkout-cta" id="sc-checkout-btn" ${basket.length === 0 ? 'disabled' : ''}>
            CHECKOUT &nbsp;·&nbsp; READY IN 15 MIN &nbsp;→
          </button>
        </div>
      </section>
    `;
  }

  function bindOverlayEvents() {
    overlay.querySelector('#sc-logo-home')?.addEventListener('click', () => setState('HOME'));
    overlay.querySelector('#sc-foot-home')?.addEventListener('click', () => setState('HOME'));
    overlay.querySelector('#sc-mini-building-home')?.addEventListener('click', () => setState('HOME'));
    overlay.querySelector('#sc-here-marker')?.addEventListener('click', () => setState('HOME'));
    overlay.querySelector('#sc-see-menu')?.addEventListener('click', () => setState('MENU_GRID', { filter: 'ALL' }));
    overlay.querySelector('#sc-note-strawberry-card')?.addEventListener('click', () => setState('MENU_GRID', { filter: 'SWEETS' }));

    overlay.querySelector('#sc-sound-toggle')?.addEventListener('click', () => {
      soundMuted = !soundMuted;
      renderUI();
      if (!soundMuted) playChime(620, 0.08);
    });

    overlay.querySelector('#sc-berry-pill')?.addEventListener('click', () => {
      berryPoints += 10;
      playChime(700, 0.08);
      renderUI();
    });

    overlay.querySelector('#sc-heart-pill')?.addEventListener('click', () => {
      heartLikes += 1;
      playChime(740, 0.09);
      renderUI();
    });

    overlay.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (target === 'SHOP') {
          setState('PRODUCT_3D', { productId: currentProductId || 'latte' });
        } else {
          setState(target);
        }
      });
    });

    overlay.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        menuFilter = btn.dataset.filter;
        renderUI();
        playChime(500, 0.06);
      });
    });

    overlay.querySelectorAll('[data-open-prod]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-quick-add]')) return;
        setState('PRODUCT_3D', { productId: el.dataset.openProd });
      });
    });

    overlay.querySelectorAll('[data-quick-add]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pid = btn.dataset.quickAdd;
        addToBasket(pid, getDefaultSizeIdxForProduct(pid), 1);
        btn.textContent = '✓';
        btn.classList.add('added');
        setTimeout(() => {
          renderUI();
        }, 420);
      });
    });

    const switchProductWithSlide = (nextProdId, slideDir = 1) => {
      if (nextProdId === currentProductId) return;
      currentProductId = nextProdId;
      selectedSizeIdx = getDefaultSizeIdxForProduct(currentProductId);
      selectedQty = 1;
      playChime(560, 0.07);

      // Update right column & thumbnail active state in-place so the 3D canvas can smoothly slide the old model out and new model in!
      const prod = SC_MENU.find(m => m.id === currentProductId) || SC_MENU[0];
      const sz = prod.sizes[selectedSizeIdx] || prod.sizes[0];
      const unitPrice = Number(sz.price ?? prod.basePrice);
      const detailCol = overlay.querySelector('.sc-prod-detail-col');
      if (detailCol && prodScene) {
        detailCol.innerHTML = `
          <button type="button" class="sc-back-treats" data-nav="MENU_GRID">← ALL TREATS</button>
          <span class="sc-prod-cat">• ${prod.cat}</span>
          <h2 class="sc-prod-title">${prod.name}</h2>
          <strong class="sc-prod-price" id="sc-live-price">${formatUSD(unitPrice * selectedQty)}</strong>
          <p class="sc-prod-desc">${prod.desc}</p>
          <div class="sc-prod-tags">
            ${prod.tags.map(t => `<span>${t}</span>`).join('')}
          </div>
          <div class="sc-size-row">
            ${prod.sizes.map((s, idx) => `
              <button type="button" class="sc-size-btn ${idx === selectedSizeIdx ? 'on' : ''}" data-size-idx="${idx}">
                ${s.label}
              </button>
            `).join('')}
          </div>
          <div class="sc-buy-row">
            <div class="sc-qty-box">
              <button type="button" id="sc-qty-minus">−</button>
              <span id="sc-qty-val">${selectedQty}</span>
              <button type="button" id="sc-qty-plus">+</button>
            </div>
            <button type="button" class="sc-add-bag-btn" id="sc-add-bag">ADD TO BAG &nbsp;🛍</button>
          </div>
        `;
        overlay.querySelectorAll('.sc-thumb-btn').forEach(b => {
          b.classList.toggle('on', b.dataset.switchProd === currentProductId);
        });
        loadProduct3D(currentProductId, { animateSlide: true, slideDir });
        bindProductDetailControls();
      } else {
        renderUI();
      }
    };

    overlay.querySelectorAll('[data-switch-prod]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextId = btn.dataset.switchProd;
        const curIdx = SC_MENU.findIndex(m => m.id === currentProductId);
        const nextIdx = SC_MENU.findIndex(m => m.id === nextId);
        const dir = nextIdx >= curIdx ? 1 : -1;
        switchProductWithSlide(nextId, dir);
      });
    });

    overlay.querySelector('#sc-prod-prev')?.addEventListener('click', () => {
      const curIdx = SC_MENU.findIndex(m => m.id === currentProductId);
      const prevIdx = (curIdx - 1 + SC_MENU.length) % SC_MENU.length;
      switchProductWithSlide(SC_MENU[prevIdx].id, -1);
    });

    overlay.querySelector('#sc-prod-next')?.addEventListener('click', () => {
      const curIdx = SC_MENU.findIndex(m => m.id === currentProductId);
      const nextIdx = (curIdx + 1) % SC_MENU.length;
      switchProductWithSlide(SC_MENU[nextIdx].id, 1);
    });

    function bindProductDetailControls() {
      overlay.querySelector('.sc-prod-detail-col [data-nav="MENU_GRID"]')?.addEventListener('click', () => {
        setState('MENU_GRID');
      });

      overlay.querySelectorAll('[data-size-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedSizeIdx = parseInt(btn.dataset.sizeIdx, 10);
          const prod = SC_MENU.find(m => m.id === currentProductId) || SC_MENU[0];
          const sz = prod.sizes[selectedSizeIdx] || prod.sizes[0];
          const unitPrice = Number(sz.price ?? prod.basePrice);
          const priceEl = overlay.querySelector('#sc-live-price');
          if (priceEl) priceEl.textContent = formatUSD(unitPrice * selectedQty);
          overlay.querySelectorAll('.sc-size-btn').forEach((b, idx) => {
            b.classList.toggle('on', idx === selectedSizeIdx);
          });
          // Rebuild 3D model in-place (preserving rotation!) so "Two slices" / "Whole cake" adds the second slice on the plate!
          loadProduct3D(currentProductId, { animateSlide: false, keepRotation: true });
          playChime(520, 0.06);
        });
      });

      overlay.querySelector('#sc-qty-minus')?.addEventListener('click', () => {
        selectedQty = Math.max(1, selectedQty - 1);
        const prod = SC_MENU.find(m => m.id === currentProductId) || SC_MENU[0];
        const sz = prod.sizes[selectedSizeIdx] || prod.sizes[0];
        const unitPrice = Number(sz.price ?? prod.basePrice);
        const qtyEl = overlay.querySelector('#sc-qty-val');
        const priceEl = overlay.querySelector('#sc-live-price');
        if (qtyEl) qtyEl.textContent = String(selectedQty);
        if (priceEl) priceEl.textContent = formatUSD(unitPrice * selectedQty);
      });

      overlay.querySelector('#sc-qty-plus')?.addEventListener('click', () => {
        selectedQty = Math.min(20, selectedQty + 1);
        const prod = SC_MENU.find(m => m.id === currentProductId) || SC_MENU[0];
        const sz = prod.sizes[selectedSizeIdx] || prod.sizes[0];
        const unitPrice = Number(sz.price ?? prod.basePrice);
        const qtyEl = overlay.querySelector('#sc-qty-val');
        const priceEl = overlay.querySelector('#sc-live-price');
        if (qtyEl) qtyEl.textContent = String(selectedQty);
        if (priceEl) priceEl.textContent = formatUSD(unitPrice * selectedQty);
      });

      const addBagBtn = overlay.querySelector('#sc-add-bag');
      addBagBtn?.addEventListener('click', () => {
        addToBasket(currentProductId, selectedSizeIdx, selectedQty);
        addBagBtn.innerHTML = 'ADDED ♥ &nbsp;✓';
        addBagBtn.classList.add('added');
        const footBagBtn = overlay.querySelector('.sc-foot-icons [data-nav="MY_BAG"]');
        if (footBagBtn) {
          footBagBtn.innerHTML = `🧺 <em class="sc-foot-bag-dot">${totalBagCount()}</em>`;
        }
        setTimeout(() => {
          if (addBagBtn.isConnected) {
            addBagBtn.innerHTML = 'ADD TO BAG &nbsp;🛍';
            addBagBtn.classList.remove('added');
          }
        }, 1250);
      });
    }

    if (state === 'PRODUCT_3D') {
      bindProductDetailControls();
    }

    // Events Month Prev/Next Navigation
    const monthKeys = Object.keys(SC_EVENTS);
    overlay.querySelector('#sc-month-prev')?.addEventListener('click', () => {
      const idx = monthKeys.indexOf(currentMonth);
      currentMonth = monthKeys[(idx - 1 + monthKeys.length) % monthKeys.length];
      selectedEventIdx = 0;
      renderUI();
      playChime(510, 0.07);
    });
    overlay.querySelector('#sc-month-next')?.addEventListener('click', () => {
      const idx = monthKeys.indexOf(currentMonth);
      currentMonth = monthKeys[(idx + 1) % monthKeys.length];
      selectedEventIdx = 0;
      renderUI();
      playChime(510, 0.07);
    });

    overlay.querySelectorAll('[data-ev-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedEventIdx = parseInt(btn.dataset.evIdx, 10);
        renderUI();
        playChime(560, 0.07);
      });
    });

    overlay.querySelector('#sc-save-seat')?.addEventListener('click', e => {
      const key = e.currentTarget.dataset.evKey;
      if (reservedEvents.has(key)) {
        reservedEvents.delete(key);
      } else {
        reservedEvents.add(key);
        heartLikes += 1;
      }
      renderUI();
      playChime(680, 0.11);
    });

    // State 5: My Bag ("Your little basket") & Order Placed ("Thank you!") Controls
    overlay.querySelectorAll('[data-bag-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.bagDec, 10);
        if (basket[idx]) {
          basket[idx].qty--;
          if (basket[idx].qty <= 0) basket.splice(idx, 1);
          renderUI();
          playChime(500, 0.06);
        }
      });
    });

    overlay.querySelectorAll('[data-bag-inc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.bagInc, 10);
        if (basket[idx]) {
          basket[idx].qty++;
          renderUI();
          playChime(560, 0.06);
        }
      });
    });

    overlay.querySelectorAll('[data-bag-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.bagDel, 10);
        if (basket[idx]) {
          basket.splice(idx, 1);
          renderUI();
          playChime(480, 0.06);
        }
      });
    });

    overlay.querySelector('#sc-checkout-btn')?.addEventListener('click', () => {
      if (basket.length === 0) return;
      checkoutComplete = true;
      berryPoints += 25;
      playChime(720, 0.14);
      renderUI();
      submitOrder('toko5', basket, {
        channel: 'web_modal',
        storeName: 'Strawberry Corner',
        paymentMethod: 'corner_pickup'
      });
    });

    overlay.querySelector('#sc-receipt-done')?.addEventListener('click', () => {
      checkoutComplete = false;
      setState('HOME');
    });

    // Park Matchmaking Controls
    overlay.querySelector('#sc-park-back-store')?.addEventListener('click', () => {
      leaveParkMatchToStore();
    });
    overlay.querySelector('#sc-park-extend-btn')?.addEventListener('click', () => {
      extendParkTimer5Min();
    });

    overlay.querySelectorAll('[data-quick-chat]').forEach(chip => {
      chip.addEventListener('click', () => {
        sendParkChatMessage(chip.dataset.quickChat);
      });
    });

    const chatForm = overlay.querySelector('#sc-park-chat-form');
    chatForm?.addEventListener('submit', e => {
      e.preventDefault();
      const inp = overlay.querySelector('#sc-park-chat-input');
      if (inp && inp.value.trim()) {
        const msg = inp.value;
        inp.value = '';
        sendParkChatMessage(msg);
      }
    });
  }

  let onExitCallback = null;

  function enter(exitCb, opts = {}) {
    onExitCallback = exitCb;
    active = true;
    const strawberryBuildingGroup = stores[5].g;
    if (savedVillageRotY === null) {
      savedVillageRotY = strawberryBuildingGroup.rotation.y;
    }
    strawberryBuildingGroup.scale.set(1, 1, 1);
    document.getElementById('app')?.classList.add('sc-mode-active');
    overlay.style.display = 'flex';
    camAnim.curPos.copy(camera.position);
    camAnim.curTarget.copy(controls.target);
    camAnim.curOffsetX = 0;
    camAnim.curOffsetY = 0;
    camera.clearViewOffset();
    setState('HOME', { instant: !!opts.instant });
  }

  function exit() {
    if (!active) return;
    clearParkTimers();
    parkOrbitUnlocked = false;
    controls.enabled = false;
    const mm = getPocketParkMatchmaking?.();
    mm?.setSessionState(false, false);
    onParkModeChange?.(false);
    active = false;
    overlay.style.display = 'none';
    document.getElementById('app')?.classList.remove('sc-mode-active');
    const strawberryBuildingGroup = stores[5].g;
    strawberryBuildingGroup.scale.set(1, 1, 1);
    if (savedVillageRotY !== null) {
      strawberryBuildingGroup.rotation.y = savedVillageRotY;
      strawberryBuildingGroup.updateMatrixWorld(true);
    }
    camAnim.fromOffsetX = camAnim.toOffsetX = camAnim.curOffsetX = 0;
    camAnim.fromOffsetY = camAnim.toOffsetY = camAnim.curOffsetY = 0;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    onExitCallback?.();
  }

  const _proj = new THREE.Vector3();
  const _coupleWorld = new THREE.Vector3();
  function projectToScreen(vec3) {
    _proj.copy(vec3).project(camera);
    return [
      (_proj.x * 0.5 + 0.5) * window.innerWidth,
      (-_proj.y * 0.5 + 0.5) * window.innerHeight,
      _proj.z
    ];
  }

  function update(now, dt) {
    if (!active) return;

    stores[5].g.scale.set(1, 1, 1);

    // 1. Cubic-Bezier Camera Position + Target + ViewOffset Interpolation
    const elapsed = now - camAnim.t0;
    const u = Math.min(1, Math.max(0, elapsed / camAnim.dur));
    const k = cubicBezierEase(u);

    if (state === 'PARK_MATCH') {
      camera.clearViewOffset();
      if (u < 1 && !parkOrbitUnlocked) {
        camAnim.curPos.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
        camAnim.curTarget.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
        camera.position.copy(camAnim.curPos);
        controls.target.copy(camAnim.curTarget);
        camera.lookAt(controls.target);
        camera.updateMatrixWorld();
      } else {
        if (!parkOrbitUnlocked) {
          parkOrbitUnlocked = true;
          camera.position.copy(camAnim.toPos);
          controls.target.copy(camAnim.toTarget);
          controls.enabled = true;
        }
        controls.target.copy(camAnim.toTarget);
        controls.update();
        camera.updateMatrixWorld();
        camAnim.curPos.copy(camera.position);
        camAnim.curTarget.copy(controls.target);
      }

      const mm = getPocketParkMatchmaking?.();
      if (mm) {
        const anchors = mm.getWorldAnchors();
        const [ux, uy, uz] = projectToScreen(anchors.userHead);
        const [px, py, pz] = projectToScreen(anchors.partnerHead);
        const uSign = ux <= px ? -1 : 1;
        const horizGap = Math.abs(ux - px);
        const spread = horizGap < 180 ? (180 - horizGap) * 0.42 : 16;

        const uBub = overlay.querySelector('#sc-bubble-user');
        if (uBub && uz < 1) {
          uBub.style.left = `${Math.round(Math.max(130, Math.min(window.innerWidth - 130, ux + uSign * spread)))}px`;
          uBub.style.top = `${Math.round(Math.max(76, Math.min(window.innerHeight - 135, uy - 10)))}px`;
        }
        const pBub = overlay.querySelector('#sc-bubble-partner');
        if (pBub && pz < 1) {
          pBub.style.left = `${Math.round(Math.max(130, Math.min(window.innerWidth - 130, px - uSign * spread)))}px`;
          pBub.style.top = `${Math.round(Math.max(76, Math.min(window.innerHeight - 135, py - 10)))}px`;
        }
      }
      updateParkBubbleDOM();
      return;
    }

    camAnim.curPos.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
    camAnim.curTarget.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
    camAnim.curOffsetX = camAnim.fromOffsetX + (camAnim.toOffsetX - camAnim.fromOffsetX) * k;
    camAnim.curOffsetY = camAnim.fromOffsetY + (camAnim.toOffsetY - camAnim.fromOffsetY) * k;

    applyCurrentViewOffset();

    camera.position.copy(camAnim.curPos);
    controls.target.copy(camAnim.curTarget);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    // 2. Position the floating "[ ☕ ♥ ]" speech bubble right above the seated couple at the cafe table in HOME & MY_BAG
    if (state === 'HOME' || state === 'MY_BAG') {
      const coupleBub = overlay.querySelector('#sc-couple-bubble');
      if (coupleBub && stores[5].coupleTableAnchor) {
        _coupleWorld.copy(stores[5].coupleTableAnchor);
        stores[5].g.localToWorld(_coupleWorld);
        const [cx, cy, cz] = projectToScreen(_coupleWorld);
        if (cz < 1) {
          coupleBub.style.left = `${Math.round(cx)}px`;
          coupleBub.style.top = `${Math.round(cy - 8)}px`;
        }
      }
    }

    // 3. Position the floating "you are here ↙" marker right above the rooftop strawberry in States 2 & 3
    if (state === 'MENU_GRID' || state === 'PRODUCT_3D') {
      const marker = overlay.querySelector('#sc-here-marker');
      if (marker) {
        _proj.set(cachedCenter.x - 0.3, cachedMaxY + 0.55, cachedCenter.z).project(camera);
        const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
        marker.style.left = `${Math.max(70, Math.min(window.innerWidth * 0.34, sx))}px`;
        marker.style.top = `${Math.max(145, Math.min(window.innerHeight - 180, sy - 6))}px`;
      }
    }

    // 4. Render the 360° Toon + Ink Outline Product Canvas in State 3 (with Horizontal Slide Transition!)
    if (state === 'PRODUCT_3D' && prodRenderer && prodScene && prodCam && prodModel) {
      if (!prodDragging) {
        prodRotY += dt * 0.55;
      }
      prodModel.rotation.set(prodRotX, prodRotY, 0);

      if (outgoingProdModel) {
        const slideElapsed = now - prodSlideT0;
        const su = Math.min(1, Math.max(0, slideElapsed / PROD_SLIDE_DUR));
        const sk = cubicBezierEase(su);
        outgoingProdModel.position.x = -prodSlideDir * 3.2 * sk;
        outgoingProdModel.rotation.set(prodRotX, prodRotY, 0);
        prodModel.position.x = prodSlideDir * 3.2 * (1 - sk);
        if (su >= 1) {
          prodScene.remove(outgoingProdModel);
          outgoingProdModel = null;
          prodModel.position.x = 0;
        }
      }

      prodRenderer.render(prodScene, prodCam);
    }
  }

  return {
    get isActive() { return active; },
    get isParkMatchActive() { return active && state === 'PARK_MATCH'; },
    enter,
    exit,
    update,
    setState,
    updateStrawberryCamera
  };
}
