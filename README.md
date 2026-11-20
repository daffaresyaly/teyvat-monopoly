# 3D Genshin Monopoly — Chronicles of Mora

A self-contained 3D WebGL board game inspired by Genshin Impact, built with **Three.js**, procedural HTML5 Canvas high-DPI tile textures, custom vector elemental emblems, and Web Audio API synthesized sound effects.

## How to Run
1. Extract this `.zip` archive anywhere on your computer.
2. Double-click **`index.html`** to open it directly in any modern browser (Chrome, Edge, Firefox, Safari) — or serve the folder with any static server (e.g., `npx serve .` or `python -m http.server`).
3. Note: Three.js is loaded from `cdnjs.cloudflare.com`. An active internet connection is only needed to load the Three.js library script; all game textures, 3D geometries, emblems, and audio are generated locally with zero external image/audio dependencies.

## Included Game Systems
- **40-Tile Teyvat Board:**
  - **8 Major Nations (24 Minor Properties):** Mondstadt (Anemo), Liyue (Geo), Inazuma (Electro), Sumeru (Dendro), Fontaine (Hydro), Natlan (Pyro), Nod-Krai (Lunar), and Snezhnaya (Cryo — culminating in **Novokitezhgrad**).
  - **4 Expedition Realms (Railroads):** The Chasm, Enkanomiya, Sea of Bygone Eras, Ancient Sacred Mountain.
  - **2 Cosmic Grids (Utilities):** Temple of Space, Frost Moon (5× / 12× dice roll).
  - **4 Corners & 2 Taxes:** Adventurers' Guild (GO), Fortress of Meropide (Jail), Serenitea Pot (Free Parking), Detained by the Gardes (Go To Jail), Northland Bank Debt (200 Mora), and Dori's "Special Discount" (250 Mora).
- **8 Playable Archon Tokens & Passives:** Venti, Zhongli, Raiden Shogun, Nahida, Furina, Mavuika, The Tsaritsa, and Columbina.
- **12 Elemental Resonances:** Automatically trigger when you own all 3 minor areas in two compatible nations (Vaporize, Melt, Overloaded, Burning, Frozen, Electro-Charged, Bloom, Quicken, Superconduct, Swirl, Crystallize, and Lunar Surge).
- **6 Rotating Ley Line Disorders:** Shift every 4 full rounds, dynamically changing board lighting and global rules.
- **Full Card Decks:** 16 **Event Wish** (Chance) cards and 16 **Daily Commission** (Community Chest) cards.

## Optional Custom Portrait Overrides
If you ever want to add your own local PNG portraits into the project, place them inside `assets/custom/` and list their filenames in `assets/custom/manifest.json`.
