// js/renderer3d.js
// Complete Three.js 3D Engine: Teyvat Board, Procedural Tokens, Outposts & Grand Taverns, 3D Dice, Particles, Camera Controller

class BoardRenderer3D {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.tileMeshes = [];
    this.tileMeta = [];
    this.buildingGroups = {};
    this.tokenMeshes = {};
    this.gnosisTemplates = {};
    this.particles = [];

    // Central Teyvat Astrolabe & Ley Line Light
    this.astrolabeGroup = null;
    this.leyLineLight = null;
    this.diceMeshes = [];

    // Spherical Camera State
    this.camState = {
      target: new THREE.Vector3(0, 0, 0),
      desiredTarget: new THREE.Vector3(0, 0, 0),
      azimuth: 0,
      desiredAzimuth: 0,
      polar: 0.88,
      desiredPolar: 0.88,
      distance: 23.5,
      desiredDistance: 23.5,
      isDragging: false,
      lastX: 0,
      lastY: 0,
      dragMoved: false,
    };

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.onTileClick = null;
    this.followPlayerId = null;

    this.clock = new THREE.Clock();

    this.speedMultiplier = 1;
    this.tileBorders = {};
    this.monopolyBeacons = {};
    this.trimMesh = null;
  }

  init(onTileClick) {
    this.onTileClick = onTileClick;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.FogExp2(0x070a12, 0.015);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 160);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.buildStarfield();
    this.buildBoard();
    this.buildAstrolabe();
    this.buildDice();
    this.bindControls();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.68);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xfef3c7, 0x1e293b, 0.45);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.05);
    dirLight.position.set(14, 26, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 65;
    const d = 14;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    this.leyLineLight = new THREE.PointLight(0x2dd4bf, 1.4, 24);
    this.leyLineLight.position.set(0, 4.2, 0);
    this.scene.add(this.leyLineLight);
  }

  buildStarfield() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 34 + Math.random() * 48;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) - 8;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.24,
      transparent: true,
      opacity: 0.78,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  getTileLayout(index) {
    // Corner size: 2.4 x 2.4; Edge tile: 1.52 x 2.4; Board center offset: 8.04
    const edgeOffset = 8.04;
    const innerEdge = 6.84;
    const step = 1.52;

    if (index === 0)
      return {
        x: edgeOffset,
        z: edgeOffset,
        rotY: 0,
        w: 2.4,
        d: 2.4,
        isCorner: true,
      };
    if (index > 0 && index < 10) {
      return {
        x: innerEdge - (index - 0.5) * step,
        z: edgeOffset,
        rotY: 0,
        w: step,
        d: 2.4,
        isCorner: false,
      };
    }
    if (index === 10)
      return {
        x: -edgeOffset,
        z: edgeOffset,
        rotY: 0,
        w: 2.4,
        d: 2.4,
        isCorner: true,
      };
    if (index > 10 && index < 20) {
      const k = index - 10;
      return {
        x: -edgeOffset,
        z: innerEdge - (k - 0.5) * step,
        rotY: -Math.PI / 2,
        w: step,
        d: 2.4,
        isCorner: false,
      };
    }
    if (index === 20)
      return {
        x: -edgeOffset,
        z: -edgeOffset,
        rotY: 0,
        w: 2.4,
        d: 2.4,
        isCorner: true,
      };
    if (index > 20 && index < 30) {
      const k = index - 20;
      return {
        x: -innerEdge + (k - 0.5) * step,
        z: -edgeOffset,
        rotY: Math.PI,
        w: step,
        d: 2.4,
        isCorner: false,
      };
    }
    if (index === 30)
      return {
        x: edgeOffset,
        z: -edgeOffset,
        rotY: 0,
        w: 2.4,
        d: 2.4,
        isCorner: true,
      };
    const k = index - 30;
    return {
      x: edgeOffset,
      z: -innerEdge + (k - 0.5) * step,
      rotY: Math.PI / 2,
      w: step,
      d: 2.4,
      isCorner: false,
    };
  }

  buildBoard() {
    // Outer Obsidian & Gold Plinth
    const baseGeo = new THREE.BoxGeometry(19.2, 0.65, 19.2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f19,
      roughness: 0.45,
      metalness: 0.6,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.34;
    baseMesh.receiveShadow = true;
    this.scene.add(baseMesh);

    // Gold Trim Border
    const trimGeo = new THREE.BoxGeometry(19.45, 0.25, 19.45);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.85,
    });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.y = -0.22;
    this.scene.add(trimMesh);
    this.trimMesh = trimMesh;

    // Inner Teyvat Celestial Map Surface
    const centerGeo = new THREE.PlaneGeometry(13.68, 13.68);
    const centerTex = window.assetManager.createCenterBoardTexture();
    const centerMat = new THREE.MeshStandardMaterial({
      map: centerTex,
      roughness: 0.65,
      metalness: 0.2,
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.rotation.x = -Math.PI / 2;
    centerMesh.position.y = 0.01;
    centerMesh.receiveShadow = true;
    this.scene.add(centerMesh);
    this.centerMesh = centerMesh;

    // Build all 40 Tiles
    BOARD_TILES.forEach((tile) => {
      const layout = this.getTileLayout(tile.index);
      this.tileMeta[tile.index] = layout;

      const geo = new THREE.BoxGeometry(layout.w - 0.03, 0.14, layout.d - 0.03);
      const topTex = window.assetManager.createTileTexture(tile);
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x161b2c,
        roughness: 0.5,
        metalness: 0.4,
      });
      const topMat = new THREE.MeshStandardMaterial({
        map: topTex,
        roughness: 0.55,
        metalness: 0.15,
      });

      // BoxGeometry material order: +x, -x, +y (top), -y, +z, -z
      const mesh = new THREE.Mesh(geo, [
        sideMat,
        sideMat,
        topMat,
        sideMat,
        sideMat,
        sideMat,
      ]);
      mesh.position.set(layout.x, 0.06, layout.z);
      mesh.rotation.y = layout.rotY;
      mesh.receiveShadow = true;
      mesh.userData = { tileIndex: tile.index };

      this.scene.add(mesh);
      this.tileMeshes[tile.index] = mesh;

      // Container for Outposts / Grand Tavern on this tile
      const bGroup = new THREE.Group();
      bGroup.position.set(layout.x, 0.13, layout.z);
      bGroup.rotation.y = layout.rotY;
      this.scene.add(bGroup);
      this.buildingGroups[tile.index] = bGroup;

      // Ownership Border Frame & Monopoly Corner Beacon
      if (
        tile.type === 'property' ||
        tile.type === 'railroad' ||
        tile.type === 'utility'
      ) {
        const borderGeo = new THREE.BoxGeometry(
          layout.w + 0.02,
          0.05,
          layout.d + 0.02,
        );
        const borderMat = new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          emissive: 0xd4af37,
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.85,
        });
        const borderMesh = new THREE.Mesh(borderGeo, borderMat);
        borderMesh.position.set(layout.x, 0.02, layout.z);
        borderMesh.rotation.y = layout.rotY;
        borderMesh.visible = false;
        this.scene.add(borderMesh);
        this.tileBorders[tile.index] = borderMesh;

        const beacon = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14, 0),
          new THREE.MeshStandardMaterial({
            color: 0xfcd34d,
            emissive: 0xfcd34d,
            emissiveIntensity: 0.85,
          }),
        );
        beacon.position.set(layout.x, 0.32, layout.z);
        beacon.visible = false;
        this.scene.add(beacon);
        this.monopolyBeacons[tile.index] = beacon;
      }
    });
  }

  updateTileAppearance(tileIndex, ownerColor = null, isMortgaged = false) {
    const tile = BOARD_TILES[tileIndex];
    const mesh = this.tileMeshes[tileIndex];
    if (!tile || !mesh) return;
    const newTex = window.assetManager.createTileTexture(
      tile,
      ownerColor,
      isMortgaged,
    );
    if (mesh.material[2].map) {
      mesh.material[2].map.dispose();
    }
    mesh.material[2].map = newTex;
    mesh.material[2].needsUpdate = true;

    const border = this.tileBorders[tileIndex];
    if (border) {
      if (ownerColor) {
        border.visible = true;
        border.material.color.set(ownerColor);
        border.material.emissive.set(ownerColor);
        border.material.emissiveIntensity = isMortgaged ? 0.1 : 0.45;
      } else {
        border.visible = false;
      }
    }
  }

  refreshAllTileTextures(tileState = {}, players = []) {
    BOARD_TILES.forEach((tile) => {
      const st = tileState[tile.index];
      const owner =
        st && st.ownerId ? players.find((p) => p.id === st.ownerId) : null;
      this.updateTileAppearance(
        tile.index,
        owner ? owner.color : null,
        Boolean(st && st.mortgaged),
      );
    });
  }

  refreshCenterBoardTexture() {
    if (!this.centerMesh || !this.centerMesh.material) return;
    const newTex = window.assetManager.createCenterBoardTexture();
    if (this.centerMesh.material.map) {
      this.centerMesh.material.map.dispose();
    }
    this.centerMesh.material.map = newTex;
    this.centerMesh.material.needsUpdate = true;
  }

  updateTileBuildings(tileIndex, level) {
    const group = this.buildingGroups[tileIndex];
    const tile = BOARD_TILES[tileIndex];
    if (!group || !tile || tile.type !== 'property') return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    if (!level || level <= 0) return;

    const reg = REGIONS[tile.region];
    const roofColor = new THREE.Color(reg.color);

    if (level < 5) {
      // 1 to 4 Adventurers' Outposts along the top banner strip (localZ = -0.86)
      const offsets = [-0.48, -0.16, 0.16, 0.48];
      for (let i = 0; i < level; i++) {
        const outpost = new THREE.Group();
        outpost.position.set(offsets[i], 0, -0.86);

        // Timber base
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.16, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 }),
        );
        base.position.y = 0.08;
        base.castShadow = true;
        outpost.add(base);

        // Peaked elemental canopy roof
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.21, 0.18, 4),
          new THREE.MeshStandardMaterial({
            color: roofColor,
            emissive: roofColor,
            emissiveIntensity: 0.25,
            roughness: 0.4,
          }),
        );
        roof.position.y = 0.24;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        outpost.add(roof);

        group.add(outpost);
      }
    } else {
      // Level 5: Grand Tavern landmark
      const tavern = new THREE.Group();
      tavern.position.set(0, 0, -0.84);

      const hall = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.34, 0.38),
        new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.55 }),
      );
      hall.position.y = 0.17;
      hall.castShadow = true;
      tavern.add(hall);

      // Glowing warm tavern windows
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.1, 0.4),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.9,
        }),
      );
      win.position.y = 0.18;
      tavern.add(win);

      // Grand elemental roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.62, 0.34, 4),
        new THREE.MeshStandardMaterial({
          color: roofColor,
          emissive: roofColor,
          emissiveIntensity: 0.38,
          roughness: 0.3,
          metalness: 0.3,
        }),
      );
      roof.position.y = 0.5;
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1.25, 1, 0.72);
      roof.castShadow = true;
      tavern.add(roof);

      // Golden finial spire
      const spire = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1),
        new THREE.MeshStandardMaterial({
          color: 0xfcd34d,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.6,
          metalness: 0.9,
        }),
      );
      spire.position.y = 0.74;
      tavern.add(spire);

      group.add(tavern);
    }
  }

  buildAstrolabe() {
    this.astrolabeGroup = new THREE.Group();
    this.astrolabeGroup.position.set(0, 1.35, 0);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.25,
    });

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.045, 12, 48),
      ringMat,
    );
    outerRing.rotation.x = Math.PI / 2;
    this.astrolabeGroup.add(outerRing);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.035, 12, 36),
      ringMat,
    );
    innerRing.rotation.x = Math.PI / 3;
    this.astrolabeGroup.add(innerRing);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.3,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), coreMat);
    this.astrolabeGroup.add(core);

    this.astrolabeGroup.userData = { outerRing, innerRing, core };
    this.scene.add(this.astrolabeGroup);
  }

  setTileMonopoly(tileIndex, isMonopoly, ownerColor = '#fcd34d') {
    const beacon = this.monopolyBeacons[tileIndex];
    if (!beacon) return;
    beacon.visible = Boolean(isMonopoly);
    if (isMonopoly) {
      beacon.material.color.set(ownerColor);
      beacon.material.emissive.set(ownerColor);
    }
  }

  setLeyLineTheme(hexColor) {
    if (this.leyLineLight) {
      this.leyLineLight.color.setHex(hexColor);
    }
    if (this.astrolabeGroup && this.astrolabeGroup.userData.core) {
      this.astrolabeGroup.userData.core.material.color.setHex(hexColor);
      this.astrolabeGroup.userData.core.material.emissive.setHex(hexColor);
    }
    if (this.trimMesh) {
      this.trimMesh.material.emissive.setHex(hexColor);
      this.trimMesh.material.emissiveIntensity = 0.22;
    }
    if (this.scene && this.scene.fog) {
      const tinted = new THREE.Color(0x070a12).lerp(
        new THREE.Color(hexColor),
        0.12,
      );
      this.scene.fog.color.copy(tinted);
    }
  }

  spawnDualBurst(tileIndex, color1 = '#fcd34d', color2 = '#38bdf8') {
    this.spawnBurst(tileIndex, new THREE.Color(color1).getHex());
    this.spawnBurst(tileIndex, new THREE.Color(color2).getHex());
  }

  buildDice() {
    // BoxGeometry face order: +x(3), -x(4), +y(1), -y(6), +z(2), -z(5)
    const faceOrder = [3, 4, 1, 6, 2, 5];
    const mats = faceOrder.map(
      (val) =>
        new THREE.MeshStandardMaterial({
          map: window.assetManager.createDiceFaceTexture(val),
          roughness: 0.35,
          metalness: 0.35,
        }),
    );

    const geo = new THREE.BoxGeometry(0.88, 0.88, 0.88);
    for (let i = 0; i < 2; i++) {
      const die = new THREE.Mesh(geo, mats);
      die.position.set(i === 0 ? -0.9 : 0.9, 0.58, 2.4);
      die.castShadow = true;
      this.scene.add(die);
      this.diceMeshes.push(die);
    }
  }

  getDiceTargetEuler(value) {
    // Returns Euler angles so `value` face points straight up (+Y)
    switch (value) {
      case 1:
        return new THREE.Euler(0, 0, 0);
      case 6:
        return new THREE.Euler(Math.PI, 0, 0);
      case 2:
        return new THREE.Euler(-Math.PI / 2, 0, 0);
      case 5:
        return new THREE.Euler(Math.PI / 2, 0, 0);
      case 3:
        return new THREE.Euler(0, 0, Math.PI / 2);
      case 4:
        return new THREE.Euler(0, 0, -Math.PI / 2);
      default:
        return new THREE.Euler(0, 0, 0);
    }
  }

  animateDiceRoll(d1, d2) {
    return new Promise((resolve) => {
      const duration = 680 / (this.speedMultiplier || 1);
      const start = performance.now();
      const target1 = this.getDiceTargetEuler(d1);
      const target2 = this.getDiceTargetEuler(d2);

      const spin1 = {
        x: Math.PI * 4 + target1.x,
        y: Math.PI * 2,
        z: Math.PI * 4 + target1.z,
      };
      const spin2 = {
        x: Math.PI * 4 + target2.x,
        y: -Math.PI * 2,
        z: Math.PI * 4 + target2.z,
      };

      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const bounce = Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * 1.9;

        this.diceMeshes[0].position.set(
          -0.95 + Math.sin(t * Math.PI) * 0.3,
          0.58 + bounce,
          2.35,
        );
        this.diceMeshes[1].position.set(
          0.95 - Math.sin(t * Math.PI) * 0.3,
          0.58 + bounce,
          2.35,
        );

        this.diceMeshes[0].rotation.set(
          spin1.x * ease,
          spin1.y * ease,
          spin1.z * ease,
        );
        this.diceMeshes[1].rotation.set(
          spin2.x * ease,
          spin2.y * ease,
          spin2.z * ease,
        );

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          this.diceMeshes[0].rotation.copy(target1);
          this.diceMeshes[1].rotation.copy(target2);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  buildGnosisSculpture(archon, primary) {
    const g = new THREE.Group();

    const ivoryMat = new THREE.MeshStandardMaterial({
      color: 0xf3ead8,
      roughness: 0.38,
      metalness: 0.25,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.28,
      metalness: 0.85,
    });

    const coreMat = new THREE.MeshStandardMaterial({
      color: primary,
      emissive: primary,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.35,
    });

    const addPart = (
      geo,
      mat,
      pos = [0, 0, 0],
      rot = [0, 0, 0],
      scale = [1, 1, 1],
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.rotation.set(...rot);
      m.scale.set(...scale);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    switch (archon.id) {
      case 'venti': {
        // Anemo Gnosis: winged hourglass / twin-fin silhouette
        addPart(
          new THREE.CylinderGeometry(0.05, 0.08, 0.56, 14),
          goldMat,
          [0, 0, 0],
        );
        addPart(
          new THREE.ConeGeometry(0.2, 0.22, 16),
          ivoryMat,
          [0, 0.16, 0],
          [Math.PI, 0, 0],
        );
        addPart(new THREE.ConeGeometry(0.2, 0.22, 16), ivoryMat, [0, -0.16, 0]);
        addPart(new THREE.OctahedronGeometry(0.11, 1), coreMat, [0, 0, 0]);
        addPart(
          new THREE.TorusGeometry(0.16, 0.032, 10, 20, Math.PI * 1.15),
          goldMat,
          [-0.14, 0.04, 0],
          [0, 0, Math.PI * 0.65],
        );
        addPart(
          new THREE.TorusGeometry(0.16, 0.032, 10, 20, Math.PI * 1.15),
          goldMat,
          [0.14, 0.04, 0],
          [0, Math.PI, Math.PI * 0.65],
        );
        break;
      }
      case 'zhongli': {
        // Geo Gnosis: stacked architectural pillars & central amber core
        addPart(
          new THREE.CylinderGeometry(0.06, 0.06, 0.58, 12),
          goldMat,
          [0, 0, 0],
        );
        addPart(new THREE.BoxGeometry(0.24, 0.1, 0.24), ivoryMat, [0, 0.2, 0]);
        addPart(new THREE.BoxGeometry(0.28, 0.1, 0.28), ivoryMat, [0, -0.2, 0]);
        addPart(new THREE.BoxGeometry(0.18, 0.22, 0.18), coreMat, [0, 0, 0]);
        addPart(new THREE.BoxGeometry(0.36, 0.04, 0.12), goldMat, [0, 0.08, 0]);
        addPart(
          new THREE.BoxGeometry(0.36, 0.04, 0.12),
          goldMat,
          [0, -0.08, 0],
        );
        break;
      }
      case 'raiden': {
        // Electro Gnosis: central blade/spindle + sweeping dual arcs
        addPart(
          new THREE.CylinderGeometry(0.045, 0.045, 0.6, 12),
          goldMat,
          [0, 0, 0],
        );
        addPart(
          new THREE.OctahedronGeometry(0.12, 0),
          coreMat,
          [0, 0.02, 0],
          [0, 0, 0],
          [0.75, 1.45, 0.75],
        );
        addPart(
          new THREE.TorusGeometry(0.22, 0.032, 10, 24, Math.PI * 1.3),
          ivoryMat,
          [-0.07, 0, 0],
          [0, 0, Math.PI * 0.35],
        );
        addPart(
          new THREE.TorusGeometry(0.22, 0.032, 10, 24, Math.PI * 1.3),
          ivoryMat,
          [0.07, 0, 0],
          [0, Math.PI, Math.PI * 0.35],
        );
        break;
      }
      case 'nahida': {
        // Dendro Gnosis: orbital lattice rings & emerald seed core
        addPart(new THREE.DodecahedronGeometry(0.12, 0), coreMat, [0, 0, 0]);
        addPart(
          new THREE.TorusGeometry(0.24, 0.028, 10, 28),
          ivoryMat,
          [0, 0, 0],
          [0.4, 0.2, 0],
        );
        addPart(
          new THREE.TorusGeometry(0.24, 0.028, 10, 28),
          goldMat,
          [0, 0, 0],
          [-0.4, -0.2, 0.5],
        );
        addPart(
          new THREE.CylinderGeometry(0.04, 0.04, 0.56, 10),
          goldMat,
          [0, 0, 0],
        );
        break;
      }
      case 'furina': {
        // Hydro Gnosis: tall tiered crown / royal scepter
        addPart(
          new THREE.CylinderGeometry(0.05, 0.08, 0.56, 14),
          goldMat,
          [0, 0, 0],
        );
        addPart(new THREE.ConeGeometry(0.22, 0.24, 8), ivoryMat, [0, 0.16, 0]);
        addPart(
          new THREE.TorusGeometry(0.18, 0.032, 10, 24),
          goldMat,
          [0, 0.05, 0],
          [Math.PI / 2, 0, 0],
        );
        addPart(new THREE.OctahedronGeometry(0.1, 1), coreMat, [0, -0.05, 0]);
        break;
      }
      case 'mavuika': {
        // Pyro Gnosis: solar ring & flame-diamond core
        addPart(
          new THREE.TorusGeometry(0.23, 0.036, 10, 28),
          goldMat,
          [0, 0, 0],
        );
        addPart(new THREE.OctahedronGeometry(0.14, 0), coreMat, [0, 0, 0]);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          addPart(
            new THREE.ConeGeometry(0.06, 0.14, 4),
            ivoryMat,
            [Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0],
            [0, 0, a - Math.PI / 2],
          );
        }
        break;
      }
      case 'tsaritsa': {
        // Cryo Gnosis: frost spindle with cross-struts & crystal core
        addPart(
          new THREE.CylinderGeometry(0.05, 0.05, 0.62, 12),
          ivoryMat,
          [0, 0, 0],
        );
        addPart(new THREE.BoxGeometry(0.38, 0.04, 0.08), goldMat, [0, 0.12, 0]);
        addPart(
          new THREE.BoxGeometry(0.28, 0.04, 0.08),
          goldMat,
          [0, -0.12, 0],
        );
        addPart(new THREE.OctahedronGeometry(0.12, 0), coreMat, [0, 0, 0]);
        break;
      }
      default: {
        // Columbina / Lunar Gnosis: crescent halo & glowing moon core
        addPart(
          new THREE.TorusGeometry(0.23, 0.038, 12, 28, Math.PI * 1.45),
          ivoryMat,
          [0, 0, 0],
          [0, 0, Math.PI * 0.28],
        );
        addPart(new THREE.OctahedronGeometry(0.12, 1), coreMat, [0.04, 0, 0]);
        addPart(
          new THREE.CylinderGeometry(0.04, 0.04, 0.54, 10),
          goldMat,
          [0, 0, 0],
        );
        break;
      }
    }

    return g;
  }

  normalizeGnosisObject(rawObj, targetHeight = 0.78) {
    const wrapper = new THREE.Group();
    wrapper.add(rawObj);

    rawObj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rawObj);
    if (!box.isEmpty()) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.y, size.x, size.z) || 1;
      const scale = targetHeight / maxDim;
      rawObj.scale.multiplyScalar(scale);

      rawObj.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(rawObj);
      scaledBox.getCenter(center);
      rawObj.position.set(-center.x, -center.y, -center.z);
    }

    wrapper.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          mats.forEach((m) => {
            m.side = THREE.DoubleSide;
            if (m.alphaMap) m.transparent = true;
            m.needsUpdate = true;
          });
        }
      }
    });

    return wrapper;
  }

  loadTextureSafe(url, isColor = true) {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => {
          if (isColor && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
          tex.anisotropy = 4;
          resolve(tex);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  async loadObjGnosis(folder, objFile, mtlFile, emissionFile) {
    const basePath = `assets/models/Gnosis/${folder}/`;
    const emissionTex = emissionFile
      ? await this.loadTextureSafe(`${basePath}${emissionFile}`, true)
      : null;

    return new Promise((resolve) => {
      const applyEmission = (root) => {
        if (emissionTex) {
          root.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material)
                ? child.material
                : [child.material];
              mats.forEach((m) => {
                m.emissive = new THREE.Color(0xffffff);
                m.emissiveMap = emissionTex;
                m.emissiveIntensity = 0.75;
                m.needsUpdate = true;
              });
            }
          });
        }
        resolve(this.normalizeGnosisObject(root));
      };

      const objLoader = new THREE.OBJLoader();
      if (mtlFile && THREE.MTLLoader) {
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.setPath(basePath);
        mtlLoader.setResourcePath(basePath);
        mtlLoader.load(
          mtlFile,
          (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.setPath(basePath);
            objLoader.load(objFile, applyEmission, undefined, () =>
              resolve(null),
            );
          },
          undefined,
          () => {
            objLoader.setPath(basePath);
            objLoader.load(objFile, applyEmission, undefined, () =>
              resolve(null),
            );
          },
        );
      } else {
        objLoader.setPath(basePath);
        objLoader.load(objFile, applyEmission, undefined, () => resolve(null));
      }
    });
  }

  // Without diffuseFile, each material keeps its own FBX texture.
  async loadFbxGnosis(folder, fbxFile, diffuseFile = null, options = {}) {
    if (!THREE.FBXLoader) return null;
    const basePath = `assets/models/Gnosis/${folder}/`;
    const diffuseTex = diffuseFile
      ? await this.loadTextureSafe(`${basePath}${diffuseFile}`, true)
      : null;
    const { hideMeshPattern = null, roughness = 0.35, metalness = 0.25 } =
      options;

    return new Promise((resolve) => {
      const loader = new THREE.FBXLoader();
      loader.load(
        `${basePath}${fbxFile}`,
        (fbx) => {
          const toRemove = [];
          fbx.traverse((child) => {
            if (!child.isMesh) return;
            if (hideMeshPattern && hideMeshPattern.test(child.name)) {
              toRemove.push(child);
              return;
            }
            // Non-skinned materials: renders bind pose, keeps clone() safe.
            const convert = (src) =>
              new THREE.MeshStandardMaterial({
                map: diffuseTex || (src && src.map) || null,
                transparent: false,
                roughness,
                metalness,
                side: THREE.DoubleSide,
              });
            child.material = Array.isArray(child.material)
              ? child.material.map(convert)
              : convert(child.material);
          });
          toRemove.forEach((m) => m.parent && m.parent.remove(m));
          resolve(this.normalizeGnosisObject(fbx));
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  async preloadGnosisModels() {
    const isHttp =
      window.location.protocol === 'http:' ||
      window.location.protocol === 'https:';
    if (!isHttp || !THREE.OBJLoader) return;

    const specs = [
      {
        id: 'venti',
        loader: () =>
          this.loadObjGnosis(
            'Anemo Gnosis',
            'Item_AnemoGnosis.obj',
            'Item_AnemoGnosis.mtl',
            'emission.png',
          ),
      },
      {
        id: 'raiden',
        loader: () =>
          this.loadObjGnosis(
            'Electrro Gnosis',
            'Gnosis_Electro.obj',
            'Gnosis_Electro.mtl',
            'emission.png',
          ),
      },
      {
        id: 'tsaritsa',
        loader: () =>
          this.loadFbxGnosis(
            'Cyro Gnosis',
            'CyroGnosis.fbx',
            'AvatarItem_Gnosis_Cyro_Tex_Diffuse.png',
          ),
      },
      {
        id: 'nahida',
        loader: () =>
          this.loadFbxGnosis(
            'Dendro Gnosis',
            'DendroGnosis.fbx',
            'Avatarltem_Gnosis_Dendro_Tex_Diffuse.png',
          ),
      },
      {
        id: 'zhongli',
        loader: () =>
          this.loadFbxGnosis(
            'Geo Gnosis',
            'GeoGnosis.fbx',
            'CS_Item_Gnosis_Geo_Diffuse.png',
          ),
      },
      {
        id: 'furina',
        loader: () =>
          this.loadFbxGnosis(
            'Hydro Gnosis',
            'HydroGnosis.fbx',
            'AvatarItem_Gnosis_Hydro_Tex_Diffuse.png',
          ),
      },
      {
        id: 'mavuika',
        loader: () =>
          this.loadFbxGnosis(
            'Pyro Gnosis',
            'PyroGnosis.fbx',
            'AvatarItem_Gnosis_Fire_Tex_Diffuse.png',
          ),
      },
      {
        id: 'columbina',
        loader: () =>
          this.loadFbxGnosis('Luonnotar', 'Luonnotar.fbx', null, {
            hideMeshPattern: /^Eff_/,
          }),
      },
    ];

    await Promise.all(
      specs.map(async ({ id, loader }) => {
        try {
          const model = await loader();
          if (model) this.gnosisTemplates[id] = model;
        } catch (_) {
          // Fallback sculpture remains active if a model fails to load
        }
      }),
    );
  }

  buildGnosisFromReference(archon, primary) {
    const g = new THREE.Group();

    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xd8c7a3,
      roughness: 0.42,
      metalness: 0.18,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.28,
      metalness: 0.82,
    });

    const coreMat = new THREE.MeshStandardMaterial({
      color: primary,
      emissive: primary,
      emissiveIntensity: 0.6,
      roughness: 0.22,
      metalness: 0.25,
    });

    const add = (
      geo,
      mat,
      pos = [0, 0, 0],
      rot = [0, 0, 0],
      scale = [1, 1, 1],
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.scale.set(...scale);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };

    switch (archon.id) {
      case 'furina': {
        // Tall chalice/flask silhouette with hydro bulb & crown collar[cite: 21]
        add(
          new THREE.CylinderGeometry(0.18, 0.24, 0.08, 20),
          boneMat,
          [0, -0.46, 0],
        );
        add(
          new THREE.CylinderGeometry(0.06, 0.14, 0.34, 18),
          coreMat,
          [0, -0.26, 0],
        );
        add(
          new THREE.CylinderGeometry(0.085, 0.085, 0.36, 16),
          boneMat,
          [0, -0.26, 0],
          [0, 0, 0],
          [1.15, 1, 0.55],
        );
        add(
          new THREE.SphereGeometry(0.15, 20, 16),
          coreMat,
          [0, 0.04, 0],
          [0, 0, 0],
          [1, 1.25, 0.85],
        );
        add(
          new THREE.TorusGeometry(0.14, 0.03, 10, 20, Math.PI * 1.3),
          boneMat,
          [0, 0.27, 0],
          [0, 0, Math.PI * 0.85],
        );
        add(new THREE.OctahedronGeometry(0.065, 0), coreMat, [0, 0.44, 0]);
        break;
      }
      case 'mavuika': {
        // Crenellated base, column shaft, and sunburst/flame medallion[cite: 22]
        add(new THREE.BoxGeometry(0.32, 0.1, 0.28), boneMat, [0, -0.44, 0]);
        add(
          new THREE.CylinderGeometry(0.07, 0.09, 0.32, 12),
          coreMat,
          [0, -0.24, 0],
        );
        add(
          new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8),
          boneMat,
          [0, -0.24, 0],
          [0, 0, 0],
          [1.1, 1, 0.55],
        );
        add(
          new THREE.CylinderGeometry(0.22, 0.22, 0.11, 24),
          boneMat,
          [0, 0.1, 0],
          [Math.PI / 2, 0, 0],
        );
        add(
          new THREE.CylinderGeometry(0.12, 0.12, 0.13, 20),
          coreMat,
          [0, 0.1, 0],
          [Math.PI / 2, 0, 0],
        );
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          add(
            new THREE.ConeGeometry(0.065, 0.16, 4),
            i % 2 === 0 ? boneMat : coreMat,
            [Math.cos(angle) * 0.23, 0.1 + Math.sin(angle) * 0.23, 0],
            [0, 0, angle - Math.PI / 2],
          );
        }
        break;
      }
      case 'nahida': {
        // Flared base, stem, curved branch cage around green orb, and leafy crown[cite: 23]
        add(
          new THREE.CylinderGeometry(0.17, 0.22, 0.1, 18),
          boneMat,
          [0, -0.45, 0],
        );
        add(
          new THREE.CylinderGeometry(0.06, 0.13, 0.3, 16),
          coreMat,
          [0, -0.25, 0],
        );
        add(new THREE.SphereGeometry(0.14, 20, 16), coreMat, [0, 0.05, 0]);
        for (let i = 0; i < 4; i++) {
          const rotY = (i * Math.PI) / 2;
          add(
            new THREE.TorusGeometry(0.17, 0.022, 8, 22, Math.PI * 1.15),
            boneMat,
            [0, 0.05, 0],
            [0, rotY, Math.PI * 0.92],
          );
        }
        add(new THREE.ConeGeometry(0.17, 0.18, 6), boneMat, [0, 0.34, 0]);
        add(new THREE.OctahedronGeometry(0.07, 0), coreMat, [0, 0.34, 0]);
        break;
      }
      case 'raiden': {
        // Stepped base, collared stem, twin sweeping horns, and violet core drum[cite: 24]
        add(
          new THREE.CylinderGeometry(0.16, 0.23, 0.12, 18),
          boneMat,
          [0, -0.44, 0],
        );
        add(
          new THREE.CylinderGeometry(0.06, 0.11, 0.28, 16),
          coreMat,
          [0, -0.24, 0],
        );
        add(
          new THREE.TorusGeometry(0.1, 0.028, 8, 20),
          boneMat,
          [0, -0.18, 0],
          [Math.PI / 2, 0, 0],
        );
        add(
          new THREE.CylinderGeometry(0.15, 0.15, 0.14, 24),
          coreMat,
          [0, 0.08, 0],
          [Math.PI / 2, 0, 0],
        );
        add(
          new THREE.TorusGeometry(0.19, 0.032, 10, 24, Math.PI * 1.1),
          boneMat,
          [-0.05, 0.11, 0],
          [0, 0, Math.PI * 0.28],
        );
        add(
          new THREE.TorusGeometry(0.19, 0.032, 10, 24, Math.PI * 1.1),
          boneMat,
          [0.05, 0.11, 0],
          [0, Math.PI, Math.PI * 0.28],
        );
        add(new THREE.OctahedronGeometry(0.09, 0), goldMat, [0, 0.36, 0]);
        break;
      }
      case 'tsaritsa': {
        // Tapered column, lower node, snowflake/quatrefoil frame, and crystal core[cite: 25]
        add(
          new THREE.CylinderGeometry(0.15, 0.21, 0.1, 18),
          boneMat,
          [0, -0.45, 0],
        );
        add(
          new THREE.CylinderGeometry(0.055, 0.11, 0.28, 14),
          coreMat,
          [0, -0.26, 0],
        );
        add(new THREE.SphereGeometry(0.09, 14, 12), boneMat, [0, -0.11, 0]);
        add(
          new THREE.OctahedronGeometry(0.13, 0),
          coreMat,
          [0, 0.11, 0],
          [0, 0, 0],
          [1, 1.2, 1],
        );
        add(
          new THREE.TorusGeometry(0.19, 0.028, 8, 24),
          boneMat,
          [0, 0.11, 0.05],
        );
        add(
          new THREE.TorusGeometry(0.19, 0.028, 8, 24),
          boneMat,
          [0, 0.11, -0.05],
        );
        add(new THREE.ConeGeometry(0.05, 0.15, 4), coreMat, [0, 0.38, 0]);
        add(
          new THREE.ConeGeometry(0.04, 0.12, 4),
          coreMat,
          [-0.12, 0.34, 0],
          [0, 0, 0.25],
        );
        add(
          new THREE.ConeGeometry(0.04, 0.12, 4),
          coreMat,
          [0.12, 0.34, 0],
          [0, 0, -0.25],
        );
        break;
      }
      case 'venti': {
        // Flared base, geometric stem, cyan sphere core, side brackets, and crown top[cite: 26]
        add(
          new THREE.CylinderGeometry(0.16, 0.22, 0.1, 18),
          boneMat,
          [0, -0.45, 0],
        );
        add(
          new THREE.CylinderGeometry(0.065, 0.12, 0.26, 16),
          coreMat,
          [0, -0.26, 0],
        );
        add(new THREE.SphereGeometry(0.17, 22, 18), coreMat, [0, 0.03, 0]);
        add(
          new THREE.TorusGeometry(0.19, 0.028, 10, 24, Math.PI * 1.25),
          boneMat,
          [0, 0.03, 0],
          [0, Math.PI / 2, 0],
        );
        add(
          new THREE.BoxGeometry(0.06, 0.16, 0.08),
          boneMat,
          [-0.2, 0.05, 0],
          [0, 0, 0.25],
        );
        add(
          new THREE.BoxGeometry(0.06, 0.16, 0.08),
          boneMat,
          [0.2, 0.05, 0],
          [0, 0, -0.25],
        );
        add(
          new THREE.CylinderGeometry(0.15, 0.13, 0.15, 12),
          boneMat,
          [0, 0.31, 0],
        );
        break;
      }
      case 'zhongli':
      default: {
        // Crenellated base, column shaft, square cage around gold block, and tower crown[cite: 27]
        add(
          new THREE.CylinderGeometry(0.18, 0.22, 0.12, 8),
          boneMat,
          [0, -0.44, 0],
        );
        add(
          new THREE.CylinderGeometry(0.07, 0.1, 0.26, 12),
          coreMat,
          [0, -0.25, 0],
        );
        add(new THREE.BoxGeometry(0.15, 0.17, 0.15), coreMat, [0, 0.06, 0]);
        const cage = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(0.32, 0.28, 0.24)),
          boneMat,
        );
        cage.position.set(0, 0.06, 0);
        g.add(cage);
        add(new THREE.BoxGeometry(0.32, 0.04, 0.24), boneMat, [0, 0.2, 0]);
        add(new THREE.BoxGeometry(0.32, 0.04, 0.24), boneMat, [0, -0.08, 0]);
        add(
          new THREE.CylinderGeometry(0.16, 0.14, 0.14, 8),
          boneMat,
          [0, 0.33, 0],
        );
        break;
      }
    }

    return g;
  }

  createArchonToken(player) {
    const archon = ARCHONS.find((a) => a.id === player.archonId) || ARCHONS[0];
    const group = new THREE.Group();
    const primary = new THREE.Color(archon.color);

    // Pedestal Base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 0.16, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.7,
        roughness: 0.3,
      }),
    );
    base.position.y = 0.08;
    base.castShadow = true;
    group.add(base);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.03, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfcd34d,
        metalness: 0.9,
        roughness: 0.2,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.16;
    group.add(rim);

    const template = this.gnosisTemplates[archon.id];
    const gnosisPiece = template
      ? template.clone(true)
      : this.buildGnosisFromReference(archon, primary);
    gnosisPiece.position.set(0, 0.68, 0);
    gnosisPiece.userData.isGnosisPiece = true;
    gnosisPiece.userData.baseY = 0.68;
    group.add(gnosisPiece);

    this.scene.add(group);
    this.tokenMeshes[player.id] = group;
    return group;
  }

  clearTokens() {
    Object.values(this.tokenMeshes).forEach((mesh) => this.scene.remove(mesh));
    this.tokenMeshes = {};
  }

  getTokenSlotOffset(slotIndex) {
    const offsets = [
      { x: -0.34, z: 0.28 },
      { x: 0.34, z: 0.28 },
      { x: -0.34, z: -0.22 },
      { x: 0.34, z: -0.22 },
    ];
    return offsets[slotIndex % offsets.length];
  }

  placeTokenImmediate(player, playersOnSameTile = []) {
    const mesh = this.tokenMeshes[player.id];
    const layout = this.tileMeta[player.position];
    if (!mesh || !layout) return;

    const idx = Math.max(
      0,
      playersOnSameTile.findIndex((p) => p.id === player.id),
    );
    const off = this.getTokenSlotOffset(idx);
    const cos = Math.cos(layout.rotY);
    const sin = Math.sin(layout.rotY);
    const wx = layout.x + off.x * cos + off.z * sin;
    const wz = layout.z - off.x * sin + off.z * cos;

    mesh.position.set(wx, 0.13, wz);
  }

  animateTokenStep(player, targetTileIndex, slotIndex = 0) {
    return new Promise((resolve) => {
      const mesh = this.tokenMeshes[player.id];
      const layout = this.tileMeta[targetTileIndex];
      if (!mesh || !layout) return resolve();

      const off = this.getTokenSlotOffset(slotIndex);
      const cos = Math.cos(layout.rotY);
      const sin = Math.sin(layout.rotY);
      const endX = layout.x + off.x * cos + off.z * sin;
      const endZ = layout.z - off.x * sin + off.z * cos;

      const startX = mesh.position.x;
      const startZ = mesh.position.z;
      const duration = 175 / (this.speedMultiplier || 1);
      const start = performance.now();

      window.soundEngine.playStep();

      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const arc = Math.sin(t * Math.PI) * 0.65;
        mesh.position.x = startX + (endX - startX) * t;
        mesh.position.z = startZ + (endZ - startZ) * t;
        mesh.position.y = 0.13 + arc;

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          mesh.position.set(endX, 0.13, endZ);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  spawnBurst(tileIndex, hexColor = 0xfcd34d) {
    const layout = this.tileMeta[tileIndex];
    if (!layout) return;

    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08),
        new THREE.MeshBasicMaterial({
          color: hexColor,
          transparent: true,
          opacity: 1,
        }),
      );
      p.position.set(layout.x, 0.35, layout.z);
      const angle = (i / 18) * Math.PI * 2;
      const speed = 0.03 + Math.random() * 0.05;
      p.userData = {
        vx: Math.cos(angle) * speed,
        vy: 0.06 + Math.random() * 0.06,
        vz: Math.sin(angle) * speed,
        life: 1.0,
      };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  setCameraPreset(preset, activePlayer = null) {
    this.followPlayerId = null;
    if (preset === 'overview') {
      this.camState.desiredTarget.set(0, 0, 0);
      this.camState.desiredAzimuth = 0;
      this.camState.desiredPolar = 0.86;
      this.camState.desiredDistance = 23.5;
    } else if (preset === 'top') {
      this.camState.desiredTarget.set(0, 0, 0);
      this.camState.desiredAzimuth = 0;
      this.camState.desiredPolar = 0.14;
      this.camState.desiredDistance = 25.0;
    } else if (preset === 'cinematic') {
      this.camState.desiredTarget.set(0, 0.6, 0);
      this.camState.desiredAzimuth = 0.65;
      this.camState.desiredPolar = 1.06;
      this.camState.desiredDistance = 19.5;
    } else if (preset === 'follow' && activePlayer) {
      this.followPlayerId = activePlayer.id;
      this.camState.desiredPolar = 0.78;
      this.camState.desiredDistance = 14.5;
    }
  }

  focusTile(tileIndex) {
    const layout = this.tileMeta[tileIndex];
    if (!layout) return;
    this.followPlayerId = null;
    this.camState.desiredTarget.set(layout.x * 0.45, 0, layout.z * 0.45);
    this.camState.desiredDistance = 17.5;
  }

  bindControls() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.camState.isDragging = true;
      this.camState.dragMoved = false;
      this.camState.lastX = e.clientX;
      this.camState.lastY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.camState.isDragging) return;
      const dx = e.clientX - this.camState.lastX;
      const dy = e.clientY - this.camState.lastY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        this.camState.dragMoved = true;
        this.followPlayerId = null;
      }
      this.camState.lastX = e.clientX;
      this.camState.lastY = e.clientY;

      this.camState.desiredAzimuth -= dx * 0.0065;
      this.camState.desiredPolar = Math.max(
        0.14,
        Math.min(1.28, this.camState.desiredPolar - dy * 0.0055),
      );
    });

    window.addEventListener('pointerup', (e) => {
      if (this.camState.isDragging && !this.camState.dragMoved) {
        this.handleCanvasClick(e);
      }
      this.camState.isDragging = false;
    });

    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camState.desiredDistance = Math.max(
          10.5,
          Math.min(34, this.camState.desiredDistance + e.deltaY * 0.012),
        );
      },
      { passive: false },
    );
  }

  handleCanvasClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.tileMeshes, false);
    if (hits.length > 0 && this.onTileClick) {
      const idx = hits[0].object.userData.tileIndex;
      if (typeof idx === 'number') {
        this.onTileClick(idx);
      }
    }
  }

  onResize() {
    if (!this.renderer || !this.camera) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    // Rotate central Teyvat Astrolabe
    if (this.astrolabeGroup) {
      const { outerRing, innerRing, core } = this.astrolabeGroup.userData;
      outerRing.rotation.z += dt * 0.35;
      innerRing.rotation.y += dt * 0.55;
      core.rotation.y -= dt * 0.8;
      this.astrolabeGroup.position.y = 1.35 + Math.sin(elapsed * 1.8) * 0.12;
    }

    // Gentle float & spin on 3D Gnosis tokens
    Object.values(this.tokenMeshes).forEach((tokenGroup, idx) => {
      tokenGroup.traverse((child) => {
        if (child.userData && child.userData.isGnosisPiece) {
          child.rotation.y += dt * 0.65;
          const baseY = child.userData.baseY ?? 0.68;
          child.position.y = baseY + Math.sin(elapsed * 2.2 + idx * 1.1) * 0.03;
        }
      });
    });

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.x += p.userData.vx;
      p.position.y += p.userData.vy;
      p.position.z += p.userData.vz;
      p.userData.vy -= 0.0025;
      p.userData.life -= dt * 1.4;
      p.material.opacity = Math.max(0, p.userData.life);
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
      }
    }

    // Follow active player if toggled
    if (this.followPlayerId && this.tokenMeshes[this.followPlayerId]) {
      const pos = this.tokenMeshes[this.followPlayerId].position;
      this.camState.desiredTarget.set(pos.x * 0.65, 0, pos.z * 0.65);
    }

    // Smooth camera interpolation
    const lerp = 1 - Math.pow(0.001, dt);
    this.camState.target.lerp(this.camState.desiredTarget, lerp);
    this.camState.azimuth +=
      (this.camState.desiredAzimuth - this.camState.azimuth) * lerp;
    this.camState.polar +=
      (this.camState.desiredPolar - this.camState.polar) * lerp;
    this.camState.distance +=
      (this.camState.desiredDistance - this.camState.distance) * lerp;

    const r = this.camState.distance;
    const sinP = Math.sin(this.camState.polar);
    this.camera.position.set(
      this.camState.target.x + r * sinP * Math.sin(this.camState.azimuth),
      this.camState.target.y + r * Math.cos(this.camState.polar),
      this.camState.target.z + r * sinP * Math.cos(this.camState.azimuth),
    );
    this.camera.lookAt(this.camState.target);

    this.renderer.render(this.scene, this.camera);
  }
}

window.BoardRenderer3D = BoardRenderer3D;
