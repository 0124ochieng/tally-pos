// Demo seed data — 3 starter categories x 10 demo products each. This is
// intentionally a small, clearly-placeholder catalogue: the admin adds real
// inventory and categories from the Inventory page after first run.

export interface SeedCategory {
  key: string
  name: string
  icon: string // lucide-react icon name
}

export const seedCategories: SeedCategory[] = [
  { key: 'phone-accessories', name: 'Phone Accessories', icon: 'Smartphone' },
  { key: 'home-entertainment', name: 'Home Entertainment', icon: 'Tv' },
  { key: 'kitchen-appliances', name: 'Kitchen & Home Appliances', icon: 'CookingPot' },
]

export interface SeedProduct {
  categoryKey: string
  name: string
  brand: string
  description: string
  sellingPrice: number // KES
  costPrice: number // KES
  unit: string
  isSerialized: boolean
  lowStockThreshold: number
  stock: number
}

const round = (n: number) => Math.round(n / 10) * 10

function item(
  categoryKey: string,
  name: string,
  brand: string,
  description: string,
  sellingPrice: number,
  costRatio: number,
  opts: Partial<Pick<SeedProduct, 'unit' | 'isSerialized' | 'lowStockThreshold' | 'stock'>> = {},
): SeedProduct {
  return {
    categoryKey,
    name,
    brand,
    description,
    sellingPrice,
    costPrice: round(sellingPrice * costRatio),
    unit: opts.unit ?? 'pc',
    isSerialized: opts.isSerialized ?? false,
    lowStockThreshold: opts.lowStockThreshold ?? (sellingPrice > 15000 ? 2 : 5),
    stock: opts.stock ?? 15,
  }
}

export const seedProducts: SeedProduct[] = [
  // ---------- Phone Accessories ----------
  item('phone-accessories', 'Oraimo FastCharge 20W Charger', 'Oraimo', 'Wall charger, 20W PD fast charging, USB-C output', 1200, 0.62, { stock: 20 }),
  item('phone-accessories', 'Oraimo Type-C Cable 1m', 'Oraimo', 'Braided 1m USB-C charging and data cable', 450, 0.55, { stock: 30 }),
  item('phone-accessories', 'Oraimo FreePods 4 TWS Earbuds', 'Oraimo', 'True wireless Bluetooth earbuds with charging case', 2800, 0.55, { stock: 14 }),
  item('phone-accessories', 'Anker PowerCore 20000mAh Power Bank', 'Anker', 'High-capacity power bank with fast charging', 4500, 0.62, { stock: 8 }),
  item('phone-accessories', 'Tempered Glass Screen Protector', 'Generic', '9H hardness tempered glass, fits most 6.1" screens', 250, 0.4, { stock: 40 }),
  item('phone-accessories', 'Universal Silicone Case', 'Generic', 'Soft silicone protective case, assorted sizes', 400, 0.4, { stock: 20 }),
  item('phone-accessories', 'Tecno Spark 20 (128GB)', 'Tecno', '6.6" display, 128GB/8GB, 50MP camera, dual SIM', 15500, 0.85, { isSerialized: true, stock: 6, lowStockThreshold: 2 }),
  item('phone-accessories', 'Samsung Galaxy A15 (128GB)', 'Samsung', '6.5" sAMOLED, 128GB/4GB, 50MP triple camera', 22000, 0.85, { isSerialized: true, stock: 4, lowStockThreshold: 2 }),
  item('phone-accessories', 'SanDisk 64GB MicroSD Card', 'SanDisk', 'Class 10 microSD card, up to 100MB/s read speed', 1200, 0.65, { stock: 15 }),
  item('phone-accessories', 'Universal Car Phone Holder', 'Generic', 'Suction dashboard mount, fits 4"-7" phones', 600, 0.45, { stock: 14 }),

  // ---------- Home Entertainment ----------
  item('home-entertainment', 'Vitron 32" HD LED TV', 'Vitron', 'HD Ready LED TV with HDMI/USB/AV inputs', 13500, 0.78, { stock: 6, lowStockThreshold: 2 }),
  item('home-entertainment', 'Hisense 43" FHD Smart TV', 'Hisense', 'Full HD Smart TV, VIDAA OS, built-in WiFi', 26500, 0.78, { stock: 4, lowStockThreshold: 2 }),
  item('home-entertainment', 'Vitron 2.1CH Home Theatre Soundbar', 'Vitron', 'Soundbar with wired subwoofer, Bluetooth, USB', 5500, 0.65, { stock: 8 }),
  item('home-entertainment', 'JBL Flip 6 Portable Bluetooth Speaker', 'JBL', 'Waterproof portable Bluetooth speaker, 12hr battery', 9500, 0.68, { stock: 6 }),
  item('home-entertainment', 'Amazon Fire TV Stick', 'Amazon', 'HD streaming device with Alexa voice remote', 6500, 0.75, { stock: 8 }),
  item('home-entertainment', 'Google Chromecast with Google TV', 'Google', '4K streaming device with remote and Google TV interface', 8500, 0.75, { stock: 6 }),
  item('home-entertainment', 'Universal TV Wall Mount Bracket', 'Generic', 'Tilting wall mount, fits 26"-55" TVs', 1800, 0.5, { stock: 12 }),
  item('home-entertainment', 'HDMI Cable 3m High Speed', 'Generic', 'High speed HDMI cable, supports 4K@60Hz', 500, 0.4, { stock: 20 }),
  item('home-entertainment', 'DSTV Explora Decoder', 'DSTV', 'HD PVR decoder with dual satellite tuner', 12500, 0.72, { stock: 5, lowStockThreshold: 2 }),
  item('home-entertainment', 'Vitron DVD Player', 'Vitron', 'DVD/CD player with USB playback and remote', 2800, 0.6, { stock: 9 }),

  // ---------- Kitchen & Home Appliances ----------
  item('kitchen-appliances', 'Ramtons 2-Burner Gas Cooker', 'Ramtons', 'Table-top 2-burner gas cooker with auto ignition', 6500, 0.68, { stock: 8 }),
  item('kitchen-appliances', 'Von Air Fryer 5L', 'Von', 'Digital air fryer, 5L basket, 8 preset programs', 7800, 0.65, { stock: 8 }),
  item('kitchen-appliances', 'Ramtons Blender 1.5L', 'Ramtons', 'Glass jar blender with 3-speed control, 1.5L', 3200, 0.58, { stock: 12 }),
  item('kitchen-appliances', 'Ramtons Electric Kettle 1.7L', 'Ramtons', 'Cordless electric kettle, auto shut-off, 1.7L', 1800, 0.55, { stock: 18 }),
  item('kitchen-appliances', 'Von Standing Fan 18"', 'Von', '18" standing fan with 3-speed oscillation', 3800, 0.6, { stock: 10 }),
  item('kitchen-appliances', 'Ramtons Dry Iron Box', 'Ramtons', 'Non-stick soleplate dry iron, 1200W', 1200, 0.55, { stock: 18 }),
  item('kitchen-appliances', 'Bruhm Microwave Oven 20L', 'Bruhm', '20L solo microwave oven with digital control', 8500, 0.68, { stock: 6 }),
  item('kitchen-appliances', 'Bruhm Washing Machine 7kg', 'Bruhm', 'Top-load fully automatic washing machine, 7kg', 32000, 0.75, { stock: 2, lowStockThreshold: 1 }),
  item('kitchen-appliances', 'Von Single Door Fridge 118L', 'Von', 'Direct cool single door refrigerator, 118L', 24500, 0.76, { stock: 3, lowStockThreshold: 1 }),
  item('kitchen-appliances', 'Ailyons Water Dispenser (Hot & Cold)', 'Ailyons', 'Free-standing hot/cold water dispenser with cabinet', 11500, 0.68, { stock: 5, lowStockThreshold: 2 }),
]
