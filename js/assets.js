// js/assets.js
// Procedural High-DPI Canvas Textures & Custom Asset Override Loader

class AssetManager {
  constructor() {
    this.customImages = {};
    this.tileTextures = {};
    this.diceTextures = {};
    this.emblemImages = {};
    this._emblemListeners = [];
    this.loadCustomEmblems();
  }

  // Load element symbols from assets/emblems/<element>.(png|webp|svg) safely for WebGL
  async loadCustomOverrides() {
    const isHttp =
      window.location.protocol === 'http:' ||
      window.location.protocol === 'https:';
    if (!isHttp) return;

    const loadImgFromUrl = (key, url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.customImages[key] = img;
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = url;
      });

    const tryLoadCustomAsset = async (key, baseName) => {
      if (await loadImgFromUrl(key, `assets/custom/${baseName}.webp`))
        return true;
      if (await loadImgFromUrl(key, `assets/custom/${baseName}.png`))
        return true;
      return false;
    };

    const archonIds = [
      'venti',
      'zhongli',
      'raiden',
      'nahida',
      'furina',
      'mavuika',
      'tsaritsa',
      'columbina',
    ];
    await Promise.all(archonIds.map((id) => tryLoadCustomAsset(id, id)));

    const boardKeys = [
      'anemo',
      'geo',
      'electro',
      'dendro',
      'hydro',
      'pyro',
      'lunar',
      'cryo',
      'primogem',
      'mondstadt',
      'liyue',
      'inazuma',
      'sumeru',
      'fontaine',
      'natlan',
      'nodkrai',
      'snezhnaya',
      'chasm',
      'enkanomiya',
      'bygone_eras',
      'sacred_mountain',
      'adventurers_guild',
      'meropide',
      'temple_of_space',
      'frost_moon',
      'intertwined_fate',
      'serenitea_pot',
      'gardes',
      'dori',
      'northland_bank',
    ];
    await Promise.all(
      boardKeys.map(async (key) => {
        if (await loadImgFromUrl(key, `assets/emblems/${key}.webp`)) return;
        if (await loadImgFromUrl(key, `assets/emblems/${key}.png`)) return;
        try {
          const res = await fetch(`assets/emblems/${key}.svg`);
          if (!res.ok) return;
          let svgText = await res.text();
          if (!/<svg[^>]*\bwidth=/i.test(svgText)) {
            svgText = svgText.replace(
              /<svg\b/i,
              '<svg width="256" height="256"',
            );
          }
          const dataUrl =
            'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
          await loadImgFromUrl(key, dataUrl);
        } catch (_) {}
      }),
    );

    try {
      const res = await fetch('assets/custom/manifest.json');
      if (!res.ok) return;
      const manifest = await res.json();
      const entries = Object.entries(manifest.overrides || {});
      await Promise.all(
        entries.map(([key, filename]) =>
          filename
            ? loadImgFromUrl(key.toLowerCase(), `assets/custom/${filename}`)
            : Promise.resolve(false),
        ),
      );
    } catch (_) {}
  }

  drawElementGlyph(ctx, element, cx, cy, r, color) {
    ctx.save();
    ctx.translate(cx, cy);

    const key = (element || '').toLowerCase();
    const customImg = this.customImages[key] || this.emblemImages[key];
    if (customImg && customImg.complete && customImg.naturalWidth > 0) {
      const size = r * 1.85;
      ctx.drawImage(customImg, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element) {
      case 'Anemo': {
        // Winged wind spiral
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.58, -Math.PI * 0.8, Math.PI * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, Math.PI * 0.2, Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, -r * 0.15);
        ctx.quadraticCurveTo(-r * 0.35, -r * 0.5, 0, -r * 0.15);
        ctx.quadraticCurveTo(r * 0.35, -r * 0.5, r * 0.85, -r * 0.15);
        ctx.stroke();
        break;
      }
      case 'Geo': {
        // Diamond pillar crest
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.lineTo(r * 0.72, 0);
        ctx.lineTo(0, r * 0.85);
        ctx.lineTo(-r * 0.72, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.42);
        ctx.lineTo(r * 0.36, 0);
        ctx.lineTo(0, r * 0.42);
        ctx.lineTo(-r * 0.36, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'Electro': {
        // Mitsudomoe / Tri-lightning ring
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(
            Math.cos(a) * r * 0.34,
            Math.sin(a) * r * 0.34,
            r * 0.17,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        break;
      }
      case 'Dendro': {
        // Heart-leaf sprout
        ctx.beginPath();
        ctx.moveTo(0, r * 0.78);
        ctx.bezierCurveTo(
          -r * 0.85,
          r * 0.25,
          -r * 0.75,
          -r * 0.65,
          0,
          -r * 0.25,
        );
        ctx.bezierCurveTo(r * 0.75, -r * 0.65, r * 0.85, r * 0.25, 0, r * 0.78);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, r * 0.72);
        ctx.lineTo(0, -r * 0.55);
        ctx.stroke();
        break;
      }
      case 'Hydro': {
        // Ripple droplet
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.82);
        ctx.bezierCurveTo(r * 0.68, -r * 0.05, r * 0.65, r * 0.78, 0, r * 0.78);
        ctx.bezierCurveTo(
          -r * 0.65,
          r * 0.78,
          -r * 0.68,
          -r * 0.05,
          0,
          -r * 0.82,
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, r * 0.22, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Pyro': {
        // Flame crown
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.88);
        ctx.quadraticCurveTo(r * 0.72, -r * 0.15, r * 0.45, r * 0.75);
        ctx.quadraticCurveTo(0, r * 0.4, -r * 0.45, r * 0.75);
        ctx.quadraticCurveTo(-r * 0.72, -r * 0.15, 0, -r * 0.88);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, r * 0.18, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Lunar': {
        // Crescent Moon + Kuuvahki star
        ctx.beginPath();
        ctx.arc(-r * 0.1, 0, r * 0.68, -Math.PI * 0.65, Math.PI * 0.65, false);
        ctx.quadraticCurveTo(
          r * 0.15,
          0,
          -r * 0.1,
          -r * 0.68 * Math.sin(Math.PI * 0.65),
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.42, -r * 0.15, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Cryo': {
        // Six-point snowflake star
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * -r * 0.82, Math.sin(a) * -r * 0.82);
          ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default: {
        // Four-point Primogem star
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.quadraticCurveTo(r * 0.15, -r * 0.15, r * 0.85, 0);
        ctx.quadraticCurveTo(r * 0.15, r * 0.15, 0, r * 0.85);
        ctx.quadraticCurveTo(-r * 0.15, r * 0.15, -r * 0.85, 0);
        ctx.quadraticCurveTo(-r * 0.15, -r * 0.15, 0, -r * 0.85);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, startY + idx * lineHeight);
    });
  }

  createTileTexture(tile, ownerColor = null, isMortgaged = false) {
    const isCorner = tile.type === 'corner';
    const w = isCorner ? 512 : 340;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Obsidian parchment card base
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#171C2E');
    bgGrad.addColorStop(1, '#0E1220');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Gold inner filigree frame
    ctx.strokeStyle = ownerColor || 'rgba(212, 175, 55, 0.55)';
    ctx.lineWidth = ownerColor ? 14 : 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (tile.type === 'property') {
      const reg = REGIONS[tile.region];
      // Elemental top banner
      const bannerH = 112;
      const bGrad = ctx.createLinearGradient(0, 0, w, bannerH);
      bGrad.addColorStop(0, reg.color);
      bGrad.addColorStop(1, reg.darkColor);
      ctx.fillStyle = bGrad;
      ctx.fillRect(14, 14, w - 28, bannerH);

      const bannerLogo = this.customImages[reg.id] ? reg.id : reg.element;
      const customImg = this.getEmblemImage(tile);
      if (customImg && customImg.complete && customImg.naturalWidth > 0) {
        const cx = w / 2;
        const cy = 14 + bannerH / 2;
        const size = 36 * 1.85;
        ctx.drawImage(customImg, cx - size / 2, cy - size / 2, size, size);
      } else {
        this.drawElementGlyph(
          ctx,
          bannerLogo,
          w / 2,
          14 + bannerH / 2,
          36,
          'rgba(255,255,255,0.92)',
        );
      }

      // Region tag
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 20px "Segoe UI", sans-serif';
      ctx.fillText(reg.name.toUpperCase(), w / 2, 158);

      // Property Name
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 31px Georgia, serif';
      this.wrapText(ctx, tile.name, w / 2, 255, w - 46, 36);

      // Price footer pill
      ctx.fillStyle = 'rgba(212, 175, 55, 0.16)';
      ctx.fillRect(36, h - 92, w - 72, 54);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(36, h - 92, w - 72, 54);

      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 28px "Segoe UI", sans-serif';
      ctx.fillText(`${tile.price} MORA`, w / 2, h - 65);
    } else if (tile.type === 'railroad') {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '700 20px "Segoe UI", sans-serif';
      ctx.fillText('EXPEDITION REALM', w / 2, 58);

      this.drawElementGlyph(
        ctx,
        tile.emblem || 'Geo',
        w / 2,
        155,
        48,
        '#38BDF8',
      );

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 30px Georgia, serif';
      this.wrapText(ctx, tile.name, w / 2, 275, w - 44, 35);

      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 28px "Segoe UI", sans-serif';
      ctx.fillText(`${tile.price} MORA`, w / 2, h - 65);
    } else if (tile.type === 'utility') {
      const isMoon = tile.name.includes('Moon');
      const accent = isMoon ? '#CBD5E1' : '#A855F7';
      ctx.fillStyle = accent;
      ctx.font = '700 20px "Segoe UI", sans-serif';
      ctx.fillText('COSMIC GRID', w / 2, 58);

      const utilLogo = isMoon
        ? this.customImages['frost_moon']
          ? 'frost_moon'
          : 'Lunar'
        : this.customImages['temple_of_space']
          ? 'temple_of_space'
          : 'Primogem';
      this.drawElementGlyph(ctx, utilLogo, w / 2, 155, 48, accent);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 30px Georgia, serif';
      this.wrapText(ctx, tile.name, w / 2, 275, w - 44, 35);

      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 28px "Segoe UI", sans-serif';
      ctx.fillText(`${tile.price} MORA`, w / 2, h - 65);
    } else if (tile.type === 'chance') {
      ctx.fillStyle = '#F472B6';
      ctx.font = 'bold 24px "Segoe UI", sans-serif';
      ctx.fillText('EVENT WISH', w / 2, 64);

      const fateLogo = this.customImages['intertwined_fate']
        ? 'intertwined_fate'
        : 'Primogem';
      this.drawElementGlyph(ctx, fateLogo, w / 2, 210, 68, '#FCD34D');

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 24px Georgia, serif';
      ctx.fillText('Intertwined Fate', w / 2, 345);
      ctx.fillStyle = '#F472B6';
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.fillText('★ ★ ★ ★ ★', w / 2, 395);
    } else if (tile.type === 'chest') {
      ctx.fillStyle = '#60A5FA';
      ctx.font = 'bold 23px "Segoe UI", sans-serif';
      ctx.fillText('COMMISSION', w / 2, 64);

      const guildLogo = this.customImages['adventurers_guild']
        ? 'adventurers_guild'
        : 'Anemo';
      this.drawElementGlyph(ctx, guildLogo, w / 2, 210, 64, '#60A5FA');

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 24px Georgia, serif';
      this.wrapText(ctx, 'Daily Guild Request', w / 2, 350, w - 48, 30);
    } else if (tile.type === 'tax') {
      ctx.fillStyle = '#F87171';
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.fillText(
        tile.subtype === 'luxury' ? 'LUXURY FEE' : 'NORTHLAND TAX',
        w / 2,
        64,
      );

      const taxLogoKey = tile.subtype === 'luxury' ? 'dori' : 'northland_bank';
      if (this.customImages[taxLogoKey]) {
        this.drawElementGlyph(ctx, taxLogoKey, w / 2, 165, 52, '#F87171');
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 27px Georgia, serif';
        this.wrapText(ctx, tile.name, w / 2, 295, w - 44, 32);
      } else {
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 29px Georgia, serif';
        this.wrapText(ctx, tile.name, w / 2, 215, w - 44, 34);
      }

      ctx.fillStyle = '#FCA5A5';
      ctx.font = 'bold 30px "Segoe UI", sans-serif';
      ctx.fillText(`PAY ${tile.amount} MORA`, w / 2, h - 75);
    } else if (tile.type === 'corner') {
      const cornerColors = {
        go: '#2DD4BF',
        jail: '#F97316',
        freeparking: '#4ADE80',
        gotojail: '#EF4444',
      };
      const cornerLogos = {
        go: 'adventurers_guild',
        jail: 'meropide',
        freeparking: 'serenitea_pot',
        gotojail: 'gardes',
      };
      const cCol = cornerColors[tile.subtype] || '#FCD34D';
      const customKey = cornerLogos[tile.subtype];
      const cornerGlyph =
        customKey && this.customImages[customKey] ? customKey : 'Primogem';
      this.drawElementGlyph(ctx, cornerGlyph, w / 2, 145, 62, cCol);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 36px Georgia, serif';
      this.wrapText(ctx, tile.name, w / 2, 285, w - 60, 42);

      ctx.fillStyle = cCol;
      ctx.font = 'bold 24px "Segoe UI", sans-serif';
      this.wrapText(ctx, tile.subtitle, w / 2, 410, w - 60, 28);
    }

    if (isMortgaged) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(14, 14, w - 28, h - 28);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.35);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 6;
      ctx.strokeRect(-140, -34, 280, 68);
      ctx.fillStyle = '#FCA5A5';
      ctx.font = 'bold 32px "Segoe UI", sans-serif';
      ctx.fillText('MORTGAGED', 0, 2);
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  createCenterBoardTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep celestial navy gradient
    const rad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      40,
      size / 2,
      size / 2,
      size * 0.7,
    );
    rad.addColorStop(0, '#1E293B');
    rad.addColorStop(0.55, '#0F172A');
    rad.addColorStop(1, '#090D16');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, size, size);

    // Astral ley-line circles
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.24)';
    ctx.lineWidth = 3;
    [150, 260, 370, 450].forEach((r) => {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 8 Elemental Nodes around the compass ring
    const regList = Object.values(REGIONS);
    regList.forEach((reg, idx) => {
      const angle = (idx * Math.PI * 2) / regList.length - Math.PI / 2;
      const nx = size / 2 + Math.cos(angle) * 315;
      const ny = size / 2 + Math.sin(angle) * 315;
      ctx.beginPath();
      ctx.arc(nx, ny, 34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = reg.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      this.drawElementGlyph(ctx, reg.element, nx, ny, 22, reg.color);
    });

    // Title Banner in Center
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText('TEYVAT', size / 2, size / 2 - 22);
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 28px "Segoe UI", sans-serif';
    ctx.fillText('CHRONICLES OF MORA · 3D', size / 2, size / 2 + 28);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  createDiceFaceTexture(value) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1E2438';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, size - 20, size - 20);

    const pips = {
      1: [[0.5, 0.5]],
      2: [
        [0.28, 0.28],
        [0.72, 0.72],
      ],
      3: [
        [0.26, 0.26],
        [0.5, 0.5],
        [0.74, 0.74],
      ],
      4: [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.28, 0.72],
        [0.72, 0.72],
      ],
      5: [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.5, 0.5],
        [0.28, 0.72],
        [0.72, 0.72],
      ],
      6: [
        [0.28, 0.24],
        [0.72, 0.24],
        [0.28, 0.5],
        [0.72, 0.5],
        [0.28, 0.76],
        [0.72, 0.76],
      ],
    };

    (pips[value] || []).forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px * size, py * size, value === 1 ? 28 : 20, 0, Math.PI * 2);
      ctx.fillStyle = value === 1 || value === 6 ? '#FCD34D' : '#F8FAFC';
      ctx.fill();
    });

    return new THREE.CanvasTexture(canvas);
  }

  whenEmblemsReady(cb) {
    if (typeof cb !== 'function') return;
    this._emblemListeners.push(cb);
    cb();
  }

  loadCustomEmblems() {
    // Maps region/element keys to filenames in assets/emblem/
    const keys = [
      'anemo',
      'geo',
      'electro',
      'dendro',
      'hydro',
      'pyro',
      'cryo',
      'nodkrai',
      'lunar',
      'mondstadt',
      'liyue',
      'inazuma',
      'sumeru',
      'fontaine',
      'natlan',
      'snezhnaya',
    ];
    const exts = ['webp', 'png', 'svg'];

    keys.forEach((key) => {
      const tryExt = (idx) => {
        if (idx >= exts.length) return;
        const img = new Image();
        img.onload = () => {
          this.emblemImages[key] = img;
          this._emblemListeners.forEach((fn) => fn());
        };
        img.onerror = () => tryExt(idx + 1);
        img.src = `assets/emblems/${key}.${exts[idx]}`;
      };
      tryExt(0);
    });
  }

  getEmblemImage(tileOrRegion) {
    if (!tileOrRegion) return null;
    const regKey = (tileOrRegion.region || '').toLowerCase();
    const elKey = (
      tileOrRegion.element ||
      (REGIONS[regKey] && REGIONS[regKey].element) ||
      ''
    ).toLowerCase();
    return (
      this.emblemImages[regKey] ||
      this.emblemImages[elKey] ||
      (regKey === 'nodkrai' ? this.emblemImages['lunar'] : null) ||
      null
    );
  }
}

window.assetManager = new AssetManager();
