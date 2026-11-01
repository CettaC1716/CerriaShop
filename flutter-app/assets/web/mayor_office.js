import * as THREE from 'three';
import { storeCatalog, submitOrder } from './js/store-data-manager.js?v=124';
import { UI_ONLY } from './js/ui-mode.js?v=124';
import { resetMayorWindPose } from './village.js?v=124';

// ============================================================================
// MAYOR'S OFFICE (POS #7 — PUSAT AKUN PEMBELI, KARTU WARGA 3D & BALAI WARGA)
// 4-Tab Camera Choreography & Buyer Account Hub:
// - Tab 1: HOME ('AKUN & PROFIL' — Profil Pembeli, Auth OTP/Google, Tier, Poin,
//          Voucher, Wishlist, Menu Daftar Pesanan, Buku Alamat, Toko Favorit, Retur)
// - Tab 2: PENDAFTARAN ('KARTU WARGA 3D' — Kartu Member 3D 360° & Paspor 7 Stempel)
// - Tab 3: PESANAN ('PESANAN & ALAMAT' — Daftar Pesanan Lintas Toko, Buku Alamat,
//          Dompet Voucher & Wishlist/Toko Favorit)
// - Tab 4: CS ('BANTUAN & RETUR' — Pengajuan Retur Produk, Ulasan, FAQ & Struk Tiket)
// ============================================================================

export const MAYOR_CATALOG = storeCatalog('toko7');
export const MAYOR_ROLES = MAYOR_CATALOG.roles;
export const MAYOR_STAMPS = MAYOR_CATALOG.stamps;
export const MAYOR_CS_CATEGORIES = MAYOR_CATALOG.csCategories;
export const MAYOR_FAQS = MAYOR_CATALOG.faqs;

const BUYER_STORAGE_KEY = 'cerria_buyer_account_v1';
const CHECKOUT_STORAGE_KEY = 'cerria_town_checkout_state_v3';

const DEFAULT_VOUCHERS = [
  {
    id: 'vch-free-ship',
    code: 'ONGKIRCERRIA',
    title: 'Gratis Ongkir Cerria Express',
    sub: 'Potongan ongkir hingga Rp25.300 di seluruh 6 toko',
    badge: 'Gratis Ongkir 3x',
    claimed: true
  },
  {
    id: 'vch-glow-20',
    code: 'GLOWSTUDIO20',
    title: 'Diskon 20% Glow Studio',
    sub: 'Berlaku untuk seluruh skincare & perangkat LED Mask',
    badge: 'Diskon 20%',
    claimed: true
  },
  {
    id: 'vch-cozy-15',
    code: 'COZYBITES15',
    title: 'Cashback 15% Cozy Bites & Sips',
    sub: 'Artisan croissant, pastry hangat & signature coffee',
    badge: 'Promo Toko #2',
    claimed: true
  },
  {
    id: 'vch-citizen-25k',
    code: 'WARGABARU25',
    title: 'Voucher Warga Terdaftar Rp25.000',
    sub: 'Potongan langsung dengan minimal belanja Rp150.000',
    badge: 'Bonus Member',
    claimed: true
  }
];

const DEFAULT_WISHLIST = [
  {
    id: 'ledmask',
    storeId: 'toko1',
    storeName: 'Glow Studio',
    name: 'Quartz Roller & LED Mask',
    price: 'Rp 680.000',
    hash: '#toko1'
  },
  {
    id: 'trench',
    storeId: 'toko3',
    storeName: 'Atelier & Boutique',
    name: 'Classic Tailored Trench Coat',
    price: 'Rp 1.196.000',
    hash: '#toko3'
  }
];

const DEFAULT_FAV_STORES = [
  { storeId: 'toko1', name: 'Glow Studio', category: 'Beauty & Skincare', hash: '#toko1', color: '#E07A68' },
  { storeId: 'toko2', name: 'Cozy Bites & Sips', category: 'Bakery & Bistro', hash: '#toko2', color: '#D4842A' },
  { storeId: 'toko4', name: 'Circuit & Byte', category: 'Tech & Gaming', hash: '#toko4', color: '#0098C8' }
];

function cubicBezierEase(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatIDR(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

export function createMayorOfficeSystem({ camera, controls, stores, chime }) {
  let active = false;
  let state = 'HOME'; // 'HOME' | 'PENDAFTARAN' | 'PESANAN' | 'CS'
  let subTabPesanan = 'orders'; // 'orders' | 'addresses' | 'vouchers' | 'wishlist' | 'favstores'
  let authModalOpen = false;
  let savedVillageRotY = null;

  // Load persisted buyer account state & sync with checkout state
  function loadBuyerState() {
    let checkoutRecipient = {
      name: 'Pelanggan Cerria Town',
      phone: '0812-3456-7890',
      email: 'pelanggan@cerriatown.id',
      address: 'Jl. Boulevard Cerria Town No. 12, Distrik Pusat, Cerria Town 10110'
    };
    let checkoutPoints = 1250;

    try {
      const rawCheckout = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      if (rawCheckout) {
        const parsedC = JSON.parse(rawCheckout);
        if (parsedC?.recipient) {
          checkoutRecipient = { ...checkoutRecipient, ...parsedC.recipient };
        }
        if (typeof parsedC?.pointsBalance === 'number') {
          checkoutPoints = parsedC.pointsBalance;
        }
      }
    } catch {}

    try {
      const rawBuyer = localStorage.getItem(BUYER_STORAGE_KEY);
      if (rawBuyer) {
        const parsedB = JSON.parse(rawBuyer);
        return {
          loggedIn: parsedB.loggedIn !== false,
          authMethod: parsedB.authMethod || 'WhatsApp OTP',
          name: parsedB.name || checkoutRecipient.name,
          phone: parsedB.phone || checkoutRecipient.phone,
          email: parsedB.email || checkoutRecipient.email,
          roleIdx: typeof parsedB.roleIdx === 'number' ? parsedB.roleIdx : 4,
          citizenIdCode: parsedB.citizenIdCode || 'CT-2026-0129',
          points: typeof parsedB.points === 'number' ? parsedB.points : checkoutPoints,
          addresses: Array.isArray(parsedB.addresses) && parsedB.addresses.length
            ? parsedB.addresses
            : [
                {
                  id: 'addr-1',
                  label: 'Alamat Utama',
                  recipient: parsedB.name || checkoutRecipient.name,
                  phone: parsedB.phone || checkoutRecipient.phone,
                  address: checkoutRecipient.address,
                  isDefault: true
                }
              ],
          orders: Array.isArray(parsedB.orders) ? parsedB.orders : [],
          vouchers: Array.isArray(parsedB.vouchers) ? parsedB.vouchers : DEFAULT_VOUCHERS,
          wishlist: Array.isArray(parsedB.wishlist) ? parsedB.wishlist : DEFAULT_WISHLIST,
          favStores: Array.isArray(parsedB.favStores) ? parsedB.favStores : DEFAULT_FAV_STORES,
          reviewsCount: typeof parsedB.reviewsCount === 'number' ? parsedB.reviewsCount : 2
        };
      }
    } catch {}

    return {
      loggedIn: true,
      authMethod: 'WhatsApp OTP',
      name: checkoutRecipient.name,
      phone: checkoutRecipient.phone,
      email: checkoutRecipient.email,
      roleIdx: 4,
      citizenIdCode: 'CT-2026-0129',
      points: checkoutPoints,
      addresses: [
        {
          id: 'addr-1',
          label: 'Alamat Utama',
          recipient: checkoutRecipient.name,
          phone: checkoutRecipient.phone,
          address: checkoutRecipient.address,
          isDefault: true
        }
      ],
      orders: [
        {
          orderId: 'ORD-CT-8821',
          storeId: 'toko1',
          storeName: 'Glow Studio',
          itemsSummary: '1x Quartz Roller & LED Mask',
          total: 680000,
          status: 'Selesai',
          date: 'Hari ini · QRIS Official'
        }
      ],
      vouchers: DEFAULT_VOUCHERS,
      wishlist: DEFAULT_WISHLIST,
      favStores: DEFAULT_FAV_STORES,
      reviewsCount: 2
    };
  }

  const buyer = loadBuyerState();

  function saveBuyerState() {
    try {
      localStorage.setItem(BUYER_STORAGE_KEY, JSON.stringify(buyer));
      // Sync primary address & buyer profile to checkout state so all 6 stores auto-fill on checkout
      const primaryAddr = buyer.addresses.find(a => a.isDefault) || buyer.addresses[0];
      const rawCheckout = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      const parsedC = rawCheckout ? JSON.parse(rawCheckout) : {};
      parsedC.recipient = {
        name: primaryAddr?.recipient || buyer.name,
        phone: primaryAddr?.phone || buyer.phone,
        email: buyer.email,
        address: primaryAddr?.address || ''
      };
      parsedC.pointsBalance = buyer.points;
      localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(parsedC));
    } catch {}
  }

  // Listen to live store orders so they appear immediately in Daftar Pesanan
  if (typeof window !== 'undefined') {
    window.addEventListener('cerria:order-submitted', e => {
      const rec = e?.detail;
      if (!rec || rec.storeId === 'toko7') return;
      const itemsList = Array.isArray(rec.items) ? rec.items : [];
      const summary = itemsList.length
        ? itemsList.map(it => `${it.qty || 1}x ${it.name || it.id}`).join(', ')
        : 'Pesanan Produk Cerria Town';
      buyer.orders.unshift({
        orderId: rec.orderId || `ORD-${Date.now().toString().slice(-5)}`,
        storeId: rec.storeId || 'toko1',
        storeName: rec.storeName || rec.storeId || 'Toko Cerria Town',
        itemsSummary: summary,
        total: Number(rec.totalAmount || rec.total || 0),
        status: 'Diproses',
        date: 'Baru saja · QRIS Official'
      });
      buyer.points += 150;
      saveBuyerState();
      if (active) renderUI();
    });
  }

  // Stamp Passport State
  const stamps = MAYOR_STAMPS.map(s => ({ ...s }));

  // Customer Service & Return Ticket State
  let csCategory = 'retur'; // 'retur' | 'produk' | 'panduan' | 'pesan'
  let openFaqIdx = 0;
  let ticketCounter = 708;
  let currentTicket = {
    code: 'CS-0708',
    sender: buyer.name,
    category: 'Layanan Retur & Bantuan Pesanan',
    note: 'Pemeriksaan status garansi & pengiriman pesanan.',
    time: 'Hari ini · Loket Utama Balai Warga',
    status: 'AKTIF · PRIORITAS PEMBELI'
  };

  function getBuyerTier() {
    const sc = collectedStampsCount();
    if (buyer.points >= 2000 || sc >= 7) return 'Gold';
    if (buyer.points >= 500 || sc >= 3) return 'Silver';
    return 'Warga Baru';
  }

  // Smooth Camera Animation State (Position + Target + ViewOffset)
  const camAnim = {
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    curPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    curTarget: new THREE.Vector3(),
    fromOffsetX: 0,
    toOffsetX: 0,
    curOffsetX: 0,
    fromOffsetY: 0,
    toOffsetY: 0,
    curOffsetY: 0,
    t0: 0,
    dur: 750
  };

  function applyCurrentViewOffset() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (W <= 767 || (Math.abs(camAnim.curOffsetX) < 0.0005 && Math.abs(camAnim.curOffsetY) < 0.0005)) {
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
    camera.updateProjectionMatrix();
  }

  const cachedCenter = new THREE.Vector3();
  let cachedMaxY = 8.5;

  function updateMayorCamera(targetState, instant = false) {
    const mayorBuildingGroup = stores[6]?.g;
    if (!mayorBuildingGroup) return;

    resetMayorWindPose();

    mayorBuildingGroup.scale.set(1, 1, 1);
    mayorBuildingGroup.rotation.y = 0.95;
    mayorBuildingGroup.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(mayorBuildingGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    cachedCenter.copy(center);
    cachedMaxY = box.max.y;

    const maxDim = Math.max(size.x, size.y, size.z);
    const fovRad = camera.fov * (Math.PI / 180);
    const baseDist = (maxDim / 2) / Math.tan(fovRad / 2);

    const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1180;
    let dist = baseDist * (isTablet ? 1.95 : 1.65);
    let targetOffsetX = isTablet ? 0.22 : 0.20;
    let targetOffsetY = 0;

    if (targetState === 'HOME') {
      dist = baseDist * (isTablet ? 1.95 : 1.65);
      targetOffsetX = isTablet ? 0.22 : 0.20;
      targetOffsetY = 0;
    } else {
      dist = baseDist * 2.85;
      targetOffsetX = 0.35;
      targetOffsetY = -0.20;
    }

    const targetCamPos = new THREE.Vector3(
      center.x + dist * 0.55,
      center.y + size.y * 0.08,
      center.z + dist * 0.85
    );
    const targetLookAt = new THREE.Vector3(
      center.x,
      center.y + size.y * 0.05,
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

  window.addEventListener('resize', () => {
    if (!active) return;
    updateMayorCamera(state, true);
  });

  // ==========================================================================
  // INTERACTIVE 360° 3D CITIZEN ID CARD RENDERER (Real-Time CanvasTexture)
  // ==========================================================================
  let cardRenderer = null;
  let cardScene = null;
  let cardCam = null;
  let cardPivot = null;
  let cardFrontCanvas = null;
  let cardFrontTex = null;
  let cardBackCanvas = null;
  let cardBackTex = null;
  let cardRoleBadgeMat = null;
  let cardDragging = false;
  let cardLastX = 0;
  let cardLastY = 0;
  let cardRotY = -0.22;
  let cardRotX = 0.10;
  let cardAutoSpin = true;

  function drawCitizenCardFrontTexture() {
    if (!cardFrontCanvas) {
      cardFrontCanvas = document.createElement('canvas');
      cardFrontCanvas.width = 1024;
      cardFrontCanvas.height = 640;
    }
    const c = cardFrontCanvas.getContext('2d');
    const w = cardFrontCanvas.width;
    const h = cardFrontCanvas.height;
    const role = MAYOR_ROLES[buyer.roleIdx] || MAYOR_ROLES[0];
    const cleanName = (buyer.name || 'Pelanggan Cerria').trim().slice(0, 26);

    c.fillStyle = '#FAF3E3';
    c.fillRect(0, 0, w, h);

    c.strokeStyle = 'rgba(110, 130, 138, 0.10)';
    c.lineWidth = 3;
    for (let r = 80; r < 520; r += 36) {
      c.beginPath();
      c.arc(w * 0.78, h * 0.54, r, 0, Math.PI * 2);
      c.stroke();
    }

    c.fillStyle = '#566A73';
    c.fillRect(0, 0, w, 128);
    c.fillStyle = role.color;
    c.fillRect(0, 128, w, 16);

    c.fillStyle = '#E5B548';
    c.beginPath();
    c.arc(82, 64, 38, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#FFF8E8';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#2E2218';
    c.font = '700 26px "DM Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText('CT', 82, 73);

    c.textAlign = 'left';
    c.fillStyle = '#FFF9EE';
    c.font = '700 34px "DM Sans", sans-serif';
    c.fillText('BALAI WARGA CERRIA TOWN', 142, 60);
    c.fillStyle = '#DFD0B4';
    c.font = '600 20px "DM Sans", sans-serif';
    c.fillText(`KARTU IDENTITAS PEMBELI · TIER ${getBuyerTier().toUpperCase()}`, 142, 95);

    c.fillStyle = '#FAF3E3';
    c.beginPath();
    c.roundRect(w - 280, 34, 240, 60, 14);
    c.fill();
    c.fillStyle = '#2E2218';
    c.font = '700 24px "DM Sans", monospace';
    c.textAlign = 'center';
    c.fillText(buyer.citizenIdCode, w - 160, 72);

    c.fillStyle = role.accent;
    c.strokeStyle = role.color;
    c.lineWidth = 6;
    c.beginPath();
    c.roundRect(52, 182, 236, 286, 24);
    c.fill();
    c.stroke();

    const ax = 170, ay = 305;
    c.fillStyle = role.color;
    c.beginPath();
    c.arc(ax, ay + 115, 86, Math.PI, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FFF9EE';
    c.beginPath();
    c.moveTo(ax - 28, ay + 38);
    c.lineTo(ax, ay + 68);
    c.lineTo(ax + 28, ay + 38);
    c.closePath();
    c.fill();
    c.fillStyle = '#F4CFB4';
    c.beginPath();
    c.arc(ax, ay - 14, 52, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#4A3324';
    c.beginPath();
    c.arc(ax, ay - 28, 54, Math.PI * 0.95, Math.PI * 2.05);
    c.fill();
    c.fillStyle = '#2E2218';
    c.beginPath();
    c.arc(ax - 18, ay - 12, 5.5, 0, Math.PI * 2);
    c.arc(ax + 18, ay - 12, 5.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8C4A32';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(ax, ay + 2, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();

    c.fillStyle = role.color;
    c.beginPath();
    c.roundRect(68, 422, 204, 34, 10);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.font = '700 18px "DM Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText(role.badge, 170, 445);

    c.textAlign = 'left';
    c.fillStyle = '#7A6B58';
    c.font = '700 18px "DM Sans", sans-serif';
    c.fillText('NAMA LENGKAP PEMBELI', 330, 210);

    c.fillStyle = '#231B14';
    c.font = '700 48px "DM Sans", sans-serif';
    c.fillText(cleanName, 330, 266);

    c.fillStyle = '#D9C9AE';
    c.fillRect(330, 286, 620, 3);

    c.fillStyle = '#7A6B58';
    c.font = '700 17px "DM Sans", sans-serif';
    c.fillText('KATEGORI FAVORIT', 330, 326);
    c.fillText('TIER & POIN', 670, 326);

    c.fillStyle = role.color;
    c.font = '700 27px "DM Sans", sans-serif';
    c.fillText(role.label, 330, 362);

    c.fillStyle = '#2E2218';
    c.font = '700 25px "DM Sans", sans-serif';
    c.fillText(`${getBuyerTier()} · ${buyer.points} Poin`, 670, 362);

    c.fillStyle = '#F1E6CE';
    c.beginPath();
    c.roundRect(330, 392, 430, 74, 14);
    c.fill();
    c.fillStyle = '#4A3B2B';
    c.font = '500 20px "DM Sans", sans-serif';
    c.fillText(`"${role.motto}"`, 348, 436, 395);

    const sx = 865, sy = 445;
    c.save();
    c.translate(sx, sy);
    c.rotate(-0.18);
    c.strokeStyle = buyer.loggedIn ? '#2E7D47' : '#C84B31';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, 0, 66, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 56, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = buyer.loggedIn ? '#2E7D47' : '#C84B31';
    c.font = '700 18px "DM Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText(buyer.loggedIn ? 'TERVERIFIKASI' : ' MODE TAMU ', 0, -8);
    c.font = '700 22px "DM Sans", sans-serif';
    c.fillText('CERRIA TOWN', 0, 18);
    c.restore();

    c.fillStyle = '#EDE0C4';
    c.fillRect(0, h - 88, w, 88);
    c.fillStyle = '#3B2E22';
    for (let bx = 56; bx < 360; bx += 10) {
      const bw = (bx * 7) % 3 === 0 ? 6 : 3;
      c.fillRect(bx, h - 68, bw, 46);
    }
    c.textAlign = 'left';
    c.fillStyle = '#5A4A3A';
    c.font = '600 20px "DM Sans", sans-serif';
    c.fillText('BERLAKU DI SELURUH 7 POS CERRIA TOWN · PUSAT AKUN PEMBELI', 390, h - 38);

    c.strokeStyle = '#566A73';
    c.lineWidth = 12;
    c.strokeRect(6, 6, w - 12, h - 12);

    if (cardFrontTex) cardFrontTex.needsUpdate = true;
    if (cardRoleBadgeMat) cardRoleBadgeMat.color.set(role.color);
  }

  function drawCitizenCardBackTexture() {
    if (!cardBackCanvas) {
      cardBackCanvas = document.createElement('canvas');
      cardBackCanvas.width = 1024;
      cardBackCanvas.height = 640;
    }
    const c = cardBackCanvas.getContext('2d');
    const w = cardBackCanvas.width;
    const h = cardBackCanvas.height;

    c.fillStyle = '#F5EBCD';
    c.fillRect(0, 0, w, h);

    c.fillStyle = '#3B4A52';
    c.fillRect(0, 48, w, 76);

    c.textAlign = 'center';
    c.fillStyle = '#2E2218';
    c.font = '700 28px "DM Sans", sans-serif';
    c.fillText('PASPOR STEMPEL 7 POS CERRIA TOWN', w / 2, 186);

    stamps.forEach((st, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const cx = (row === 0 ? 190 : 285) + col * 215;
      const cy = 285 + row * 155;

      c.fillStyle = st.collected ? '#FFFDF7' : '#EAE0C8';
      c.strokeStyle = st.collected ? st.color : '#B8AC96';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(cx, cy, 56, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = st.collected ? st.color : '#8E8270';
      c.font = '700 24px "DM Sans", sans-serif';
      c.fillText(`POS ${st.pos}`, cx, cy - 6);
      c.font = '700 17px "DM Sans", sans-serif';
      c.fillText(st.name.toUpperCase(), cx, cy + 20);
    });

    c.fillStyle = '#566A73';
    c.font = '600 20px "DM Sans", sans-serif';
    c.fillText('Diterbitkan Resmi oleh Balai Warga · Alun-Alun Air Mancur Cerria Town', w / 2, h - 36);

    c.strokeStyle = '#566A73';
    c.lineWidth = 12;
    c.strokeRect(6, 6, w - 12, h - 12);

    if (cardBackTex) cardBackTex.needsUpdate = true;
  }

  function ensureCitizenCardRenderer(hostEl) {
    if (UI_ONLY) {
      drawCitizenCardFrontTexture();
      cardFrontCanvas.className = 'ui-only-idcard-2d';
      hostEl.innerHTML = '';
      hostEl.appendChild(cardFrontCanvas);
      return;
    }
    if (!cardRenderer) {
      const isMob =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.innerWidth < 1024 ||
        Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      cardRenderer = new THREE.WebGLRenderer({ antialias: !isMob, alpha: true, powerPreference: 'high-performance' });
      cardRenderer.setPixelRatio(Math.min(window.devicePixelRatio, isMob ? 1.25 : 2.0));
      cardRenderer.outputColorSpace = THREE.SRGBColorSpace;

      cardScene = new THREE.Scene();
      cardCam = new THREE.PerspectiveCamera(30, 1.45, 0.1, 30);
      cardCam.position.set(0, 0.15, 5.2);
      cardCam.lookAt(0, 0.05, 0);

      const amb = new THREE.AmbientLight('#FFF8EC', 1.75);
      const dir1 = new THREE.DirectionalLight('#FFF3DD', 1.45);
      dir1.position.set(3.5, 4.5, 5);
      const dir2 = new THREE.DirectionalLight('#DCE8F5', 0.75);
      dir2.position.set(-4, -2, -3);
      cardScene.add(amb, dir1, dir2);

      drawCitizenCardFrontTexture();
      drawCitizenCardBackTexture();

      cardFrontTex = new THREE.CanvasTexture(cardFrontCanvas);
      cardFrontTex.colorSpace = THREE.SRGBColorSpace;
      cardBackTex = new THREE.CanvasTexture(cardBackCanvas);
      cardBackTex.colorSpace = THREE.SRGBColorSpace;

      cardPivot = new THREE.Group();
      cardScene.add(cardPivot);

      const cardW = 3.10;
      const cardH = 1.94;
      const cardD = 0.09;

      const outlineGeo = new THREE.BoxGeometry(cardW + 0.07, cardH + 0.07, cardD + 0.04);
      const outlineMat = new THREE.MeshBasicMaterial({ color: '#2B2118', side: THREE.BackSide });
      cardPivot.add(new THREE.Mesh(outlineGeo, outlineMat));

      const edgeMat = new THREE.MeshStandardMaterial({ color: '#E6D6B8', roughness: 0.55, metalness: 0.1 });
      const frontMat = new THREE.MeshStandardMaterial({ map: cardFrontTex, roughness: 0.42, metalness: 0.06 });
      const backMat = new THREE.MeshStandardMaterial({ map: cardBackTex, roughness: 0.48, metalness: 0.05 });
      const cardGeo = new THREE.BoxGeometry(cardW, cardH, cardD);
      const cardMesh = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat]);
      cardPivot.add(cardMesh);

      const goldMat = new THREE.MeshStandardMaterial({ color: '#E5B548', roughness: 0.28, metalness: 0.72 });
      const crestGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 24);
      crestGeo.rotateX(Math.PI / 2);
      const crestMesh = new THREE.Mesh(crestGeo, goldMat);
      crestMesh.position.set(-1.12, 0.58, cardD / 2 + 0.018);
      cardPivot.add(crestMesh);

      cardRoleBadgeMat = new THREE.MeshStandardMaterial({ color: '#6E828A', roughness: 0.45 });
      const badgeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.11, 0.025), cardRoleBadgeMat);
      badgeStrip.position.set(-0.98, -0.38, cardD / 2 + 0.015);
      cardPivot.add(badgeStrip);

      const clipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.13), goldMat);
      clipMesh.position.set(0, cardH / 2 + 0.06, 0);
      cardPivot.add(clipMesh);

      const ribbonMat = new THREE.MeshStandardMaterial({ color: '#8FA38A', roughness: 0.7 });
      const ribbonMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.04), ribbonMat);
      ribbonMesh.position.set(0, cardH / 2 + 0.34, 0);
      cardPivot.add(ribbonMesh);

      const dom = cardRenderer.domElement;
      dom.className = 'mayor-id-webgl';
      dom.addEventListener('pointerdown', e => {
        cardDragging = true;
        cardAutoSpin = false;
        cardLastX = e.clientX;
        cardLastY = e.clientY;
        dom.setPointerCapture(e.pointerId);
      });
      dom.addEventListener('pointermove', e => {
        if (!cardDragging) return;
        const dx = e.clientX - cardLastX;
        const dy = e.clientY - cardLastY;
        cardLastX = e.clientX;
        cardLastY = e.clientY;
        cardRotY += dx * 0.014;
        cardRotX = Math.max(-0.45, Math.min(0.45, cardRotX + dy * 0.009));
      });
      const stopCardDrag = () => { cardDragging = false; };
      dom.addEventListener('pointerup', stopCardDrag);
      dom.addEventListener('pointercancel', stopCardDrag);
    }

    hostEl.innerHTML = '';
    hostEl.appendChild(cardRenderer.domElement);
    const rect = hostEl.getBoundingClientRect();
    const w = Math.max(300, rect.width || 400);
    const h = Math.max(230, rect.height || 265);
    cardRenderer.setSize(w, h);
    cardCam.aspect = w / h;
    cardCam.updateProjectionMatrix();
    drawCitizenCardFrontTexture();
    drawCitizenCardBackTexture();
  }

  // Create Overlay DOM
  const overlay = document.createElement('div');
  overlay.id = 'mayor-overlay';
  overlay.className = 'sc-overlay mayor-overlay';
  overlay.style.display = 'none';
  document.getElementById('app').appendChild(overlay);

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .mayor-overlay .sc-dot-mayor {
      width: 10px; height: 10px; border-radius: 50%; background: #6E828A; display: inline-block;
    }

    /* Buyer Account Dashboard (Tab 1 - Blibli Reference Inspired) */
    .mayor-buyer-hub {
      margin-left: auto;
      width: min(560px, 50vw);
      max-height: min(82dvh, calc(100dvh - 155px));
      overflow-y: auto;
      background: rgba(255, 253, 249, 0.96);
      border: 1.5px solid #E5D9C3;
      border-radius: 24px;
      padding: 20px 22px;
      box-shadow: 0 20px 50px rgba(32, 25, 18, 0.14);
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: #231B14;
    }

    .mayor-profile-top {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 14px;
      align-items: center;
    }

    .mayor-user-box {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .mayor-avatar-badge {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: linear-gradient(135deg, #566A73 0%, #8FA38A 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 800;
      flex-shrink: 0;
      box-shadow: 0 6px 14px rgba(86, 106, 115, 0.25);
    }

    .mayor-user-meta {
      min-width: 0;
      flex: 1;
    }

    .mayor-user-tag {
      font-size: 11px;
      font-weight: 800;
      color: #2563EB;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 2px;
    }

    .mayor-user-tag span.dot-gold {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #F59E0B;
      display: inline-block;
    }

    .mayor-user-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .mayor-user-name-row strong {
      font-size: 17px;
      font-weight: 800;
      color: #18181B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mayor-edit-profile-btn {
      border: 0;
      background: transparent;
      color: #2563EB;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 2px 4px;
      position: relative;
      flex-shrink: 0;
    }

    .mayor-edit-profile-btn::after {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #EF4444;
      position: absolute;
      top: 0;
      right: -4px;
    }

    .mayor-user-phone {
      font-size: 12.5px;
      color: #71717A;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }

    .mayor-mission-banner {
      background: linear-gradient(90deg, #CCFBF1 0%, #BAE6FD 55%, #7DD3FC 100%);
      border: 1px solid #93C5FD;
      border-radius: 14px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      transition: transform 0.16s ease;
      text-align: left;
      font-family: inherit;
    }

    .mayor-mission-banner:hover {
      transform: translateY(-1px);
    }

    .mayor-mission-banner b {
      font-size: 12.5px;
      font-weight: 700;
      color: #0F172A;
      line-height: 1.3;
    }

    .mayor-tier-points-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .mayor-tp-card {
      background: #FFFFFF;
      border: 1.5px solid #E4E4E7;
      border-radius: 16px;
      padding: 12px 15px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: border-color 0.16s ease, transform 0.16s ease;
      text-align: left;
      font-family: inherit;
    }

    .mayor-tp-card:hover {
      border-color: #6E828A;
      transform: translateY(-1px);
    }

    .mayor-tp-icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #F4F4F5;
      color: #3F3F46;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .mayor-tp-card small {
      display: block;
      font-size: 11.5px;
      color: #71717A;
      font-weight: 600;
    }

    .mayor-tp-card strong {
      display: block;
      font-size: 17px;
      font-weight: 800;
      color: #18181B;
    }

    .mayor-quick-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
      padding: 4px 2px;
    }

    .mayor-qstat-btn {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: transparent;
      border: 0;
      padding: 6px 4px;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: background 0.15s ease;
    }

    .mayor-qstat-btn:hover {
      background: rgba(110, 130, 138, 0.08);
    }

    .mayor-qstat-ico {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      background: #F1F5F9;
      color: #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .mayor-qstat-title {
      font-size: 14px;
      font-weight: 600;
      color: #18181B;
    }

    .mayor-qstat-title b {
      color: #2563EB;
      font-weight: 700;
      margin-left: 4px;
    }

    .mayor-qstat-sub {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #15803D;
      margin-top: 2px;
    }

    .mayor-menu-divider {
      height: 1px;
      background: #E4E4E7;
      margin: 2px 0;
    }

    .mayor-account-menu-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid #E4E4E7;
      padding-top: 10px;
    }

    .mayor-menu-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .mayor-menu-col:first-child {
      padding-right: 12px;
      border-right: 1px solid #E4E4E7;
    }

    .mayor-menu-col:last-child {
      padding-left: 12px;
    }

    .mayor-menu-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 8px;
      border-radius: 10px;
      border: 0;
      background: transparent;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      color: #18181B;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s ease;
    }

    .mayor-menu-link:hover {
      background: rgba(110, 130, 138, 0.10);
    }

    .mayor-menu-link i {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #F4F4F5;
      color: #52525B;
      display: flex;
      align-items: center;
      justify-content: center;
      font-style: normal;
      font-size: 13px;
      flex-shrink: 0;
    }

    .mayor-menu-link.logout {
      color: #DC2626;
      margin-top: auto;
    }

    /* Passport Stamps Grid */
    .mayor-passport-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    .mayor-stamp-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 8px 4px; border-radius: 12px; border: 1.5px dashed #C7B99E;
      background: #FAF4E6; cursor: pointer; transition: transform 0.16s ease, border-color 0.16s ease;
      font-family: inherit;
    }
    .mayor-stamp-btn.collected {
      border-style: solid; border-color: #6E828A; background: #FFFDF8;
    }
    .mayor-stamp-btn:hover { transform: translateY(-2px); }
    .mayor-stamp-seal {
      width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 11px; color: #fff; margin-bottom: 4px;
    }
    .mayor-stamp-btn b { font-size: 10.5px; color: #2B2118; }
    .mayor-stamp-btn small { font-size: 9px; color: #6E828A; font-weight: 700; }

    /* Tab 2: 3D Citizen Card */
    .mayor-id-split {
      display: grid;
      grid-template-columns: 1.08fr 1fr;
      gap: 20px;
      align-items: stretch;
    }
    .mayor-id-stage {
      background: radial-gradient(circle at 50% 42%, #FFFDF8 0%, #EFE4CE 100%);
      border: 1.5px solid #DFD0B4;
      border-radius: 18px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      min-height: 280px;
    }
    .mayor-id-canvas-host {
      width: 100%;
      height: 235px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    }
    .mayor-id-canvas-host:active { cursor: grabbing; }
    .mayor-id-toolbar {
      display: flex; gap: 8px; align-items: center; justify-content: space-between; width: 100%;
      padding-top: 6px; border-top: 1px dashed #D8C9AE; font-size: 11.5px; color: #5D4E3D;
    }
    .mayor-mini-btn {
      background: #FAF3E3; border: 1px solid #C8B89A; border-radius: 999px;
      padding: 4px 10px; font-size: 11px; font-weight: 700; color: #2E2218; cursor: pointer;
    }
    .mayor-mini-btn:hover { background: #EFE2C6; }

    .mayor-form-col {
      display: flex; flex-direction: column; gap: 10px; justify-content: space-between;
    }
    .mayor-field label {
      display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em;
      color: #6B5B4B; margin-bottom: 4px; text-transform: uppercase;
    }
    .mayor-input {
      width: 100%; padding: 9px 12px; border-radius: 10px; border: 1.5px solid #D5C5A8;
      background: #FFFDF9; font-family: inherit; font-size: 13.5px; font-weight: 600; color: #2B2118;
      box-sizing: border-box;
    }
    .mayor-input:focus { outline: none; border-color: #6E828A; }
    .mayor-role-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px;
    }
    .mayor-role-pill {
      text-align: left; padding: 7px 10px; border-radius: 10px; border: 1.5px solid #DFD0B4;
      background: #FAF4E8; cursor: pointer; font-family: inherit; transition: all 0.15s ease;
    }
    .mayor-role-pill.on {
      border-color: #6E828A; background: #E9F0F2; box-shadow: 0 2px 6px rgba(110,130,138,0.15);
    }
    .mayor-role-pill b { display: block; font-size: 12px; color: #2B2118; }
    .mayor-role-pill small { font-size: 10px; color: #6B5B4B; font-weight: 600; }

    /* Tab 3 & Tab 4 Lists */
    .mayor-list-row {
      background: #FFFDF9;
      border: 1.5px solid #E5D8BF;
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .mayor-cs-grid {
      display: grid; grid-template-columns: 1.18fr 0.82fr; gap: 16px; margin-top: 10px;
    }
    .mayor-faq-item {
      border: 1px solid #E2D4B8; border-radius: 11px; background: #FFFDF8;
      margin-bottom: 7px; overflow: hidden;
    }
    .mayor-faq-q {
      width: 100%; text-align: left; background: none; border: none; padding: 9px 12px;
      font-family: inherit; font-size: 12.5px; font-weight: 700; color: #2B2118;
      display: flex; justify-content: space-between; align-items: center; cursor: pointer;
    }
    .mayor-faq-a {
      padding: 0 12px 10px; font-size: 12px; line-height: 1.45; color: #5A4B3C;
    }
    .mayor-ticket-card {
      background: #FAF2DF; border: 2px dashed #8FA38A; border-radius: 16px;
      padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
    }
    .mayor-ticket-code {
      font-size: 26px; font-weight: 800; color: #2B2118; letter-spacing: 0.04em;
      background: #FFFDF8; padding: 6px 12px; border-radius: 10px; text-align: center;
      border: 1px solid #DFD0B4;
    }

    /* Clean Minimalist Google Login Modal (1:1 Reference Style) */
    .mayor-auth-backdrop {
      position: fixed;
      inset: 0;
      z-index: 250;
      background: rgba(17, 22, 34, 0.42);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .mayor-auth-modal {
      width: min(410px, 92vw);
      background: #FFFFFF;
      border: 1px solid #EAECEF;
      border-radius: 26px;
      padding: 38px 34px 32px;
      box-shadow: 0 28px 72px rgba(15, 20, 28, 0.22);
      color: #111622;
      text-align: center;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .mayor-auth-close-x {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 0;
      background: #F4F5F7;
      color: #6B7280;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .mayor-auth-close-x:hover {
      background: #E5E7EB;
      color: #111622;
    }
    .mayor-auth-app-logo {
      width: 48px;
      height: 48px;
      border-radius: 13px;
      background: #111622;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 22px rgba(17, 22, 34, 0.22);
      margin-bottom: 20px;
    }
    .mayor-auth-title {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111622;
    }
    .mayor-auth-sub {
      margin: 0 0 26px;
      font-size: 13.5px;
      font-weight: 500;
      color: #8A909E;
      line-height: 1.45;
    }
    .mayor-google-signin-only-btn {
      width: 100%;
      height: 50px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
      background: #FFFFFF;
      color: #111622;
      font-family: inherit;
      font-size: 14.5px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      position: relative;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(17, 22, 34, 0.04);
      transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
    }
    .mayor-google-signin-only-btn:hover {
      border-color: #CBD5E1;
      box-shadow: 0 6px 16px rgba(17, 22, 34, 0.08);
      transform: translateY(-1px);
    }
    .mayor-google-g-box {
      position: absolute;
      left: 9px;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #111622;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mayor-google-pill-top {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1.5px solid #DADCE0;
      background: #FFFFFF;
      color: #1F1F1F;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .mayor-google-pill-top:hover {
      border-color: #3B82F6;
      transform: translateY(-1px);
    }

    @media (max-width: 1024px), (orientation: portrait) {
      .mayor-buyer-hub {
        width: min(560px, 94vw);
        margin: 0 auto;
      }
      .mayor-profile-top,
      .mayor-id-split,
      .mayor-cs-grid,
      .mayor-account-menu-grid {
        grid-template-columns: 1fr;
      }
      .mayor-menu-col:first-child {
        padding-right: 0;
        border-right: 0;
        border-bottom: 1px solid #E4E4E7;
        padding-bottom: 8px;
      }
      .mayor-menu-col:last-child {
        padding-left: 0;
        padding-top: 6px;
      }
      .mayor-passport-grid {
        grid-template-columns: repeat(auto-fill, minmax(95px, 1fr));
      }
    }
  `;
  document.head.appendChild(styleEl);

  function setState(nextState, opts = {}) {
    state = nextState;
    if (opts.csCategory) csCategory = opts.csCategory;
    if (opts.subTabPesanan) subTabPesanan = opts.subTabPesanan;
    updateMayorCamera(state, !!opts.instant);
    renderUI();
    chime?.(540, 0.08);
  }

  function collectedStampsCount() {
    return stamps.filter(s => s.collected).length;
  }

  const GOOGLE_G_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>`;

  function renderAuthModal() {
    if (!authModalOpen) return '';
    return `
      <div class="mayor-auth-backdrop" id="mayor-auth-backdrop">
        <div class="mayor-auth-modal" role="dialog" aria-modal="true" aria-label="Welcome to Cerria Town">
          <button type="button" class="mayor-auth-close-x" id="mayor-auth-close" aria-label="Tutup">✕</button>

          <!-- Top Rounded App Logo (1:1 Reference Style) -->
          <div class="mayor-auth-app-logo">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="4" fill="#FFFFFF" stroke="none"/>
              <path d="M9 10v2M15 10v2" stroke="#111622" stroke-width="2.2"/>
              <path d="M9.5 15c1.2 1 3.8 1 5 0" stroke="#111622" stroke-width="2"/>
            </svg>
          </div>

          <h3 class="mayor-auth-title">Welcome to Cerria Town</h3>
          <p class="mayor-auth-sub">Please sign in or sign up with your Google account.</p>

          <!-- Single Clean "Sign in with Google" Button ONLY -->
          <button type="button" class="mayor-google-signin-only-btn" id="mayor-oauth-google">
            <span class="mayor-google-g-box">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 15.65 5 12c0-3.65 3.36-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"/>
              </svg>
            </span>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderUI() {
    const isBottomLeft = state !== 'HOME';
    const cfg = MAYOR_CATALOG;
    const themeColor = cfg.themeColor || '#6E828A';
    const brandTitle = cfg.brandTitle || 'Balai Warga';
    const brandSub = 'PUSAT AKUN & LAYANAN PEMBELI';
    const exitBtnLabel = state === 'HOME' ? '← Kembali ke Kota' : '← Kembali';

    overlay.dataset.state = state;
    overlay.innerHTML = `
      <div class="sc-backdrop ${isBottomLeft ? 'mode-bl' : 'mode-center'}"></div>

      <!-- Top Header Navigation (Clean Civic & Buyer Hub Tabs — Zero Store Clutter) -->
      <header class="sc-topbar">
        <div class="sc-brand-wrap">
          <button type="button" class="sc-exit-btn" id="mayor-exit-town">${exitBtnLabel}</button>
          <div class="sc-logo" id="mayor-logo-home">
            <span class="sc-logo-berry" style="background:${themeColor};color:#fff;display:flex;align-items:center;justify-content:center;border-radius:10px;width:32px;height:32px;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2l2.2 2.2H11v1.6l8 4.2v2h-1.5v7.5H19v2H5v-2h1.5V12H5v-2l8-4.2V4.2h-1.2L12 2zm0 6.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z"/>
              </svg>
            </span>
            <div>
              <strong>${brandTitle}</strong>
              <small>${brandSub}</small>
            </div>
          </div>
        </div>

        <nav class="sc-topnav" aria-label="Navigasi Akun & Balai Warga">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-mayor-nav="HOME">👤 Akun &amp; Profil</button>
          <button type="button" class="${state === 'PENDAFTARAN' ? 'on' : ''}" data-mayor-nav="PENDAFTARAN">🪪 Kartu Warga 3D</button>
          <button type="button" class="${state === 'PESANAN' ? 'on' : ''}" data-mayor-nav="PESANAN">📦 Pesanan &amp; Alamat (${buyer.orders.length})</button>
          <button type="button" class="${state === 'CS' ? 'on' : ''}" data-mayor-nav="CS">💬 Bantuan &amp; Retur</button>
        </nav>

        <div class="sc-top-stats">
          <button type="button" class="mayor-google-pill-top" id="mayor-top-google-btn">
            ${GOOGLE_G_SVG}
            <span>${buyer.loggedIn ? 'Akun Google' : 'Login Google'}</span>
          </button>
          <span class="sc-stat-pill"><i class="sc-dot-mayor"></i> ${getBuyerTier()} · ${buyer.points} Poin</span>
        </div>
      </header>

      <!-- Main Stage Area -->
      <div class="sc-stage">
        ${renderStateContent()}
      </div>

      <!-- Clean Bottom Bar -->
      <footer class="sc-bottombar">
        <button type="button" class="sc-exit-btn sc-bottom-exit-btn" id="mayor-exit-town-bottom">${exitBtnLabel}</button>
        <div class="sc-foot-brand">
          <span class="sc-dot-mayor"></span>
          <div>
            <b>${brandTitle}</b>
            <small>${brandSub}</small>
          </div>
        </div>
        <p class="sc-foot-quote">Pusat akun pembeli, buku alamat pengiriman, dan layanan terpadu 7 Pos Cerria Town. <span>★</span></p>
      </footer>

      ${renderAuthModal()}
    `;

    bindOverlayEvents();

    if (state === 'PENDAFTARAN') {
      const host = overlay.querySelector('#mayor-idcard-canvas-host');
      if (host) {
        ensureCitizenCardRenderer(host);
      }
    }
  }

  function renderStateContent() {
    const tierName = getBuyerTier();
    const activeVouchersCount = buyer.vouchers.filter(v => v.claimed).length;
    const initials = (buyer.name || 'PC')
      .split(/\s+/)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    // ========================================================================
    // TAB 1 — AKUN & PROFIL PEMBELI (Blibli Reference Inspired, Clean Layout)
    // ========================================================================
    if (state === 'HOME') {
      return `
        <section class="mayor-buyer-hub" aria-label="Pusat Akun Pembeli Cerria Town">
          <!-- Top Row: Profile Info + Mission Banner -->
          <div class="mayor-profile-top">
            <div class="mayor-user-box">
              <div class="mayor-avatar-badge">${escapeHtml(initials)}</div>
              <div class="mayor-user-meta">
                <div class="mayor-user-tag">
                  <span>cerria</span><span class="dot-gold"></span><span>warga</span>
                </div>
                <div class="mayor-user-name-row">
                  <strong>${escapeHtml(buyer.loggedIn ? buyer.name : 'Tamu Cerria Town')}</strong>
                  <button type="button" class="mayor-edit-profile-btn" id="mayor-open-auth">
                    ${buyer.loggedIn ? 'Ubah' : 'Masuk'}
                  </button>
                </div>
                <div class="mayor-user-phone">
                  <span>🔗</span>
                  <span>${escapeHtml(buyer.loggedIn ? buyer.phone : 'Tautkan nomor WA / Email')}</span>
                </div>
              </div>
            </div>

            <button type="button" class="mayor-mission-banner" data-mayor-nav="PENDAFTARAN">
              <div>
                <b>Kumpulkan 7 stempel pos &amp; dapatkan poin</b>
                <small style="display:block;font-size:11px;color:#1E3A8A;margin-top:2px">
                  Terkumpul ${collectedStampsCount()}/7 Pos · Klik buka paspor →
                </small>
              </div>
              <span style="font-size:22px">🎯</span>
            </button>
          </div>

          <!-- Tier & Poin Cards -->
          <div class="mayor-tier-points-grid">
            <button type="button" class="mayor-tp-card" data-mayor-nav="PENDAFTARAN">
              <div class="mayor-tp-icon">❖</div>
              <div>
                <small>Tier</small>
                <strong>${escapeHtml(tierName)}</strong>
              </div>
            </button>

            <button type="button" class="mayor-tp-card" data-pesanan-jump="vouchers">
              <div class="mayor-tp-icon">◎</div>
              <div>
                <small>Poin</small>
                <strong>${buyer.points.toLocaleString('id-ID')}</strong>
              </div>
            </button>
          </div>

          <!-- Quick Counters (Voucher, Ulasan, Wishlist, Kartu Warga — No PayLater!) -->
          <div class="mayor-quick-stats-grid">
            <button type="button" class="mayor-qstat-btn" data-pesanan-jump="vouchers">
              <span class="mayor-qstat-ico">🎟️</span>
              <div>
                <span class="mayor-qstat-title">Voucher <b>${activeVouchersCount}</b></span>
                <span class="mayor-qstat-sub">Gratis ongkir 3x</span>
              </div>
            </button>

            <button type="button" class="mayor-qstat-btn" data-cs-jump="pesan">
              <span class="mayor-qstat-ico">💬</span>
              <div>
                <span class="mayor-qstat-title">Ulasan <b>${buyer.reviewsCount}</b></span>
                <span style="display:block;font-size:11.5px;color:#71717A;margin-top:2px">Rating &amp; testimoni produk</span>
              </div>
            </button>

            <button type="button" class="mayor-qstat-btn" data-pesanan-jump="wishlist">
              <span class="mayor-qstat-ico">♥</span>
              <div>
                <span class="mayor-qstat-title">Wishlist <b>${buyer.wishlist.length}</b></span>
                <span style="display:block;font-size:11.5px;color:#71717A;margin-top:2px">Koleksi produk 3D disimpan</span>
              </div>
            </button>

            <button type="button" class="mayor-qstat-btn" data-mayor-nav="PENDAFTARAN">
              <span class="mayor-qstat-ico">🪪</span>
              <div>
                <span class="mayor-qstat-title">Kartu Warga <b>3D</b></span>
                <span style="display:block;font-size:11.5px;color:#71717A;margin-top:2px">ID ${escapeHtml(buyer.citizenIdCode)}</span>
              </div>
            </button>
          </div>

          <!-- Main Account Menu (2 Columns — Clean & Relevant to Cerria Town) -->
          <div class="mayor-account-menu-grid">
            <div class="mayor-menu-col">
              <button type="button" class="mayor-menu-link" data-pesanan-jump="orders">
                <i>📦</i>
                <span>Daftar pesanan (${buyer.orders.length})</span>
              </button>
              <button type="button" class="mayor-menu-link" data-pesanan-jump="favstores">
                <i>🏪</i>
                <span>Toko favorit (${buyer.favStores.length})</span>
              </button>
              <button type="button" class="mayor-menu-link" data-pesanan-jump="addresses">
                <i>📒</i>
                <span>Alamat pengiriman (${buyer.addresses.length})</span>
              </button>
            </div>

            <div class="mayor-menu-col">
              <button type="button" class="mayor-menu-link" data-cs-jump="retur">
                <i>🔄</i>
                <span>Retur produk</span>
              </button>
              <button type="button" class="mayor-menu-link" data-cs-jump="panduan">
                <i>🛡️</i>
                <span>Pusat bantuan &amp; CS</span>
              </button>
              <button type="button" class="mayor-menu-link ${buyer.loggedIn ? 'logout' : ''}" id="mayor-toggle-login">
                <i>↪</i>
                <span>${buyer.loggedIn ? 'Keluar' : 'Masuk Akun'}</span>
              </button>
            </div>
          </div>
        </section>
      `;
    }

    // ========================================================================
    // TAB 2 — KARTU WARGA 3D & PASPOR 7 STEMPEL
    // ========================================================================
    if (state === 'PENDAFTARAN') {
      const activeRole = MAYOR_ROLES[buyer.roleIdx] || MAYOR_ROLES[0];
      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-mayor-nav="HOME">← KEMBALI KE AKUN</button>
          <h1 class="sc-calligraphy-sm">Kartu Warga 3D</h1>
          <p class="sc-kicker">PUTAR 360° &nbsp;·&nbsp; PASPOR 7 POS</p>
        </aside>

        <section class="sc-right-panel sc-card">
          <div class="sc-menu-bar" style="margin-bottom:12px">
            <span class="sc-section-tag">KARTU IDENTITAS PEMBELI 3D &amp; PASPOR STEMPEL KOTA</span>
            <span class="sc-stat-pill" style="background:#E9F0F2;color:#2E2218;font-weight:700">No. ID: ${escapeHtml(buyer.citizenIdCode)}</span>
          </div>

          <div class="mayor-id-split">
            <div class="mayor-id-stage">
              <div class="mayor-id-canvas-host" id="mayor-idcard-canvas-host"></div>
              <div class="mayor-id-toolbar">
                <span>‹ Geser untuk memutar Kartu 360° (Depan &amp; Belakang) ›</span>
                <div style="display:flex;gap:6px">
                  <button type="button" class="mayor-mini-btn" id="mayor-flip-card">Balik Sisi ↻</button>
                  <button type="button" class="mayor-mini-btn" id="mayor-spin-card">${cardAutoSpin ? 'Jeda Putar' : 'Putar Otomatis'}</button>
                </div>
              </div>
            </div>

            <div class="mayor-form-col">
              <div class="mayor-field">
                <label for="mayor-citizen-name">Nama Lengkap Pembeli (Tercetak Real-Time di Kartu 3D)</label>
                <input
                  id="mayor-citizen-name"
                  class="mayor-input"
                  type="text"
                  maxlength="24"
                  value="${escapeHtml(buyer.name)}"
                  placeholder="Masukkan nama Anda..."
                />
              </div>

              <div class="mayor-field">
                <label>Pilih Gelar &amp; Destinasi Favorit</label>
                <div class="mayor-role-grid">
                  ${MAYOR_ROLES.map((r, idx) => `
                    <button type="button" class="mayor-role-pill ${idx === buyer.roleIdx ? 'on' : ''}" data-role-idx="${idx}">
                      <b>${r.label}</b>
                      <small>${r.favPos}</small>
                    </button>
                  `).join('')}
                </div>
              </div>

              <div style="background:#FAF3E3;border:1px solid #DFD0B4;border-radius:12px;padding:8px 12px;font-size:11.5px;color:#4A3B2C">
                <b>Stempel Paspor 7 Pos (${collectedStampsCount()}/7):</b> Klik cap di bawah untuk verifikasi kunjungan dan klaim +50 Poin!
                <div class="mayor-passport-grid">
                  ${stamps.map((st, idx) => `
                    <button type="button" class="mayor-stamp-btn ${st.collected ? 'collected' : ''}" data-stamp-idx="${idx}" title="${st.name}">
                      <span class="mayor-stamp-seal" style="background:${st.collected ? st.color : '#C5B8A2'}">${st.pos}</span>
                      <b>${st.name.split(' ')[0]}</b>
                      <small>${st.collected ? 'SAH ✓' : 'CAP'}</small>
                    </button>
                  `).join('')}
                </div>
              </div>

              <div style="display:flex;gap:10px;align-items:center">
                <button type="button" class="sc-add-bag-btn" style="background:#53666E;flex:1" id="mayor-register-btn">
                  ✓ SIMPAN PROFIL &amp; PERBARUI KARTU WARGA (${activeRole.badge})
                </button>
              </div>
            </div>
          </div>
        </section>
      `;
    }

    // ========================================================================
    // TAB 3 — PESANAN, BUKU ALAMAT, VOUCHER, WISHLIST & TOKO FAVORIT
    // ========================================================================
    if (state === 'PESANAN') {
      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-mayor-nav="HOME">← KEMBALI KE AKUN</button>
          <h1 class="sc-calligraphy-sm">Pesanan &amp; Alamat</h1>
          <p class="sc-kicker">RIWAYAT BELANJA &nbsp;·&nbsp; BUKU ALAMAT</p>
        </aside>

        <section class="sc-right-panel sc-card">
          <div class="sc-menu-bar" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div>
              <span class="sc-section-tag">AKTIVITAS BELANJA &amp; PENGIRIMAN PEMBELI</span>
              <h2 style="margin:2px 0 0;font-size:19px;color:#2B2118">Daftar Pesanan, Alamat, Voucher &amp; Favorit</h2>
            </div>
            <div class="sc-filter-pills">
              <button type="button" class="${subTabPesanan === 'orders' ? 'on' : ''}" data-sub-pesanan="orders">📦 Pesanan (${buyer.orders.length})</button>
              <button type="button" class="${subTabPesanan === 'addresses' ? 'on' : ''}" data-sub-pesanan="addresses">📒 Alamat (${buyer.addresses.length})</button>
              <button type="button" class="${subTabPesanan === 'vouchers' ? 'on' : ''}" data-sub-pesanan="vouchers">🎟️ Voucher (${buyer.vouchers.length})</button>
              <button type="button" class="${subTabPesanan === 'wishlist' ? 'on' : ''}" data-sub-pesanan="wishlist">♥ Wishlist (${buyer.wishlist.length})</button>
              <button type="button" class="${subTabPesanan === 'favstores' ? 'on' : ''}" data-sub-pesanan="favstores">🏪 Toko Favorit</button>
            </div>
          </div>

          ${subTabPesanan === 'orders' ? `
            <div style="max-height:340px;overflow-y:auto;padding-right:4px">
              ${buyer.orders.length === 0 ? `
                <div class="mayor-list-row">
                  <span>Belum ada riwayat pesanan. Silakan berbelanja di Toko #1 s/d #6.</span>
                </div>
              ` : buyer.orders.map(ord => `
                <div class="mayor-list-row">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                      <strong style="font-size:14px;color:#18181B">${escapeHtml(ord.storeName)}</strong>
                      <span class="sc-stat-pill" style="font-size:10.5px;background:#E9F0F2;color:#334155">${escapeHtml(ord.orderId)}</span>
                      <span class="sc-stat-pill" style="font-size:10.5px;background:#DCFCE7;color:#166534">${escapeHtml(ord.status)}</span>
                    </div>
                    <div style="font-size:12.5px;color:#475569">${escapeHtml(ord.itemsSummary)}</div>
                    <small style="font-size:11px;color:#71717A">${escapeHtml(ord.date)}</small>
                  </div>
                  <div style="text-align:right">
                    <strong style="display:block;font-size:14.5px;color:#18181B;margin-bottom:5px">${formatIDR(ord.total)}</strong>
                    <button type="button" class="mayor-mini-btn" data-retur-order="${escapeHtml(ord.orderId)}">Ajukan Retur / Bantuan</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${subTabPesanan === 'addresses' ? `
            <div>
              <div style="max-height:215px;overflow-y:auto;margin-bottom:12px">
                ${buyer.addresses.map((addr, idx) => `
                  <div class="mayor-list-row">
                    <div>
                      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                        <strong style="font-size:13.5px">${escapeHtml(addr.label)} — ${escapeHtml(addr.recipient)}</strong>
                        <span style="font-size:12px;color:#64748B">${escapeHtml(addr.phone)}</span>
                        ${addr.isDefault ? '<span class="sc-stat-pill" style="font-size:10px;background:#DBEAFE;color:#1D4ED8">Utama · Auto-Fill Checkout</span>' : ''}
                      </div>
                      <div style="font-size:12.5px;color:#475569">${escapeHtml(addr.address)}</div>
                    </div>
                    <div style="display:flex;gap:6px">
                      ${!addr.isDefault ? `<button type="button" class="mayor-mini-btn" data-addr-default="${idx}">Jadikan Utama</button>` : ''}
                      ${buyer.addresses.length > 1 ? `<button type="button" class="mayor-mini-btn" style="color:#DC2626" data-addr-del="${idx}">Hapus</button>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="background:#FAF4E6;border:1.5px solid #DFD0B4;border-radius:14px;padding:12px">
                <strong style="display:block;font-size:12.5px;margin-bottom:8px">Tambah / Perbarui Alamat Pengiriman Baru</strong>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
                  <input id="mayor-new-addr-label" class="mayor-input" type="text" placeholder="Label (Rumah / Kantor)" value="Rumah" />
                  <input id="mayor-new-addr-name" class="mayor-input" type="text" placeholder="Nama Penerima" value="${escapeHtml(buyer.name)}" />
                  <input id="mayor-new-addr-phone" class="mayor-input" type="tel" placeholder="No. WhatsApp" value="${escapeHtml(buyer.phone)}" />
                </div>
                <div style="display:flex;gap:8px">
                  <input id="mayor-new-addr-full" class="mayor-input" type="text" placeholder="Tulis alamat lengkap pengiriman..." />
                  <button type="button" class="sc-pill-cta" style="background:#53666E;white-space:nowrap" id="mayor-add-address-btn">+ Simpan Alamat</button>
                </div>
              </div>
            </div>
          ` : ''}

          ${subTabPesanan === 'vouchers' ? `
            <div style="max-height:330px;overflow-y:auto">
              ${buyer.vouchers.map((v, idx) => `
                <div class="mayor-list-row">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                      <strong style="font-size:14px">${escapeHtml(v.title)}</strong>
                      <span class="sc-stat-pill" style="font-size:10.5px;background:#DCFCE7;color:#15803D">${escapeHtml(v.badge)}</span>
                    </div>
                    <div style="font-size:12px;color:#57534E">${escapeHtml(v.sub)} · Kode: <b>${escapeHtml(v.code)}</b></div>
                  </div>
                  <button type="button" class="mayor-mini-btn" data-toggle-voucher="${idx}">
                    ${v.claimed ? '✓ Aktif di Checkout' : 'Klaim Voucher'}
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${subTabPesanan === 'wishlist' ? `
            <div style="max-height:330px;overflow-y:auto">
              ${buyer.wishlist.map(w => `
                <div class="mayor-list-row">
                  <div>
                    <strong style="font-size:14px;display:block">${escapeHtml(w.name)}</strong>
                    <span style="font-size:12px;color:#57534E">${escapeHtml(w.storeName)} · <b>${escapeHtml(w.price)}</b></span>
                  </div>
                  <button type="button" class="sc-pill-cta" style="background:#53666E;padding:7px 14px;font-size:12px" data-jump-store="${escapeHtml(w.hash)}">
                    Kunjungi Toko →
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${subTabPesanan === 'favstores' ? `
            <div style="max-height:330px;overflow-y:auto">
              ${buyer.favStores.map(fs => `
                <div class="mayor-list-row">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="width:14px;height:14px;border-radius:50%;background:${fs.color};display:inline-block"></span>
                    <div>
                      <strong style="font-size:14px;display:block">${escapeHtml(fs.name)}</strong>
                      <span style="font-size:12px;color:#57534E">${escapeHtml(fs.category)}</span>
                    </div>
                  </div>
                  <button type="button" class="sc-pill-cta" style="background:#53666E;padding:7px 14px;font-size:12px" data-jump-store="${escapeHtml(fs.hash)}">
                    Teleport ke Toko →
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </section>
      `;
    }

    // ========================================================================
    // TAB 4 — BANTUAN, RETUR PRODUK & TIKET LAYANAN CS
    // ========================================================================
    const catObj =
      csCategory === 'retur'
        ? {
            title: 'Pengajuan Retur Produk & Garansi Pesanan',
            badge: 'PROTEKSI PEMBELI 100%'
          }
        : MAYOR_CS_CATEGORIES[csCategory] || MAYOR_CS_CATEGORIES.produk;

    return `
      <aside class="sc-left-sub">
        <button type="button" class="sc-back-link" data-mayor-nav="HOME">← KEMBALI KE AKUN</button>
        <h1 class="sc-calligraphy-sm">Bantuan &amp; Retur</h1>
        <p class="sc-kicker">RETUR PRODUK &nbsp;·&nbsp; ULASAN &amp; TIKET CS</p>
      </aside>

      <section class="sc-right-panel sc-card">
        <div class="sc-menu-bar" style="margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div>
            <span class="sc-section-tag">PUSAT BANTUAN &amp; KOMPLAIN PEMBELI · BALAI WARGA</span>
            <h2 style="margin:2px 0 0;font-size:19px;color:#2B2118">Retur Produk, Ulasan &amp; Tiket Customer Service</h2>
          </div>
          <div class="sc-filter-pills">
            <button type="button" class="${csCategory === 'retur' ? 'on' : ''}" data-cs-cat="retur">🔄 RETUR PRODUK</button>
            <button type="button" class="${csCategory === 'pesan' ? 'on' : ''}" data-cs-cat="pesan">⭐ ULASAN &amp; PESAN</button>
            <button type="button" class="${csCategory === 'panduan' ? 'on' : ''}" data-cs-cat="panduan">📖 PANDUAN KOTA</button>
          </div>
        </div>

        <div class="mayor-cs-grid">
          <div>
            <div style="background:#FAF4E6;border:1.5px solid #DFD0B4;border-radius:14px;padding:12px;margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong style="font-size:14px;color:#2B2118">${catObj.title}</strong>
                <span class="sc-stat-pill" style="font-size:10px;padding:3px 8px">${catObj.badge}</span>
              </div>

              ${csCategory === 'retur' || csCategory === 'pesan' ? `
                <div style="display:flex;flex-direction:column;gap:8px">
                  <input id="mayor-cs-sender" class="mayor-input" type="text" value="${escapeHtml(buyer.name)}" placeholder="Nama Pembeli..." />
                  <input id="mayor-cs-note" class="mayor-input" type="text" placeholder="${csCategory === 'retur' ? 'Masukkan ID Pesanan (misal ORD-CT-8821) & alasan retur/penukaran...' : 'Tulis ulasan kepuasan belanja atau pesan ke Balai Warga...'}" />
                  <button type="button" class="sc-pill-cta" style="background:#53666E;align-self:flex-start" id="mayor-send-msg">
                    ${csCategory === 'retur' ? 'AJUKAN RETUR & CETAK TIKET →' : 'KIRIM ULASAN & DAPATKAN +25 POIN →'}
                  </button>
                </div>
              ` : `
                <div style="display:flex;flex-direction:column;gap:8px">
                  ${(catObj.items || []).map(it => `
                    <div style="background:#FFFDF9;border:1px solid #E5D8BF;border-radius:10px;padding:8px 10px">
                      <b style="font-size:12.5px;color:#2B2118;display:block;margin-bottom:2px">${it.head}</b>
                      <span style="font-size:11.5px;color:#5A4B3C;line-height:1.4">${it.body}</span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <div>
              <span class="sc-section-tag" style="display:block;margin-bottom:6px">PERTANYAAN UMUM PEMBELI (FAQ)</span>
              ${MAYOR_FAQS.map((f, idx) => `
                <div class="mayor-faq-item">
                  <button type="button" class="mayor-faq-q" data-faq-idx="${idx}">
                    <span>${f.q}</span>
                    <b>${openFaqIdx === idx ? '−' : '+'}</b>
                  </button>
                  ${openFaqIdx === idx ? `<div class="mayor-faq-a">${f.a}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="mayor-ticket-card">
            <div>
              <span class="sc-eyebrow" style="color:#53666E">STRUK NOMOR TIKET LAYANAN</span>
              <h3 style="margin:4px 0 8px;font-size:16px;color:#2B2118">Loket Bantuan &amp; Retur</h3>
              <div class="mayor-ticket-code">${escapeHtml(currentTicket.code)}</div>
            </div>

            <div style="font-size:12px;color:#3B2E22;line-height:1.55;border-top:1px dashed #C7B99E;border-bottom:1px dashed #C7B99E;padding:8px 0">
              <div><b>Pembeli:</b> ${escapeHtml(currentTicket.sender)}</div>
              <div><b>Layanan:</b> ${escapeHtml(currentTicket.category)}</div>
              <div><b>Keterangan:</b> ${escapeHtml(currentTicket.note)}</div>
              <div><b>Waktu:</b> ${escapeHtml(currentTicket.time)}</div>
              <div style="color:#2E7D47;font-weight:700;margin-top:4px">● ${escapeHtml(currentTicket.status)}</div>
            </div>

            <div style="display:flex;flex-direction:column;gap:7px">
              <button type="button" class="sc-add-bag-btn" style="background:#53666E;width:100%" id="mayor-new-ticket">
                🖨 CETAK NOMOR TIKET BARU
              </button>
              <button type="button" class="mayor-mini-btn" style="width:100%;padding:7px" data-mayor-nav="HOME">
                ← Kembali ke Akun Pembeli
              </button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function bindOverlayEvents() {
    const handleBackOrExit = () => {
      if (state === 'HOME') {
        exit();
      } else {
        setState('HOME');
      }
    };
    overlay.querySelector('#mayor-exit-town')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#mayor-exit-town-bottom')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#mayor-logo-home')?.addEventListener('click', () => setState('HOME'));

    overlay.querySelectorAll('[data-mayor-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        setState(btn.dataset.mayorNav);
      });
    });

    overlay.querySelectorAll('[data-pesanan-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        setState('PESANAN', { subTabPesanan: btn.dataset.pesananJump });
      });
    });

    overlay.querySelectorAll('[data-sub-pesanan]').forEach(btn => {
      btn.addEventListener('click', () => {
        subTabPesanan = btn.dataset.subPesanan;
        renderUI();
        chime?.(520, 0.07);
      });
    });

    overlay.querySelectorAll('[data-cs-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        setState('CS', { csCategory: btn.dataset.csJump });
      });
    });

    overlay.querySelectorAll('[data-retur-order]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ordId = btn.dataset.returOrder;
        csCategory = 'retur';
        ticketCounter++;
        currentTicket = {
          code: `RT-0${ticketCounter}`,
          sender: buyer.name,
          category: 'Pengajuan Retur Pesanan',
          note: `Pemeriksaan retur untuk pesanan #${ordId}`,
          time: 'Baru saja · Loket Retur Balai Warga',
          status: 'MENUNGGU VERIFIKASI ADMIN'
        };
        setState('CS', { csCategory: 'retur' });
      });
    });

    // Teleport directly to a store from Wishlist or Favorite Stores
    overlay.querySelectorAll('[data-jump-store]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetHash = btn.dataset.jumpStore || '#toko1';
        exit();
        window.location.hash = targetHash;
      });
    });

    // Auth Modal Controls
    const openGoogleAuthModal = () => {
      authModalOpen = true;
      renderUI();
      chime?.(580, 0.08);
    };
    overlay.querySelector('#mayor-open-auth')?.addEventListener('click', openGoogleAuthModal);
    overlay.querySelector('#mayor-top-google-btn')?.addEventListener('click', openGoogleAuthModal);
    overlay.querySelector('#mayor-auth-close')?.addEventListener('click', () => {
      authModalOpen = false;
      renderUI();
    });
    overlay.querySelector('#mayor-auth-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'mayor-auth-backdrop') {
        authModalOpen = false;
        renderUI();
      }
    });
    overlay.querySelector('#mayor-auth-cancel')?.addEventListener('click', () => {
      authModalOpen = false;
      renderUI();
    });
    const completeGoogleSignIn = () => {
      const nVal = overlay.querySelector('#mayor-auth-name')?.value?.trim();
      const pVal = overlay.querySelector('#mayor-auth-phone')?.value?.trim();
      const eVal = overlay.querySelector('#mayor-auth-email')?.value?.trim();
      if (nVal) buyer.name = nVal;
      if (pVal) buyer.phone = pVal;
      if (eVal) buyer.email = eVal;
      buyer.loggedIn = true;
      buyer.authMethod = 'Google OAuth';
      if (buyer.addresses[0]) {
        buyer.addresses[0].recipient = buyer.name;
        buyer.addresses[0].phone = buyer.phone;
      }
      saveBuyerState();
      drawCitizenCardFrontTexture();
      authModalOpen = false;
      renderUI();
      chime?.(720, 0.11);
    };
    overlay.querySelector('#mayor-oauth-google')?.addEventListener('click', completeGoogleSignIn);
    overlay.querySelector('#mayor-oauth-google-btn')?.addEventListener('click', completeGoogleSignIn);
    overlay.querySelector('#mayor-oauth-wa')?.addEventListener('click', () => {
      buyer.loggedIn = true;
      buyer.authMethod = 'WhatsApp OTP';
      saveBuyerState();
      authModalOpen = false;
      renderUI();
      chime?.(720, 0.11);
    });
    overlay.querySelector('#mayor-auth-save')?.addEventListener('click', () => {
      const nVal = overlay.querySelector('#mayor-auth-name')?.value?.trim();
      const pVal = overlay.querySelector('#mayor-auth-phone')?.value?.trim();
      const eVal = overlay.querySelector('#mayor-auth-email')?.value?.trim();
      if (nVal) buyer.name = nVal;
      if (pVal) buyer.phone = pVal;
      if (eVal) buyer.email = eVal;
      buyer.loggedIn = true;
      if (buyer.addresses[0]) {
        buyer.addresses[0].recipient = buyer.name;
        buyer.addresses[0].phone = buyer.phone;
      }
      saveBuyerState();
      drawCitizenCardFrontTexture();
      authModalOpen = false;
      renderUI();
      chime?.(740, 0.12);
    });

    // Login / Logout Toggle
    overlay.querySelector('#mayor-toggle-login')?.addEventListener('click', () => {
      if (buyer.loggedIn) {
        buyer.loggedIn = false;
        saveBuyerState();
        renderUI();
        chime?.(420, 0.08);
      } else {
        authModalOpen = true;
        renderUI();
        chime?.(580, 0.08);
      }
    });

    // Address Book Management
    overlay.querySelector('#mayor-add-address-btn')?.addEventListener('click', () => {
      const lbl = overlay.querySelector('#mayor-new-addr-label')?.value?.trim() || 'Rumah';
      const rec = overlay.querySelector('#mayor-new-addr-name')?.value?.trim() || buyer.name;
      const ph = overlay.querySelector('#mayor-new-addr-phone')?.value?.trim() || buyer.phone;
      const full = overlay.querySelector('#mayor-new-addr-full')?.value?.trim();
      if (!full) return;
      buyer.addresses.forEach(a => { a.isDefault = false; });
      buyer.addresses.unshift({
        id: `addr-${Date.now()}`,
        label: lbl,
        recipient: rec,
        phone: ph,
        address: full,
        isDefault: true
      });
      saveBuyerState();
      renderUI();
      chime?.(680, 0.1);
    });

    overlay.querySelectorAll('[data-addr-default]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.addrDefault, 10);
        buyer.addresses.forEach((a, i) => { a.isDefault = i === idx; });
        saveBuyerState();
        renderUI();
        chime?.(600, 0.08);
      });
    });

    overlay.querySelectorAll('[data-addr-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.addrDel, 10);
        if (buyer.addresses.length <= 1) return;
        buyer.addresses.splice(idx, 1);
        if (!buyer.addresses.some(a => a.isDefault) && buyer.addresses[0]) {
          buyer.addresses[0].isDefault = true;
        }
        saveBuyerState();
        renderUI();
        chime?.(460, 0.08);
      });
    });

    overlay.querySelectorAll('[data-toggle-voucher]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.toggleVoucher, 10);
        if (buyer.vouchers[idx]) {
          buyer.vouchers[idx].claimed = !buyer.vouchers[idx].claimed;
          saveBuyerState();
          renderUI();
          chime?.(640, 0.08);
        }
      });
    });

    // Stamp Passport Events
    overlay.querySelectorAll('[data-stamp-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.stampIdx, 10);
        if (stamps[idx]) {
          stamps[idx].collected = !stamps[idx].collected;
          if (stamps[idx].collected) buyer.points += 50;
          saveBuyerState();
          drawCitizenCardBackTexture();
          drawCitizenCardFrontTexture();
          renderUI();
          chime?.(620, 0.09);
        }
      });
    });

    // Live Real-Time Name Input on 3D Citizen ID Card
    const nameInput = overlay.querySelector('#mayor-citizen-name');
    if (nameInput) {
      nameInput.addEventListener('input', e => {
        buyer.name = e.target.value || 'Pelanggan Cerria';
        saveBuyerState();
        drawCitizenCardFrontTexture();
      });
    }

    overlay.querySelectorAll('[data-role-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        buyer.roleIdx = parseInt(btn.dataset.roleIdx, 10);
        saveBuyerState();
        cardAutoSpin = false;
        cardRotY = -0.15;
        renderUI();
        chime?.(580, 0.08);
      });
    });

    overlay.querySelector('#mayor-flip-card')?.addEventListener('click', () => {
      cardAutoSpin = false;
      cardRotY += Math.PI;
      chime?.(520, 0.07);
    });

    overlay.querySelector('#mayor-spin-card')?.addEventListener('click', e => {
      cardAutoSpin = !cardAutoSpin;
      e.currentTarget.textContent = cardAutoSpin ? 'Jeda Putar' : 'Putar Otomatis';
    });

    overlay.querySelector('#mayor-register-btn')?.addEventListener('click', () => {
      buyer.loggedIn = true;
      saveBuyerState();
      drawCitizenCardFrontTexture();
      renderUI();
      chime?.(760, 0.14);
      const role = MAYOR_ROLES[buyer.roleIdx] || MAYOR_ROLES[0];
      submitOrder('toko7', [{ id: role?.id || 'explorer', name: role?.label || 'Kartu Warga', qty: 1 }], {
        channel: 'mayor_office',
        citizenName: buyer.name,
        citizenIdCode: buyer.citizenIdCode
      });
    });

    // Customer Service & Return Events
    overlay.querySelectorAll('[data-cs-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        csCategory = btn.dataset.csCat;
        renderUI();
        chime?.(520, 0.07);
      });
    });

    overlay.querySelectorAll('[data-faq-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.faqIdx, 10);
        openFaqIdx = openFaqIdx === idx ? -1 : idx;
        renderUI();
        chime?.(490, 0.06);
      });
    });

    const issueNewTicket = (customSender, customNote) => {
      ticketCounter++;
      const isRetur = csCategory === 'retur';
      currentTicket = {
        code: `${isRetur ? 'RT' : 'CS'}-0${ticketCounter}`,
        sender: (customSender || buyer.name || 'Pelanggan Cerria').trim(),
        category: isRetur ? 'Pengajuan Retur & Garansi Produk' : 'Ulasan & Layanan Pembeli',
        note: (customNote || 'Pemeriksaan layanan pembeli di Balai Warga').trim(),
        time: 'Baru saja · Loket Utama Balai Warga',
        status: 'TERCETAK · SIAP DILAYANI'
      };
      if (csCategory === 'pesan') {
        buyer.reviewsCount += 1;
        buyer.points += 25;
        saveBuyerState();
      }
      renderUI();
      chime?.(710, 0.12);
    };

    overlay.querySelector('#mayor-new-ticket')?.addEventListener('click', () => {
      issueNewTicket();
    });

    overlay.querySelector('#mayor-send-msg')?.addEventListener('click', () => {
      const senderVal = overlay.querySelector('#mayor-cs-sender')?.value;
      const noteVal = overlay.querySelector('#mayor-cs-note')?.value;
      issueNewTicket(senderVal, noteVal);
    });
  }

  let onExitCallback = null;

  function enter(exitCb) {
    onExitCallback = exitCb;
    active = true;
    const mayorBuildingGroup = stores[6]?.g;
    if (mayorBuildingGroup) {
      if (savedVillageRotY === null) {
        savedVillageRotY = mayorBuildingGroup.rotation.y;
      }
      mayorBuildingGroup.scale.set(1, 1, 1);
    }
    document.getElementById('app')?.classList.add('sc-mode-active');
    overlay.style.display = 'flex';
    camAnim.curPos.copy(camera.position);
    camAnim.curTarget.copy(controls.target);
    camAnim.curOffsetX = 0;
    camAnim.curOffsetY = 0;
    camera.clearViewOffset();
    setState('HOME', { instant: false });
  }

  function exit() {
    if (!active) return;
    active = false;
    authModalOpen = false;
    overlay.style.display = 'none';
    document.getElementById('app')?.classList.remove('sc-mode-active');
    const mayorBuildingGroup = stores[6]?.g;
    if (mayorBuildingGroup) {
      mayorBuildingGroup.scale.set(1, 1, 1);
      if (savedVillageRotY !== null) {
        mayorBuildingGroup.rotation.y = savedVillageRotY;
        mayorBuildingGroup.updateMatrixWorld(true);
      }
    }
    camAnim.fromOffsetX = camAnim.toOffsetX = camAnim.curOffsetX = 0;
    camAnim.fromOffsetY = camAnim.toOffsetY = camAnim.curOffsetY = 0;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    onExitCallback?.();
  }

  function update(now, dt) {
    if (!active) return;

    const elapsed = now - camAnim.t0;
    const u = Math.min(1, Math.max(0, elapsed / camAnim.dur));
    const k = cubicBezierEase(u);

    camAnim.curPos.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
    camAnim.curTarget.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
    camAnim.curOffsetX = camAnim.fromOffsetX + (camAnim.toOffsetX - camAnim.fromOffsetX) * k;
    camAnim.curOffsetY = camAnim.fromOffsetY + (camAnim.toOffsetY - camAnim.fromOffsetY) * k;

    const mayorBuildingGroup = stores[6]?.g;
    if (mayorBuildingGroup) mayorBuildingGroup.scale.set(1, 1, 1);

    applyCurrentViewOffset();

    camera.position.copy(camAnim.curPos);
    controls.target.copy(camAnim.curTarget);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    if (state === 'PENDAFTARAN' && cardRenderer && cardScene && cardCam && cardPivot) {
      if (cardAutoSpin && !cardDragging) {
        cardRotY += dt * 0.62;
      }
      cardPivot.rotation.set(cardRotX, cardRotY, 0);
      cardRenderer.render(cardScene, cardCam);
    }
  }

  return {
    get isActive() { return active; },
    enter,
    exit,
    update,
    setState,
    updateMayorCamera
  };
}
