/* ==========================================================================
   STRAWBERRY CORNER — CAFÉ & LITTLE THINGS
   Standalone 2.5D Interactive Web & Mobile App (Built from Scratch)
   ========================================================================== */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CATALOG DATA (Exact 8 Menu Treats + 4 Strawberry Goods + Events)
  // --------------------------------------------------------------------------
  const MENU_ITEMS = [
    {
      id: 'strawberry-latte',
      index: 0,
      name: 'Strawberry Latte',
      category: 'DRINKS',
      badge: { text: '★ POPULAR', type: 'popular' },
      basePrice: 4.50,
      shortDesc: 'Espresso, steamed milk & house berry syrup',
      fullDesc: 'A double shot pulled over steamed milk and our strawberry syrup, finished with a little foam heart.',
      tags: ['ESPRESSO', 'HOUSE SYRUP', 'OAT OR WHOLE MILK'],
      sizes: [
        { label: 'Small', price: 3.90, scale: 0.91, meta: 'Small · Oat milk' },
        { label: 'Regular', price: 4.50, scale: 1.00, meta: 'Regular · Oat milk', default: true },
        { label: 'Large', price: 5.20, scale: 1.09, meta: 'Large · Oat milk' }
      ],
      cardImg: 'assets/menu-latte.png',
      thumbImg: 'assets/thumb-0.png',
      heroImgs: ['assets/hero-latte.png', 'assets/hero-latte-rot.png']
    },
    {
      id: 'strawberry-cake',
      index: 1,
      name: 'Strawberry Cake',
      category: 'SWEETS',
      badge: { text: '★ POPULAR', type: 'popular' },
      basePrice: 5.20,
      shortDesc: 'Three layers of sponge, cream & fresh berries',
      fullDesc: 'Vanilla sponge stacked with whipped cream and berries picked this week, crowned with two of the reddest.',
      tags: ['BAKED THIS MORNING', 'FRESH CREAM', 'SEASONAL BERRIES'],
      sizes: [
        { label: 'Slice', price: 5.20, scale: 1.00, meta: 'Slice · Fresh cream', default: true },
        { label: 'Two slices', price: 9.80, scale: 1.05, meta: 'Two slices · Fresh cream' },
        { label: 'Whole cake', price: 32.00, scale: 1.11, meta: 'Whole cake · Boxed' }
      ],
      cardImg: 'assets/menu-cake.png',
      thumbImg: 'assets/thumb-1.png',
      heroImgs: ['assets/hero-cake-slice.png', 'assets/hero-cake-whole.png']
    },
    {
      id: 'berry-soda',
      index: 2,
      name: 'Berry Soda',
      category: 'DRINKS',
      badge: null,
      basePrice: 4.80,
      shortDesc: 'Sparkling water, crushed berries & mint',
      fullDesc: 'Muddled strawberries, a squeeze of Meyer lemon, and sparkling spring water topped with whipped cloud cream.',
      tags: ['CRUSHED BERRIES', 'SPARKLING WATER', 'GARDEN MINT'],
      sizes: [
        { label: 'Small', price: 4.20, scale: 0.92, meta: 'Small · Extra mint' },
        { label: 'Regular', price: 4.80, scale: 1.00, meta: 'Regular · Extra mint', default: true },
        { label: 'Large', price: 5.50, scale: 1.08, meta: 'Large · Extra mint' }
      ],
      cardImg: 'assets/menu-soda.png',
      thumbImg: 'assets/thumb-2.png',
      heroImgs: ['assets/hero-soda.png']
    },
    {
      id: 'homemade-jam',
      index: 3,
      name: 'Homemade Jam',
      category: 'PANTRY',
      badge: null,
      basePrice: 6.90,
      shortDesc: 'Small-batch preserve, 250g jar',
      fullDesc: 'Slow-simmered in copper pans with whole fruit, raw cane sugar, and a splash of lemon juice. Wrapped in gingham.',
      tags: ['SMALL BATCH', 'WHOLE BERRIES', '250G GLASS JAR'],
      sizes: [
        { label: 'Jar (250g)', price: 6.90, scale: 1.00, meta: '250g Jar · Gingham wrap', default: true },
        { label: 'Twin Pack', price: 12.80, scale: 1.06, meta: 'Twin Pack · Ribbon box' },
        { label: 'Gift Trio', price: 18.50, scale: 1.11, meta: 'Gift Trio · Keepsake crate' }
      ],
      cardImg: 'assets/menu-jam.png',
      thumbImg: 'assets/thumb-3.png',
      heroImgs: ['assets/hero-jam.png']
    },
    {
      id: 'iced-berry-matcha',
      index: 4,
      name: 'Iced Berry Matcha',
      category: 'DRINKS',
      badge: { text: 'NEW', type: 'new' },
      basePrice: 5.40,
      shortDesc: 'Uji matcha layered over strawberry milk',
      fullDesc: 'Ceremonial first-harvest Uji matcha whisked to order and poured gently over cold-pressed strawberry milk.',
      tags: ['UJI MATCHA', 'COLD BERRY MILK', 'OAT OR DAIRY'],
      sizes: [
        { label: 'Small', price: 4.80, scale: 0.92, meta: 'Small · Less ice' },
        { label: 'Regular', price: 5.40, scale: 1.00, meta: 'Regular · Oat milk', default: true },
        { label: 'Large', price: 6.10, scale: 1.08, meta: 'Large · Oat milk' }
      ],
      cardImg: 'assets/menu-matcha.png',
      thumbImg: 'assets/thumb-4.png',
      heroImgs: ['assets/menu-matcha.png']
    },
    {
      id: 'strawberry-tart',
      index: 5,
      name: 'Strawberry Tart',
      category: 'SWEETS',
      badge: null,
      basePrice: 5.80,
      shortDesc: 'Crisp pastry shell, vanilla custard & glazed fruit',
      fullDesc: 'Buttery shortcrust filled with vanilla custard and a crown of glazed strawberries, with a sprig of mint.',
      tags: ['BUTTER SHORTCRUST', 'VANILLA CUSTARD', 'GLAZED BERRIES'],
      sizes: [
        { label: 'Little tart', price: 5.80, scale: 1.00, meta: 'Little tart · Vanilla custard', default: true },
        { label: 'Two tarts', price: 11.00, scale: 1.06, meta: 'Two tarts · Boxed' },
        { label: 'Family tart', price: 26.00, scale: 1.12, meta: 'Family tart · 8-inch' }
      ],
      cardImg: 'assets/menu-tart.png',
      thumbImg: 'assets/thumb-5.png',
      heroImgs: ['assets/hero-tart.png']
    },
    {
      id: 'berry-croissant',
      index: 6,
      name: 'Berry Croissant',
      category: 'SWEETS',
      badge: null,
      basePrice: 4.60,
      shortDesc: 'Flaky butter pastry filled with berry cream',
      fullDesc: 'Golden laminated pastry baked each morning and piped with chilled strawberry mascarpone cream.',
      tags: ['CULTURED BUTTER', 'BERRY MASCARPONE', 'DUSTED SUGAR'],
      sizes: [
        { label: 'Single', price: 4.60, scale: 1.00, meta: 'Warmed · Dusted sugar', default: true },
        { label: 'Pair (2)', price: 8.80, scale: 1.06, meta: 'Pair · Paper pastry bag' },
        { label: 'Morning Box (4)', price: 16.50, scale: 1.11, meta: 'Box of 4 · Ribbon tied' }
      ],
      cardImg: 'assets/menu-croissant.png',
      thumbImg: 'assets/thumb-6.png',
      heroImgs: ['assets/menu-croissant.png']
    },
    {
      id: 'cream-puff',
      index: 7,
      name: 'Cream Puff',
      category: 'SWEETS',
      badge: null,
      basePrice: 4.20,
      shortDesc: 'Choux pastry with whipped strawberry chantilly',
      fullDesc: 'Crisp craquelin choux filled with airy strawberry chantilly and a hidden spoonful of house berry compote.',
      tags: ['CRAQUELIN CHOUX', 'BERRY CHANTILLY', 'HOUSE COMPOTE'],
      sizes: [
        { label: 'Single', price: 4.20, scale: 1.00, meta: 'Single · Chilled cream', default: true },
        { label: 'Duo (2)', price: 8.00, scale: 1.06, meta: 'Duo · Gift box' },
        { label: 'Trio (3)', price: 11.50, scale: 1.10, meta: 'Trio · Gift box' }
      ],
      cardImg: 'assets/menu-puff.png',
      thumbImg: 'assets/thumb-7.png',
      heroImgs: ['assets/menu-puff.png']
    }
  ];

  const SHOP_GOODS = [
    {
      id: 'ceramic-mug',
      name: 'Ceramic Mug',
      price: 22.00,
      img: 'assets/shop-mug.png',
      meta: 'Hand-painted stoneware · 300ml'
    },
    {
      id: 'canvas-tote',
      name: 'Canvas Tote',
      price: 18.00,
      img: 'assets/shop-tote.png',
      meta: 'Heavy organic cotton · Embroidered'
    },
    {
      id: 'house-jam-jar',
      name: 'House Jam Jar',
      price: 8.50,
      img: 'assets/shop-jam.png',
      meta: 'Gingham lid · 250g preserve'
    },
    {
      id: 'recipe-postcards',
      name: 'Recipe Postcards',
      price: 9.00,
      img: 'assets/shop-postcards.png',
      meta: 'Dotted journal & 6 illustrated cards'
    }
  ];

  const MONTHS_DATA = [
    {
      monthIndex: 9,
      name: 'October',
      short: 'OCT',
      year: 2026,
      leadingDays: [28, 29, 30], // Mon 28, Tue 29, Wed 30 Sep (Oct 1, 2026 is Thu)
      daysInMonth: 31,
      trailingDays: [1, 2, 3, 4, 5, 6, 7, 8],
      events: [
        {
          id: 'ev-oct-3',
          day: 3,
          dow: 'SAT',
          mon: 'OCT',
          shortLabel: 'Acoustic Evening',
          icon: 'assets/ev-icon-music.png',
          meta: '19:00 · 2 H · JULIAN, GUITAR',
          title: 'Acoustic Evening',
          desc: 'Unplugged folk melodies by the window while we pour warm spiced strawberry cider and cinnamon scones.',
          seatsLeft: 5,
          seatsTotal: 12,
          reserved: false
        },
        {
          id: 'ev-oct-7',
          day: 7,
          dow: 'WED',
          mon: 'OCT',
          shortLabel: 'Little Readers’ Circle',
          icon: 'assets/ev-icon-book.png',
          meta: '18:00 · 1½ H · SORA, BOOKSELLER',
          title: 'Little Readers’ Circle',
          desc: 'Bring the chapter book you are halfway through, swap quiet recommendations, and share a pot of berry oolong.',
          seatsLeft: 4,
          seatsTotal: 10,
          reserved: false
        },
        {
          id: 'ev-oct-10',
          day: 10,
          dow: 'SAT',
          mon: 'OCT',
          shortLabel: 'Berry Picking Morning',
          icon: 'assets/ev-icon-basket.png',
          meta: '09:00 · 3 H · HOLLOW FARM',
          title: 'Berry Picking Morning',
          desc: 'We ride out to the farm together, fill our baskets, and come back to a picnic breakfast.',
          seatsLeft: 3,
          seatsTotal: 16,
          reserved: false
        },
        {
          id: 'ev-oct-14',
          day: 14,
          dow: 'WED',
          mon: 'OCT',
          shortLabel: 'Cake Decorating Night',
          icon: 'assets/ev-icon-cake.png',
          meta: '18:30 · 2 H · CLARA, PASTRY CHEF',
          title: 'Cake Decorating Night',
          desc: 'Pipe soft chantilly rosettes and crown your own two-layer vanilla sponge with glazed autumn strawberries.',
          seatsLeft: 3,
          seatsTotal: 8,
          reserved: false
        },
        {
          id: 'ev-oct-17',
          day: 17,
          dow: 'SAT',
          mon: 'OCT',
          shortLabel: 'Lantern Walk & Cocoa',
          icon: 'assets/ev-icon-lantern.png',
          meta: '17:30 · 1½ H · THE CORNER CREW',
          title: 'Lantern Walk & Cocoa',
          desc: 'A twilight stroll around the river path carrying paper lanterns, returning for house strawberry white hot cocoa.',
          seatsLeft: 6,
          seatsTotal: 14,
          reserved: false
        },
        {
          id: 'ev-oct-18',
          day: 18,
          dow: 'SUN',
          mon: 'OCT',
          circled: true,
          shortLabel: 'Latte Art for Beginners',
          icon: 'assets/ev-icon-latte.png',
          meta: '18:30 · 1½ H · MINA, HEAD BARISTA',
          title: 'Latte Art for Beginners',
          desc: 'Learn to pour hearts, tulips and wobbly swans. Milk, cups and plenty of practice shots included.',
          seatsLeft: 5,
          seatsTotal: 8,
          reserved: false
        },
        {
          id: 'ev-oct-21',
          day: 21,
          dow: 'WED',
          mon: 'OCT',
          shortLabel: 'Jam-Making Class',
          icon: 'assets/ev-icon-jam.png',
          meta: '18:30 · 2 H · GRANDMA LOU',
          title: 'Jam-Making Class',
          desc: 'Hull, mash and simmer your own small batch, then take two jars home with a hand-written label.',
          seatsLeft: 3,
          seatsTotal: 10,
          reserved: false
        },
        {
          id: 'ev-oct-24',
          day: 24,
          dow: 'SAT',
          mon: 'OCT',
          shortLabel: 'Watercolour & Tea',
          icon: 'assets/ev-icon-brush.png',
          meta: '15:00 · 2 H · HANNA, ILLUSTRATOR',
          title: 'Watercolour & Tea',
          desc: 'Paint botanical postcards of berries and teacups on cold-pressed cotton paper with all brushes provided.',
          seatsLeft: 4,
          seatsTotal: 10,
          reserved: false
        },
        {
          id: 'ev-oct-28',
          day: 28,
          dow: 'WED',
          mon: 'OCT',
          shortLabel: 'Acoustic Evening',
          icon: 'assets/ev-icon-music.png',
          meta: '19:00 · 2 H · JULIAN, GUITAR',
          title: 'Acoustic Evening',
          desc: 'Unplugged folk melodies by the window while we pour warm spiced strawberry cider and cinnamon scones.',
          seatsLeft: 7,
          seatsTotal: 12,
          reserved: false
        },
        {
          id: 'ev-oct-31',
          day: 31,
          dow: 'SAT',
          mon: 'OCT',
          shortLabel: 'Little Readers’ Circle',
          icon: 'assets/ev-icon-book.png',
          meta: '17:00 · 2 H · SORA, BOOKSELLER',
          title: 'Little Readers’ Circle',
          desc: 'Autumn stories by candlelight with warm buttermilk scones and freshly steeped berry hibiscus tea.',
          seatsLeft: 5,
          seatsTotal: 12,
          reserved: false
        }
      ]
    },
    {
      monthIndex: 10,
      name: 'November',
      short: 'NOV',
      year: 2026,
      leadingDays: [26, 27, 28, 29, 30, 31], // Nov 1, 2026 is Sunday
      daysInMonth: 30,
      trailingDays: [1, 2, 3, 4, 5, 6],
      events: [
        {
          id: 'ev-nov-4',
          day: 4,
          dow: 'WED',
          mon: 'NOV',
          shortLabel: 'Watercolour & Tea',
          icon: 'assets/ev-icon-brush.png',
          meta: '18:00 · 2 H · HANNA, ILLUSTRATOR',
          title: 'Watercolour & Tea',
          desc: 'Paint botanical postcards of berries and teacups on cold-pressed cotton paper with all brushes provided.',
          seatsLeft: 4,
          seatsTotal: 10,
          reserved: false
        },
        {
          id: 'ev-nov-7',
          day: 7,
          dow: 'SAT',
          mon: 'NOV',
          shortLabel: 'Cake Decorating Night',
          icon: 'assets/ev-icon-cake.png',
          meta: '16:00 · 2 H · CLARA, PASTRY CHEF',
          title: 'Cake Decorating Night',
          desc: 'Pipe soft chantilly rosettes and crown your own two-layer vanilla sponge with glazed autumn strawberries.',
          seatsLeft: 3,
          seatsTotal: 8,
          reserved: false
        },
        {
          id: 'ev-nov-14',
          day: 14,
          dow: 'SAT',
          mon: 'NOV',
          shortLabel: 'Lantern Walk & Cocoa',
          icon: 'assets/ev-icon-lantern.png',
          meta: '17:00 · 1½ H · THE CORNER CREW',
          title: 'Lantern Walk & Cocoa',
          desc: 'A twilight stroll around the river path carrying paper lanterns, returning for house strawberry white hot cocoa.',
          seatsLeft: 6,
          seatsTotal: 14,
          reserved: false
        },
        {
          id: 'ev-nov-21',
          day: 21,
          dow: 'SAT',
          mon: 'NOV',
          shortLabel: 'Latte Art for Beginners',
          icon: 'assets/ev-icon-latte.png',
          meta: '15:00 · 1½ H · MINA, HEAD BARISTA',
          title: 'Latte Art for Beginners',
          desc: 'Learn to pour hearts, tulips and wobbly swans. Milk, cups and plenty of practice shots included.',
          seatsLeft: 5,
          seatsTotal: 8,
          reserved: false
        }
      ]
    },
    {
      monthIndex: 11,
      name: 'December',
      short: 'DEC',
      year: 2026,
      leadingDays: [30], // Dec 1, 2026 is Tuesday
      daysInMonth: 31,
      trailingDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      events: [
        {
          id: 'ev-dec-2',
          day: 2,
          dow: 'WED',
          mon: 'DEC',
          shortLabel: 'Jam-Making Class',
          icon: 'assets/ev-icon-jam.png',
          meta: '10:00 · 2 H · GRANDMA LOU',
          title: 'Jam-Making Class',
          desc: 'Hull, mash and simmer your own small batch, then take two jars home with a hand-written label.',
          seatsLeft: 3,
          seatsTotal: 10,
          reserved: false
        },
        {
          id: 'ev-dec-5',
          day: 5,
          dow: 'SAT',
          mon: 'DEC',
          shortLabel: 'Watercolour & Tea',
          icon: 'assets/ev-icon-brush.png',
          meta: '15:00 · 2 H · HANNA, ILLUSTRATOR',
          title: 'Watercolour & Tea',
          desc: 'Paint winter berry wreaths and keepsake gift tags while sipping warm spiced strawberry tea.',
          seatsLeft: 4,
          seatsTotal: 10,
          reserved: false
        },
        {
          id: 'ev-dec-9',
          day: 9,
          dow: 'WED',
          mon: 'DEC',
          shortLabel: 'Acoustic Evening',
          icon: 'assets/ev-icon-music.png',
          meta: '19:00 · 2 H · JULIAN, GUITAR',
          title: 'Acoustic Evening',
          desc: 'Unplugged folk melodies by the window while we pour warm spiced strawberry cider and cinnamon scones.',
          seatsLeft: 5,
          seatsTotal: 12,
          reserved: false
        },
        {
          id: 'ev-dec-12',
          day: 12,
          dow: 'SAT',
          mon: 'DEC',
          shortLabel: 'Little Readers’ Circle',
          icon: 'assets/ev-icon-book.png',
          meta: '17:00 · 2 H · SORA, BOOKSELLER',
          title: 'Little Readers’ Circle',
          desc: 'Cozy winter tales and book-swapping over warm scones and clotted cream.',
          seatsLeft: 6,
          seatsTotal: 12,
          reserved: false
        },
        {
          id: 'ev-dec-16',
          day: 16,
          dow: 'WED',
          mon: 'DEC',
          shortLabel: 'Berry Picking Morning',
          icon: 'assets/ev-icon-basket.png',
          meta: '09:00 · 3 H · HOLLOW FARM GREENHOUSE',
          title: 'Berry Picking Morning',
          desc: 'We visit the heated glasshouses together, fill our baskets, and come back to a warm breakfast.',
          seatsLeft: 4,
          seatsTotal: 16,
          reserved: false
        },
        {
          id: 'ev-dec-19',
          day: 19,
          dow: 'SAT',
          mon: 'DEC',
          shortLabel: 'Cake Decorating Night',
          icon: 'assets/ev-icon-cake.png',
          meta: '18:30 · 2 H · CLARA, PASTRY CHEF',
          title: 'Cake Decorating Night',
          desc: 'Decorate a festive strawberry shortcake with snow-dusted sugar berries and fresh rosemary sprigs.',
          seatsLeft: 2,
          seatsTotal: 8,
          reserved: false
        },
        {
          id: 'ev-dec-20',
          day: 20,
          dow: 'SUN',
          mon: 'DEC',
          shortLabel: 'Lantern Walk & Cocoa',
          icon: 'assets/ev-icon-lantern.png',
          meta: '17:00 · 1½ H · THE CORNER CREW',
          title: 'Lantern Walk & Cocoa',
          desc: 'A solstice twilight walk carrying paper lanterns, returning for house strawberry white hot cocoa.',
          seatsLeft: 5,
          seatsTotal: 14,
          reserved: false
        },
        {
          id: 'ev-dec-23',
          day: 23,
          dow: 'WED',
          mon: 'DEC',
          shortLabel: 'Latte Art for Beginners',
          icon: 'assets/ev-icon-latte.png',
          meta: '18:30 · 1½ H · MINA, HEAD BARISTA',
          title: 'Latte Art for Beginners',
          desc: 'Learn to pour hearts, tulips and wobbly swans. Milk, cups and plenty of practice shots included.',
          seatsLeft: 4,
          seatsTotal: 8,
          reserved: false
        },
        {
          id: 'ev-dec-26',
          day: 26,
          dow: 'SAT',
          mon: 'DEC',
          shortLabel: 'Jam-Making Class',
          icon: 'assets/ev-icon-jam.png',
          meta: '10:00 · 2 H · GRANDMA LOU',
          title: 'Jam-Making Class',
          desc: 'Hull, mash and simmer your own small batch, then take two jars home with a hand-written label.',
          seatsLeft: 3,
          seatsTotal: 10,
          reserved: false
        },
        {
          id: 'ev-dec-30',
          day: 30,
          dow: 'WED',
          mon: 'DEC',
          shortLabel: 'Watercolour & Tea',
          icon: 'assets/ev-icon-brush.png',
          meta: '15:00 · 2 H · HANNA, ILLUSTRATOR',
          title: 'Watercolour & Tea',
          desc: 'Paint New Year botanical calendars while enjoying warm strawberry tea.',
          seatsLeft: 5,
          seatsTotal: 10,
          reserved: false
        }
      ]
    }
  ];

  // --------------------------------------------------------------------------
  // 1B. BOUTIQUE STREET ROW METADATA (4 Adjoining Buildings in rowStreetGroup)
  // --------------------------------------------------------------------------
  const BOUTIQUE_BUILDINGS = [
    {
      index: 0,
      id: 'strawberry-corner',
      icon: '🍓',
      name: 'Strawberry Corner',
      tagSub: 'Café & Bakery',
      brandSub: 'CAFÉ & LITTLE THINGS',
      heroSub: 'COFFEE  ·  STRAWBERRIES  ·  A BRIGHTER DAY',
      seasonEyebrow: '<span class="sc-sprig">🌿</span> SEASON SPECIAL',
      seasonTitleHtml: 'Strawberry<br/>Moments <span class="sc-heart">♥</span>',
      seasonSubHtml: 'SWEET RECIPES<br/>FOR A BRIGHTER DAY'
    },
    {
      index: 1,
      id: 'botanical-bookshop',
      icon: '🌿',
      name: 'Botanical Bookshop',
      tagSub: 'Books & Apothecary',
      brandSub: 'BOOKSHOP & APOTHECARY',
      heroSub: 'RARE FOLIOS  ·  HERBAL ELIXIRS  ·  QUIET HOURS',
      seasonEyebrow: '<span class="sc-sprig">🌿</span> APOTHECARY EDITION',
      seasonTitleHtml: 'Botanical<br/>Folios <span class="sc-heart">♥</span>',
      seasonSubHtml: 'HERBAL TEAS &amp; RARE<br/>ILLUSTRATED VOLUMES'
    },
    {
      index: 2,
      id: 'floral-atelier',
      icon: '🌸',
      name: 'Floral Atelier',
      tagSub: 'Flower & Craft',
      brandSub: 'FLORAL & PERFUME GALLERY',
      heroSub: 'WISTERIA BLOOMS  ·  EAU DE PARFUM  ·  BOTANICAL ART',
      seasonEyebrow: '<span class="sc-sprig">🌸</span> ATELIER COLLECTION',
      seasonTitleHtml: 'Wisteria<br/>Bouquets <span class="sc-heart">♥</span>',
      seasonSubHtml: 'HAND-TIED STEMS &amp;<br/>ARTISAN PERFUMES'
    },
    {
      index: 3,
      id: 'clockmaker-studio',
      icon: '🕰️',
      name: 'Clockmaker Studio',
      tagSub: 'Horology & Fine Art',
      brandSub: 'CLOCKMAKER & ART STUDIO',
      heroSub: 'BRASS CHRONOGRAPHS  ·  OIL CANVASES  ·  FINE CRAFT',
      seasonEyebrow: '<span class="sc-sprig">🕰️</span> STUDIO EXHIBITION',
      seasonTitleHtml: 'Golden<br/>Chronographs <span class="sc-heart">♥</span>',
      seasonSubHtml: 'BESPOKE TIMEPIECES &amp;<br/>PLEIN-AIR SKETCHES'
    }
  ];

  // --------------------------------------------------------------------------
  // 2. APPLICATION STATE
  // --------------------------------------------------------------------------
  const state = {
    currentView: 'HOME', // HOME | MENU_GRID | PRODUCT_3D | EVENTS | MY_BAG | ORDER_PLACED | SHOP
    isMenuOpen: false,
    activeBuildingIdx: 0, // 0 = Strawberry Corner, 1 = Botanical Bookshop, 2 = Floral Atelier, 3 = Clockmaker Studio
    weatherMode: 'sunny', // 'sunny' | 'rain'
    menuFilter: 'ALL',
    activeProductIdx: 0,
    activeSizeIdx: 1, // Regular by default for Latte
    activeQty: 1,
    turntableAngle: 0, // radians
    turntableTargetAngle: 0,
    isDraggingTurntable: false,
    dragStartX: 0,
    dragStartAngle: 0,
    points: 1250,
    likes: 12,
    soundEnabled: false,
    calMonthIdx: 0, // 0 = Oct, 1 = Nov, 2 = Dec
    selectedEventId: 'ev-oct-18',
    bag: [
      {
        id: 'strawberry-latte',
        name: 'Strawberry Latte',
        sizeLabel: 'LARGE',
        price: 5.20,
        qty: 1,
        meta: 'LARGE · $ 5.20 EACH',
        thumb: 'assets/thumb-0.png'
      },
      {
        id: 'strawberry-cake',
        name: 'Strawberry Cake',
        sizeLabel: 'WHOLE CAKE',
        price: 32.00,
        qty: 1,
        meta: 'WHOLE CAKE · $ 32.00 EACH',
        thumb: 'assets/thumb-1.png'
      },
      {
        id: 'strawberry-tart',
        name: 'Strawberry Tart',
        sizeLabel: 'LITTLE TART',
        price: 5.80,
        qty: 3,
        meta: 'LITTLE TART · $ 5.80 EACH',
        thumb: 'assets/thumb-5.png'
      }
    ]
  };

  // Preload hero images for instant turntable rendering
  const heroImageCache = {};
  function preloadImages() {
    MENU_ITEMS.forEach((item) => {
      item.heroImgs.forEach((src) => {
        if (!heroImageCache[src]) {
          const img = new Image();
          img.onload = () => {
            if (typeof window.__drawTurntableImmediate === 'function') {
              window.__drawTurntableImmediate(performance.now());
            }
          };
          img.src = src;
          heroImageCache[src] = img;
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 3. COZY WEB AUDIO SYNTHESIZER (Soft Chimes & Tactile Clicks)
  // --------------------------------------------------------------------------
  let audioCtx = null;
  function playCozyTone(type) {
    if (!state.soundEnabled) return;
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'bell') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.56);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.08);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 4. TOAST HELPER
  // --------------------------------------------------------------------------
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('sc-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 2200);
  }

  // --------------------------------------------------------------------------
  // 5. FRAMER-MOTION STYLE CHOREOGRAPHY ENGINE & STATE NAVIGATION
  //    (Shared-Element Hero Morph, Stagger Cascades, Spring Turntable Carousel)
  // --------------------------------------------------------------------------
  function applyStaggerCascade(rootEl, selector) {
    if (!rootEl) return;
    const els = rootEl.querySelectorAll(selector);
    els.forEach((el, idx) => {
      el.classList.remove('sc-fm-stagger-item');
      el.style.setProperty('--stagger-idx', String(idx));
      // Trigger reflow so animation restarts cleanly
      void el.offsetWidth;
      el.classList.add('sc-fm-stagger-item');
    });
  }

  function animateElementSpring(el, keyframes, duration = 480, easing = 'cubic-bezier(0.16, 1, 0.3, 1)') {
    if (!el || typeof el.animate !== 'function') return null;
    try {
      return el.animate(keyframes, { duration, easing, fill: 'both' });
    } catch (_) {
      return null;
    }
  }

  // Shared-Element Hero Morph (Framer Motion layoutId style: Card -> Giant Product 3D Card)
  function runSharedElementProductMorph(sourceCardEl, targetProdIdx) {
    if (!sourceCardEl) {
      navigateTo('PRODUCT_3D', { productIdx: targetProdIdx });
      return;
    }

    const srcCardRect = sourceCardEl.getBoundingClientRect();
    const srcImgEl = sourceCardEl.querySelector('img');
    const srcImgRect = srcImgEl ? srcImgEl.getBoundingClientRect() : srcCardRect;
    const imgSrc = srcImgEl ? srcImgEl.src : MENU_ITEMS[targetProdIdx].cardImg;

    // Switch state to PRODUCT_3D
    navigateTo('PRODUCT_3D', { productIdx: targetProdIdx, fromCardMorph: true });

    const giantCard = document.querySelector('.sc-product-giant-card');
    const turntableStage = document.getElementById('sc-turntable-stage');
    const turntableCanvas = document.getElementById('sc-turntable-canvas');
    const sharedLayer = document.getElementById('sc-fm-shared-layer');

    if (!giantCard || !turntableStage) return;

    const dstCardRect = giantCard.getBoundingClientRect();
    const dstStageRect = turntableStage.getBoundingClientRect();

    // 1. FLIP Morph on the Giant Product Card container from clicked card rect
    if (dstCardRect.width > 0 && srcCardRect.width > 0) {
      const dx = srcCardRect.left - dstCardRect.left;
      const dy = srcCardRect.top - dstCardRect.top;
      const sx = Math.max(0.18, srcCardRect.width / dstCardRect.width);
      const sy = Math.max(0.18, srcCardRect.height / dstCardRect.height);

      animateElementSpring(
        giantCard,
        [
          {
            transformOrigin: 'top left',
            transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
            opacity: 0.55
          },
          {
            transformOrigin: 'top left',
            transform: 'translate3d(0px, 0px, 0) scale(1, 1)',
            opacity: 1
          }
        ],
        540,
        'cubic-bezier(0.16, 1, 0.3, 1)'
      );
    }

    // 2. Shared-Element Flying Hero Image from grid card into the 2.5D/3D Turntable stage
    if (sharedLayer && dstStageRect.width > 0 && srcImgRect.width > 0) {
      sharedLayer.innerHTML = '';
      const flyImg = document.createElement('img');
      flyImg.src = imgSrc;
      flyImg.className = 'sc-fm-flying-img';
      const targetSize = Math.min(dstStageRect.width, dstStageRect.height) * 0.86;
      const dstLeft = dstStageRect.left + (dstStageRect.width - targetSize) * 0.5;
      const dstTop = dstStageRect.top + (dstStageRect.height - targetSize) * 0.5;

      flyImg.style.left = `${srcImgRect.left}px`;
      flyImg.style.top = `${srcImgRect.top}px`;
      flyImg.style.width = `${srcImgRect.width}px`;
      flyImg.style.height = `${srcImgRect.height}px`;
      sharedLayer.appendChild(flyImg);

      if (turntableCanvas) {
        turntableCanvas.style.opacity = '0';
        turntableCanvas.style.transition = 'opacity 0.24s ease';
      }

      const anim = animateElementSpring(
        flyImg,
        [
          {
            left: `${srcImgRect.left}px`,
            top: `${srcImgRect.top}px`,
            width: `${srcImgRect.width}px`,
            height: `${srcImgRect.height}px`,
            opacity: 1,
            transform: 'scale(0.95)'
          },
          {
            left: `${dstLeft}px`,
            top: `${dstTop}px`,
            width: `${targetSize}px`,
            height: `${targetSize}px`,
            opacity: 1,
            transform: 'scale(1.03)'
          }
        ],
        460,
        'cubic-bezier(0.16, 1, 0.3, 1)'
      );

      setTimeout(() => {
        if (turntableCanvas) turntableCanvas.style.opacity = '1';
        if (flyImg.parentNode) {
          const fadeOut = animateElementSpring(flyImg, [{ opacity: 1 }, { opacity: 0 }], 160, 'ease-out');
          if (fadeOut) {
            fadeOut.onfinish = () => flyImg.remove();
          } else {
            flyImg.remove();
          }
        }
      }, 390);
      if (!anim) {
        if (turntableCanvas) turntableCanvas.style.opacity = '1';
        flyImg.remove();
      }
    }
  }

  function updateBuildingBrandAndTagsUI(animateTags = true) {
    const n = BOUTIQUE_BUILDINGS.length;
    const curr = BOUTIQUE_BUILDINGS[state.activeBuildingIdx] || BOUTIQUE_BUILDINGS[0];
    const hasPrev = state.activeBuildingIdx > 0;
    const hasNext = state.activeBuildingIdx < n - 1;
    const prev = hasPrev ? BOUTIQUE_BUILDINGS[state.activeBuildingIdx - 1] : BOUTIQUE_BUILDINGS[0];
    const next = hasNext ? BOUTIQUE_BUILDINGS[state.activeBuildingIdx + 1] : BOUTIQUE_BUILDINGS[n - 1];

    // 1. Update Floating Left & Right Pin Tags
    const prevBtn = document.getElementById('sc-tag-prev');
    const nextBtn = document.getElementById('sc-tag-next');
    const prevIconEl = document.getElementById('sc-tag-prev-icon');
    const prevNameEl = document.getElementById('sc-tag-prev-name');
    const prevSubEl = document.getElementById('sc-tag-prev-sub');
    const nextIconEl = document.getElementById('sc-tag-next-icon');
    const nextNameEl = document.getElementById('sc-tag-next-name');
    const nextSubEl = document.getElementById('sc-tag-next-sub');

    if (prevBtn) prevBtn.style.display = hasPrev ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = hasNext ? 'flex' : 'none';

    if (prevIconEl) prevIconEl.textContent = prev.icon;
    if (prevNameEl) prevNameEl.textContent = prev.name;
    if (prevSubEl) prevSubEl.textContent = prev.tagSub;
    if (nextIconEl) nextIconEl.textContent = next.icon;
    if (nextNameEl) nextNameEl.textContent = next.name;
    if (nextSubEl) nextSubEl.textContent = next.tagSub;

    if (animateTags) {
      if (prevBtn && hasPrev) {
        animateElementSpring(
          prevBtn,
          [
            { transform: 'translateY(-50%) scale(0.92)' },
            { transform: 'translateY(-50%) scale(1.04)' },
            { transform: 'translateY(-50%) scale(1)' }
          ],
          320
        );
      }
      if (nextBtn && hasNext) {
        animateElementSpring(
          nextBtn,
          [
            { transform: 'translateY(-50%) scale(0.92)' },
            { transform: 'translateY(-50%) scale(1.04)' },
            { transform: 'translateY(-50%) scale(1)' }
          ],
          320
        );
      }
    }

    // 2. Update Top-Left Brand Header
    const topBrandImg = document.getElementById('sc-top-brand-img');
    const topBrandCustom = document.getElementById('sc-top-brand-custom');
    const topBrandEmoji = document.getElementById('sc-top-brand-emoji');
    const topBrandTitle = document.getElementById('sc-top-brand-title');
    const topBrandSub = document.getElementById('sc-top-brand-sub');
    if (state.activeBuildingIdx === 0) {
      if (topBrandImg) topBrandImg.style.display = 'block';
      if (topBrandCustom) topBrandCustom.style.display = 'none';
    } else {
      if (topBrandImg) topBrandImg.style.display = 'none';
      if (topBrandCustom) topBrandCustom.style.display = 'flex';
      if (topBrandEmoji) topBrandEmoji.textContent = curr.icon;
      if (topBrandTitle) topBrandTitle.textContent = curr.name;
      if (topBrandSub) topBrandSub.textContent = curr.brandSub;
    }

    // 3. Update Bottom-Left Footer Brand
    const botBerryImg = document.getElementById('sc-bot-berry-img');
    const botEmojiIcon = document.getElementById('sc-bot-emoji-icon');
    const botBrandTitle = document.getElementById('sc-bot-brand-title');
    const botBrandSub = document.getElementById('sc-bot-brand-sub');
    if (state.activeBuildingIdx === 0) {
      if (botBerryImg) botBerryImg.style.display = 'block';
      if (botEmojiIcon) botEmojiIcon.style.display = 'none';
    } else {
      if (botBerryImg) botBerryImg.style.display = 'none';
      if (botEmojiIcon) {
        botEmojiIcon.style.display = 'inline-flex';
        botEmojiIcon.textContent = curr.icon;
      }
    }
    if (botBrandTitle) botBrandTitle.textContent = curr.name;
    if (botBrandSub) botBrandSub.textContent = curr.brandSub;

    // 4. Update Hero & Season Card copy so each building has its own boutique identity
    const heroSubEl = document.querySelector('.sc-hero-sub');
    const seasonEyebrowEl = document.querySelector('.sc-season-copy .sc-eyebrow');
    const seasonTitleEl = document.querySelector('.sc-season-copy .sc-season-title');
    const seasonSubEl = document.querySelector('.sc-season-copy .sc-season-sub');
    if (heroSubEl) heroSubEl.textContent = curr.heroSub;
    if (seasonEyebrowEl) seasonEyebrowEl.innerHTML = curr.seasonEyebrow;
    if (seasonTitleEl) seasonTitleEl.innerHTML = curr.seasonTitleHtml;
    if (seasonSubEl) seasonSubEl.innerHTML = curr.seasonSubHtml;
  }

  function selectBuilding(targetIndex, opts = {}) {
    // Lock building switching while a store's interior menu is open unless forced
    if (state.isMenuOpen && !opts.force) return;
    const n = BOUTIQUE_BUILDINGS.length;
    const nextIdx = ((targetIndex % n) + n) % n;
    if (state.activeBuildingIdx === nextIdx && !opts.force) return;
    state.activeBuildingIdx = nextIdx;
    playCozyTone('click');
    updateBuildingBrandAndTagsUI(true);
    if (typeof window.__panToBoutiqueBuilding === 'function') {
      window.__panToBoutiqueBuilding(nextIdx, Boolean(opts.instant));
    }
    const curr = BOUTIQUE_BUILDINGS[nextIdx];
    if (!opts.silent && curr) {
      showToast(`${curr.icon} ${curr.name} · ${curr.tagSub}`);
    }
  }

  function setWeatherMode(mode, opts = {}) {
    const nextMode = mode === 'rain' ? 'rain' : 'sunny';
    state.weatherMode = nextMode;
    const isRain = nextMode === 'rain';
    document.body.classList.toggle('sc-weather-rain', isRain);

    const wBtn = document.getElementById('sc-weather-btn');
    const wIcon = document.getElementById('sc-weather-icon');
    const wLabel = document.getElementById('sc-weather-label');
    if (wBtn) wBtn.classList.toggle('rain-active', isRain);
    if (wIcon) wIcon.textContent = isRain ? '🌧️' : '☀️';
    if (wLabel) wLabel.textContent = isRain ? 'Rain' : 'Sunny';

    if (typeof window.__setBoutiqueWeather === 'function') {
      window.__setBoutiqueWeather(nextMode);
    }
    if (!opts.silent) {
      playCozyTone('bell');
      showToast(isRain ? '🌧️ Cozy Rainy Afternoon · Store Lights On' : '☀️ Warm Sunny Afternoon at the Row');
    }
  }

  function setMenuOpen(open) {
    const nextOpen = Boolean(open);
    if (state.isMenuOpen === nextOpen) return;
    state.isMenuOpen = nextOpen;

    const bldgStage = document.getElementById('sc-building-stage');
    const leftHome = document.getElementById('sc-left-home');
    const leftMenu = document.getElementById('sc-left-menu');
    const homeSec = document.getElementById('sc-view-home');

    if (nextOpen) {
      document.body.classList.remove('sc-menu-closed');
      playCozyTone('click');
      if (state.currentView === 'HOME') {
        if (leftHome) leftHome.classList.add('active');
        if (leftMenu) leftMenu.classList.remove('active');
        if (homeSec) homeSec.classList.add('active');
        applyStaggerCascade(homeSec, '.sc-season-card, .sc-home-section-card, .sc-mini-prod-card, .sc-good-tile');
        applyStaggerCascade(leftHome, '.sc-hero-heading, .sc-pill-nav, .sc-pinned-note');
      } else {
        navigateTo(state.currentView);
      }
    } else {
      document.body.classList.add('sc-menu-closed');
      playCozyTone('click');
      state.currentView = 'HOME';
      if (bldgStage) {
        bldgStage.classList.remove('pos-bottom-left', 'pos-bottom-right', 'party-mode');
        bldgStage.classList.add('pos-center');
      }
      if (leftHome) leftHome.classList.add('active');
      if (leftMenu) leftMenu.classList.remove('active');
      document.querySelectorAll('.sc-state-view').forEach((sec) => sec.classList.remove('active'));
      if (homeSec) homeSec.classList.add('active');
      if (typeof window.__setStrawberry3DView === 'function') {
        window.__setStrawberry3DView('HOME');
      }
      syncNavigationHighlights('HOME');
    }
  }

  function navigateTo(targetView, options = {}) {
    if (!state.isMenuOpen) {
      state.isMenuOpen = true;
      document.body.classList.remove('sc-menu-closed');
    }
    const prevView = state.currentView;
    if (options.filter) {
      state.menuFilter = options.filter;
    }
    if (typeof options.productIdx === 'number') {
      selectProduct(options.productIdx, { animateCarousel: false });
    }

    state.currentView = targetView;
    playCozyTone('click');

    const bldgStage = document.getElementById('sc-building-stage');
    const leftHome = document.getElementById('sc-left-home');
    const leftMenu = document.getElementById('sc-left-menu');

    // Update 3D building position & party mode
    bldgStage.classList.remove('pos-center', 'pos-bottom-left', 'pos-bottom-right', 'party-mode');

    if (targetView === 'MENU_GRID' || targetView === 'PRODUCT_3D') {
      bldgStage.classList.add('pos-bottom-left');
      leftHome.classList.remove('active');
      leftMenu.classList.add('active');
    } else if (targetView === 'EVENTS') {
      bldgStage.classList.add('pos-bottom-right', 'party-mode');
      leftHome.classList.remove('active');
      leftMenu.classList.remove('active');
    } else {
      // HOME, SHOP, MY_BAG, ORDER_PLACED
      bldgStage.classList.add('pos-center');
      if (targetView === 'ORDER_PLACED') {
        bldgStage.classList.add('party-mode');
      }
      leftHome.classList.add('active');
      leftMenu.classList.remove('active');
    }

    if (typeof window.__setStrawberry3DView === 'function') {
      window.__setStrawberry3DView(targetView);
    }

    // Toggle active view section
    document.querySelectorAll('.sc-state-view').forEach((sec) => sec.classList.remove('active'));
    const basketCard = document.getElementById('sc-basket-card');
    const orderPlacedCard = document.getElementById('sc-order-placed-card');

    if (targetView === 'HOME') {
      const homeSec = document.getElementById('sc-view-home');
      homeSec.classList.add('active');
      applyStaggerCascade(homeSec, '.sc-season-card, .sc-home-section-card, .sc-mini-prod-card, .sc-good-tile');
      applyStaggerCascade(leftHome, '.sc-pill-nav');
    } else if (targetView === 'MENU_GRID') {
      renderMenuGrid();
      const menuSec = document.getElementById('sc-view-menu-grid');
      menuSec.classList.add('active');
      applyStaggerCascade(menuSec, '.sc-filter-pill, .sc-menu-card');
    } else if (targetView === 'PRODUCT_3D') {
      renderProductDetail({ staggerEnter: true });
      const prodSec = document.getElementById('sc-view-product-3d');
      prodSec.classList.add('active');
      if (!options.fromCardMorph) {
        const giantCard = prodSec.querySelector('.sc-product-giant-card');
        animateElementSpring(
          giantCard,
          [
            { opacity: 0, transform: 'translate3d(0, 18px, 0) scale(0.96)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
          ],
          480
        );
      }
    } else if (targetView === 'EVENTS') {
      renderEventsView({ initialEnter: prevView !== 'EVENTS' });
      const evSec = document.getElementById('sc-view-events');
      evSec.classList.add('active');
      applyStaggerCascade(evSec, '.sc-calendar-card, .sc-event-ticket-wrap');
    } else if (targetView === 'MY_BAG') {
      renderBagView({ staggerItems: true });
      basketCard.classList.remove('sc-hidden');
      orderPlacedCard.classList.add('sc-hidden');
      document.getElementById('sc-view-my-bag').classList.add('active');
      animateElementSpring(
        basketCard,
        [
          { opacity: 0, transform: 'translate3d(24px, 0, 0) scale(0.96)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
        ],
        460
      );
    } else if (targetView === 'ORDER_PLACED') {
      renderOrderPlacedView();
      basketCard.classList.add('sc-hidden');
      orderPlacedCard.classList.remove('sc-hidden');
      document.getElementById('sc-view-my-bag').classList.add('active');
      animateElementSpring(
        orderPlacedCard,
        [
          { opacity: 0, transform: 'translate3d(0, 16px, 0) scale(0.95)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
        ],
        500
      );
    } else if (targetView === 'SHOP') {
      renderShopView();
      const shopSec = document.getElementById('sc-view-shop');
      shopSec.classList.add('active');
      applyStaggerCascade(shopSec, '.sc-shop-right-card, .sc-shop-item-card');
    }

    // Sync active highlights on Top Nav, Left Pill Nav, and Bottom Bar
    syncNavigationHighlights(targetView);
  }

  function syncNavigationHighlights(view) {
    const logicalNav =
      view === 'PRODUCT_3D' ? 'MENU_GRID' :
      view === 'ORDER_PLACED' ? 'MY_BAG' : view;

    document.querySelectorAll('.sc-topnav-link').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === logicalNav);
    });

    document.querySelectorAll('.sc-pill-nav').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.state === logicalNav);
    });

    document.querySelectorAll('.sc-bot-icon-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.botnav === logicalNav);
    });
  }

  // --------------------------------------------------------------------------
  // 6. RENDER HOME BESTSELLERS & SHOP VIEW
  // --------------------------------------------------------------------------
  function renderHomeBestsellers() {
    const container = document.getElementById('sc-home-bestsellers');
    if (!container) return;
    const top4 = MENU_ITEMS.slice(0, 4);
    container.innerHTML = top4.map((item, i) => `
      <button class="sc-mini-prod-card sc-fm-stagger-item" style="--stagger-idx:${i}" data-open-prod="${item.index}" type="button">
        <div class="sc-mini-art-box">
          <img src="${item.cardImg}" alt="${item.name}" draggable="false" />
        </div>
        <div class="sc-mini-title">${item.name}</div>
        <div class="sc-mini-price">$ ${item.basePrice.toFixed(2)}</div>
      </button>
    `).join('');

    container.querySelectorAll('[data-open-prod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.openProd, 10);
        runSharedElementProductMorph(btn, idx);
      });
    });
  }

  function renderShopView() {
    const grid = document.getElementById('sc-shop-grid');
    if (!grid) return;
    grid.innerHTML = SHOP_GOODS.map((g, idx) => `
      <div class="sc-shop-item-card sc-fm-stagger-item" style="--stagger-idx:${idx}">
        <div>
          <img src="${g.img}" alt="${g.name}" draggable="false" />
          <div class="sc-shop-item-title">${g.name}</div>
          <div class="sc-bag-item-meta">${g.meta}</div>
        </div>
        <div class="sc-shop-item-foot">
          <span class="sc-shop-item-price">$ ${g.price.toFixed(2)}</span>
          <button class="sc-shop-add-mini" data-add-good="${idx}" type="button">+ BAG</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-add-good]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = SHOP_GOODS[parseInt(btn.dataset.addGood, 10)];
        addItemToBag({
          id: g.id,
          name: g.name,
          price: g.price,
          qty: 1,
          meta: g.meta,
          thumb: g.img
        });
        playCozyTone('bell');
        showToast(`Added ${g.name} to your little basket ♥`);
      });
    });
  }

  // --------------------------------------------------------------------------
  // 7. RENDER STATE 2: MENU_GRID (8-Card 4x2 Grid with Stagger & Hero Morph)
  // --------------------------------------------------------------------------
  function renderMenuGrid() {
    const filterBar = document.getElementById('sc-menu-filters');
    if (filterBar) {
      filterBar.querySelectorAll('.sc-filter-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.cat === state.menuFilter);
      });
    }

    const items = state.menuFilter === 'ALL'
      ? MENU_ITEMS
      : MENU_ITEMS.filter((it) => it.category === state.menuFilter);

    const grid = document.getElementById('sc-menu-grid-cards');
    if (!grid) return;

    grid.innerHTML = items.map((item, i) => `
      <button class="sc-menu-card sc-fm-stagger-item" style="--stagger-idx:${i}" data-prod-idx="${item.index}" type="button">
        ${item.badge ? `<span class="sc-menu-badge ${item.badge.type}">${item.badge.text}</span>` : ''}
        <div class="sc-menu-art-wrap">
          <img src="${item.cardImg}" alt="${item.name}" draggable="false" />
        </div>
        <div>
          <div class="sc-menu-card-title-row">
            <span class="sc-menu-card-name">${item.name}</span>
            <span class="sc-menu-card-price">$ ${item.basePrice.toFixed(2)}</span>
          </div>
          <p class="sc-menu-card-desc">${item.shortDesc}</p>
        </div>
      </button>
    `).join('');

    grid.querySelectorAll('.sc-menu-card').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.prodIdx, 10);
        runSharedElementProductMorph(card, idx);
      });
    });
  }

  // --------------------------------------------------------------------------
  // 8. RENDER STATE 3: PRODUCT_3D + INTERACTIVE SPRING TURNTABLE CAROUSEL
  // --------------------------------------------------------------------------
  state.displayScale = 1.0;
  state.carouselTransition = null;

  function selectProduct(idx, opts = {}) {
    const prevIdx = state.activeProductIdx;
    const nextIdx = (idx + MENU_ITEMS.length) % MENU_ITEMS.length;

    if (opts.animateCarousel && prevIdx !== nextIdx) {
      const dir = nextIdx > prevIdx ? 1 : -1;
      state.carouselTransition = {
        prevProdIdx: prevIdx,
        prevSizeIdx: state.activeSizeIdx,
        dir,
        startTime: performance.now(),
        duration: 460
      };
    }

    state.activeProductIdx = nextIdx;
    const item = MENU_ITEMS[state.activeProductIdx];
    const defSizeIdx = item.sizes.findIndex((s) => s.default);
    state.activeSizeIdx = defSizeIdx >= 0 ? defSizeIdx : 0;
    state.activeQty = 1;
    state.turntableAngle = 0;
    state.turntableTargetAngle = 0;

    // Reset ADD TO BAG button visual state
    const addBtn = document.getElementById('sc-add-to-bag-btn');
    const addTxt = document.getElementById('sc-add-bag-text');
    if (addBtn && addTxt) {
      addBtn.classList.remove('added');
      addTxt.textContent = 'ADD TO BAG';
    }
  }

  function renderProductDetail(opts = {}) {
    const item = MENU_ITEMS[state.activeProductIdx];
    const sizeObj = item.sizes[state.activeSizeIdx] || item.sizes[0];

    const catEl = document.getElementById('sc-prod-cat');
    const titleEl = document.getElementById('sc-prod-title');
    const priceEl = document.getElementById('sc-prod-price');
    const descEl = document.getElementById('sc-prod-desc');
    const qtyValEl = document.getElementById('sc-qty-val');

    catEl.textContent = item.category;
    titleEl.textContent = item.name;
    priceEl.textContent = `$ ${(sizeObj.price * state.activeQty).toFixed(2)}`;
    descEl.textContent = item.fullDesc;
    qtyValEl.textContent = String(state.activeQty);

    if (opts.pricePop) {
      animateElementSpring(
        priceEl,
        [
          { transform: 'scale(1.14)', color: '#E46C5E' },
          { transform: 'scale(1)', color: '#2E2018' }
        ],
        340,
        'cubic-bezier(0.34, 1.56, 0.64, 1)'
      );
    }

    // Tags
    const tagsEl = document.getElementById('sc-prod-tags');
    tagsEl.innerHTML = item.tags.map((t) => `<span class="sc-prod-tag">${t}</span>`).join('');

    // Sizes
    const sizesEl = document.getElementById('sc-prod-sizes');
    sizesEl.innerHTML = item.sizes.map((s, sIdx) => `
      <button class="sc-size-btn ${sIdx === state.activeSizeIdx ? 'active' : ''}" data-size-idx="${sIdx}" type="button">
        ${s.label}
      </button>
    `).join('');

    sizesEl.querySelectorAll('.sc-size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeSizeIdx = parseInt(btn.dataset.sizeIdx, 10);
        // Reset ADD TO BAG state so user can add the newly selected size
        const addBtn = document.getElementById('sc-add-to-bag-btn');
        const addTxt = document.getElementById('sc-add-bag-text');
        if (addBtn && addTxt) {
          addBtn.classList.remove('added');
          addTxt.textContent = 'ADD TO BAG';
        }
        playCozyTone('click');
        renderProductDetail({ pricePop: true });
      });
    });

    // Bottom 8-Thumbnail Strip
    const stripEl = document.getElementById('sc-thumb-strip');
    stripEl.innerHTML = MENU_ITEMS.map((m, i) => `
      <button class="sc-thumb-btn ${m.index === state.activeProductIdx ? 'active' : ''} ${opts.staggerEnter ? 'sc-fm-stagger-item' : ''}" style="--stagger-idx:${i}" data-thumb-idx="${m.index}" type="button" title="${m.name}">
        <img src="${m.thumbImg}" alt="${m.name}" draggable="false" />
      </button>
    `).join('');

    stripEl.querySelectorAll('.sc-thumb-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.thumbIdx, 10);
        if (idx === state.activeProductIdx) return;
        const dir = idx > state.activeProductIdx ? 1 : -1;
        selectProduct(idx, { animateCarousel: true });
        playCozyTone('click');
        renderProductDetail({ slideDir: dir });
      });
    });

    // Directional Framer-Motion slide on Product Info Column when switching thumbnails
    if (opts.slideDir) {
      const slideClass = opts.slideDir > 0 ? 'sc-fm-slide-right' : 'sc-fm-slide-left';
      [catEl, titleEl, priceEl, descEl, tagsEl, sizesEl].forEach((el, i) => {
        if (!el) return;
        el.classList.remove('sc-fm-slide-right', 'sc-fm-slide-left', 'sc-fm-stagger-item');
        el.style.setProperty('--stagger-idx', String(i));
        void el.offsetWidth;
        el.classList.add(slideClass);
      });
    } else if (opts.staggerEnter) {
      [catEl, titleEl, priceEl, descEl, tagsEl, sizesEl].forEach((el, i) => {
        if (!el) return;
        el.classList.remove('sc-fm-slide-right', 'sc-fm-slide-left', 'sc-fm-stagger-item');
        el.style.setProperty('--stagger-idx', String(i));
        void el.offsetWidth;
        el.classList.add('sc-fm-stagger-item');
      });
    }

    if (typeof window.__drawTurntableImmediate === 'function') {
      window.__drawTurntableImmediate(performance.now());
    }
  }

  // Interactive 2.5D/3D Watercolor + Ink Turntable Canvas Renderer with Carousel Slide
  function setupTurntableCanvas() {
    const stage = document.getElementById('sc-turntable-stage');
    const canvas = document.getElementById('sc-turntable-canvas');
    if (!stage || !canvas) return;
    const ctx = canvas.getContext('2d');

    const startDrag = (clientX) => {
      state.isDraggingTurntable = true;
      state.dragStartX = clientX;
      state.dragStartAngle = state.turntableTargetAngle;
    };

    const moveDrag = (clientX) => {
      if (!state.isDraggingTurntable) return;
      const dx = clientX - state.dragStartX;
      state.turntableTargetAngle = state.dragStartAngle + dx * 0.018;
    };

    const endDrag = () => {
      state.isDraggingTurntable = false;
    };

    stage.addEventListener('mousedown', (e) => startDrag(e.clientX));
    window.addEventListener('mousemove', (e) => moveDrag(e.clientX));
    window.addEventListener('mouseup', endDrag);

    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) startDrag(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) moveDrag(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', endDrag);

    function drawSeededBerry(cx, cy, r, rot) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(130, 80, 65, 0.16)';
      ctx.beginPath();
      ctx.ellipse(2, r * 0.85, r * 0.95, r * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(-r * 0.28, -r * 0.25, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#FF6859');
      grad.addColorStop(0.55, '#E42E24');
      grad.addColorStop(1, '#B31B14');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#38221C';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFF3D6';
      for (let i = 0; i < 7; i++) {
        const a = rot + i * 0.9;
        const sr = (i % 2 === 0 ? 0.45 : 0.72) * r;
        const sx = Math.cos(a) * sr;
        const sy = Math.sin(a) * sr * 0.75;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 1.5, 2.2, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#4E8C52';
      ctx.beginPath();
      ctx.arc(Math.cos(rot) * r * 0.25, -r * 0.2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawProductOnStage(prodItem, sizeIdx, angle, scaleMul, offsetX, alpha, bobY, w, h) {
      if (alpha <= 0.01) return;
      let imgSrc = prodItem.heroImgs[0];
      if (prodItem.id === 'strawberry-latte' && prodItem.heroImgs.length > 1) {
        const normA = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (normA > 0.45 && normA < 4.8) {
          imgSrc = prodItem.heroImgs[1];
        }
      } else if (prodItem.id === 'strawberry-cake' && prodItem.heroImgs.length > 1) {
        const normA = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (sizeIdx === 2 || (normA > 0.5 && normA < 4.5)) {
          imgSrc = prodItem.heroImgs[1];
        }
      }
      const heroImg = heroImageCache[imgSrc];

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(w * 0.5 + offsetX, h * 0.52 + bobY);

      // Soft warm ground contact aura on the cream stage
      const shadowGrad = ctx.createRadialGradient(0, 92, 12, 0, 92, 155 * scaleMul);
      shadowGrad.addColorStop(0, 'rgba(218, 165, 148, 0.26)');
      shadowGrad.addColorStop(0.65, 'rgba(218, 165, 148, 0.08)');
      shadowGrad.addColorStop(1, 'rgba(218, 165, 148, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(0, 92, 155 * scaleMul, 42 * scaleMul, 0, 0, Math.PI * 2);
      ctx.fill();

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const tiltX = sinA * 14;
      const flipScaleX = cosA >= 0 ? (0.88 + 0.12 * cosA) : -(0.88 + 0.12 * Math.abs(cosA));

      ctx.save();
      ctx.translate(tiltX * 0.5, 0);
      ctx.scale(scaleMul * flipScaleX, scaleMul);

      if (heroImg && heroImg.complete && heroImg.naturalWidth > 0) {
        const targetW = 330;
        const targetH = (heroImg.naturalHeight / heroImg.naturalWidth) * targetW;
        ctx.drawImage(heroImg, -targetW * 0.5, -targetH * 0.5, targetW, targetH);
      }
      ctx.restore();

      if (Math.abs(angle) > 0.08) {
        const orbitRx = 126 * scaleMul;
        const orbitRy = 42 * scaleMul;
        const bx = Math.sin(angle * 1.35) * orbitRx;
        const by = 52 * scaleMul + Math.cos(angle * 1.35) * orbitRy;
        drawSeededBerry(bx, by, 21 * scaleMul, angle * 1.5);
      }

      ctx.restore();
    }

    function drawFrame(now) {
      // Smooth spring interpolation for rotation angle & size variant scale
      state.turntableAngle += (state.turntableTargetAngle - state.turntableAngle) * 0.16;

      const item = MENU_ITEMS[state.activeProductIdx];
      const sizeObj = item.sizes[state.activeSizeIdx] || item.sizes[0];
      const targetScale = sizeObj.scale || 1.0;
      state.displayScale += (targetScale - state.displayScale) * 0.18;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bobY = Math.sin((now || 0) * 0.0024) * 3.0;

      // Check if horizontal spring carousel transition is active (matches 00:27 in reference video!)
      if (state.carouselTransition) {
        const elapsed = (now || performance.now()) - state.carouselTransition.startTime;
        const rawT = Math.min(1, Math.max(0, elapsed / state.carouselTransition.duration));
        // Spring ease-out curve
        const easeT = 1 - Math.pow(1 - rawT, 3.2);
        const dir = state.carouselTransition.dir;
        const prevItem = MENU_ITEMS[state.carouselTransition.prevProdIdx];

        if (prevItem) {
          drawProductOnStage(
            prevItem,
            state.carouselTransition.prevSizeIdx || 0,
            0,
            1.0 - easeT * 0.16,
            -dir * easeT * 245,
            1 - easeT,
            bobY,
            w,
            h
          );
        }

        drawProductOnStage(
          item,
          state.activeSizeIdx,
          state.turntableAngle,
          state.displayScale * (0.86 + 0.14 * easeT),
          dir * (1 - easeT) * 245,
          easeT,
          bobY,
          w,
          h
        );

        if (rawT >= 1) {
          state.carouselTransition = null;
        }
      } else {
        drawProductOnStage(
          item,
          state.activeSizeIdx,
          state.turntableAngle,
          state.displayScale,
          0,
          1,
          bobY,
          w,
          h
        );
      }
    }

    window.__drawTurntableImmediate = drawFrame;

    function renderLoop(now) {
      requestAnimationFrame(renderLoop);
      if (state.currentView !== 'PRODUCT_3D') return;
      drawFrame(now);
    }

    drawFrame(performance.now());
    requestAnimationFrame(renderLoop);
  }

  // --------------------------------------------------------------------------
  // 9. RENDER STATE 4: EVENTS (Washi-Tape Calendar & Perforated Ticket)
  // --------------------------------------------------------------------------
  function renderEventsView(opts = {}) {
    const monthData = MONTHS_DATA[state.calMonthIdx];
    const monthNameEl = document.getElementById('sc-cal-month-name');
    const yearEl = document.getElementById('sc-cal-year');
    monthNameEl.textContent = monthData.name;
    yearEl.textContent = String(monthData.year);

    const calGrid = document.getElementById('sc-cal-grid');
    const cellsHtml = [];
    let cellCounter = 0;

    monthData.leadingDays.forEach((ld) => {
      cellCounter++;
      cellsHtml.push(`
        <div class="sc-cal-cell muted">
          <div class="sc-cal-day-top"><span class="sc-cal-day-num">${ld}</span></div>
        </div>
      `);
    });

    for (let d = 1; d <= monthData.daysInMonth; d++) {
      const colIdx = cellCounter % 7;
      const isWknd = colIdx === 5 || colIdx === 6;
      cellCounter++;

      const ev = monthData.events.find((e) => e.day === d);
      if (ev) {
        const isSel = ev.id === state.selectedEventId;
        cellsHtml.push(`
          <button class="sc-cal-cell has-event ${isWknd ? 'wknd-cell' : ''} ${isSel ? 'selected' : ''}" data-ev-id="${ev.id}" type="button">
            <div class="sc-cal-day-top">
              <span class="sc-cal-day-num ${ev.circled || isSel ? 'circled' : ''}">${d}</span>
              ${ev.reserved ? '<span class="sc-cal-heart-saved">♥</span>' : ''}
            </div>
            <img src="${ev.icon}" alt="" class="sc-cal-ev-illus" draggable="false" />
            <div class="sc-cal-ev-label">${ev.shortLabel}</div>
          </button>
        `);
      } else {
        cellsHtml.push(`
          <div class="sc-cal-cell ${isWknd ? 'wknd-cell' : ''}">
            <div class="sc-cal-day-top"><span class="sc-cal-day-num">${d}</span></div>
          </div>
        `);
      }
    }

    monthData.trailingDays.forEach((td) => {
      if (cellCounter < 42) {
        cellCounter++;
        cellsHtml.push(`
          <div class="sc-cal-cell muted">
            <div class="sc-cal-day-top"><span class="sc-cal-day-num">${td}</span></div>
          </div>
        `);
      }
    });

    calGrid.innerHTML = cellsHtml.join('');

    if (opts.monthSlideDir) {
      const dx = opts.monthSlideDir * 28;
      animateElementSpring(
        calGrid,
        [
          { opacity: 0.25, transform: `translate3d(${dx}px, 0, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        380
      );
      animateElementSpring(
        monthNameEl,
        [
          { opacity: 0, transform: `translate3d(${dx * 0.7}px, 0, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        380
      );
    }

    calGrid.querySelectorAll('[data-ev-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.selectedEventId === btn.dataset.evId) return;
        state.selectedEventId = btn.dataset.evId;
        playCozyTone('click');
        renderEventsView({ ticketFlip: true });
      });
    });

    const monthEvs = monthData.events;
    let activeEv = monthEvs.find((e) => e.id === state.selectedEventId);
    if (!activeEv && monthEvs.length > 0) {
      activeEv = monthEvs[0];
      state.selectedEventId = activeEv.id;
    }

    if (activeEv) {
      document.getElementById('sc-stub-dow').textContent = activeEv.dow;
      document.getElementById('sc-stub-day').textContent = String(activeEv.day);
      document.getElementById('sc-stub-mon').textContent = activeEv.mon;
      document.getElementById('sc-ticket-title').textContent = activeEv.title;
      document.getElementById('sc-ticket-meta').textContent = activeEv.meta;
      document.getElementById('sc-ticket-icon').src = activeEv.icon;
      document.getElementById('sc-ticket-desc').textContent = activeEv.desc;

      const curLeft = activeEv.reserved ? Math.max(0, activeEv.seatsLeft - 1) : activeEv.seatsLeft;
      document.getElementById('sc-ticket-seats').innerHTML = `
        <strong>${curLeft}</strong> of ${activeEv.seatsTotal} seats left
      `;

      if (opts.ticketFlip || opts.monthSlideDir) {
        const ticketCard = document.getElementById('sc-ticket-card');
        animateElementSpring(
          ticketCard,
          [
            { opacity: 0.4, transform: 'translate3d(0, 12px, 0) scale(0.97)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
          ],
          420
        );
      }

      const actionArea = document.getElementById('sc-ticket-action-area');
      if (activeEv.reserved) {
        actionArea.innerHTML = `
          <div class="sc-reserved-stamp-wrap">
            <div class="sc-reserved-stamp">
              <span>RESERVED</span>
              <span>♥</span>
            </div>
            <button id="sc-cancel-seat-btn" class="sc-cancel-seat-pill" type="button">CANCEL MY SEAT</button>
          </div>
        `;
        document.getElementById('sc-cancel-seat-btn').addEventListener('click', () => {
          activeEv.reserved = false;
          playCozyTone('click');
          showToast(`Canceled seat for ${activeEv.title}`);
          renderEventsView();
        });
      } else {
        actionArea.innerHTML = `
          <button id="sc-save-seat-btn" class="sc-save-seat-btn" type="button">SAVE A SEAT</button>
        `;
        document.getElementById('sc-save-seat-btn').addEventListener('click', () => {
          activeEv.reserved = true;
          playCozyTone('bell');
          showToast(`Seat saved for ${activeEv.title} ♥`);
          renderEventsView();
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 10. RENDER STATE 5: MY_BAG & ORDER_PLACED (Matches t_52.0 & t_58.0 1:1)
  // --------------------------------------------------------------------------
  function updateBagBadge(pop = false) {
    const totalCount = state.bag.reduce((sum, it) => sum + it.qty, 0);
    const badge = document.getElementById('sc-bot-bag-badge');
    if (badge) {
      badge.textContent = String(totalCount);
      badge.style.display = totalCount > 0 ? 'flex' : 'none';
      if (pop) {
        badge.classList.remove('sc-badge-pop');
        void badge.offsetWidth;
        badge.classList.add('sc-badge-pop');
      }
    }
  }

  function addItemToBag(newItem) {
    const existing = state.bag.find(
      (b) => b.id === newItem.id && b.sizeLabel === newItem.sizeLabel
    );
    if (existing) {
      existing.qty += newItem.qty;
    } else {
      state.bag.push({ ...newItem });
    }
    updateBagBadge(true);
  }

  function computeBagTotals() {
    const subtotal = state.bag.reduce((sum, it) => sum + it.price * it.qty, 0);
    const count = state.bag.reduce((sum, it) => sum + it.qty, 0);
    return { subtotal, total: subtotal, count };
  }

  function renderBagView(opts = {}) {
    const { subtotal, total, count } = computeBagTotals();
    document.getElementById('sc-bag-count-label').textContent = `${count} TREAT${count === 1 ? '' : 'S'}`;

    const listEl = document.getElementById('sc-bag-items-list');
    if (state.bag.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 28px 10px; text-align: center; font-family: var(--font-serif); font-style: italic; color: var(--ink-muted);">
          Your little basket is empty — pick a treat from the counter ♥
        </div>
      `;
    } else {
      const staggerCls = opts.staggerItems ? 'sc-fm-stagger-item' : '';
      const itemsHtml = state.bag.map((it, idx) => `
        <div class="sc-bag-item ${staggerCls}" style="--stagger-idx:${idx}">
          <img src="${it.thumb}" alt="${it.name}" class="sc-bag-item-thumb" draggable="false" />
          <div class="sc-bag-item-info">
            <div class="sc-bag-item-top">
              <span class="sc-bag-item-name">${it.name}</span>
              <div class="sc-bag-item-controls">
                <div class="sc-mini-stepper">
                  <button data-bag-dec="${idx}" type="button">−</button>
                  <span>${it.qty}</span>
                  <button data-bag-inc="${idx}" type="button">+</button>
                </div>
                <span class="sc-bag-item-price">$ ${(it.price * it.qty).toFixed(2)}</span>
                <button class="sc-bag-remove" data-bag-rem="${idx}" type="button" title="Remove">×</button>
              </div>
            </div>
            <div class="sc-bag-item-bottom">
              <span class="sc-bag-item-meta">${it.meta}</span>
            </div>
          </div>
        </div>
      `);

      itemsHtml.push(`
        <div class="sc-bag-item freebie-card ${staggerCls}" style="--stagger-idx:${state.bag.length}">
          <img src="assets/thumb-7.png" alt="Berry Macaron" class="sc-bag-item-thumb" draggable="false" />
          <div class="sc-bag-item-info">
            <div class="sc-bag-item-top">
              <span class="sc-bag-item-name">Berry Macaron</span>
              <div class="sc-bag-item-controls">
                <span class="sc-on-us-pill">ON US ♥</span>
                <span class="sc-free-italic">free</span>
              </div>
            </div>
            <div class="sc-bag-item-bottom">
              <span class="sc-bag-item-meta">A LITTLE THANK-YOU, ON US</span>
            </div>
          </div>
        </div>
      `);

      listEl.innerHTML = itemsHtml.join('');
    }

    listEl.querySelectorAll('[data-bag-dec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.bagDec, 10);
        if (state.bag[i].qty > 1) {
          state.bag[i].qty--;
        } else {
          state.bag.splice(i, 1);
        }
        playCozyTone('click');
        updateBagBadge(true);
        renderBagView({ priceBounce: true });
      });
    });

    listEl.querySelectorAll('[data-bag-inc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.bagInc, 10);
        state.bag[i].qty++;
        playCozyTone('click');
        updateBagBadge(true);
        renderBagView({ priceBounce: true });
      });
    });

    listEl.querySelectorAll('[data-bag-rem]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.bagRem, 10);
        state.bag.splice(i, 1);
        playCozyTone('click');
        updateBagBadge(true);
        renderBagView({ priceBounce: true });
      });
    });

    const subEl = document.getElementById('sc-bag-subtotal');
    const totEl = document.getElementById('sc-bag-total');
    subEl.textContent = `$ ${subtotal.toFixed(2)}`;
    totEl.textContent = `$ ${total.toFixed(2)}`;

    if (opts.priceBounce) {
      animateElementSpring(
        totEl,
        [
          { transform: 'scale(1.16)' },
          { transform: 'scale(1)' }
        ],
        340,
        'cubic-bezier(0.34, 1.56, 0.64, 1)'
      );
    }
  }

  function renderOrderPlacedView() {
    const { total } = computeBagTotals();
    const receiptList = document.getElementById('sc-receipt-items');
    const lines = state.bag.map((it, idx) => `
      <div class="sc-receipt-line sc-fm-stagger-item" style="--stagger-idx:${idx}">
        <span>${it.qty} × ${it.name} <small>${it.sizeLabel || ''}</small></span>
        <span>$ ${(it.price * it.qty).toFixed(2)}</span>
      </div>
    `);
    lines.push(`
      <div class="sc-receipt-line freebie sc-fm-stagger-item" style="--stagger-idx:${state.bag.length}">
        <span>1 × Berry Macaron</span>
        <span>on us</span>
      </div>
      <div class="sc-receipt-line freebie sc-fm-stagger-item" style="--stagger-idx:${state.bag.length + 1}">
        <span>Seed packet</span>
        <span>gift</span>
      </div>
    `);
    receiptList.innerHTML = lines.join('');
    document.getElementById('sc-receipt-paid').textContent = `$ ${total.toFixed(2)}`;

    // Re-trigger receipt unfold and MADE WITH LOVE stamp slam
    const receiptBox = document.getElementById('sc-receipt-box');
    const loveStamp = document.getElementById('sc-made-love-stamp');
    if (receiptBox) {
      receiptBox.style.animation = 'none';
      void receiptBox.offsetWidth;
      receiptBox.style.animation = '';
    }
    if (loveStamp) {
      loveStamp.style.animation = 'none';
      void loveStamp.offsetWidth;
      loveStamp.style.animation = '';
    }
  }

  // --------------------------------------------------------------------------
  // 11. AMBIENT FLOATING STRAWBERRY PETALS & LEAVES (2.5D Atmospheric Layer)
  // --------------------------------------------------------------------------
  function setupFloatingPetals() {
    const canvas = document.getElementById('sc-petals-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const petals = Array.from({ length: 14 }, (_, i) => ({
      x: Math.random() * window.innerWidth * 0.65,
      y: Math.random() * window.innerHeight * 0.75,
      r: 3 + Math.random() * 3.5,
      vx: 0.18 + Math.random() * 0.25,
      vy: 0.22 + Math.random() * 0.3,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
      isLeaf: i % 4 === 0,
      alpha: 0.45 + Math.random() * 0.35
    }));

    function animatePetals() {
      requestAnimationFrame(animatePetals);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      petals.forEach((p) => {
        p.x += p.vx + Math.sin(p.angle) * 0.15;
        p.y += p.vy;
        p.angle += p.spin;

        if (p.y > canvas.height - 60 || p.x > canvas.width * 0.75) {
          p.x = 30 + Math.random() * (canvas.width * 0.42);
          p.y = 40 + Math.random() * 140;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.isLeaf ? '#7BA376' : '#E46C5E';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    requestAnimationFrame(animatePetals);
  }

  // --------------------------------------------------------------------------
  // 12. INTERACTIVE 3D WEBGL STRAWBERRY CORNER BUILDING & ORGANIC SWAYING TREES
  //     (1:1 Blueprint Architecture · Zero 2D Deadcode · Horizontal-Only Yaw)
  // --------------------------------------------------------------------------
  function setupStrawberry3DBuilding() {
    const parallaxEl = document.getElementById('sc-building-parallax');
    if (!parallaxEl || typeof THREE === 'undefined') return;

    // Subtle mouse parallax on outer stage container
    window.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      parallaxEl.style.transform = `translate3d(${(nx * 3.5).toFixed(1)}px, ${(ny * 2.2).toFixed(1)}px, 0)`;
    });

    // Purge any leftover 2D image/hotspot nodes if any exist
    parallaxEl.querySelectorAll('img, .sc-bldg-hotspot, canvas').forEach((n) => n.remove());

    const STAGE_W = 1380;
    const STAGE_H = 720;

    // Background blurred canvas for non-active neighbor buildings & full street
    const bgCanvas = document.createElement('canvas');
    bgCanvas.id = 'sc-webgl-bg-canvas';
    parallaxEl.appendChild(bgCanvas);

    // Foreground sharp canvas for active building, active sidewalk, cars, birds, rain
    const canvas = document.createElement('canvas');
    canvas.id = 'sc-webgl-building-canvas';
    parallaxEl.appendChild(canvas);

    let bgRenderer;
    let renderer;
    try {
      bgRenderer = new THREE.WebGLRenderer({
        canvas: bgCanvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      console.warn('WebGL context could not be initialized:', err);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [bgRenderer, renderer].forEach((r) => {
      r.setSize(STAGE_W, STAGE_H, false);
      r.setPixelRatio(dpr);
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.NoToneMapping;
    });

    const scene = new THREE.Scene();

    // Camera framed so the entire rooftop strawberry stem down to shared sidewalk & road fits comfortably
    const camera = new THREE.PerspectiveCamera(28, STAGE_W / STAGE_H, 0.1, 140);
    const BASE_CAM_POS = new THREE.Vector3(0, 4.35, 18.2);
    const BASE_CAM_LOOK = new THREE.Vector3(0, 3.72, 0);
    camera.position.copy(BASE_CAM_POS);
    camera.lookAt(BASE_CAM_LOOK);

    // Warm storybook daylight illumination (adapts smoothly in Rain mode)
    const hemiLight = new THREE.HemisphereLight(0xFFF6E8, 0xC8A98E, 0.68);
    hemiLight.position.set(4, 16, 2);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFF3DE, 0.72);
    sunLight.position.set(11.5, 16.5, 13.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 48;
    const d = 14.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xFFE0C2, 0.28);
    rimLight.position.set(-9.0, 8.0, -7.0);
    scene.add(rimLight);

    const interiorWarmLight = new THREE.PointLight(0xFFAE42, 0.65, 11.5);
    interiorWarmLight.position.set(0.2, 2.4, 0.6);
    scene.add(interiorWarmLight);

    // Continuous rowStreetGroup (`world`) containing all 4 adjoining buildings, shared sidewalk, road, & vehicles
    const world = new THREE.Group();
    const rowStreetGroup = world;
    // Fixed 3/4 isometric pitch & street yaw; elevated slightly (y = 0.44) so sidewalk & road clear the bottom bar
    const LOCKED_PITCH_X = 0.065;
    const STREET_YAW_Y = 0.35; // ~20 deg 3/4 street angle matching the 4-building blueprint
    const DEFAULT_YAW_Y = STREET_YAW_Y;
    rowStreetGroup.position.set(0, 0.44, 0);
    rowStreetGroup.rotation.x = LOCKED_PITCH_X;
    rowStreetGroup.rotation.y = STREET_YAW_Y;
    scene.add(rowStreetGroup);

    // ------------------------------------------------------------------------
    // Materials Palette (1:1 Blueprint Watercolor & Storybook Architecture)
    // ------------------------------------------------------------------------
    const matCreamStucco = new THREE.MeshStandardMaterial({ color: 0xF5E9D6, roughness: 0.92, metalness: 0.01 });
    const matStoneTrim = new THREE.MeshStandardMaterial({ color: 0xDFCBB2, roughness: 0.88, metalness: 0.02 });
    const matSidewalk = new THREE.MeshStandardMaterial({ color: 0xE8D8C3, roughness: 0.92, metalness: 0.01 });
    const matSidewalkCurb = new THREE.MeshStandardMaterial({ color: 0xCFB89E, roughness: 0.90, metalness: 0.02 });
    const matMortarLine = new THREE.MeshBasicMaterial({ color: 0xC7AE93, transparent: true, opacity: 0.65 });

    const matDeepTeal = new THREE.MeshStandardMaterial({ color: 0x24504E, roughness: 0.72, metalness: 0.05 });
    const matLightTealWainscot = new THREE.MeshStandardMaterial({ color: 0x6CA39C, roughness: 0.75, metalness: 0.03 });
    const matGoldSign = new THREE.MeshStandardMaterial({ color: 0xE8B948, roughness: 0.40, metalness: 0.35 });

    const matWarmGlass = new THREE.MeshStandardMaterial({
      color: 0xFFDF9E,
      emissive: 0xFF9E2C,
      emissiveIntensity: 0.28,
      roughness: 0.25,
      metalness: 0.08
    });

    const matAwningRed = new THREE.MeshStandardMaterial({ color: 0xC62828, roughness: 0.72, metalness: 0.02 });
    const matAwningCream = new THREE.MeshStandardMaterial({ color: 0xFAF3E8, roughness: 0.78, metalness: 0.01 });

    const matWoodDoor = new THREE.MeshStandardMaterial({ color: 0x744222, roughness: 0.80, metalness: 0.04 });
    const matWoodDark = new THREE.MeshStandardMaterial({ color: 0x522D16, roughness: 0.84, metalness: 0.04 });
    const matIronBlack = new THREE.MeshStandardMaterial({ color: 0x222527, roughness: 0.55, metalness: 0.35 });

    const matTerracotta = new THREE.MeshStandardMaterial({ color: 0xBF5233, roughness: 0.78, metalness: 0.03 });
    const matTerracottaDark = new THREE.MeshStandardMaterial({ color: 0x9C3E24, roughness: 0.82, metalness: 0.03 });

    // Dappled watercolor botanical leaf surface texture for organic foliage
    function createDappledLeafSurfaceTexture(baseHex, darkHex, lightHex) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 240; i++) {
        const x = (Math.sin(i * 78.233) * 0.5 + 0.5) * 256;
        const y = (Math.cos(i * 45.164) * 0.5 + 0.5) * 256;
        const r = 8 + (i % 5) * 4;
        ctx.fillStyle = i % 2 === 0 ? lightHex : darkHex;
        ctx.globalAlpha = 0.26;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.2, r * 0.8, (i % 7) * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    const leafTexDark = createDappledLeafSurfaceTexture('#2A6336', '#1D4926', '#3E7E4A');
    const leafTexMid = createDappledLeafSurfaceTexture('#3E7E46', '#2B5E33', '#5CA05E');
    const leafTexLight = createDappledLeafSurfaceTexture('#5C9E57', '#3F7D3E', '#7EC072');

    const matFoliageDark = new THREE.MeshStandardMaterial({ map: leafTexDark, roughness: 0.95, metalness: 0.0 });
    const matFoliageMid = new THREE.MeshStandardMaterial({ map: leafTexMid, roughness: 0.95, metalness: 0.0 });
    const matFoliageLight = new THREE.MeshStandardMaterial({ map: leafTexLight, roughness: 0.95, metalness: 0.0 });

    const matBerryRed = new THREE.MeshStandardMaterial({ color: 0xCC1F25, roughness: 0.42, metalness: 0.05 });
    const matBerrySeed = new THREE.MeshStandardMaterial({ color: 0xF5CE56, roughness: 0.45, metalness: 0.08 });
    const matCalyxGreen = new THREE.MeshStandardMaterial({ color: 0x2B6E2F, roughness: 0.68, metalness: 0.02, side: THREE.DoubleSide });

    const interactivePickables = [];
    function registerPickable(meshOrGroup, actionName) {
      meshOrGroup.traverse((child) => {
        if (child.isMesh) {
          child.userData.scAction = actionName;
          interactivePickables.push(child);
        }
      });
    }

    // Helper: create rounded box or standard box with shadow
    function makeBox(w, h, d, mat, x, y, z, parent = world) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

    // ------------------------------------------------------------------------
    // 1. BUILDING #0: STRAWBERRY CORNER (`index = 0`, Left Corner)
    //    Oriented in `rowStreetGroup` so its 2-window café front (+X) faces +Z
    //    (z = +1.425) and its wooden entrance door (+Z) faces -X (x = -1.425).
    //    Right wall (-Z) is at x = +1.425, flush against Building #1!
    // ------------------------------------------------------------------------
    const bldgGroup = new THREE.Group();
    bldgGroup.rotation.y = -Math.PI / 2;
    bldgGroup.position.set(0, 0, 0.465);
    rowStreetGroup.add(bldgGroup);

    // Core footprint constants
    const W_X = 1.92; // local x: -0.96 .. +0.96 -> street z: -0.495 .. +1.425
    const D_Z = 2.85; // local z: -1.425 .. +1.425 -> street x: -1.425 .. +1.425

    // Stone plinth at base of ground floor
    makeBox(W_X + 0.08, 0.24, D_Z + 0.08, matStoneTrim, 0, 0.14, 0, bldgGroup);

    // ------------------------------------------------------------------------
    // 2. GROUND FLOOR BODY & PILASTERS (y = 0.24 .. 2.86)
    // ------------------------------------------------------------------------
    const gfH = 2.62;
    const gfCenterY = 0.24 + gfH / 2; // 1.55
    makeBox(W_X, gfH, D_Z, matCreamStucco, 0, gfCenterY, 0, bldgGroup);

    // Corner & center vertical stucco pilasters for crisp architectural relief
    const pilPositions = [
      [-0.94, -1.40],
      [0.94, -1.40],
      [0.94, 0.0],
      [0.94, 1.40],
      [-0.94, 1.40],
      [-0.02, 1.40]
    ];
    pilPositions.forEach(([px, pz]) => {
      makeBox(0.12, gfH, 0.12, matStoneTrim, px, gfCenterY, pz, bldgGroup);
    });

    // Subtle horizontal stucco rustication grooves on ground floor walls
    [0.95, 1.55, 2.15].forEach((ry) => {
      makeBox(W_X + 0.015, 0.018, D_Z + 0.015, matStoneTrim, 0, ry, 0, bldgGroup);
    });

    // ------------------------------------------------------------------------
    // 3. FRONT ELEVATION (+X FACE, x = +0.96):
    //    Two Café Window Bays + Light-Teal Wainscoting + Scalloped Red/Cream Awning
    // ------------------------------------------------------------------------
    const frontCafeGroup = new THREE.Group();
    bldgGroup.add(frontCafeGroup);

    [-0.68, 0.68].forEach((bayZ) => {
      const bayW = 1.06;
      // Light-Teal Wainscoting base panel (1:1 blueprint detail!)
      makeBox(0.06, 0.62, bayW, matLightTealWainscot, W_X / 2 + 0.01, 0.55, bayZ, frontCafeGroup);
      // Dark-teal recessed molding border on wainscot
      makeBox(0.07, 0.46, bayW - 0.14, matDeepTeal, W_X / 2 + 0.012, 0.55, bayZ, frontCafeGroup);
      makeBox(0.076, 0.40, bayW - 0.20, matLightTealWainscot, W_X / 2 + 0.015, 0.55, bayZ, frontCafeGroup);

      // Stone window sill
      makeBox(0.12, 0.07, bayW + 0.06, matStoneTrim, W_X / 2 + 0.03, 0.88, bayZ, frontCafeGroup);

      // Deep-teal outer window frame
      const winH = 1.26;
      const winY = 1.54;
      makeBox(0.06, winH + 0.08, bayW, matDeepTeal, W_X / 2 + 0.01, winY, bayZ, frontCafeGroup);

      // Warm glowing café glass
      makeBox(0.068, winH - 0.04, bayW - 0.10, matWarmGlass, W_X / 2 + 0.014, winY, bayZ, frontCafeGroup);

      // Mullion bars (2 vertical + 1 horizontal transom)
      [-0.18, 0.18].forEach((mz) => {
        makeBox(0.078, winH - 0.02, 0.032, matDeepTeal, W_X / 2 + 0.018, winY, bayZ + mz, frontCafeGroup);
      });
      makeBox(0.078, 0.035, bayW - 0.08, matDeepTeal, W_X / 2 + 0.018, winY + 0.28, bayZ, frontCafeGroup);

      // Miniature pastry shelf visible silhouette behind window glow
      makeBox(0.08, 0.03, bayW - 0.18, matWoodDoor, W_X / 2 + 0.022, 1.12, bayZ, frontCafeGroup);
      [-0.26, 0.0, 0.26].forEach((pz) => {
        const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 12), matAwningCream);
        cake.position.set(W_X / 2 + 0.028, 1.17, bayZ + pz);
        frontCafeGroup.add(cake);
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), matBerryRed);
        berry.position.set(W_X / 2 + 0.032, 1.22, bayZ + pz);
        frontCafeGroup.add(berry);
      });
    });

    // Full-Width Red & Cream Striped Scalloped Awning on Front (+X) Face
    const frontAwningGroup = new THREE.Group();
    bldgGroup.add(frontAwningGroup);
    const numStripesFront = 13;
    const totalAwningZ = 2.74;
    const stripeW = totalAwningZ / numStripesFront;
    const awningSlopeLen = 0.62;
    const awningAngle = 0.48; // ~27.5 deg downward tilt

    for (let i = 0; i < numStripesFront; i++) {
      const sz = -totalAwningZ / 2 + stripeW * (i + 0.5);
      const isRed = i % 2 === 0;
      const sMat = isRed ? matAwningRed : matAwningCream;

      // Sloped awning panel
      const slopeMesh = new THREE.Mesh(new THREE.BoxGeometry(awningSlopeLen, 0.045, stripeW + 0.003), sMat);
      slopeMesh.position.set(W_X / 2 + 0.25, 2.50, sz);
      slopeMesh.rotation.z = -awningAngle;
      slopeMesh.castShadow = true;
      frontAwningGroup.add(slopeMesh);

      // Front vertical scalloped flap
      const flapX = W_X / 2 + 0.52;
      const flapY = 2.31;
      makeBox(0.042, 0.13, stripeW + 0.002, sMat, flapX, flapY, sz, frontAwningGroup);

      // Rounded bottom scallop cylinder oriented along X axis
      const scallop = new THREE.Mesh(
        new THREE.CylinderGeometry(stripeW * 0.49, stripeW * 0.49, 0.042, 14),
        sMat
      );
      scallop.rotation.z = Math.PI / 2;
      scallop.position.set(flapX, flapY - 0.065, sz);
      frontAwningGroup.add(scallop);
    }
    registerPickable(frontCafeGroup, 'MENU_GRID');
    registerPickable(frontAwningGroup, 'MENU_GRID');

    // ------------------------------------------------------------------------
    // 4. SIDE PROFILE ELEVATION (+Z FACE, z = +1.425):
    //    Left Hanging Berry Basket + Wooden Café Door + Right Café Window & Awning
    // ------------------------------------------------------------------------
    const sideCafeGroup = new THREE.Group();
    bldgGroup.add(sideCafeGroup);

    // 4A. Recessed Wooden Entrance Door on Left Side of +Z Face (x = -0.38)
    const doorX = -0.38;
    const doorZ = D_Z / 2;
    // Stone architrave around door
    makeBox(0.86, 2.18, 0.08, matStoneTrim, doorX, 1.33, doorZ + 0.01, sideCafeGroup);
    // Warm Walnut Door Frame & Panel
    makeBox(0.72, 2.06, 0.09, matWoodDark, doorX, 1.28, doorZ + 0.02, sideCafeGroup);
    makeBox(0.62, 1.96, 0.10, matWoodDoor, doorX, 1.26, doorZ + 0.025, sideCafeGroup);
    // Upper Glass Window in Door
    makeBox(0.46, 0.78, 0.11, matWarmGlass, doorX, 1.66, doorZ + 0.028, sideCafeGroup);
    // Wooden cross mullions in door glass
    makeBox(0.46, 0.028, 0.116, matWoodDark, doorX, 1.66, doorZ + 0.03, sideCafeGroup);
    makeBox(0.028, 0.78, 0.116, matWoodDark, doorX, 1.66, doorZ + 0.03, sideCafeGroup);
    // Lower raised wood panel on door
    makeBox(0.46, 0.56, 0.11, matWoodDark, doorX, 0.78, doorZ + 0.028, sideCafeGroup);
    // Cute hanging "OPEN" sign plate inside door glass
    makeBox(0.24, 0.11, 0.118, matAwningCream, doorX, 1.50, doorZ + 0.034, sideCafeGroup);
    makeBox(0.18, 0.035, 0.122, matAwningRed, doorX, 1.50, doorZ + 0.036, sideCafeGroup);
    // Brass doorknob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), matGoldSign);
    knob.position.set(doorX + 0.22, 1.12, doorZ + 0.09);
    sideCafeGroup.add(knob);
    // Two-tier Stone Entrance Steps in front of door
    makeBox(0.92, 0.12, 0.28, matStoneTrim, doorX, 0.18, doorZ + 0.14, sideCafeGroup);
    makeBox(1.04, 0.08, 0.42, matSidewalkCurb, doorX, 0.09, doorZ + 0.22, sideCafeGroup);

    // 4B. Hanging Berry Basket cleanly anchored to the Left Pilaster (x = -0.84, z = +1.44)
    const basketAnchorX = -0.84;
    const basketAnchorY = 2.42;
    const basketAnchorZ = doorZ + 0.04;
    // Iron wall plate attached flush to the pilaster
    makeBox(0.06, 0.22, 0.04, matIronBlack, basketAnchorX, basketAnchorY, basketAnchorZ, sideCafeGroup);
    // Horizontal wrought-iron arm extending forward (+Z)
    makeBox(0.035, 0.035, 0.26, matIronBlack, basketAnchorX, basketAnchorY + 0.06, basketAnchorZ + 0.12, sideCafeGroup);
    // Diagonal scroll brace connecting wall plate to arm
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.20, 0.028), matIronBlack);
    brace.position.set(basketAnchorX, basketAnchorY - 0.01, basketAnchorZ + 0.09);
    brace.rotation.x = -0.68;
    sideCafeGroup.add(brace);
    // Vertical hanging chain from arm tip down to terracotta basket
    const basketZ = basketAnchorZ + 0.22;
    const basketY = basketAnchorY - 0.18;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), matIronBlack);
    chain.position.set(basketAnchorX, basketAnchorY - 0.05, basketZ);
    sideCafeGroup.add(chain);
    // Terracotta hanging pot
    const hangPot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.16, 14), matTerracotta);
    hangPot.position.set(basketAnchorX, basketY, basketZ);
    hangPot.castShadow = true;
    sideCafeGroup.add(hangPot);
    // Lush green foliage & trailing red berries in hanging basket
    [
      [0, 0.09, 0, 0.12],
      [-0.07, 0.06, 0.05, 0.09],
      [0.07, 0.06, 0.04, 0.09],
      [0, 0.04, -0.06, 0.09],
      [-0.04, -0.04, 0.09, 0.065],
      [0.05, -0.06, 0.08, 0.06]
    ].forEach(([ox, oy, oz, r], idx) => {
      const leafBall = new THREE.Mesh(
        new THREE.SphereGeometry(r, 10, 10),
        idx % 2 === 0 ? matFoliageMid : matFoliageLight
      );
      leafBall.position.set(basketAnchorX + ox, basketY + oy, basketZ + oz);
      sideCafeGroup.add(leafBall);
    });
    [
      [-0.06, 0.02, 0.11],
      [0.06, 0.00, 0.11],
      [0.0, -0.08, 0.10]
    ].forEach(([bx, by, bz]) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), matBerryRed);
      b.scale.set(1, 1.25, 1);
      b.position.set(basketAnchorX + bx, basketY + by, basketZ + bz);
      sideCafeGroup.add(b);
    });

    // 4C. Side Profile Right Café Window Bay (x = +0.44, z = +1.425) + Wainscoting + Side Awning
    const sideBayX = 0.44;
    const sideBayW = 0.88;
    // Light-Teal Wainscoting base panel (matches Front Elevation!)
    makeBox(sideBayW, 0.62, 0.06, matLightTealWainscot, sideBayX, 0.55, doorZ + 0.01, sideCafeGroup);
    makeBox(sideBayW - 0.14, 0.46, 0.07, matDeepTeal, sideBayX, 0.55, doorZ + 0.012, sideCafeGroup);
    makeBox(sideBayW - 0.20, 0.40, 0.076, matLightTealWainscot, sideBayX, 0.55, doorZ + 0.015, sideCafeGroup);
    // Stone window sill
    makeBox(sideBayW + 0.06, 0.07, 0.12, matStoneTrim, sideBayX, 0.88, doorZ + 0.03, sideCafeGroup);
    // Deep-teal window frame & warm glass
    makeBox(sideBayW, 1.34, 0.06, matDeepTeal, sideBayX, 1.54, doorZ + 0.01, sideCafeGroup);
    makeBox(sideBayW - 0.10, 1.22, 0.068, matWarmGlass, sideBayX, 1.54, doorZ + 0.014, sideCafeGroup);
    // Window mullions
    makeBox(0.032, 1.24, 0.078, matDeepTeal, sideBayX, 1.54, doorZ + 0.018, sideCafeGroup);
    makeBox(sideBayW - 0.08, 0.035, 0.078, matDeepTeal, sideBayX, 1.82, doorZ + 0.018, sideCafeGroup);

    // Side Awning over the +Z Café Window (5 alternating red/cream stripes)
    const numSideStripes = 5;
    const sideAwningW = 0.98;
    const sideStripeW = sideAwningW / numSideStripes;
    for (let i = 0; i < numSideStripes; i++) {
      const sx = sideBayX - sideAwningW / 2 + sideStripeW * (i + 0.5);
      const sMat = i % 2 === 0 ? matAwningRed : matAwningCream;

      const slope = new THREE.Mesh(new THREE.BoxGeometry(sideStripeW + 0.002, 0.042, 0.52), sMat);
      slope.position.set(sx, 2.48, doorZ + 0.22);
      slope.rotation.x = awningAngle;
      slope.castShadow = true;
      sideCafeGroup.add(slope);

      const flapZ = doorZ + 0.45;
      const flapY = 2.31;
      makeBox(sideStripeW + 0.002, 0.12, 0.04, sMat, sx, flapY, flapZ, sideCafeGroup);

      const scallop = new THREE.Mesh(
        new THREE.CylinderGeometry(sideStripeW * 0.49, sideStripeW * 0.49, 0.04, 12),
        sMat
      );
      scallop.rotation.x = Math.PI / 2;
      scallop.position.set(sx, flapY - 0.06, flapZ);
      sideCafeGroup.add(scallop);
    }
    registerPickable(sideCafeGroup, 'MENU_GRID');

    // ------------------------------------------------------------------------
    // 5. OUTDOOR CAFÉ FURNITURE & SLEEPING GINGER CAT ("MOCHI")
    // ------------------------------------------------------------------------
    const propsGroup = new THREE.Group();
    bldgGroup.add(propsGroup);

    // 5A. A-Frame Chalkboard Sign on Front-Left Corner (+X / +Z corner)
    const signGroup = new THREE.Group();
    signGroup.position.set(1.38, 0.09, 1.12);
    signGroup.rotation.y = 0.42;
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.58, 0.34), matWoodDoor);
    legA.position.set(-0.08, 0.27, 0);
    legA.rotation.z = -0.18;
    signGroup.add(legA);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.58, 0.34), matWoodDoor);
    legB.position.set(0.08, 0.27, 0);
    legB.rotation.z = 0.18;
    signGroup.add(legB);
    const slateA = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.44, 0.28), matIronBlack);
    slateA.position.set(-0.075, 0.30, 0);
    slateA.rotation.z = -0.18;
    signGroup.add(slateA);
    const chalkBerry = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matBerryRed);
    chalkBerry.position.set(0.10, 0.32, 0);
    signGroup.add(chalkBerry);
    propsGroup.add(signGroup);

    // 5B. Bistro Table & Two Chairs on Front Sidewalk (+X face)
    const bistroX = 1.44;
    const bistroZ = -0.32;
    const tablePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.52, 10), matIronBlack);
    tablePedestal.position.set(bistroX, 0.34, bistroZ);
    propsGroup.add(tablePedestal);
    const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.03, 14), matIronBlack);
    tableBase.position.set(bistroX, 0.10, bistroZ);
    propsGroup.add(tableBase);
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20), matAwningCream);
    tableTop.position.set(bistroX, 0.60, bistroZ);
    tableTop.castShadow = true;
    propsGroup.add(tableTop);
    // Berry shortcake + iced latte on table
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.016, 12), matAwningCream);
    plate.position.set(bistroX - 0.08, 0.63, bistroZ + 0.06);
    propsGroup.add(plate);
    const miniCake = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 10), matAwningCream);
    miniCake.position.set(bistroX - 0.08, 0.66, bistroZ + 0.06);
    propsGroup.add(miniCake);
    const miniTopBerry = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), matBerryRed);
    miniTopBerry.position.set(bistroX - 0.08, 0.695, bistroZ + 0.06);
    propsGroup.add(miniTopBerry);
    const latteCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.036, 0.11, 10),
      new THREE.MeshStandardMaterial({ color: 0xF7B9C4, roughness: 0.3 })
    );
    latteCup.position.set(bistroX + 0.09, 0.675, bistroZ - 0.05);
    propsGroup.add(latteCup);

    // Two Bistro Chairs flanking the table
    [-0.42, 0.42].forEach((czOff, idx) => {
      const chair = new THREE.Group();
      chair.position.set(bistroX + 0.04, 0.09, bistroZ + czOff);
      chair.rotation.y = idx === 0 ? 0.35 : -0.35;
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 14), matWoodDoor);
      seat.position.y = 0.28;
      chair.add(seat);
      [
        [-0.10, -0.10],
        [0.10, -0.10],
        [-0.10, 0.10],
        [0.10, 0.10]
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.28, 6), matIronBlack);
        leg.position.set(lx, 0.14, lz);
        chair.add(leg);
      });
      const backRest = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.28, 0.025),
        matIronBlack
      );
      backRest.position.set(0, 0.44, idx === 0 ? -0.13 : 0.13);
      chair.add(backRest);
      propsGroup.add(chair);
    });

    // 5C. Lush Terracotta Planter Box at Front-Right Corner (+X, z = -1.16)
    makeBox(0.28, 0.24, 0.46, matTerracotta, 1.18, 0.21, -1.14, propsGroup);
    [
      [1.18, 0.38, -1.24, 0.14],
      [1.18, 0.41, -1.12, 0.16],
      [1.18, 0.37, -1.00, 0.13]
    ].forEach(([bx, by, bz, r], i) => {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), i % 2 === 0 ? matFoliageMid : matFoliageLight);
      bush.position.set(bx, by, bz);
      propsGroup.add(bush);
    });

    // 5D. Sleeping Ginger Cat "Mochi" on Wooden Bench under Side Window (+Z face)
    const catGroup = new THREE.Group();
    catGroup.position.set(sideBayX, 0.09, doorZ + 0.22);
    // Little wooden bench
    makeBox(0.56, 0.14, 0.24, matWoodDoor, 0, 0.07, 0, catGroup);
    const matGingerCat = new THREE.MeshStandardMaterial({ color: 0xE68A3E, roughness: 0.72 });
    const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), matGingerCat);
    catBody.scale.set(1.35, 0.72, 0.95);
    catBody.position.set(-0.02, 0.18, 0.01);
    catGroup.add(catBody);
    const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), matGingerCat);
    catHead.position.set(0.09, 0.20, 0.02);
    catGroup.add(catHead);
    [-0.03, 0.03].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 6), matGingerCat);
      ear.position.set(0.11, 0.26, 0.02 + ez);
      catGroup.add(ear);
    });
    bldgGroup.add(catGroup);
    registerPickable(catGroup, 'CAT_PET');

    // ------------------------------------------------------------------------
    // 6. VINTAGE TEAL SIGNAGE BAND & CORNICE (y = 2.86 .. 3.16)
    // ------------------------------------------------------------------------
    const trimGroup = new THREE.Group();
    bldgGroup.add(trimGroup);

    // Lower & Upper Cream Cornice Ledges
    makeBox(W_X + 0.14, 0.06, D_Z + 0.14, matStoneTrim, 0, 2.87, 0, trimGroup);
    makeBox(W_X + 0.10, 0.22, D_Z + 0.10, matDeepTeal, 0, 3.01, 0, trimGroup);
    makeBox(W_X + 0.16, 0.06, D_Z + 0.16, matStoneTrim, 0, 3.15, 0, trimGroup);

    // Gold "STRAWBERRY CORNER" Frieze Signboard Texture on Front (+X) & Side (+Z)
    function createSignboardMaterial(textStr) {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#24504E';
      ctx.fillRect(0, 0, 1024, 128);
      ctx.strokeStyle = '#D9AC42';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, 1004, 108);
      ctx.fillStyle = '#F5CF6B';
      ctx.font = 'bold 54px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(textStr, 512, 66);
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.20 });
    }
    const matSignBoard = createSignboardMaterial('· STRAWBERRY CORNER ·');

    const signFront = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.17, 2.18), matSignBoard);
    signFront.position.set(W_X / 2 + 0.052, 3.01, 0);
    trimGroup.add(signFront);

    const signSide = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.17, 0.025), matSignBoard);
    signSide.position.set(0, 3.01, D_Z / 2 + 0.052);
    trimGroup.add(signSide);

    // ------------------------------------------------------------------------
    // 7. SECOND FLOOR (y = 3.18 .. 5.56)
    //    - Main Tower (`z` from -0.51 to +1.425, full `W_X = 1.92`)
    //    - Recessed Right-Wing Balcony Wall (`z` from -1.425 to -0.51, `x` from -0.96 to +0.26)
    //    - OPEN Front-Right Balcony Deck (`x` from +0.26 to +0.96, `z` from -1.425 to -0.51)
    //    - True Hollow Extruded Arched Windows (ZERO misrotated cylinders!)
    // ------------------------------------------------------------------------
    const secondFloorGroup = new THREE.Group();
    bldgGroup.add(secondFloorGroup);

    const sfBottomY = 3.18;
    const sfTopY = 5.56;
    const sfH = sfTopY - sfBottomY; // 2.38
    const sfCenterY = sfBottomY + sfH / 2; // 4.37

    // 7A. Main 2nd-Floor Tower (occupies z: -0.51 .. +1.425 -> depth = 1.935, center z = +0.4575)
    const mainTowerZDepth = 1.935;
    const mainTowerZCenter = 0.4575;
    makeBox(W_X, sfH, mainTowerZDepth, matCreamStucco, 0, sfCenterY, mainTowerZCenter, secondFloorGroup);

    // Corner quoins / pilasters on Main Tower
    [
      [-0.94, -0.49],
      [0.94, -0.49],
      [0.94, 1.40],
      [-0.94, 1.40]
    ].forEach(([px, pz]) => {
      makeBox(0.11, sfH, 0.11, matStoneTrim, px, sfCenterY, pz, secondFloorGroup);
    });

    // 7B. Recessed Balcony Wing (`sideExt`) in z: -1.425 .. -0.51 (depth = 0.915, center z = -0.9675)
    //     Crucial fix: `sideExt` ONLY occupies x: -0.96 .. +0.24 (width = 1.20, center x = -0.36)
    //     so x: +0.24 .. +0.96 is a completely OPEN 2nd-floor balcony terrace!
    const extZDepth = 0.915;
    const extZCenter = -0.9675;
    const extXWidth = 1.20;
    const extXCenter = -0.36;
    const extH = 1.88; // y: 3.18 .. 5.06
    makeBox(extXWidth, extH, extZDepth, matCreamStucco, extXCenter, sfBottomY + extH / 2, extZCenter, secondFloorGroup);

    // Upper cornice ledge on top of `sideExt` (stops flush at z = -0.51; never penetrates mainTower!)
    makeBox(extXWidth + 0.08, 0.09, extZDepth + 0.06, matStoneTrim, extXCenter, sfBottomY + extH + 0.045, extZCenter - 0.02, secondFloorGroup);
    // Terracotta coping tiles on `sideExt` upper cornice
    makeBox(extXWidth + 0.10, 0.07, extZDepth + 0.08, matTerracotta, extXCenter, sfBottomY + extH + 0.12, extZCenter - 0.02, secondFloorGroup);

    // Two cute terracotta pots with green plants on `sideExt` upper roof ledge
    [-0.65, -0.05].forEach((px) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.14, 12), matTerracotta);
      pot.position.set(px, sfBottomY + extH + 0.22, extZCenter - 0.10);
      secondFloorGroup.add(pot);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), matFoliageMid);
      plant.position.set(px, sfBottomY + extH + 0.34, extZCenter - 0.10);
      secondFloorGroup.add(plant);
    });

    // Warm French Balcony Window/Door on the +X face of `sideExt` (x = +0.24) facing the open balcony deck
    makeBox(0.06, 1.32, 0.56, matDeepTeal, 0.25, 3.88, extZCenter, secondFloorGroup);
    makeBox(0.07, 1.20, 0.46, matWarmGlass, 0.255, 3.88, extZCenter, secondFloorGroup);
    makeBox(0.08, 1.22, 0.028, matDeepTeal, 0.26, 3.88, extZCenter, secondFloorGroup);
    makeBox(0.08, 0.028, 0.46, matDeepTeal, 0.26, 4.02, extZCenter, secondFloorGroup);

    // 7C. Open Front-Right 2nd-Floor Balcony Deck & Wrought-Iron Railing (x: +0.24 .. +0.94, z: -1.40 .. -0.52)
    const balDeckX = 0.60;
    const balDeckW = 0.72;
    // Terracotta tiled balcony floor slab resting on top of the Teal Cornice
    makeBox(balDeckW, 0.05, extZDepth - 0.02, matTerracottaDark, balDeckX, 3.20, extZCenter, secondFloorGroup);

    // Wrought-iron railing flush along the Front (+X = +0.92) & Right (-Z = -1.39) edges of the balcony deck
    const railTopY = 3.68;
    const railBotY = 3.22;
    const railH = railTopY - railBotY;
    const railFrontX = 0.91;
    const railRightZ = -1.39;

    // Front top & bottom iron rails (along Z from -1.39 to -0.51)
    makeBox(0.032, 0.032, 0.90, matIronBlack, railFrontX, railTopY, extZCenter, secondFloorGroup);
    makeBox(0.028, 0.028, 0.90, matIronBlack, railFrontX, railBotY + 0.04, extZCenter, secondFloorGroup);
    // Right side top & bottom iron rails (along X from +0.24 to +0.91)
    makeBox(0.68, 0.032, 0.032, matIronBlack, 0.58, railTopY, railRightZ, secondFloorGroup);
    makeBox(0.68, 0.028, 0.028, matIronBlack, 0.58, railBotY + 0.04, railRightZ, secondFloorGroup);

    // Corner & end posts with iron ball finials
    [
      [railFrontX, -0.53],
      [railFrontX, railRightZ],
      [0.26, railRightZ]
    ].forEach(([px, pz]) => {
      makeBox(0.048, railH + 0.04, 0.048, matIronBlack, px, (railTopY + railBotY) / 2, pz, secondFloorGroup);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), matIronBlack);
      finial.position.set(px, railTopY + 0.04, pz);
      secondFloorGroup.add(finial);
    });

    // Vertical iron balusters along Front (+X) railing
    for (let bz = -1.30; bz <= -0.60; bz += 0.115) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, railH, 6), matIronBlack);
      bar.position.set(railFrontX, (railTopY + railBotY) / 2, bz);
      secondFloorGroup.add(bar);
    }
    // Vertical iron balusters along Right (-Z) railing
    for (let bx = 0.34; bx <= 0.82; bx += 0.115) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, railH, 6), matIronBlack);
      bar.position.set(bx, (railTopY + railBotY) / 2, railRightZ);
      secondFloorGroup.add(bar);
    }

    // Lush balcony greenery & red berries weaving along the balcony railing
    [
      [railFrontX - 0.02, 3.66, -0.78, 0.11],
      [railFrontX - 0.01, 3.62, -0.94, 0.13],
      [railFrontX - 0.02, 3.65, -1.12, 0.10],
      [0.72, 3.64, railRightZ + 0.02, 0.11],
      [0.54, 3.66, railRightZ + 0.02, 0.12]
    ].forEach(([vx, vy, vz, r], idx) => {
      const vBall = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), idx % 2 === 0 ? matFoliageMid : matFoliageLight);
      vBall.position.set(vx, vy, vz);
      secondFloorGroup.add(vBall);
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), matBerryRed);
      berry.position.set(vx + 0.05, vy - 0.02, vz + 0.04);
      secondFloorGroup.add(berry);
    });

    // ------------------------------------------------------------------------
    // 7D. TRUE HOLLOW EXTRUDED ARCHED WINDOWS (Front +X & Side +Z)
    //     Uses THREE.Shape + absarc + ExtrudeGeometry so the arch curves cleanly
    //     upward (+Y) and never blocks the window pane!
    // ------------------------------------------------------------------------
    function createArchedWindowAssembly({
      innerW = 0.72,
      rectH = 0.76,
      surroundThickness = 0.13,
      surroundMat = matDeepTeal,
      hasKeystone = false
    }) {
      const group = new THREE.Group();
      const innerR = innerW / 2;
      const outerW = innerW + surroundThickness * 2;
      const outerR = outerW / 2;

      // 1. Hollow Arch Surround Frame (outerShape with innerHole punched out)
      const outerShape = new THREE.Shape();
      outerShape.moveTo(-outerR, 0);
      outerShape.lineTo(outerR, 0);
      outerShape.lineTo(outerR, rectH);
      outerShape.absarc(0, rectH, outerR, 0, Math.PI, false);
      outerShape.lineTo(-outerR, 0);

      const holePath = new THREE.Path();
      holePath.moveTo(-innerR, 0.02);
      holePath.lineTo(innerR, 0.02);
      holePath.lineTo(innerR, rectH);
      holePath.absarc(0, rectH, innerR, 0, Math.PI, false);
      holePath.lineTo(-innerR, 0.02);
      outerShape.holes.push(holePath);

      const frameGeo = new THREE.ExtrudeGeometry(outerShape, {
        depth: 0.085,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.012
      });
      const frameMesh = new THREE.Mesh(frameGeo, surroundMat);
      frameMesh.castShadow = true;
      frameMesh.receiveShadow = true;
      group.add(frameMesh);

      // 2. Inner Arched Warm Glowing Glass Pane
      const glassShape = new THREE.Shape();
      glassShape.moveTo(-innerR, 0.02);
      glassShape.lineTo(innerR, 0.02);
      glassShape.lineTo(innerR, rectH);
      glassShape.absarc(0, rectH, innerR, 0, Math.PI, false);
      glassShape.lineTo(-innerR, 0.02);

      const glassGeo = new THREE.ExtrudeGeometry(glassShape, {
        depth: 0.04,
        bevelEnabled: false
      });
      const glassMesh = new THREE.Mesh(glassGeo, matWarmGlass);
      glassMesh.position.z = 0.018;
      group.add(glassMesh);

      // 3. Inner Dark-Teal Window Sash & Cross Mullions
      const totalInnerH = rectH + innerR;
      const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.032, totalInnerH - 0.02, 0.035), matDeepTeal);
      vMullion.position.set(0, totalInnerH / 2, 0.055);
      group.add(vMullion);

      const hMullion1 = new THREE.Mesh(new THREE.BoxGeometry(innerW - 0.02, 0.032, 0.035), matDeepTeal);
      hMullion1.position.set(0, rectH, 0.055);
      group.add(hMullion1);

      const hMullion2 = new THREE.Mesh(new THREE.BoxGeometry(innerW - 0.02, 0.028, 0.035), matDeepTeal);
      hMullion2.position.set(0, rectH * 0.5, 0.055);
      group.add(hMullion2);

      // 4. Optional Keystone at top of arch (for Side Profile stone arch)
      if (hasKeystone) {
        const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.11), matStoneTrim);
        keystone.position.set(0, rectH + outerR - 0.02, 0.045);
        group.add(keystone);
      }

      // 5. Stone Window Sill + Terracotta Flower Box with Greenery & Berries
      const sill = new THREE.Mesh(new THREE.BoxGeometry(outerW + 0.14, 0.08, 0.16), matStoneTrim);
      sill.position.set(0, -0.03, 0.06);
      sill.castShadow = true;
      group.add(sill);

      const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(innerW + 0.06, 0.14, 0.14), matTerracotta);
      flowerBox.position.set(0, 0.07, 0.11);
      flowerBox.castShadow = true;
      group.add(flowerBox);

      [-0.22, -0.07, 0.08, 0.22].forEach((fx, i) => {
        const bush = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 10, 10),
          i % 2 === 0 ? matFoliageMid : matFoliageLight
        );
        bush.position.set(fx, 0.16, 0.12);
        group.add(bush);

        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), matBerryRed);
        berry.position.set(fx + (i % 2 === 0 ? 0.03 : -0.03), 0.15, 0.19);
        group.add(berry);
      });

      return group;
    }

    // Place Front Elevation (+X) Arched Window (Deep-Teal Surround, centered on mainTower at z = +0.46)
    const frontArchWin = createArchedWindowAssembly({
      innerW: 0.74,
      rectH: 0.78,
      surroundThickness: 0.13,
      surroundMat: matDeepTeal,
      hasKeystone: false
    });
    frontArchWin.rotation.y = Math.PI / 2;
    frontArchWin.position.set(W_X / 2 - 0.01, 3.68, mainTowerZCenter);
    secondFloorGroup.add(frontArchWin);

    // Place Side Profile (+Z) Arched Window (Cream Stone Surround + Keystone, centered on +Z face at x = 0)
    const sideArchWin = createArchedWindowAssembly({
      innerW: 0.76,
      rectH: 0.80,
      surroundThickness: 0.14,
      surroundMat: matStoneTrim,
      hasKeystone: true
    });
    sideArchWin.position.set(0, 3.68, D_Z / 2 - 0.01);
    secondFloorGroup.add(sideArchWin);

    registerPickable(secondFloorGroup, 'EVENTS');

    // ------------------------------------------------------------------------
    // 8. ROOFTOP CORNICE, SCALLOPED TERRACOTTA TILES & IRON FENCE (y = 5.56 .. 6.26)
    // ------------------------------------------------------------------------
    const roofGroup = new THREE.Group();
    bldgGroup.add(roofGroup);

    const roofZDepth = mainTowerZDepth;
    const roofZCenter = mainTowerZCenter;

    // Stepped Cream Stone Roof Cornice
    makeBox(W_X + 0.14, 0.08, roofZDepth + 0.14, matStoneTrim, 0, 5.60, roofZCenter, roofGroup);
    makeBox(W_X + 0.22, 0.08, roofZDepth + 0.22, matStoneTrim, 0, 5.68, roofZCenter, roofGroup);

    // Terracotta Roof Eave Band
    makeBox(W_X + 0.28, 0.10, roofZDepth + 0.28, matTerracotta, 0, 5.76, roofZCenter, roofGroup);

    // Individual Scalloped Barrel Tiles along Front (+X), Back (-X), Left (+Z), and Right (-Z) eaves
    const tileRadius = 0.058;
    for (let tz = roofZCenter - roofZDepth / 2 - 0.05; tz <= roofZCenter + roofZDepth / 2 + 0.05; tz += 0.145) {
      [W_X / 2 + 0.12, -W_X / 2 - 0.12].forEach((tx) => {
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(tileRadius, tileRadius, 0.12, 10),
          matTerracotta
        );
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(tx, 5.75, tz);
        roofGroup.add(barrel);
      });
    }
    for (let tx = -W_X / 2 - 0.05; tx <= W_X / 2 + 0.05; tx += 0.145) {
      [roofZCenter + roofZDepth / 2 + 0.12, roofZCenter - roofZDepth / 2 - 0.12].forEach((tz) => {
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(tileRadius, tileRadius, 0.12, 10),
          matTerracotta
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(tx, 5.75, tz);
        roofGroup.add(barrel);
      });
    }

    // Lush Green Rooftop Garden Turf Pad
    makeBox(W_X - 0.06, 0.10, roofZDepth - 0.06, matFoliageDark, 0, 5.83, roofZCenter, roofGroup);

    // Black Wrought-Iron Rooftop Perimeter Fence
    const rFenceBotY = 5.84;
    const rFenceTopY = 6.26;
    const rFenceH = rFenceTopY - rFenceBotY;
    const fxMax = W_X / 2 - 0.04;
    const fzMin = roofZCenter - roofZDepth / 2 + 0.04;
    const fzMax = roofZCenter + roofZDepth / 2 - 0.04;

    // Horizontal top & bottom iron rails on all 4 sides
    [rFenceTopY, rFenceBotY + 0.05].forEach((ry) => {
      makeBox(0.03, 0.03, roofZDepth - 0.08, matIronBlack, fxMax, ry, roofZCenter, roofGroup);
      makeBox(0.03, 0.03, roofZDepth - 0.08, matIronBlack, -fxMax, ry, roofZCenter, roofGroup);
      makeBox(W_X - 0.08, 0.03, 0.03, matIronBlack, 0, ry, fzMax, roofGroup);
      makeBox(W_X - 0.08, 0.03, 0.03, matIronBlack, 0, ry, fzMin, roofGroup);
    });

    // 4 Corner Iron Posts with Finials
    [
      [fxMax, fzMax],
      [-fxMax, fzMax],
      [fxMax, fzMin],
      [-fxMax, fzMin]
    ].forEach(([px, pz]) => {
      makeBox(0.05, rFenceH + 0.06, 0.05, matIronBlack, px, (rFenceTopY + rFenceBotY) / 2, pz, roofGroup);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), matIronBlack);
      ball.position.set(px, rFenceTopY + 0.05, pz);
      roofGroup.add(ball);
    });

    // Vertical iron pickets along all 4 sides of rooftop fence
    for (let z = fzMin + 0.12; z <= fzMax - 0.10; z += 0.13) {
      [fxMax, -fxMax].forEach((x) => {
        const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, rFenceH, 6), matIronBlack);
        picket.position.set(x, (rFenceTopY + rFenceBotY) / 2, z);
        roofGroup.add(picket);
      });
    }
    for (let x = -fxMax + 0.12; x <= fxMax - 0.10; x += 0.13) {
      [fzMax, fzMin].forEach((z) => {
        const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, rFenceH, 6), matIronBlack);
        picket.position.set(x, (rFenceTopY + rFenceBotY) / 2, z);
        roofGroup.add(picket);
      });
    }

    // 4 Corner Terracotta Pots on the Rooftop Garden + Cascading Vines & Berries
    [
      [fxMax - 0.22, fzMax - 0.22],
      [-fxMax + 0.22, fzMax - 0.22],
      [fxMax - 0.22, fzMin + 0.22],
      [-fxMax + 0.22, fzMin + 0.22]
    ].forEach(([px, pz], idx) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.10, 0.20, 14), matTerracotta);
      pot.position.set(px, 5.96, pz);
      pot.castShadow = true;
      roofGroup.add(pot);

      const bushMain = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), idx % 2 === 0 ? matFoliageMid : matFoliageLight);
      bushMain.position.set(px, 6.14, pz);
      roofGroup.add(bushMain);

      const miniB = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), matBerryRed);
      miniB.scale.set(1, 1.2, 1);
      miniB.position.set(px + (px > 0 ? 0.12 : -0.12), 6.18, pz + (pz > roofZCenter ? 0.10 : -0.10));
      roofGroup.add(miniB);
    });

    // Lush rooftop foliage mounds & trailing ivy cascading over the roof cornice
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const rx = Math.cos(ang) * 0.68;
      const rz = roofZCenter + Math.sin(ang) * 0.68;
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(0.16 + (i % 3) * 0.04, 10, 10),
        i % 2 === 0 ? matFoliageMid : matFoliageLight
      );
      mound.scale.set(1.2, 0.75, 1.2);
      mound.position.set(rx, 5.94, rz);
      roofGroup.add(mound);
    }

    // Trailing vine clusters hanging slightly over Front (+X) and Side (+Z) cornice
    [
      [fxMax + 0.08, 5.68, roofZCenter + 0.35],
      [fxMax + 0.08, 5.56, roofZCenter + 0.42],
      [fxMax + 0.08, 5.70, roofZCenter - 0.38],
      [-0.32, 5.68, fzMax + 0.08],
      [-0.24, 5.55, fzMax + 0.09],
      [0.42, 5.68, fzMax + 0.08]
    ].forEach(([vx, vy, vz], i) => {
      const vLeaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 - (i % 2) * 0.015, 8, 8),
        i % 2 === 0 ? matFoliageLight : matFoliageMid
      );
      vLeaf.position.set(vx, vy, vz);
      roofGroup.add(vLeaf);
    });

    // ------------------------------------------------------------------------
    // 9. GIANT ROOFTOP STRAWBERRY SCULPTURE + CALYX LEAVES + CURVED STEM + BIRDS
    // ------------------------------------------------------------------------
    const giantBerryGroup = new THREE.Group();
    giantBerryGroup.position.set(0, 5.92, roofZCenter);
    roofGroup.add(giantBerryGroup);

    // Lathe-profiled plump heart-shaped strawberry body (height = 1.48)
    const berryPts = [];
    const berryH = 1.48;
    const berrySteps = 28;
    for (let i = 0; i <= berrySteps; i++) {
      const t = i / berrySteps; // 0 = bottom tip, 1 = crown top
      const y = t * berryH;
      // Plump strawberry contour: rounded tip at bottom, widest at t ~ 0.66, tucked crown at top
      const r =
        0.74 *
        Math.pow(Math.sin(t * Math.PI), 0.58) *
        (0.58 + 0.54 * Math.pow(t, 0.45));
      berryPts.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
    const berryLatheGeo = new THREE.LatheGeometry(berryPts, 36);
    const giantBerryMesh = new THREE.Mesh(berryLatheGeo, matBerryRed);
    giantBerryMesh.castShadow = true;
    giantBerryMesh.receiveShadow = true;
    giantBerryGroup.add(giantBerryMesh);

    // 84 Recessed Golden Achenes (Seeds) in Fibonacci spiral across the strawberry surface
    const numSeeds = 84;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < numSeeds; i++) {
      const t = 0.12 + (i / numSeeds) * 0.76;
      const y = t * berryH;
      const r =
        0.74 *
        Math.pow(Math.sin(t * Math.PI), 0.58) *
        (0.58 + 0.54 * Math.pow(t, 0.45));
      const theta = i * goldenAngle;

      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), matBerrySeed);
      seed.scale.set(0.85, 1.35, 0.65);
      seed.position.set(Math.cos(theta) * (r + 0.004), y, Math.sin(theta) * (r + 0.004));
      seed.lookAt(0, y, 0);
      giantBerryGroup.add(seed);
    }

    // 8 Lush Sculpted Green Calyx Leaves radiating & draping over the top of the strawberry
    const numCalyx = 8;
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.22, 0.18, 0.18, 0.48);
    leafShape.quadraticCurveTo(0.08, 0.64, 0, 0.74);
    leafShape.quadraticCurveTo(-0.08, 0.64, -0.18, 0.48);
    leafShape.quadraticCurveTo(-0.22, 0.18, 0, 0);
    const calyxGeo = new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.014,
      bevelThickness: 0.014
    });

    for (let i = 0; i < numCalyx; i++) {
      const angle = (i / numCalyx) * Math.PI * 2;
      const leafPivot = new THREE.Group();
      leafPivot.position.set(0, berryH - 0.04, 0);
      leafPivot.rotation.y = angle;

      const leafMesh = new THREE.Mesh(
        calyxGeo,
        i % 2 === 0 ? matCalyxGreen : matFoliageMid
      );
      leafMesh.rotation.x = Math.PI / 2 + 0.30; // drapes cleanly down over the upper shoulder of the strawberry
      leafMesh.castShadow = true;
      leafPivot.add(leafMesh);
      giantBerryGroup.add(leafPivot);
    }

    // Inner upturned crown leaves + Curved Woody Green Strawberry Stem at the crown
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.3;
      const innerPivot = new THREE.Group();
      innerPivot.position.set(0, berryH - 0.02, 0);
      innerPivot.rotation.y = angle;
      const innerLeaf = new THREE.Mesh(calyxGeo, matFoliageLight);
      innerLeaf.scale.set(0.65, 0.55, 0.7);
      innerLeaf.rotation.x = Math.PI / 2 - 0.22;
      innerPivot.add(innerLeaf);
      giantBerryGroup.add(innerPivot);
    }

    const crownRosette = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), matCalyxGreen);
    crownRosette.scale.set(1.4, 0.55, 1.4);
    crownRosette.position.set(0, berryH + 0.02, 0);
    giantBerryGroup.add(crownRosette);

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, berryH, 0),
      new THREE.Vector3(0.04, berryH + 0.22, 0.02),
      new THREE.Vector3(0.14, berryH + 0.42, 0.06)
    ]);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 14, 0.052, 10, false);
    const stemMesh = new THREE.Mesh(stemGeo, matCalyxGreen);
    stemMesh.castShadow = true;
    giantBerryGroup.add(stemMesh);

    // 3 Cute Little Sparrows perched on the Rooftop Railing & Garden (Blueprint Detail #4!)
    const matBirdBrown = new THREE.MeshStandardMaterial({ color: 0x8D6246, roughness: 0.75 });
    const matBirdBeak = new THREE.MeshStandardMaterial({ color: 0xF2B04C, roughness: 0.5 });
    [
      [fxMax, rFenceTopY + 0.05, roofZCenter + 0.28, 0.8],
      [-0.28, rFenceTopY + 0.05, fzMax, -0.4],
      [0.46, 6.24, roofZCenter + 0.42, 1.2]
    ].forEach(([bx, by, bz, rotY]) => {
      const bird = new THREE.Group();
      bird.position.set(bx, by, bz);
      bird.rotation.y = rotY;
      const bBody = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), matBirdBrown);
      bBody.scale.set(1.25, 0.9, 0.9);
      bird.add(bBody);
      const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), matBirdBrown);
      bHead.position.set(0.038, 0.026, 0);
      bird.add(bHead);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), matBirdBeak);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.072, 0.026, 0);
      bird.add(beak);
      roofGroup.add(bird);
    });

    registerPickable(roofGroup, 'SHOP');

    // ------------------------------------------------------------------------
    // 10. SOFT ORGANIC WATERCOLOR SWAYING TREES (LEFT & RIGHT)
    //     Multi-sphere botanical cloud clusters + soft radial watercolor sprites
    // ------------------------------------------------------------------------
    function createWatercolorFoliageTexture(hexMain, hexHighlight) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(58, 52, 8, 64, 64, 60);
      grad.addColorStop(0, hexHighlight);
      grad.addColorStop(0.55, hexMain);
      grad.addColorStop(0.85, hexMain + 'AA');
      grad.addColorStop(1, hexMain + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    const texLeafLight = createWatercolorFoliageTexture('#68AB64', '#8FD183');
    const texLeafMid = createWatercolorFoliageTexture('#458B4E', '#6BB56B');

    const swayingCanopies = [];

    function createOrganicTree({ x, z, trunkH, scale = 1.0, phase = 0 }) {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0.08, z);
      treeGroup.scale.setScalar(scale);

      // Terracotta tree planter ring on sidewalk
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.14, 14), matTerracotta);
      ring.position.y = 0.07;
      ring.castShadow = true;
      treeGroup.add(ring);

      // Curved organic wooden trunk using TubeGeometry
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.10, 0),
        new THREE.Vector3(0.04, trunkH * 0.45, -0.03),
        new THREE.Vector3(-0.03, trunkH * 0.85, 0.02),
        new THREE.Vector3(0, trunkH, 0)
      ]);
      const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.085, 10, false);
      const trunkMesh = new THREE.Mesh(trunkGeo, matWoodDoor);
      trunkMesh.castShadow = true;
      treeGroup.add(trunkMesh);

      // Two organic upper branches
      [
        [new THREE.Vector3(0, trunkH * 0.72, 0), new THREE.Vector3(-0.26, trunkH * 1.02, 0.14)],
        [new THREE.Vector3(0, trunkH * 0.78, 0), new THREE.Vector3(0.24, trunkH * 1.05, -0.12)]
      ].forEach(([p0, p1]) => {
        const bCurve = new THREE.CatmullRomCurve3([p0, p1]);
        const bMesh = new THREE.Mesh(new THREE.TubeGeometry(bCurve, 6, 0.045, 8, false), matWoodDoor);
        treeGroup.add(bMesh);
      });

      // Rounded botanical foliage cloud canopy (smooth high-segment spheres + watercolor sprites)
      const canopyGroup = new THREE.Group();
      canopyGroup.position.set(0, trunkH, 0);
      treeGroup.add(canopyGroup);

      const puffSpecs = [
        [0, 0.34, 0, 0.48, matFoliageMid],
        [-0.30, 0.18, 0.18, 0.38, matFoliageLight],
        [0.30, 0.22, -0.14, 0.38, matFoliageMid],
        [0.14, 0.20, 0.28, 0.34, matFoliageLight],
        [-0.18, 0.24, -0.26, 0.35, matFoliageDark],
        [0, 0.62, 0.04, 0.36, matFoliageLight]
      ];
      puffSpecs.forEach(([px, py, pz, r, mat]) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
        puff.scale.set(1.12, 0.88, 1.08);
        puff.position.set(px, py, pz);
        puff.castShadow = true;
        puff.receiveShadow = true;
        canopyGroup.add(puff);

        // Soft watercolor halo sprite for feathery hand-painted silhouette
        const spMat = new THREE.SpriteMaterial({
          map: mat === matFoliageLight ? texLeafLight : texLeafMid,
          transparent: true,
          opacity: 0.55,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(spMat);
        sprite.position.set(px * 1.12, py + 0.04, pz * 1.12);
        sprite.scale.set(r * 2.45, r * 2.15, 1);
        canopyGroup.add(sprite);
      });

      // Tiny red berries & cream blossoms nested in tree foliage
      [
        [-0.24, 0.28, 0.42],
        [0.26, 0.36, 0.28],
        [0.05, 0.58, 0.34]
      ].forEach(([bx, by, bz]) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), matBerryRed);
        b.position.set(bx, by, bz);
        canopyGroup.add(b);
      });

      swayingCanopies.push({ group: canopyGroup, treeGroup, phase });
      return treeGroup;
    }

    // Left Corner Tree (beside Strawberry Corner entrance door, attached to bldgGroup)
    const leftTree = createOrganicTree({ x: -0.78, z: 1.78, trunkH: 1.85, scale: 0.94, phase: 0.0 });
    bldgGroup.add(leftTree);

    // ------------------------------------------------------------------------
    // 10B. PROCEDURAL TEXTURES & MATERIALS FOR BUILDINGS #1, #2, #3
    // ------------------------------------------------------------------------
    function createBrickWallTexture(baseHex, brickHexA, brickHexB, mortarHex) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 256, 256);
      const rows = 12;
      const cols = 6;
      const rh = 256 / rows;
      const cw = 256 / cols;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (cw * 0.5);
        for (let col = -1; col <= cols; col++) {
          ctx.fillStyle = (r + col) % 2 === 0 ? brickHexA : brickHexB;
          ctx.fillRect(col * cw + offset + 2, r * rh + 2, cw - 4, rh - 4);
        }
      }
      ctx.strokeStyle = mortarHex;
      ctx.lineWidth = 2;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * rh);
        ctx.lineTo(256, r * rh);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    function createSlateRoofTexture() {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#56646E';
      ctx.fillRect(0, 0, 256, 256);
      const rows = 10;
      const cols = 8;
      const rh = 256 / rows;
      const cw = 256 / cols;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (cw * 0.5);
        for (let col = -1; col <= cols; col++) {
          ctx.fillStyle = (r + col) % 2 === 0 ? '#5D6C76' : '#4E5B65';
          ctx.fillRect(col * cw + off + 1, r * rh + 1, cw - 2, rh - 2);
          ctx.strokeStyle = '#3B464E';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(col * cw + off + 1, r * rh + 1, cw - 2, rh - 2);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 1.5);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    function createClockDialTexture() {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FCF5E5';
      ctx.beginPath();
      ctx.arc(128, 128, 122, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#B88938';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = '#3A2E21';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(128, 128, 104, 0, Math.PI * 2);
      ctx.stroke();
      const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      ctx.fillStyle = '#2B241D';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      numerals.forEach((num, idx) => {
        const ang = (idx / 12) * Math.PI * 2 - Math.PI / 2;
        const rx = 128 + Math.cos(ang) * 84;
        const ry = 128 + Math.sin(ang) * 84;
        ctx.fillText(num, rx, ry);
      });
      // Clock hands (10:10 classic watchmaker pose)
      ctx.strokeStyle = '#221C16';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(84, 96);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(178, 90);
      ctx.stroke();
      ctx.fillStyle = '#B88938';
      ctx.beginPath();
      ctx.arc(128, 128, 8, 0, Math.PI * 2);
      ctx.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    const matSageTimber = new THREE.MeshStandardMaterial({ color: 0x3D5E47, roughness: 0.78, metalness: 0.04 });
    const matSageDark = new THREE.MeshStandardMaterial({ color: 0x2A4432, roughness: 0.82, metalness: 0.05 });
    const matSageCanopy = new THREE.MeshStandardMaterial({ color: 0x34533E, roughness: 0.76, metalness: 0.02 });
    const matSandstoneBrick = new THREE.MeshStandardMaterial({
      map: createBrickWallTexture('#E2C7A2', '#DFC29B', '#D5B58B', '#C2A27A'),
      roughness: 0.90,
      metalness: 0.01
    });
    const matSlateMansard = new THREE.MeshStandardMaterial({
      map: createSlateRoofTexture(),
      roughness: 0.78,
      metalness: 0.06
    });
    const matShutterBrown = new THREE.MeshStandardMaterial({ color: 0x6E472B, roughness: 0.82, metalness: 0.03 });
    const matChimneyBrick = new THREE.MeshStandardMaterial({ color: 0xB85D43, roughness: 0.85, metalness: 0.02 });

    const matPeachStucco = new THREE.MeshStandardMaterial({ color: 0xE8A598, roughness: 0.90, metalness: 0.01 });
    const matIvoryStucco = new THREE.MeshStandardMaterial({ color: 0xFBF3E6, roughness: 0.90, metalness: 0.01 });
    const matWarmOak = new THREE.MeshStandardMaterial({ color: 0x9C6B43, roughness: 0.78, metalness: 0.04 });
    const matWisteriaPurple = new THREE.MeshStandardMaterial({ color: 0x9B72CF, roughness: 0.75, metalness: 0.02 });
    const matWisteriaLilac = new THREE.MeshStandardMaterial({ color: 0xC39EE8, roughness: 0.75, metalness: 0.02 });
    const matTerraTile = new THREE.MeshStandardMaterial({ color: 0xC86446, roughness: 0.76, metalness: 0.03 });
    const matTerraTileDark = new THREE.MeshStandardMaterial({ color: 0xAD4F34, roughness: 0.80, metalness: 0.03 });

    const matNavyWood = new THREE.MeshStandardMaterial({ color: 0x2B3A4A, roughness: 0.74, metalness: 0.06 });
    const matNavyDark = new THREE.MeshStandardMaterial({ color: 0x1D2834, roughness: 0.78, metalness: 0.08 });
    const matCreamBrick = new THREE.MeshStandardMaterial({
      map: createBrickWallTexture('#EFE4D0', '#EDE1CC', '#E4D6BE', '#D2C2A8'),
      roughness: 0.88,
      metalness: 0.01
    });
    const matCharcoalSash = new THREE.MeshStandardMaterial({ color: 0x2F353B, roughness: 0.68, metalness: 0.12 });
    const matBrassGold = new THREE.MeshStandardMaterial({ color: 0xD8A648, roughness: 0.36, metalness: 0.48 });
    const matSkylightGlass = new THREE.MeshStandardMaterial({
      color: 0x9BC4D9,
      emissive: 0x5E8CA8,
      emissiveIntensity: 0.18,
      roughness: 0.22,
      metalness: 0.18
    });
    const matClockDial = new THREE.MeshBasicMaterial({ map: createClockDialTexture() });

    const zFront = 1.425; // 100% aligned front facade plane across all 4 buildings!
    const bldgDepth = 2.38; // spans z: [-0.955, +1.425]
    const zCenter = zFront - bldgDepth / 2; // +0.235

    // ------------------------------------------------------------------------
    // 10C. BUILDING #1: BOTANICAL BOOKSHOP & APOTHECARY (`index = 1`)
    //      Width = 3.45, spans x: [+1.425, +4.875], center cx1 = 3.15 (gap = 0!)
    // ------------------------------------------------------------------------
    const bldg1Group = new THREE.Group();
    const cx1 = 3.15;
    const W1 = 3.45;
    bldg1Group.position.set(cx1, 0, 0);
    rowStreetGroup.add(bldg1Group);

    // Stone foundation plinth + Ground floor sage green timber body (y = 0.24 .. 2.86)
    makeBox(W1, 0.24, bldgDepth + 0.04, matStoneTrim, 0, 0.12, zCenter, bldg1Group);
    makeBox(W1, 2.64, bldgDepth, matSageTimber, 0, 1.56, zCenter, bldg1Group);

    // Sage green molded pilasters & upper entablature cornice
    [-W1 / 2 + 0.10, -0.44, 0.44, W1 / 2 - 0.10].forEach((px) => {
      makeBox(0.14, 2.68, 0.10, matSageDark, px, 1.56, zFront + 0.02, bldg1Group);
    });
    makeBox(W1 + 0.08, 0.26, bldgDepth + 0.12, matSageDark, 0, 2.84, zCenter, bldg1Group);
    makeBox(W1 + 0.12, 0.09, bldgDepth + 0.16, matStoneTrim, 0, 2.98, zCenter, bldg1Group);

    // Recessed center timber entrance door + brass hardware + welcome mat
    makeBox(0.76, 2.18, 0.10, matSageDark, 0, 1.24, zFront - 0.02, bldg1Group);
    makeBox(0.64, 1.98, 0.08, matSageTimber, 0, 1.18, zFront, bldg1Group);
    makeBox(0.46, 0.72, 0.06, matWarmGlass, 0, 1.62, zFront + 0.02, bldg1Group);
    makeBox(0.06, 0.06, 0.06, matBrassGold, 0.22, 1.05, zFront + 0.05, bldg1Group);
    makeBox(0.24, 0.05, 0.05, matBrassGold, 0, 0.72, zFront + 0.05, bldg1Group);
    makeBox(0.72, 0.03, 0.42, matWarmOak, 0, 0.06, zFront + 0.24, bldg1Group);

    // Two protruding bay display windows (left: antique books, right: amber apothecary jars)
    [-1.02, 1.02].forEach((bx, bIdx) => {
      const bayW = 1.04;
      const bayD = 0.28;
      // Bay base wainscot & roof cap
      makeBox(bayW, 0.56, bayD, matSageDark, bx, 0.42, zFront + bayD / 2, bldg1Group);
      makeBox(bayW - 0.12, 0.38, bayD + 0.02, matSageTimber, bx, 0.42, zFront + bayD / 2, bldg1Group);
      makeBox(bayW + 0.06, 0.10, bayD + 0.06, matSageDark, bx, 2.28, zFront + bayD / 2, bldg1Group);
      // Warm glowing bay window glass
      makeBox(bayW - 0.08, 1.52, bayD - 0.04, matWarmGlass, bx, 1.46, zFront + bayD / 2, bldg1Group);
      // Timber window mullions
      [-bayW / 2 + 0.04, -0.18, 0.18, bayW / 2 - 0.04].forEach((mx) => {
        makeBox(0.035, 1.54, 0.04, matSageDark, bx + mx, 1.46, zFront + bayD + 0.01, bldg1Group);
      });
      makeBox(bayW, 0.035, bayD + 0.03, matSageDark, bx, 1.84, zFront + bayD / 2, bldg1Group);
      // Interior display shelves (books on left, apothecary jars on right)
      [0.92, 1.34].forEach((sy) => {
        makeBox(bayW - 0.16, 0.03, 0.16, matWoodDoor, bx, sy, zFront + bayD - 0.04, bldg1Group);
        for (let k = -2; k <= 2; k++) {
          if (bIdx === 0) {
            const bookMat = k % 2 === 0 ? matTerracotta : matDeepTeal;
            makeBox(0.08, 0.22, 0.10, bookMat, bx + k * 0.15, sy + 0.12, zFront + bayD - 0.03, bldg1Group);
          } else {
            const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.18, 10), matBrassGold);
            jar.position.set(bx + k * 0.16, sy + 0.10, zFront + bayD - 0.02);
            bldg1Group.add(jar);
          }
        }
      });
    });

    // Dark forest-green slanted canopy awning over storefront
    const b1Awning = new THREE.Mesh(new THREE.BoxGeometry(W1 - 0.16, 0.08, 0.68), matSageCanopy);
    b1Awning.position.set(0, 2.52, zFront + 0.30);
    b1Awning.rotation.x = 0.38;
    b1Awning.castShadow = true;
    bldg1Group.add(b1Awning);
    makeBox(W1 - 0.16, 0.14, 0.04, matSageDark, 0, 2.38, zFront + 0.61, bldg1Group);

    // Potted boxwood topiary beside left bay window
    const b1Pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 12), matTerracotta);
    b1Pot.position.set(-W1 / 2 + 0.22, 0.18, zFront + 0.28);
    bldg1Group.add(b1Pot);
    const b1Bush = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 12), matFoliageMid);
    b1Bush.scale.set(0.9, 1.35, 0.9);
    b1Bush.position.set(-W1 / 2 + 0.22, 0.46, zFront + 0.28);
    bldg1Group.add(b1Bush);

    // Second Floor: Warm sandstone brick masonry (y = 3.02 .. 4.92) + shuttered windows + flower boxes
    makeBox(W1, 1.90, bldgDepth, matSandstoneBrick, 0, 3.97, zCenter, bldg1Group);
    makeBox(W1 + 0.10, 0.14, bldgDepth + 0.14, matStoneTrim, 0, 4.94, zCenter, bldg1Group);

    [-0.86, 0.86].forEach((wx) => {
      // Window frame & warm glass
      makeBox(0.76, 1.12, 0.08, matShutterBrown, wx, 3.96, zFront + 0.01, bldg1Group);
      makeBox(0.64, 1.00, 0.06, matWarmGlass, wx, 3.96, zFront + 0.02, bldg1Group);
      makeBox(0.035, 1.00, 0.08, matShutterBrown, wx, 3.96, zFront + 0.03, bldg1Group);
      makeBox(0.64, 0.035, 0.08, matShutterBrown, wx, 3.96, zFront + 0.03, bldg1Group);
      // Left & right wooden louvered shutters
      makeBox(0.24, 1.10, 0.05, matShutterBrown, wx - 0.50, 3.96, zFront + 0.03, bldg1Group);
      makeBox(0.24, 1.10, 0.05, matShutterBrown, wx + 0.50, 3.96, zFront + 0.03, bldg1Group);
      // Wrought-iron Juliet window box with lavender & white blossoms
      makeBox(0.82, 0.18, 0.20, matIronBlack, wx, 3.34, zFront + 0.10, bldg1Group);
      for (let f = -2; f <= 2; f++) {
        const tuft = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 10, 8),
          f % 2 === 0 ? matFoliageLight : matWisteriaPurple
        );
        tuft.position.set(wx + f * 0.15, 3.47, zFront + 0.11);
        bldg1Group.add(tuft);
      }
    });

    // French Slate-Grey Mansard Roof (y = 5.00 .. 6.28) + 2 Dormers + 2 Red-Brick Chimneys
    const mansardH = 1.26;
    const mansardWall = new THREE.Mesh(new THREE.BoxGeometry(W1 - 0.12, mansardH, bldgDepth - 0.24), matSlateMansard);
    mansardWall.position.set(0, 5.62, zCenter);
    mansardWall.castShadow = true;
    bldg1Group.add(mansardWall);
    // Sloped front mansard face
    const mansardFront = new THREE.Mesh(new THREE.BoxGeometry(W1 - 0.06, mansardH + 0.08, 0.16), matSlateMansard);
    mansardFront.position.set(0, 5.62, zFront - 0.12);
    mansardFront.rotation.x = -0.22;
    mansardFront.castShadow = true;
    bldg1Group.add(mansardFront);
    // Zinc ridge cap
    makeBox(W1 - 0.16, 0.10, bldgDepth - 0.36, matStoneTrim, 0, 6.28, zCenter, bldg1Group);

    // Two timber-pedimented dormer windows on the mansard slope
    [-0.86, 0.86].forEach((dx) => {
      makeBox(0.58, 0.68, 0.42, matCreamStucco, dx, 5.56, zFront - 0.04, bldg1Group);
      makeBox(0.42, 0.48, 0.06, matShutterBrown, dx, 5.52, zFront + 0.18, bldg1Group);
      makeBox(0.34, 0.40, 0.05, matWarmGlass, dx, 5.52, zFront + 0.19, bldg1Group);
      const ped = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.32, 4), matSlateMansard);
      ped.rotation.y = Math.PI / 4;
      ped.position.set(dx, 6.04, zFront - 0.02);
      bldg1Group.add(ped);
    });

    // Two red-brick chimney stacks with twin terracotta chimney pots
    [-W1 / 2 + 0.32, W1 / 2 - 0.32].forEach((chx) => {
      makeBox(0.46, 0.62, 0.42, matChimneyBrick, chx, 6.54, zCenter, bldg1Group);
      makeBox(0.52, 0.08, 0.48, matStoneTrim, chx, 6.86, zCenter, bldg1Group);
      [-0.10, 0.10].forEach((pz) => {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.26, 10), matTerracotta);
        pot.position.set(chx, 7.02, zCenter + pz);
        bldg1Group.add(pot);
      });
    });

    // ------------------------------------------------------------------------
    // 10D. BUILDING #2: MEDITERRANEAN FLORAL ATELIER (`index = 2`)
    //      Width = 3.45, spans x: [+4.875, +8.325], center cx2 = 6.60 (gap = 0!)
    // ------------------------------------------------------------------------
    const bldg2Group = new THREE.Group();
    const cx2 = 6.60;
    const W2 = 3.45;
    bldg2Group.position.set(cx2, 0, 0);
    rowStreetGroup.add(bldg2Group);

    // Ground Floor: Soft terracotta/peach stucco (y = 0.24 .. 2.86)
    makeBox(W2, 0.24, bldgDepth + 0.04, matStoneTrim, 0, 0.12, zCenter, bldg2Group);
    makeBox(W2, 2.64, bldgDepth, matPeachStucco, 0, 1.56, zCenter, bldg2Group);
    makeBox(W2 + 0.08, 0.14, bldgDepth + 0.10, matStoneTrim, 0, 2.90, zCenter, bldg2Group);

    // Grand Romanesque Arched Double Glass Door in center
    const archW = 1.64;
    makeBox(archW + 0.18, 1.72, 0.10, matStoneTrim, 0, 1.02, zFront + 0.01, bldg2Group);
    const archTopOuter = new THREE.Mesh(new THREE.CylinderGeometry(archW / 2 + 0.09, archW / 2 + 0.09, 0.10, 24, 1, false, 0, Math.PI), matStoneTrim);
    archTopOuter.rotation.z = -Math.PI / 2;
    archTopOuter.rotation.y = Math.PI / 2;
    archTopOuter.position.set(0, 1.88, zFront + 0.01);
    bldg2Group.add(archTopOuter);

    // Warm glass inside arch + double oak doors + fanlight
    makeBox(archW - 0.06, 1.66, 0.08, matWarmOak, 0, 0.98, zFront + 0.02, bldg2Group);
    [-0.38, 0.38].forEach((dx) => {
      makeBox(0.64, 1.38, 0.06, matWarmGlass, dx, 1.04, zFront + 0.04, bldg2Group);
      makeBox(0.64, 0.035, 0.08, matWarmOak, dx, 1.04, zFront + 0.05, bldg2Group);
    });
    const fanGlass = new THREE.Mesh(new THREE.CylinderGeometry(archW / 2 - 0.06, archW / 2 - 0.06, 0.08, 20, 1, false, 0, Math.PI), matWarmGlass);
    fanGlass.rotation.z = -Math.PI / 2;
    fanGlass.rotation.y = Math.PI / 2;
    fanGlass.position.set(0, 1.86, zFront + 0.03);
    bldg2Group.add(fanGlass);

    // Lush climbing purple wisteria cascades & green vines framing the Romanesque arch
    const wisteriaPoints = [
      [-1.18, 2.65], [-0.95, 2.72], [-0.68, 2.75], [0.68, 2.75], [0.95, 2.70], [1.18, 2.62],
      [-1.25, 2.25], [-1.32, 1.75], [1.25, 2.25], [1.32, 1.75]
    ];
    wisteriaPoints.forEach(([wx, wy], idx) => {
      const leafPuff = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), idx % 2 === 0 ? matFoliageMid : matFoliageLight);
      leafPuff.position.set(wx, wy, zFront + 0.08);
      bldg2Group.add(leafPuff);
      // Hanging purple wisteria raceme cluster
      for (let b = 0; b < 3; b++) {
        const wDrop = new THREE.Mesh(
          new THREE.SphereGeometry(0.085 - b * 0.015, 8, 8),
          b % 2 === 0 ? matWisteriaPurple : matWisteriaLilac
        );
        wDrop.scale.set(0.85, 1.35, 0.85);
        wDrop.position.set(wx + (b - 1) * 0.04, wy - 0.14 - b * 0.11, zFront + 0.13);
        bldg2Group.add(wDrop);
      }
    });

    // Potted Mediterranean olive trees & terracotta urns flanking the arched doorway
    [-1.14, 1.14].forEach((ox) => {
      const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.13, 0.34, 12), matTerracotta);
      urn.position.set(ox, 0.22, zFront + 0.28);
      bldg2Group.add(urn);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.58, 8), matWoodDoor);
      stem.position.set(ox, 0.62, zFront + 0.28);
      bldg2Group.add(stem);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), matFoliageLight);
      crown.position.set(ox, 0.96, zFront + 0.28);
      bldg2Group.add(crown);
    });

    // Second Floor: Creamy ivory stucco (y = 2.96 .. 5.12) + Twin Arched French Doors + Wrought-Iron Balcony
    makeBox(W2, 2.18, bldgDepth, matIvoryStucco, 0, 4.05, zCenter, bldg2Group);

    // Cantilevered stone balcony slab & ornate black wrought-iron balustrade
    const balcW = 2.48;
    makeBox(balcW, 0.10, 0.42, matStoneTrim, 0, 2.98, zFront + 0.20, bldg2Group);
    makeBox(balcW, 0.04, 0.40, matIronBlack, 0, 3.52, zFront + 0.20, bldg2Group);
    for (let bx = -balcW / 2 + 0.06; bx <= balcW / 2 - 0.05; bx += 0.16) {
      makeBox(0.025, 0.50, 0.025, matIronBlack, bx, 3.27, zFront + 0.38, bldg2Group);
    }

    // Twin arched French balcony doors + striped fabric hoods
    [-0.74, 0.74].forEach((fx) => {
      makeBox(0.76, 1.32, 0.08, matWarmOak, fx, 3.68, zFront + 0.02, bldg2Group);
      makeBox(0.62, 1.24, 0.06, matWarmGlass, fx, 3.68, zFront + 0.03, bldg2Group);
      makeBox(0.035, 1.24, 0.08, matWarmOak, fx, 3.68, zFront + 0.04, bldg2Group);
      // Striped cream/sand hood awning over each French door
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.36), matAwningCream);
      hood.position.set(fx, 4.52, zFront + 0.16);
      hood.rotation.x = 0.42;
      bldg2Group.add(hood);
    });

    // Pitched Mediterranean Warm Terracotta Barrel-Tile Roof (y = 5.14 .. 6.24) + exposed wooden rafter tails
    makeBox(W2 + 0.14, 0.10, bldgDepth + 0.18, matStoneTrim, 0, 5.14, zCenter, bldg2Group);
    for (let rx = -W2 / 2 + 0.22; rx <= W2 / 2 - 0.20; rx += 0.48) {
      makeBox(0.07, 0.09, 0.26, matWoodDark, rx, 5.06, zFront + 0.08, bldg2Group);
    }
    const roofSlope2 = new THREE.Group();
    roofSlope2.position.set(0, 5.56, zCenter + 0.12);
    roofSlope2.rotation.x = 0.36;
    bldg2Group.add(roofSlope2);
    makeBox(W2 + 0.16, 0.14, bldgDepth * 0.68, matTerraTileDark, 0, 0, 0, roofSlope2);
    // Barrel clay tile ribs
    const numTiles2 = 14;
    for (let tIdx = 0; tIdx < numTiles2; tIdx++) {
      const tx = -W2 / 2 + 0.12 + (tIdx / (numTiles2 - 1)) * (W2 - 0.24);
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.085, bldgDepth * 0.68, 8),
        tIdx % 2 === 0 ? matTerraTile : matTerraTileDark
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(tx, 0.08, 0);
      roofSlope2.add(barrel);
    }
    // Back roof slope
    const roofBack2 = new THREE.Mesh(new THREE.BoxGeometry(W2 + 0.12, 0.56, bldgDepth * 0.52), matTerraTileDark);
    roofBack2.position.set(0, 5.48, zCenter - 0.46);
    bldg2Group.add(roofBack2);

    // ------------------------------------------------------------------------
    // 10E. BUILDING #3: ARTISANAL CLOCKMAKER & ART STUDIO (`index = 3`)
    //      Slender 3-story tower: Width = 3.15, spans x: [+8.325, +11.475],
    //      center cx3 = 9.90 (gap = 0!)
    // ------------------------------------------------------------------------
    const bldg3Group = new THREE.Group();
    const cx3 = 9.90;
    const W3 = 3.15;
    bldg3Group.position.set(cx3, 0, 0);
    rowStreetGroup.add(bldg3Group);

    // Ground Floor: Deep Navy/Indigo Wood Panel Storefront (y = 0.24 .. 2.86)
    makeBox(W3, 0.24, bldgDepth + 0.04, matStoneTrim, 0, 0.12, zCenter, bldg3Group);
    makeBox(W3, 2.64, bldgDepth, matNavyWood, 0, 1.56, zCenter, bldg3Group);
    [-W3 / 2 + 0.10, -0.44, 0.44, W3 / 2 - 0.10].forEach((px) => {
      makeBox(0.14, 2.68, 0.10, matNavyDark, px, 1.56, zFront + 0.02, bldg3Group);
    });
    makeBox(W3 + 0.10, 0.24, bldgDepth + 0.12, matNavyDark, 0, 2.84, zCenter, bldg3Group);
    makeBox(W3 + 0.14, 0.09, bldgDepth + 0.16, matStoneTrim, 0, 2.98, zCenter, bldg3Group);

    // Center navy door + Left & Right showcase windows (easel on left, brass clockwork gears on right)
    makeBox(0.72, 2.12, 0.08, matNavyDark, 0, 1.22, zFront + 0.01, bldg3Group);
    makeBox(0.54, 1.18, 0.06, matWarmGlass, 0, 1.48, zFront + 0.03, bldg3Group);
    makeBox(0.05, 0.05, 0.05, matBrassGold, 0.20, 1.02, zFront + 0.05, bldg3Group);

    [-0.94, 0.94].forEach((sx, sIdx) => {
      makeBox(0.88, 1.48, 0.08, matNavyDark, sx, 1.52, zFront + 0.01, bldg3Group);
      makeBox(0.76, 1.36, 0.06, matWarmGlass, sx, 1.52, zFront + 0.03, bldg3Group);
      makeBox(0.88, 0.48, 0.08, matNavyDark, sx, 0.48, zFront + 0.02, bldg3Group);
      if (sIdx === 0) {
        // Miniature wooden drafting easel & canvas inside left window
        makeBox(0.34, 0.42, 0.04, matAwningCream, sx, 1.38, zFront + 0.06, bldg3Group);
        makeBox(0.04, 0.68, 0.04, matWoodDoor, sx - 0.12, 1.26, zFront + 0.05, bldg3Group);
        makeBox(0.04, 0.68, 0.04, matWoodDoor, sx + 0.12, 1.26, zFront + 0.05, bldg3Group);
      } else {
        // Brass clockwork gears inside right window
        const gear1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 14), matBrassGold);
        gear1.rotation.x = Math.PI / 2;
        gear1.position.set(sx - 0.10, 1.36, zFront + 0.06);
        bldg3Group.add(gear1);
        const gear2 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12), matBrassGold);
        gear2.rotation.x = Math.PI / 2;
        gear2.position.set(sx + 0.14, 1.26, zFront + 0.06);
        bldg3Group.add(gear2);
      }
    });

    // Crisp off-white slanted canvas awning + two brass gooseneck sconce lanterns
    const b3Awning = new THREE.Mesh(new THREE.BoxGeometry(W3 - 0.24, 0.07, 0.64), matAwningCream);
    b3Awning.position.set(0, 2.48, zFront + 0.28);
    b3Awning.rotation.x = 0.40;
    b3Awning.castShadow = true;
    bldg3Group.add(b3Awning);

    [-W3 / 2 + 0.16, W3 / 2 - 0.16].forEach((lx) => {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), matWarmGlass);
      lantern.position.set(lx, 2.12, zFront + 0.12);
      bldg3Group.add(lantern);
    });

    // Floors 2 & 3: Pale Cream Brickwork (y = 3.02 .. 6.18) + Dark Charcoal Sash Windows
    makeBox(W3, 3.16, bldgDepth, matCreamBrick, 0, 4.60, zCenter, bldg3Group);

    // 2nd Floor (y = 3.78) & 3rd Floor (y = 5.18) Sash Windows
    [3.78, 5.18].forEach((wy) => {
      [-0.92, 0.92].forEach((wx) => {
        makeBox(0.68, 1.06, 0.08, matCharcoalSash, wx, wy, zFront + 0.01, bldg3Group);
        makeBox(0.56, 0.94, 0.06, matWarmGlass, wx, wy, zFront + 0.02, bldg3Group);
        makeBox(0.58, 0.04, 0.08, matCharcoalSash, wx, wy, zFront + 0.03, bldg3Group);
        makeBox(0.035, 0.94, 0.08, matCharcoalSash, wx, wy, zFront + 0.03, bldg3Group);
        makeBox(0.76, 0.08, 0.12, matStoneTrim, wx, wy - 0.55, zFront + 0.04, bldg3Group);
      });
    });

    // Prominent Embossed Vintage Round Brass Station Wall Clock centered on 2nd-floor facade!
    const clockGroup = new THREE.Group();
    clockGroup.position.set(0, 3.82, zFront + 0.05);
    bldg3Group.add(clockGroup);
    const clockBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.10, 28), matBrassGold);
    clockBezel.rotation.x = Math.PI / 2;
    clockGroup.add(clockBezel);
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.11, 28), matClockDial);
    clockFace.rotation.x = Math.PI / 2;
    clockFace.rotation.y = Math.PI / 2;
    clockGroup.add(clockFace);

    // Classical Dentil Cornice + Flat Roof Deck + Dark Industrial Metal Railing + Glass Skylight Hatch
    makeBox(W3 + 0.16, 0.18, bldgDepth + 0.18, matStoneTrim, 0, 6.22, zCenter, bldg3Group);
    for (let dx = -W3 / 2; dx <= W3 / 2; dx += 0.22) {
      makeBox(0.10, 0.10, 0.08, matStoneTrim, dx, 6.08, zFront + 0.06, bldg3Group);
    }
    // Industrial rooftop perimeter railing
    const rW3 = W3 - 0.12;
    const rD3 = bldgDepth - 0.16;
    makeBox(rW3, 0.045, 0.045, matIronBlack, 0, 6.72, zFront - 0.08, bldg3Group);
    makeBox(rW3, 0.045, 0.045, matIronBlack, 0, 6.72, zCenter - rD3 / 2, bldg3Group);
    makeBox(0.045, 0.045, rD3, matIronBlack, -rW3 / 2, 6.72, zCenter, bldg3Group);
    makeBox(0.045, 0.045, rD3, matIronBlack, rW3 / 2, 6.72, zCenter, bldg3Group);
    for (let px = -rW3 / 2; px <= rW3 / 2 + 0.01; px += 0.26) {
      makeBox(0.03, 0.42, 0.03, matIronBlack, px, 6.51, zFront - 0.08, bldg3Group);
      makeBox(0.03, 0.42, 0.03, matIronBlack, px, 6.51, zCenter - rD3 / 2, bldg3Group);
    }
    // Angled Glass Skylight Hatch on roof deck
    makeBox(1.36, 0.16, 0.96, matCharcoalSash, 0, 6.38, zCenter, bldg3Group);
    const skylightPrism = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.38, 4), matSkylightGlass);
    skylightPrism.rotation.y = Math.PI / 4;
    skylightPrism.scale.set(1.18, 1.0, 0.85);
    skylightPrism.position.set(0, 6.62, zCenter);
    bldg3Group.add(skylightPrism);

    // Right Corner Tree (beside Clockmaker right sidewalk corner, attached to bldg3Group)
    const rightCornerTree = createOrganicTree({ x: W3 / 2 + 0.42, z: 1.05, trunkH: 1.88, scale: 0.92, phase: 1.7 });
    bldg3Group.add(rightCornerTree);

    // Tag each of the 4 building groups with its `buildingIdx` for click raycasting & dual-canvas blur
    const buildingGroups = [bldgGroup, bldg1Group, bldg2Group, bldg3Group];
    const buildingCentersX = [0.00, cx1, cx2, cx3];
    const buildingWidths = [2.85, W1, W2, W3];
    buildingGroups.forEach((grp, idx) => {
      grp.userData.buildingIdx = idx;
      grp.traverse((child) => {
        if (child.isMesh) {
          child.userData.buildingIdx = idx;
        }
      });
    });

    // ------------------------------------------------------------------------
    // 10F. CONTINUOUS SHARED PAVED SIDEWALK (`sharedSidewalkGroup`)
    //      Spans across all 4 buildings with curb, bollards, 5 vintage
    //      cast-iron streetlamps, and a parked vintage bicycle.
    // ------------------------------------------------------------------------
    const sharedSidewalkGroup = new THREE.Group();
    rowStreetGroup.add(sharedSidewalkGroup);

    const totalSwMinX = -2.45;
    const totalSwMaxX = 12.35;
    const totalSwW = totalSwMaxX - totalSwMinX; // 14.80
    const totalSwCenterX = (totalSwMinX + totalSwMaxX) / 2; // 4.95
    const swFrontZ = 2.74;
    const swBackZ = -1.35;
    const totalSwD = swFrontZ - swBackZ; // 4.09
    const totalSwCenterZ = (swFrontZ + swBackZ) / 2; // 0.695

    // Main sandstone sidewalk slab & front stone curb
    makeBox(totalSwW, 0.14, totalSwD, matSidewalk, totalSwCenterX, -0.03, totalSwCenterZ, sharedSidewalkGroup);
    makeBox(totalSwW + 0.12, 0.17, 0.16, matSidewalkCurb, totalSwCenterX, -0.02, swFrontZ, sharedSidewalkGroup);

    // Subtle cobblestone mortar grid lines across the shared sidewalk
    for (let gx = totalSwMinX + 0.35; gx < totalSwMaxX - 0.2; gx += 0.55) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.005, totalSwD - 0.18), matMortarLine);
      l.position.set(gx, 0.043, totalSwCenterZ);
      sharedSidewalkGroup.add(l);
    }
    for (let gz = swBackZ + 0.35; gz < swFrontZ - 0.15; gz += 0.52) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(totalSwW - 0.2, 0.005, 0.014), matMortarLine);
      l.position.set(totalSwCenterX, 0.043, gz);
      sharedSidewalkGroup.add(l);
    }

    // Black cast-iron street bollards along the curb
    [-2.05, -0.45, 0.85, 2.25, 4.05, 5.75, 7.45, 9.10, 10.75, 11.95].forEach((bx) => {
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.42, 10), matIronBlack);
      bollard.position.set(bx, 0.24, swFrontZ - 0.22);
      bollard.castShadow = true;
      sharedSidewalkGroup.add(bollard);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), matIronBlack);
      cap.position.set(bx, 0.46, swFrontZ - 0.22);
      sharedSidewalkGroup.add(cap);
    });

    // 5 Vintage Cast-Iron Streetlamps along the sidewalk curb (warm glow brightens in Rain mode)
    const streetLampBulbs = [];
    const matLampGlow = new THREE.MeshStandardMaterial({
      color: 0xFFE9A8,
      emissive: 0xFFA733,
      emissiveIntensity: 0.42,
      roughness: 0.2,
      metalness: 0.05
    });
    [-1.45, 1.425, 4.875, 8.325, 11.50].forEach((lx) => {
      const lampGrp = new THREE.Group();
      lampGrp.position.set(lx, 0.04, swFrontZ - 0.28);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.32, 10), matIronBlack);
      base.position.y = 0.16;
      lampGrp.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 1.85, 10), matIronBlack);
      pole.position.y = 1.12;
      pole.castShadow = true;
      lampGrp.add(pole);
      const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.26, 8), matLampGlow);
      lanternGlass.position.y = 2.16;
      lampGrp.add(lanternGlass);
      streetLampBulbs.push(lanternGlass);
      const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 8), matIronBlack);
      lanternCap.position.y = 2.35;
      lampGrp.add(lanternCap);
      sharedSidewalkGroup.add(lampGrp);
    });

    // Vintage Parked Bicycle between Building #1 (Bookshop) and Building #2 (Floral Atelier)
    const bikeGroup = new THREE.Group();
    bikeGroup.position.set(4.85, 0.05, swFrontZ - 0.34);
    sharedSidewalkGroup.add(bikeGroup);
    [-0.24, 0.24].forEach((wx) => {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 20), matIronBlack);
      tire.position.set(wx, 0.18, 0);
      bikeGroup.add(tire);
    });
    makeBox(0.36, 0.025, 0.025, matDeepTeal, 0, 0.28, 0, bikeGroup);
    makeBox(0.025, 0.24, 0.025, matDeepTeal, -0.14, 0.26, 0, bikeGroup);
    makeBox(0.025, 0.28, 0.025, matDeepTeal, 0.16, 0.28, 0, bikeGroup);
    makeBox(0.12, 0.04, 0.08, matWoodDoor, -0.14, 0.40, 0, bikeGroup); // leather saddle
    makeBox(0.12, 0.11, 0.14, matStoneTrim, 0.24, 0.38, 0, bikeGroup); // wicker front basket

    // Active Sidewalk Patch (`activePatchGroup`): renders crisp on fgRenderer directly under active building!
    const activePatchGroup = new THREE.Group();
    rowStreetGroup.add(activePatchGroup);
    const patchSlab = makeBox(3.55, 0.145, totalSwD, matSidewalk, 0, -0.028, totalSwCenterZ, activePatchGroup);
    const patchCurb = makeBox(3.55, 0.174, 0.165, matSidewalkCurb, 0, -0.018, swFrontZ, activePatchGroup);
    patchSlab.receiveShadow = true;
    patchCurb.receiveShadow = true;

    // ------------------------------------------------------------------------
    // 10G. FRONT ASPHALT ROAD & RANDOM-TEMPO LOOPING STORYBOOK CARS
    //      Adapted from Cerria Town traffic system: 2 lanes, 4 pastel vehicles,
    //      rotating wheels, warm headlights, and 1.5s–5.5s random spawn delay.
    // ------------------------------------------------------------------------
    const roadGroup = new THREE.Group();
    rowStreetGroup.add(roadGroup);

    const roadMinX = -9.5;
    const roadMaxX = 19.5;
    const roadW = roadMaxX - roadMinX;
    const roadCenterX = (roadMinX + roadMaxX) / 2; // 5.0
    const roadStartZ = swFrontZ + 0.08; // 2.82
    const roadEndZ = 5.42;
    const roadD = roadEndZ - roadStartZ; // 2.60
    const roadCenterZ = (roadStartZ + roadEndZ) / 2; // 4.12

    const matAsphalt = new THREE.MeshStandardMaterial({ color: 0x5A5552, roughness: 0.88, metalness: 0.04 });
    const matRoadLine = new THREE.MeshBasicMaterial({ color: 0xE8DFD1 });
    const matRoadVignette = new THREE.MeshBasicMaterial({
      color: 0xF5EFE6,
      transparent: true,
      opacity: 0.72
    });

    // Main asphalt road surface
    const roadMesh = makeBox(roadW, 0.08, roadD, matAsphalt, roadCenterX, -0.11, roadCenterZ, roadGroup);
    roadMesh.receiveShadow = true;

    // Dashed cream centerline markings
    for (let mx = roadMinX + 0.8; mx < roadMaxX - 0.8; mx += 1.25) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.07), matRoadLine);
      dash.position.set(mx, -0.064, roadCenterZ);
      roadGroup.add(dash);
    }

    // Soft outer road border fade into cream background (#f5efe6)
    const vignetteStrip = new THREE.Mesh(new THREE.BoxGeometry(roadW, 0.015, 0.45), matRoadVignette);
    vignetteStrip.position.set(roadCenterX, -0.065, roadEndZ - 0.15);
    roadGroup.add(vignetteStrip);

    // Storybook Low-Poly Cars (4 distinct pastel vehicles in 2 opposite lanes)
    const carsGroup = new THREE.Group();
    rowStreetGroup.add(carsGroup);

    const matCarWheel = new THREE.MeshStandardMaterial({ color: 0x232528, roughness: 0.7, metalness: 0.2 });
    const matCarHub = new THREE.MeshStandardMaterial({ color: 0xE8DFD1, roughness: 0.4, metalness: 0.3 });
    const matHeadlight = new THREE.MeshStandardMaterial({
      color: 0xFFF4C2,
      emissive: 0xFFBE44,
      emissiveIntensity: 0.75,
      roughness: 0.2
    });
    const matTaillight = new THREE.MeshStandardMaterial({
      color: 0xFF5252,
      emissive: 0xE53935,
      emissiveIntensity: 0.55,
      roughness: 0.3
    });

    function createStorybookCar({ bodyColor, roofColor, style = 'sedan', dir = 1, laneZ = 3.45, startX = 0 }) {
      const carGrp = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.52, metalness: 0.08 });
      const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.58, metalness: 0.04 });
      const winMat = new THREE.MeshStandardMaterial({
        color: 0xCFE6F5,
        emissive: 0xFFE0A3,
        emissiveIntensity: 0.22,
        roughness: 0.2,
        metalness: 0.25
      });

      const chassis = new THREE.Group();
      carGrp.add(chassis);

      if (style === 'van') {
        // Cute Mini Bakery/Café Van
        makeBox(1.18, 0.34, 0.58, bodyMat, 0, 0.26, 0, chassis);
        makeBox(0.96, 0.32, 0.54, roofMat, -0.06, 0.54, 0, chassis);
        makeBox(0.88, 0.22, 0.56, winMat, -0.05, 0.54, 0, chassis);
        // Tiny roof luggage rack
        makeBox(0.56, 0.03, 0.38, matIronBlack, -0.08, 0.72, 0, chassis);
      } else if (style === 'hatchback') {
        // Rounded Classic Hatchback
        makeBox(1.06, 0.28, 0.54, bodyMat, 0, 0.23, 0, chassis);
        makeBox(0.64, 0.26, 0.48, roofMat, -0.08, 0.48, 0, chassis);
        makeBox(0.56, 0.19, 0.50, winMat, -0.08, 0.47, 0, chassis);
      } else {
        // Storybook Vintage Sedan / Coupe
        makeBox(1.16, 0.28, 0.56, bodyMat, 0, 0.23, 0, chassis);
        makeBox(0.62, 0.25, 0.50, roofMat, -0.04, 0.47, 0, chassis);
        makeBox(0.54, 0.18, 0.52, winMat, -0.04, 0.46, 0, chassis);
      }

      // Bumpers
      makeBox(0.06, 0.07, 0.52, matCarHub, 0.58 * dir, 0.15, 0, chassis);
      makeBox(0.06, 0.07, 0.52, matCarHub, -0.58 * dir, 0.15, 0, chassis);

      // Warm headlights & red taillights
      [-0.18, 0.18].forEach((lz) => {
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), matHeadlight);
        hl.position.set(0.56 * dir, 0.25, lz);
        chassis.add(hl);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.09), matTaillight);
        tl.position.set(-0.56 * dir, 0.25, lz);
        chassis.add(tl);
      });

      // 4 Rotating Wheels
      const wheels = [];
      [
        [-0.34, -0.28],
        [0.34, -0.28],
        [-0.34, 0.28],
        [0.34, 0.28]
      ].forEach(([wx, wz]) => {
        const wGrp = new THREE.Group();
        wGrp.position.set(wx, 0.12, wz);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), matCarWheel);
        tire.rotation.x = Math.PI / 2;
        wGrp.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 10), matCarHub);
        hub.rotation.x = Math.PI / 2;
        wGrp.add(hub);
        carGrp.add(wGrp);
        wheels.push(wGrp);
      });

      carGrp.position.set(startX, -0.06, laneZ);
      carsGroup.add(carGrp);

      return {
        group: carGrp,
        chassis,
        wheels,
        dir,
        laneZ,
        x: startX,
        speed: 2.6 + Math.random() * 1.4,
        waiting: false,
        waitTimer: 0
      };
    }

    const loopingCars = [
      createStorybookCar({ bodyColor: 0xD9534F, roofColor: 0xFAF3E8, style: 'hatchback', dir: 1, laneZ: 3.46, startX: 1.2 }),
      createStorybookCar({ bodyColor: 0x6EB599, roofColor: 0xFAF3E8, style: 'van', dir: 1, laneZ: 3.46, startX: -6.2 }),
      createStorybookCar({ bodyColor: 0xEAB64D, roofColor: 0xFAF3E8, style: 'sedan', dir: -1, laneZ: 4.72, startX: 8.4 }),
      createStorybookCar({ bodyColor: 0x6BAED6, roofColor: 0xFAF3E8, style: 'sedan', dir: -1, laneZ: 4.72, startX: 15.8 })
    ];

    // ------------------------------------------------------------------------
    // 10H. LIVING FLYING BIRDS ABOVE ROOFTOPS (Adapted from Cerria Town)
    // ------------------------------------------------------------------------
    const birdsGroup = new THREE.Group();
    rowStreetGroup.add(birdsGroup);

    const matSkyBird = new THREE.MeshStandardMaterial({ color: 0x4A3B32, roughness: 0.7, side: THREE.DoubleSide });
    const flyingBirds = [];
    for (let bIdx = 0; bIdx < 6; bIdx++) {
      const birdGrp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 6), matSkyBird);
      body.rotation.z = -Math.PI / 2;
      birdGrp.add(body);

      const leftWingPivot = new THREE.Group();
      const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.22), matSkyBird);
      leftWing.position.set(0, 0, -0.11);
      leftWingPivot.add(leftWing);
      birdGrp.add(leftWingPivot);

      const rightWingPivot = new THREE.Group();
      const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.22), matSkyBird);
      rightWing.position.set(0, 0, 0.11);
      rightWingPivot.add(rightWing);
      birdGrp.add(rightWingPivot);

      const dir = bIdx % 2 === 0 ? 1 : -1;
      if (dir < 0) birdGrp.rotation.y = Math.PI;
      const startX = -3.0 + bIdx * 2.8;
      const baseY = 6.95 + (bIdx % 3) * 0.48;
      const baseZ = -0.4 + (bIdx % 2) * 1.35;
      birdGrp.position.set(startX, baseY, baseZ);
      birdsGroup.add(birdGrp);

      flyingBirds.push({
        group: birdGrp,
        leftWingPivot,
        rightWingPivot,
        dir,
        x: startX,
        baseY,
        baseZ,
        speed: 1.35 + (bIdx % 3) * 0.32,
        flapSpeed: 10.5 + (bIdx % 3) * 2.2,
        phase: bIdx * 1.3
      });
    }

    // ------------------------------------------------------------------------
    // 10I. 3D WEATHER SYSTEM: SLANTED RAIN STREAKS & GROUND SPLASH RIPPLES
    // ------------------------------------------------------------------------
    const rainGroup = new THREE.Group();
    rainGroup.visible = state.weatherMode === 'rain';
    rowStreetGroup.add(rainGroup);

    const RAIN_COUNT = 260;
    const rainPositions = new Float32Array(RAIN_COUNT * 6);
    const rainDropsMeta = [];
    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = -5.0 + Math.random() * 20.0;
      const ry = Math.random() * 10.5;
      const rz = -2.2 + Math.random() * 8.2;
      const speed = 13.0 + Math.random() * 5.0;
      rainDropsMeta.push({ x: rx, y: ry, z: rz, speed });
      const i6 = i * 6;
      rainPositions[i6] = rx;
      rainPositions[i6 + 1] = ry;
      rainPositions[i6 + 2] = rz;
      rainPositions[i6 + 3] = rx - 0.08;
      rainPositions[i6 + 4] = ry - 0.52;
      rainPositions[i6 + 5] = rz;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xB8D0E8,
      transparent: true,
      opacity: 0.52
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainGroup.add(rainLines);

    // Ground rain splash ripples on sidewalk & road
    const splashRipples = [];
    const splashGeo = new THREE.RingGeometry(0.03, 0.065, 12);
    splashGeo.rotateX(-Math.PI / 2);
    for (let s = 0; s < 32; s++) {
      const sMat = new THREE.MeshBasicMaterial({
        color: 0xD2E4F4,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(splashGeo, sMat);
      const onRoad = s % 2 === 0;
      ring.position.set(
        -2.0 + Math.random() * 14.0,
        onRoad ? -0.055 : 0.048,
        onRoad ? 3.0 + Math.random() * 2.2 : 1.55 + Math.random() * 1.1
      );
      rainGroup.add(ring);
      splashRipples.push({
        mesh: ring,
        mat: sMat,
        phase: Math.random()
      });
    }

    // ------------------------------------------------------------------------
    // 11. LINEAR CAMERA PANNING & CLICK RAYCASTING (NO STREET ROTATION!)
    // ------------------------------------------------------------------------
    const depthMaskMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true
    });
    activePatchGroup.visible = false;

    function getBuildingWorldPanOffset(idx) {
      const safeIdx = Math.max(0, Math.min(BOUTIQUE_BUILDINGS.length - 1, idx));
      const v = new THREE.Vector3(buildingCentersX[safeIdx] || 0, 0, 0);
      v.applyEuler(rowStreetGroup.rotation);
      return { x: v.x, y: v.y, z: v.z };
    }

    const initOffset = getBuildingWorldPanOffset(state.activeBuildingIdx || 0);
    let targetPanX = initOffset.x;
    let targetPanY = initOffset.y;
    let targetPanZ = initOffset.z;
    let currentPanX = initOffset.x;
    let currentPanY = initOffset.y;
    let currentPanZ = initOffset.z;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let dragDistance = 0;

    const buildingRaycaster = new THREE.Raycaster();
    const buildingPointer = new THREE.Vector2();

    function getBuildingHitsAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return [];
      }
      buildingPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      buildingPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      buildingRaycaster.setFromCamera(buildingPointer, camera);
      return buildingRaycaster.intersectObjects(buildingGroups, true);
    }

    canvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
      dragDistance = 0;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isDragging) {
        const hits = getBuildingHitsAt(e.clientX, e.clientY);
        canvas.style.cursor = hits.length > 0 ? 'pointer' : 'default';
        return;
      }
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragDistance += Math.hypot(dx, dy);
    });

    function finishDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}

      const totalMove = Math.max(
        dragDistance,
        Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY)
      );
      const bldgHits = getBuildingHitsAt(e.clientX, e.clientY);
      canvas.style.cursor = bldgHits.length > 0 ? 'pointer' : 'default';

      // Pure click (< 6px drag tolerance)
      if (totalMove < 6) {
        if (bldgHits.length > 0) {
          const hitIdx =
            typeof bldgHits[0].object.userData.buildingIdx === 'number'
              ? bldgHits[0].object.userData.buildingIdx
              : state.activeBuildingIdx;

          if (!state.isMenuOpen) {
            if (hitIdx !== state.activeBuildingIdx) {
              // Clicked on a blurred neighbor building -> pan linearly to that building!
              selectBuilding(hitIdx);
              return;
            }
            // Clicked on the active centered building -> open the store menu layout!
            setMenuOpen(true);
            return;
          }

          // When menu is already open, check interactive building zones (e.g. Mochi the cat)
          const hits = buildingRaycaster.intersectObjects(interactivePickables, false);
          if (hits.length > 0) {
            const act = hits[0].object.userData.scAction;
            if (act === 'CAT_PET') {
              const stage = document.getElementById('sc-building-stage');
              if (stage) stage.classList.add('party-mode');
              playCozyTone('bell');
              showToast('Mochi purrs: yay ♥');
            } else if (act) {
              navigateTo(act);
            }
          }
        } else if (state.isMenuOpen) {
          // Clicked on empty background/sky of the canvas OUTSIDE the 3D building
          setMenuOpen(false);
        }
      }
    }

    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);

    // Hook linear camera panning when `selectBuilding(idx)` is called
    window.__panToBoutiqueBuilding = (idx) => {
      const off = getBuildingWorldPanOffset(idx);
      targetPanX = off.x;
      targetPanY = off.y;
      targetPanZ = off.z;
    };

    // Hook weather mode changes
    window.__apply3DWeatherMode = (mode) => {
      rainGroup.visible = mode === 'rain';
    };

    window.__setStrawberry3DView = () => {};
    window.rotateStrawberry3DBuilding = () => {};

    // Initialize brand & floating tag labels for initial building (`index = 0`)
    updateBuildingBrandAndTagsUI();

    // ------------------------------------------------------------------------
    // 12. ANIMATION LOOP (Linear Panning + Cars + Birds + Rain + Dual-Canvas Render)
    // ------------------------------------------------------------------------
    const clock = new THREE.Clock();
    let prevTime = 0;
    renderer.autoClear = false;

    function animate3D() {
      requestAnimationFrame(animate3D);
      const t = clock.getElapsedTime();
      const dt = Math.min(0.05, Math.max(0.001, t - prevTime));
      prevTime = t;

      // 1) Smooth Linear Camera Panning parallel to the 3D street row (X, Y, Z aligned!)
      const targetOff = getBuildingWorldPanOffset(state.activeBuildingIdx);
      targetPanX = targetOff.x;
      targetPanY = targetOff.y;
      targetPanZ = targetOff.z;
      currentPanX += (targetPanX - currentPanX) * 0.09;
      currentPanY += (targetPanY - currentPanY) * 0.09;
      currentPanZ += (targetPanZ - currentPanZ) * 0.09;

      camera.position.set(
        BASE_CAM_POS.x + currentPanX,
        BASE_CAM_POS.y + currentPanY,
        BASE_CAM_POS.z + currentPanZ
      );
      camera.lookAt(
        BASE_CAM_LOOK.x + currentPanX,
        BASE_CAM_LOOK.y + currentPanY,
        BASE_CAM_LOOK.z + currentPanZ
      );

      // Move interior warm point light to active building
      interiorWarmLight.position.set(currentPanX, 2.4 + currentPanY, currentPanZ + 0.6);

      // 2) Subtle breathing bob of the active building & gentle breeze on trees
      buildingGroups.forEach((grp, idx) => {
        grp.position.y = idx === state.activeBuildingIdx ? Math.sin(t * 1.35) * 0.016 : 0;
      });
      swayingCanopies.forEach(({ group, treeGroup, phase }) => {
        group.rotation.z = Math.sin(t * 1.6 + phase) * 0.048;
        group.rotation.x = Math.cos(t * 1.25 + phase) * 0.032;
        treeGroup.rotation.z = Math.sin(t * 1.1 + phase) * 0.015;
      });

      // 3) Looping Storybook Cars with Random Respawn Delay (1.5s to 5.5s) & Random Speed
      loopingCars.forEach((car) => {
        if (car.waiting) {
          car.waitTimer -= dt;
          if (car.waitTimer <= 0) {
            car.waiting = false;
            car.group.visible = true;
            car.speed = 2.5 + Math.random() * 1.65;
            car.x = car.dir > 0 ? roadMinX - 1.2 : roadMaxX + 1.2;
            car.group.position.x = car.x;
          }
          return;
        }
        car.x += car.dir * car.speed * dt;
        car.group.position.x = car.x;
        // Engine bobbing & wheel spin
        car.chassis.position.y = Math.sin(t * 14.0 + car.x) * 0.008;
        car.wheels.forEach((w) => {
          w.rotation.z -= car.dir * car.speed * dt * 4.2;
        });

        if ((car.dir > 0 && car.x > roadMaxX + 1.2) || (car.dir < 0 && car.x < roadMinX - 1.2)) {
          car.waiting = true;
          car.group.visible = false;
          car.waitTimer = 1.5 + Math.random() * 4.0; // Random spawn delay 1.5s .. 5.5s
        }
      });

      // 4) Living Flying Birds with Wing Flapping (`Math.sin(time * flapSpeed)`)
      flyingBirds.forEach((bird) => {
        bird.x += bird.dir * bird.speed * dt;
        if (bird.dir > 0 && bird.x > 16.5) bird.x = -6.5;
        if (bird.dir < 0 && bird.x < -6.5) bird.x = 16.5;
        bird.group.position.x = bird.x;
        bird.group.position.y = bird.baseY + Math.sin(t * 2.2 + bird.phase) * 0.14;
        const flap = Math.sin(t * bird.flapSpeed + bird.phase) * 0.58;
        bird.leftWingPivot.rotation.x = flap;
        bird.rightWingPivot.rotation.x = -flap;
      });

      // 5) Weather Lighting & 3D Rain Particle Animation
      const isRain = state.weatherMode === 'rain';
      rainGroup.visible = isRain;
      const targetHemiInt = isRain ? 0.50 : 0.68;
      const targetSunInt = isRain ? 0.42 : 0.72;
      hemiLight.intensity += (targetHemiInt - hemiLight.intensity) * 0.08;
      sunLight.intensity += (targetSunInt - sunLight.intensity) * 0.08;

      const stage = document.getElementById('sc-building-stage');
      const isParty = stage && stage.classList.contains('party-mode');
      const baseWinGlow = isRain ? 0.78 : isParty ? 0.52 : 0.34;
      matWarmGlass.emissiveIntensity = baseWinGlow + Math.sin(t * 2.0) * 0.05;
      matLampGlow.emissiveIntensity = isRain ? 1.15 : 0.42;
      matHeadlight.emissiveIntensity = isRain ? 1.25 : 0.72;

      if (isRain) {
        const posAttr = rainGeo.attributes.position;
        const arr = posAttr.array;
        for (let i = 0; i < RAIN_COUNT; i++) {
          const drop = rainDropsMeta[i];
          drop.y -= drop.speed * dt;
          drop.x -= 1.8 * dt;
          if (drop.y < 0.0) {
            drop.y = 9.5 + Math.random() * 2.0;
            drop.x = -5.0 + Math.random() * 20.0;
          }
          const i6 = i * 6;
          arr[i6] = drop.x;
          arr[i6 + 1] = drop.y;
          arr[i6 + 2] = drop.z;
          arr[i6 + 3] = drop.x - 0.09;
          arr[i6 + 4] = drop.y - 0.54;
          arr[i6 + 5] = drop.z;
        }
        posAttr.needsUpdate = true;

        splashRipples.forEach((sp) => {
          sp.phase = (sp.phase + dt * 2.4) % 1.0;
          const s = 0.5 + sp.phase * 1.8;
          sp.mesh.scale.set(s, 1, s);
          sp.mat.opacity = (1.0 - sp.phase) * 0.55;
        });
      }

      // 6) Dual-Canvas Hardware Depth-Masked Render Pass:
      //    - Pass 1 (`bgRenderer` -> blurred background canvas): non-active neighbor buildings + sidewalk + road
      //    - Pass 2a (`renderer` depth mask): write neighbor buildings to depth buffer (`colorWrite: false`)
      //      so interior party walls (`gap = 0`) never overlap neighbor facades
      //    - Pass 2b (`renderer` sharp foreground): active building + shared sidewalk + road + cars + birds + rain
      const activeIdx = state.activeBuildingIdx;
      buildingGroups.forEach((grp, idx) => {
        grp.visible = idx !== activeIdx;
      });
      sharedSidewalkGroup.visible = true;
      roadGroup.visible = true;
      activePatchGroup.visible = false;
      carsGroup.visible = false;
      birdsGroup.visible = false;
      rainGroup.visible = false;
      bgRenderer.render(scene, camera);

      renderer.clear();
      // Pass 2a: Depth-only mask for non-active neighbor buildings
      sharedSidewalkGroup.visible = false;
      roadGroup.visible = false;
      scene.overrideMaterial = depthMaskMaterial;
      renderer.render(scene, camera);
      scene.overrideMaterial = null;

      // Pass 2b: Sharp active building + continuous sidewalk + road + cars + birds + rain
      buildingGroups.forEach((grp, idx) => {
        grp.visible = idx === activeIdx;
      });
      sharedSidewalkGroup.visible = true;
      roadGroup.visible = true;
      carsGroup.visible = true;
      birdsGroup.visible = true;
      rainGroup.visible = isRain;
      renderer.render(scene, camera);

      // Restore visibility so Raycaster hit-testing can pick any building on click
      buildingGroups.forEach((grp) => {
        grp.visible = true;
      });
    }
    animate3D();
  }

  // --------------------------------------------------------------------------
  // 13. EVENT LISTENERS & INITIALIZATION
  // --------------------------------------------------------------------------
  function bindEvents() {
    // Top-left & Bottom-left Brand logos -> reset isMenuOpen = false (building-only mode)
    document.getElementById('sc-brand-btn').addEventListener('click', () => setMenuOpen(false));

    const botBrandBtn = document.getElementById('sc-bot-brand-btn');
    if (botBrandBtn) {
      botBrandBtn.addEventListener('click', () => setMenuOpen(false));
      botBrandBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setMenuOpen(false);
        }
      });
    }

    // Floating Left/Right Neighbor Building Pin Tags (only active when isMenuOpen === false)
    const prevTagBtn = document.getElementById('sc-tag-prev');
    if (prevTagBtn) {
      prevTagBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.isMenuOpen && state.activeBuildingIdx > 0) {
          selectBuilding(state.activeBuildingIdx - 1);
        }
      });
    }
    const nextTagBtn = document.getElementById('sc-tag-next');
    if (nextTagBtn) {
      nextTagBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.isMenuOpen && state.activeBuildingIdx < BOUTIQUE_BUILDINGS.length - 1) {
          selectBuilding(state.activeBuildingIdx + 1);
        }
      });
    }

    // Top-right Weather Toggle Button (☀️ Sunny / 🌧️ Rain)
    const weatherBtn = document.getElementById('sc-weather-btn');
    if (weatherBtn) {
      weatherBtn.addEventListener('click', () => {
        setWeatherMode(state.weatherMode === 'rain' ? 'sunny' : 'rain');
      });
    }

    // Click empty area outside building & outside UI panels -> close menu (isMenuOpen = false)
    let vpDownX = 0;
    let vpDownY = 0;
    const viewportEl = document.getElementById('sc-viewport');
    if (viewportEl) {
      viewportEl.addEventListener('pointerdown', (e) => {
        vpDownX = e.clientX;
        vpDownY = e.clientY;
      });
      viewportEl.addEventListener('pointerup', (e) => {
        if (!state.isMenuOpen) return;
        if (Math.hypot(e.clientX - vpDownX, e.clientY - vpDownY) >= 6) return;
        if (e.target && (e.target.id === 'sc-webgl-building-canvas' || e.target.id === 'sc-webgl-bg-canvas')) return;
        const uiSelector = [
          '#sc-topbar',
          '#sc-bottombar',
          '#sc-floating-tags',
          '#sc-left-home',
          '#sc-left-menu',
          '.sc-home-right',
          '.sc-menu-filter-bar',
          '.sc-menu-grid',
          '.sc-product-giant-card',
          '.sc-calendar-card',
          '.sc-event-ticket-wrap',
          '.sc-bag-right-card',
          '.sc-shop-right-card',
          '#sc-toast'
        ].join(', ');
        if (e.target && e.target.closest(uiSelector)) return;
        setMenuOpen(false);
      });
    }

    // Top nav links
    document.querySelectorAll('.sc-topnav-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        const filter = btn.dataset.filter || 'ALL';
        navigateTo(target, { filter });
      });
    });

    // Left pill navigation
    document.querySelectorAll('.sc-pill-nav').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.state));
    });

    // Bottom bar icon buttons
    document.querySelectorAll('.sc-bot-icon-btn').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.botnav));
    });

    // Generic [data-goto] buttons
    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
    });

    // Home Strawberry Goods tiles
    document.querySelectorAll('#sc-home-goods .sc-good-tile').forEach((tile) => {
      tile.addEventListener('click', () => navigateTo('SHOP'));
    });

    // Top-right sound toggle, points +, likes ♥, gear
    document.getElementById('sc-sound-btn').addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      if (state.soundEnabled) playCozyTone('bell');
      showToast(state.soundEnabled ? 'Café ambient chimes enabled 🌿' : 'Café sounds muted');
    });

    document.getElementById('sc-points-add').addEventListener('click', () => {
      state.points += 50;
      document.getElementById('sc-points-val').textContent = state.points.toLocaleString();
      playCozyTone('bell');
      showToast('+50 Berry Club points collected! 🍓');
    });

    document.getElementById('sc-likes-pill').addEventListener('click', () => {
      state.likes += 1;
      document.getElementById('sc-likes-val').textContent = String(state.likes);
      playCozyTone('click');
      showToast('Saved to your Corner favorites ♥');
    });

    document.getElementById('sc-gear-btn').addEventListener('click', () => {
      showToast('Strawberry Corner · Warm Daylight Theme ♥');
    });

    // Menu category filters
    document.querySelectorAll('#sc-menu-filters .sc-filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.menuFilter = btn.dataset.cat;
        playCozyTone('click');
        renderMenuGrid();
      });
    });

    // Product 3D view controls
    document.getElementById('sc-back-all-treats').addEventListener('click', () => {
      navigateTo('MENU_GRID');
    });

    document.getElementById('sc-qty-minus').addEventListener('click', () => {
      if (state.activeQty > 1) {
        state.activeQty--;
        playCozyTone('click');
        renderProductDetail({ pricePop: true });
        animateElementSpring(
          document.getElementById('sc-qty-val'),
          [
            { transform: 'scale(0.75)' },
            { transform: 'scale(1.18)' },
            { transform: 'scale(1)' }
          ],
          300,
          'cubic-bezier(0.34, 1.56, 0.64, 1)'
        );
      }
    });

    document.getElementById('sc-qty-plus').addEventListener('click', () => {
      state.activeQty++;
      playCozyTone('click');
      renderProductDetail({ pricePop: true });
      animateElementSpring(
        document.getElementById('sc-qty-val'),
        [
          { transform: 'scale(1.32)' },
          { transform: 'scale(0.92)' },
          { transform: 'scale(1)' }
        ],
        300,
        'cubic-bezier(0.34, 1.56, 0.64, 1)'
      );
    });

    document.getElementById('sc-add-to-bag-btn').addEventListener('click', () => {
      const item = MENU_ITEMS[state.activeProductIdx];
      const sizeObj = item.sizes[state.activeSizeIdx] || item.sizes[0];
      addItemToBag({
        id: item.id,
        name: item.name,
        sizeLabel: sizeObj.label.toUpperCase(),
        price: sizeObj.price,
        qty: state.activeQty,
        meta: `${sizeObj.label.toUpperCase()} · $ ${sizeObj.price.toFixed(2)} EACH`,
        thumb: item.thumbImg
      });

      const addBtn = document.getElementById('sc-add-to-bag-btn');
      const addTxt = document.getElementById('sc-add-bag-text');
      addBtn.classList.add('added');
      addTxt.textContent = 'ADDED ♥';
      animateElementSpring(
        addBtn,
        [
          { transform: 'scale(0.92)' },
          { transform: 'scale(1.07)' },
          { transform: 'scale(1)' }
        ],
        380,
        'cubic-bezier(0.34, 1.56, 0.64, 1)'
      );
      playCozyTone('bell');
      showToast(`${state.activeQty} × ${item.name} tucked into your bag ♥`);
    });

    // Events calendar controls
    document.getElementById('sc-cal-prev').addEventListener('click', () => {
      state.calMonthIdx = (state.calMonthIdx - 1 + MONTHS_DATA.length) % MONTHS_DATA.length;
      state.selectedEventId = MONTHS_DATA[state.calMonthIdx].events[0].id;
      playCozyTone('click');
      renderEventsView({ monthSlideDir: -1 });
    });

    document.getElementById('sc-cal-next').addEventListener('click', () => {
      state.calMonthIdx = (state.calMonthIdx + 1) % MONTHS_DATA.length;
      state.selectedEventId = MONTHS_DATA[state.calMonthIdx].events[0].id;
      playCozyTone('click');
      renderEventsView({ monthSlideDir: 1 });
    });

    document.querySelectorAll('#sc-events-filters .sc-ev-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.evCategoryFilter = btn.dataset.evcat;
        playCozyTone('click');
        renderEventsView();
      });
    });

    // My Bag delivery mode & Checkout
    document.querySelectorAll('.sc-deliv-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.deliveryMode = btn.dataset.mode;
        document.querySelectorAll('.sc-deliv-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.mode === state.deliveryMode);
        });
        renderBagView();
      });
    });

    document.getElementById('sc-checkout-btn').addEventListener('click', () => {
      if (state.bag.length === 0) {
        showToast('Add a little treat to your basket first ♥');
        return;
      }
      playCozyTone('bell');
      navigateTo('ORDER_PLACED');
    });

    document.getElementById('sc-back-corner-order-btn').addEventListener('click', () => {
      navigateTo('HOME');
    });
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    state.isMenuOpen = false;
    document.body.classList.remove('sc-no-anim', 'sc-bldg-hero');
    document.body.classList.add('sc-menu-closed');
    if (params.has('noanim') || params.has('hero')) {
      params.delete('noanim');
      params.delete('hero');
      const cleanQuery = params.toString();
      const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash;
      try {
        window.history.replaceState({}, '', cleanUrl);
      } catch (_) {}
    }
    const qVp = params.get('vp');
    if (qVp) {
      const wPx = `${parseInt(qVp, 10)}px`;
      document.documentElement.style.maxWidth = wPx;
      document.body.style.maxWidth = wPx;
      const vpEl = document.getElementById('sc-viewport');
      if (vpEl) vpEl.style.maxWidth = wPx;
      const topEl = document.getElementById('sc-topbar');
      if (topEl) topEl.style.maxWidth = wPx;
      const botEl = document.getElementById('sc-bottombar');
      if (botEl) {
        botEl.style.left = '8px';
        botEl.style.right = 'auto';
        botEl.style.width = `calc(${wPx} - 16px)`;
      }
    }

    preloadImages();
    renderHomeBestsellers();
    renderMenuGrid();
    renderProductDetail();
    renderEventsView();
    renderBagView();
    updateBagBadge();
    setupTurntableCanvas();
    setupFloatingPetals();
    setupStrawberry3DBuilding();
    bindEvents();

    // Support URL query parameter deep-linking (?state=MENU_GRID, ?yaw=-1.2, etc.)
    const qState = params.get('state');
    if (qState) {
      const qProd = params.get('prod');
      const qSize = params.get('size');
      if (qProd !== null) {
        selectProduct(parseInt(qProd, 10));
        if (qSize !== null) state.activeSizeIdx = parseInt(qSize, 10);
      }
      if (params.get('added') === '1') {
        const addBtn = document.getElementById('sc-add-to-bag-btn');
        const addTxt = document.getElementById('sc-add-bag-text');
        if (addBtn && addTxt) {
          addBtn.classList.add('added');
          addTxt.textContent = 'ADDED ♥';
        }
      }
      if (params.get('reserved') === '1') {
        const ev = MONTHS_DATA[0].events.find((e) => e.id === 'ev-oct-18');
        if (ev) ev.reserved = true;
      }
      navigateTo(qState);
    }
    const qYaw = params.get('yaw');
    if (qYaw !== null && typeof window.rotateStrawberry3DBuilding === 'function') {
      window.rotateStrawberry3DBuilding(parseFloat(qYaw));
    }

    // Expose helper for automated visual testing
    window.StrawberryCornerApp = {
      navigateTo,
      setMenuOpen,
      isMenuOpen: () => state.isMenuOpen,
      selectBuilding,
      setWeatherMode,
      getActiveBuilding: () => state.activeBuildingIdx,
      getWeatherMode: () => state.weatherMode,
      selectProduct: (idx, sizeIdx = 1) => {
        selectProduct(idx);
        state.activeSizeIdx = sizeIdx;
        renderProductDetail();
      },
      rotateTurntable: (angleRad) => {
        state.turntableTargetAngle = angleRad;
        state.turntableAngle = angleRad;
      },
      selectEvent: (monthIdx, evId, reserve = null) => {
        state.calMonthIdx = monthIdx;
        state.selectedEventId = evId;
        if (typeof reserve === 'boolean') {
          const ev = MONTHS_DATA[monthIdx].events.find((e) => e.id === evId);
          if (ev) ev.reserved = reserve;
        }
        renderEventsView();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
