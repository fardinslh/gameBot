import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const WIDTH = 2048;
const HEIGHT = 3072;

// The clean canvas terrain master is authored at genuine 2048x3072 resolution.
// It features:
// - Low-frequency organic ground gradients (no photographic noise, no pixel speckle)
// - Crisp, intentionally authored vector edges for roads, courtyards, riverbanks, and bridge
// - Strict registration with KINGDOM_BUILDING_LAYOUT and kingdom-base-v3 landmarks
// - Directional lighting from top-left (45 degrees) with warm highlights and cool shadows

function buildMasterSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <!-- Lighting Gradients -->
    <linearGradient id="globalLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4d6935" />
      <stop offset="35%" stop-color="#445e2e" />
      <stop offset="70%" stop-color="#384f25" />
      <stop offset="100%" stop-color="#2d401e" />
    </linearGradient>

    <!-- Mountain Gradient -->
    <linearGradient id="mountainRidge" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#4e584a" />
      <stop offset="40%" stop-color="#3f473c" />
      <stop offset="85%" stop-color="#2c3329" />
      <stop offset="100%" stop-color="#21271f" />
    </linearGradient>

    <!-- Castle Courtyard Flagstone Radial -->
    <radialGradient id="castlePlazaGrad" cx="48%" cy="46%" r="55%">
      <stop offset="0%" stop-color="#b8a788" />
      <stop offset="55%" stop-color="#9e8d70" />
      <stop offset="85%" stop-color="#7a6c54" />
      <stop offset="100%" stop-color="#5a4e3b" />
    </radialGradient>

    <!-- Market Plaza Radial -->
    <radialGradient id="marketPlazaGrad" cx="48%" cy="48%" r="52%">
      <stop offset="0%" stop-color="#a89578" />
      <stop offset="60%" stop-color="#8c7a5f" />
      <stop offset="90%" stop-color="#6a5b44" />
      <stop offset="100%" stop-color="#4e4230" />
    </radialGradient>

    <!-- Road Gradient -->
    <linearGradient id="mainRoadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5c4f3d" />
      <stop offset="12%" stop-color="#917f65" />
      <stop offset="50%" stop-color="#a49378" />
      <stop offset="88%" stop-color="#8a795f" />
      <stop offset="100%" stop-color="#4a3e2e" />
    </linearGradient>

    <!-- Farm Soil Gradient -->
    <radialGradient id="farmSoilGrad" cx="45%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#7a5d38" />
      <stop offset="50%" stop-color="#634b2c" />
      <stop offset="80%" stop-color="#4f3b22" />
      <stop offset="100%" stop-color="#3b2b18" />
    </radialGradient>

    <!-- Lumber Yard Gradient -->
    <radialGradient id="lumberYardGrad" cx="50%" cy="48%" r="58%">
      <stop offset="0%" stop-color="#8c6d44" />
      <stop offset="55%" stop-color="#735633" />
      <stop offset="85%" stop-color="#574024" />
      <stop offset="100%" stop-color="#3e2d18" />
    </radialGradient>

    <!-- Mine Quarry Gradient -->
    <radialGradient id="mineQuarryGrad" cx="45%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#757064" />
      <stop offset="45%" stop-color="#5a564c" />
      <stop offset="80%" stop-color="#433f37" />
      <stop offset="100%" stop-color="#2d2a24" />
    </radialGradient>

    <!-- River Water Gradient -->
    <linearGradient id="riverGrad" x1="0%" y1="20%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2f6266" />
      <stop offset="35%" stop-color="#214b52" />
      <stop offset="70%" stop-color="#193b42" />
      <stop offset="100%" stop-color="#11292e" />
    </linearGradient>

    <!-- River Sand Shallows -->
    <linearGradient id="riverBankShallows" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#698565" />
      <stop offset="50%" stop-color="#486955" />
      <stop offset="100%" stop-color="#2c4f42" />
    </linearGradient>

    <!-- Bridge Stonework Gradient -->
    <linearGradient id="bridgeStone" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#484134" />
      <stop offset="15%" stop-color="#827662" />
      <stop offset="50%" stop-color="#9a8c76" />
      <stop offset="85%" stop-color="#7c6f5a" />
      <stop offset="100%" stop-color="#3b352a" />
    </linearGradient>

    <!-- Soft Blur Filter for Smooth Ground Transitions -->
    <filter id="softTerrainBlend" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="32" />
    </filter>
    <filter id="mediumBlend" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="16" />
    </filter>
    <filter id="subtleBlend" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="8" />
    </filter>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" />
    </filter>
  </defs>

  <!-- ========================================== -->
  <!-- 1. BASE MEADOW & TOPOGRAPHY                -->
  <!-- ========================================== -->
  <!-- Deep base fill -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#globalLight)" />

  <!-- Mountainous North Ridge (Y: 0 to 520) -->
  <path d="M 0 0 L 2048 0 L 2048 440 Q 1700 480 1400 420 Q 1100 360 800 460 Q 500 520 200 440 Q 80 400 0 380 Z" fill="url(#mountainRidge)" />

  <!-- Mountain Rocky Escarpments & Strata -->
  <g opacity="0.6">
    <!-- Mountain Face 1 (Upper Left) -->
    <polygon points="0,80 340,60 480,240 220,380 0,320" fill="#586152" />
    <polygon points="120,70 340,60 480,240 310,210" fill="#717a6a" opacity="0.5" />
    <!-- Mountain Face 2 (Upper Center) -->
    <polygon points="760,40 1260,30 1340,260 980,310 680,220" fill="#4d5447" />
    <polygon points="880,35 1260,30 1140,180 820,160" fill="#67705f" opacity="0.6" />
    <!-- Mountain Face 3 (Upper Right) -->
    <polygon points="1420,70 2048,40 2048,360 1780,410 1560,280" fill="#545e4e" />
    <polygon points="1600,60 2048,40 1960,220 1680,200" fill="#6f7a68" opacity="0.5" />
  </g>

  <!-- Subtle Elevation Shading (Low-Frequency Hills) -->
  <g filter="url(#softTerrainBlend)" opacity="0.55">
    <!-- Castle Plateau Rise (Center Y: 1000..1650) -->
    <ellipse cx="1024" cy="1330" rx="640" ry="460" fill="#58783e" />
    <!-- Market Basin Rise (Center Y: 2100..2550) -->
    <ellipse cx="1024" cy="2340" rx="580" ry="380" fill="#4f6e35" />
    <!-- Western Agriculture Slope -->
    <ellipse cx="560" cy="1916" rx="420" ry="360" fill="#506634" />
    <!-- Eastern Forest Slope -->
    <ellipse cx="1488" cy="1916" rx="420" ry="360" fill="#3c5226" />
    <!-- Valley Shadows (Cool shaded depressions) -->
    <path d="M 0 1600 Q 400 1500 700 1680 Q 900 1760 1024 1720 Q 1200 1680 1500 1760 Q 1800 1650 2048 1600 L 2048 1800 Q 1600 1900 1024 1850 Q 500 1900 0 1780 Z" fill="#293b1b" opacity="0.7" />
  </g>

  <!-- ========================================== -->
  <!-- 2. DISTRICT WORK-GROUND APRONS             -->
  <!-- ========================================== -->

  <!-- A. Mine Quarry Excavation (Center: 674, 730) -->
  <g id="mine-quarry">
    <!-- Soft outer quarry depression -->
    <path d="M 440 600 Q 674 520 880 580 Q 940 760 840 890 Q 674 960 500 880 Q 400 750 440 600 Z" fill="#383d32" filter="url(#mediumBlend)" opacity="0.7" />
    <!-- Terraced Rock Quarry Floor -->
    <polygon points="490,630 674,580 840,640 870,780 790,870 570,880 470,770" fill="url(#mineQuarryGrad)" stroke="#323028" stroke-width="6" />
    <!-- Inner quarry steps and rock scree -->
    <polygon points="530,660 674,620 790,670 810,770 740,840 580,840 510,750" fill="#666155" opacity="0.6" />
    <polygon points="560,700 674,670 740,710 750,770 700,810 600,810 550,760" fill="#7d786b" opacity="0.5" />
    <!-- Quarry cart trail exit -->
    <path d="M 674 850 Q 690 920 740 980" stroke="#5a5446" stroke-width="32" stroke-linecap="round" fill="none" opacity="0.8" />
  </g>

  <!-- B. Blacksmith Forge Yard (Center: 560, 330) -->
  <g id="blacksmith-yard">
    <ellipse cx="560" cy="330" rx="170" ry="120" fill="#2d2822" filter="url(#subtleBlend)" opacity="0.7" />
    <polygon points="440,300 560,250 670,300 680,370 560,410 430,360" fill="#484239" stroke="#2b2721" stroke-width="5" />
    <!-- Hearth apron flagstone -->
    <polygon points="480,320 560,280 630,320 630,360 560,390 470,350" fill="#5c5449" opacity="0.7" />
  </g>

  <!-- C. Workshop Engineering Yard (Center: 1054, 340) -->
  <g id="workshop-yard">
    <ellipse cx="1054" cy="340" rx="180" ry="125" fill="#36291a" filter="url(#subtleBlend)" opacity="0.7" />
    <polygon points="930,310 1054,260 1170,310 1180,380 1054,420 920,370" fill="#634e35" stroke="#3b2d1c" stroke-width="5" />
    <!-- Compacted gravel staging -->
    <polygon points="970,325 1054,290 1130,325 1140,370 1054,400 960,365" fill="#7d6446" opacity="0.7" />
  </g>

  <!-- D. Watchtower Defensive Terrace (Center: 1488, 600) -->
  <g id="watchtower-terrace">
    <ellipse cx="1488" cy="600" rx="160" ry="110" fill="#32342c" filter="url(#subtleBlend)" opacity="0.7" />
    <polygon points="1380,570 1488,520 1590,570 1600,640 1488,680 1370,630" fill="#615e52" stroke="#37362d" stroke-width="5" />
    <polygon points="1415,580 1488,545 1555,580 1560,630 1488,660 1410,620" fill="#7a7668" opacity="0.7" />
  </g>

  <!-- E. Academy Scholarly Terrace (Center: 1204, 840) -->
  <g id="academy-terrace">
    <ellipse cx="1204" cy="840" rx="180" ry="120" fill="#35372f" filter="url(#subtleBlend)" opacity="0.65" />
    <polygon points="1090,810 1204,760 1310,810 1320,880 1204,920 1080,870" fill="#757063" stroke="#423f37" stroke-width="5" />
    <!-- Paved stone terrace -->
    <polygon points="1125,820 1204,785 1275,820 1280,865 1204,900 1120,860" fill="#8f897b" opacity="0.75" />
  </g>

  <!-- F. Farm Field & Loam (Center: 560, 1916) -->
  <g id="farm-field">
    <!-- Soft outer tilled zone -->
    <path d="M 280 1800 Q 560 1680 840 1780 Q 900 1960 820 2080 Q 560 2160 300 2060 Q 220 1940 280 1800 Z" fill="#4d3820" filter="url(#mediumBlend)" opacity="0.7" />
    <!-- Primary furrowed field boundary -->
    <polygon points="340,1830 560,1750 780,1830 810,1980 730,2070 480,2080 320,1970" fill="url(#farmSoilGrad)" stroke="#3d2c18" stroke-width="6" />
    <!-- Crisp stylized furrows (angled 25 deg) -->
    <g stroke="#382714" stroke-width="8" opacity="0.6" stroke-linecap="round">
      <line x1="380" y1="1870" x2="680" y2="1820" />
      <line x1="370" y1="1910" x2="730" y2="1860" />
      <line x1="370" y1="1950" x2="760" y2="1900" />
      <line x1="390" y1="1990" x2="760" y2="1940" />
      <line x1="420" y1="2030" x2="720" y2="1980" />
      <line x1="480" y1="2060" x2="680" y2="2020" />
    </g>
  </g>

  <!-- G. Lumber Mill Yard (Center: 1488, 1916) -->
  <g id="lumber-yard">
    <!-- Soft outer clearing -->
    <path d="M 1240 1790 Q 1488 1700 1740 1790 Q 1810 1950 1730 2080 Q 1488 2150 1240 2070 Q 1170 1940 1240 1790 Z" fill="#523d22" filter="url(#mediumBlend)" opacity="0.65" />
    <!-- Saw-pit clearing -->
    <polygon points="1280,1820 1488,1750 1690,1820 1710,1980 1640,2070 1420,2080 1260,1970" fill="url(#lumberYardGrad)" stroke="#453119" stroke-width="6" />
    <!-- Inner sawdust core -->
    <ellipse cx="1488" cy="1916" rx="140" ry="90" fill="#a48152" opacity="0.4" />
  </g>

  <!-- H. Grand Market Plaza (Center: 1024, 2344) -->
  <g id="market-plaza">
    <!-- Soft outer worn dirt buffer -->
    <ellipse cx="1024" cy="2344" rx="340" ry="240" fill="#4a3e2a" filter="url(#mediumBlend)" opacity="0.7" />
    <!-- Primary Cobblestone Plaza -->
    <polygon points="820,2300 930,2190 1024,2160 1118,2190 1228,2300 1228,2388 1118,2498 1024,2528 930,2498 820,2388" fill="url(#marketPlazaGrad)" stroke="#423522" stroke-width="8" />
    <!-- Concentric Paver Rings -->
    <polygon points="870,2315 950,2230 1024,2210 1098,2230 1178,2315 1178,2375 1098,2455 1024,2480 950,2455 870,2375" fill="none" stroke="#685741" stroke-width="4" opacity="0.7" />
    <ellipse cx="1024" cy="2344" rx="90" ry="60" fill="#a49174" opacity="0.5" stroke="#594a37" stroke-width="3" />
  </g>

  <!-- I. Castle Grand Courtyard (Center: 1024, 1330) -->
  <g id="castle-courtyard">
    <!-- Soft outer terrace elevation -->
    <ellipse cx="1024" cy="1330" rx="360" ry="260" fill="#3c3629" filter="url(#mediumBlend)" opacity="0.75" />
    <!-- Formal Royal Flagstone Hexagon -->
    <polygon points="790,1330 900,1190 1024,1150 1148,1190 1258,1330 1258,1420 1148,1510 1024,1540 900,1510 790,1420" fill="url(#castlePlazaGrad)" stroke="#4a3e2e" stroke-width="10" />
    <!-- Inner curb border -->
    <polygon points="830,1330 925,1220 1024,1185 1123,1220 1218,1330 1218,1405 1123,1475 1024,1505 925,1475 830,1405" fill="none" stroke="#6d5d47" stroke-width="5" opacity="0.85" />
    <!-- Central Paved Medallion Base -->
    <ellipse cx="1024" cy="1330" rx="140" ry="90" fill="#c4b497" opacity="0.55" stroke="#6d5e4a" stroke-width="4" />
  </g>

  <!-- ========================================== -->
  <!-- 3. ROAD & PATH NETWORK                     -->
  <!-- ========================================== -->

  <!-- Secondary Working Roads (Dirt & Gravel) -->
  <g id="secondary-roads" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- Road to Farm: from Main road (1024, 1860) curving to Farm (660, 1916) -->
    <path d="M 1024 1860 Q 860 1850 680 1916" stroke="#483925" stroke-width="46" />
    <path d="M 1024 1860 Q 860 1850 680 1916" stroke="#7d674b" stroke-width="38" />
    <path d="M 1024 1860 Q 860 1850 680 1916" stroke="#947c5d" stroke-width="24" opacity="0.8" />

    <!-- Road to Lumber Mill: from Main road (1024, 1860) curving to Mill (1380, 1916) -->
    <path d="M 1024 1860 Q 1180 1850 1360 1916" stroke="#483925" stroke-width="46" />
    <path d="M 1024 1860 Q 1180 1850 1360 1916" stroke="#7d674b" stroke-width="38" />
    <path d="M 1024 1860 Q 1180 1850 1360 1916" stroke="#947c5d" stroke-width="24" opacity="0.8" />

    <!-- Mountain Trail to Mine: from Castle (900, 1220) winding to Mine (740, 880) -->
    <path d="M 900 1220 Q 820 1140 840 1020 Q 850 940 760 880" stroke="#3b372f" stroke-width="36" />
    <path d="M 900 1220 Q 820 1140 840 1020 Q 850 940 760 880" stroke="#686254" stroke-width="28" />
    <path d="M 900 1220 Q 820 1140 840 1020 Q 850 940 760 880" stroke="#827b6c" stroke-width="16" opacity="0.8" />

    <!-- Mountain Trail to Workshop & Blacksmith: from Castle North (1024, 1150) -->
    <path d="M 1024 1150 Q 1040 800 1054 420" stroke="#3d372c" stroke-width="32" />
    <path d="M 1024 1150 Q 1040 800 1054 420" stroke="#756956" stroke-width="24" />
    <!-- Branch to Blacksmith (560, 390) -->
    <path d="M 1035 700 Q 850 620 620 390" stroke="#3d372c" stroke-width="30" />
    <path d="M 1035 700 Q 850 620 620 390" stroke="#756956" stroke-width="22" />

    <!-- Mountain Trail to Academy & Watchtower: from Castle NE (1120, 1220) -->
    <path d="M 1120 1220 Q 1220 1120 1204 920" stroke="#3d3931" stroke-width="32" />
    <path d="M 1120 1220 Q 1220 1120 1204 920" stroke="#766f61" stroke-width="24" />
    <!-- Branch to Watchtower (1488, 680) -->
    <path d="M 1204 920 Q 1340 820 1488 680" stroke="#3d3931" stroke-width="30" />
    <path d="M 1204 920 Q 1340 820 1488 680" stroke="#766f61" stroke-width="22" />
  </g>

  <!-- Primary Imperial Thoroughfare (Cobblestone Highway) -->
  <g id="primary-thoroughfare">
    <!-- North Section: Castle South (1024, 1540) to Market North (1024, 2160) -->
    <path d="M 1024 1540 L 1024 2160" stroke="#3a3022" stroke-width="58" stroke-linecap="butt" />
    <path d="M 1024 1540 L 1024 2160" stroke="url(#mainRoadGrad)" stroke-width="50" stroke-linecap="butt" />
    <!-- Subtle paver highlights -->
    <path d="M 1024 1540 L 1024 2160" stroke="#b09f83" stroke-width="12" stroke-dasharray="16,24" opacity="0.6" stroke-linecap="butt" />

    <!-- South Section: Market South (1024, 2528) to Bridge North (1024, 2780) -->
    <path d="M 1024 2528 L 1024 2780" stroke="#3a3022" stroke-width="58" stroke-linecap="butt" />
    <path d="M 1024 2528 L 1024 2780" stroke="url(#mainRoadGrad)" stroke-width="50" stroke-linecap="butt" />
    <path d="M 1024 2528 L 1024 2780" stroke="#b09f83" stroke-width="12" stroke-dasharray="16,24" opacity="0.6" stroke-linecap="butt" />
  </g>

  <!-- ========================================== -->
  <!-- 4. RIVER, BANKS, AND STONE BRIDGE          -->
  <!-- ========================================== -->
  <g id="river-system">
    <!-- Sandy Shallows / Erosion Basin Underlay -->
    <path d="M -40 2620 Q 300 2580 620 2640 Q 900 2700 1024 2760 Q 1200 2820 1500 2760 Q 1800 2680 2088 2620 L 2088 2980 Q 1800 3040 1500 2980 Q 1200 2920 1024 2980 Q 800 3040 500 2980 Q 200 2920 -40 2980 Z" fill="url(#riverBankShallows)" />

    <!-- Deep Water Flow Channel -->
    <path d="M -40 2660 Q 300 2620 620 2680 Q 900 2740 1024 2800 Q 1200 2860 1500 2800 Q 1800 2720 2088 2660 L 2088 2920 Q 1800 2980 1500 2920 Q 1200 2870 1024 2930 Q 800 2990 500 2930 Q 200 2870 -40 2930 Z" fill="url(#riverGrad)" stroke="#1a3f47" stroke-width="8" />

    <!-- Subtle Water Flow Highlights -->
    <g stroke="#4da8b0" stroke-width="4" opacity="0.35" fill="none" stroke-linecap="round">
      <path d="M 80 2710 Q 350 2670 600 2720" />
      <path d="M 680 2740 Q 880 2790 960 2815" />
      <path d="M 1090 2865 Q 1280 2875 1460 2835" />
      <path d="M 1540 2815 Q 1780 2760 1980 2710" />
      <path d="M 220 2840 Q 520 2860 820 2890" />
      <path d="M 1240 2900 Q 1520 2900 1820 2840" />
    </g>

    <!-- Riverbank Stone Outcrops -->
    <g fill="#4d4739" stroke="#2b281f" stroke-width="3">
      <ellipse cx="280" cy="2650" rx="35" ry="20" />
      <ellipse cx="580" cy="2700" rx="42" ry="24" />
      <ellipse cx="880" cy="2755" rx="38" ry="22" />
      <ellipse cx="1180" cy="2830" rx="40" ry="24" />
      <ellipse cx="1480" cy="2775" rx="44" ry="25" />
      <ellipse cx="1780" cy="2705" rx="36" ry="21" />

      <ellipse cx="360" cy="2915" rx="40" ry="22" />
      <ellipse cx="680" cy="2960" rx="44" ry="25" />
      <ellipse cx="1340" cy="2930" rx="38" ry="22" />
      <ellipse cx="1660" cy="2875" rx="42" ry="24" />
    </g>

    <!-- ARMED STONE BRIDGE (Span across Y: 2780..2960, Centered at X: 1024) -->
    <!-- Bridge Shadow onto Water -->
    <rect x="940" y="2790" width="168" height="170" fill="#081417" opacity="0.75" filter="url(#softShadow)" />

    <!-- Bridge Abutments (Stone piers on north and south banks) -->
    <polygon points="940,2770 1108,2770 1118,2810 930,2810" fill="#4d4536" stroke="#2d281f" stroke-width="4" />
    <polygon points="930,2930 1118,2930 1108,2970 940,2970" fill="#4d4536" stroke="#2d281f" stroke-width="4" />

    <!-- Bridge Main Arch Roadway Deck -->
    <polygon points="944,2775 1104,2775 1104,2965 944,2965" fill="url(#bridgeStone)" stroke="#383226" stroke-width="6" />

    <!-- Bridge Parapet Walls (Raised stone side barriers) -->
    <!-- West Parapet (Cast shadow side) -->
    <rect x="936" y="2770" width="16" height="200" fill="#5a5141" stroke="#322d23" stroke-width="3" />
    <rect x="940" y="2772" width="6" height="196" fill="#3c3529" />
    <!-- East Parapet (Sunlit side) -->
    <rect x="1096" y="2770" width="16" height="200" fill="#756b57" stroke="#322d23" stroke-width="3" />
    <rect x="1098" y="2772" width="6" height="196" fill="#8f836c" />

    <!-- Bridge Deck Cobblestone Pavers -->
    <g stroke="#544a3b" stroke-width="2" opacity="0.6">
      <line x1="954" y1="2805" x2="1094" y2="2805" />
      <line x1="954" y1="2840" x2="1094" y2="2840" />
      <line x1="954" y1="2875" x2="1094" y2="2875" />
      <line x1="954" y1="2910" x2="1094" y2="2910" />
      <line x1="954" y1="2945" x2="1094" y2="2945" />
    </g>

    <!-- South Road Extension from Bridge Out of Map -->
    <path d="M 1024 2965 L 1024 3072" stroke="#3a3022" stroke-width="56" stroke-linecap="butt" />
    <path d="M 1024 2965 L 1024 3072" stroke="url(#mainRoadGrad)" stroke-width="48" stroke-linecap="butt" />
  </g>

  <!-- ========================================== -->
  <!-- 5. STYLIZED FOLIAGE & TREE CANOPIES        -->
  <!-- ========================================== -->
  <!-- Smooth organic tree masses framing the world borders without noisy speckle -->
  <g id="stylized-foliage">
    <!-- Mountain Pines (Upper Perimeter) -->
    <g fill="#2d3d24" stroke="#1c2616" stroke-width="4">
      <polygon points="120,240 160,160 200,240" />
      <polygon points="180,260 220,170 260,260" />
      <polygon points="260,250 300,165 340,250" />
      <polygon points="720,200 760,120 800,200" />
      <polygon points="780,210 820,130 860,210" />
      <polygon points="1280,240 1320,150 1360,240" />
      <polygon points="1340,250 1380,160 1420,250" />
      <polygon points="1680,260 1720,170 1760,260" />
      <polygon points="1740,270 1780,180 1820,270" />
    </g>

    <!-- West Edge Forest Canopy (X: 0..160) -->
    <g fill="#374d28" stroke="#223018" stroke-width="5">
      <circle cx="60" cy="1100" r="75" />
      <circle cx="80" cy="1220" r="85" fill="#425c30" />
      <circle cx="50" cy="1350" r="80" />
      <circle cx="70" cy="1480" r="90" fill="#425c30" />
      <circle cx="40" cy="1620" r="85" />
      <circle cx="60" cy="2250" r="80" fill="#3f582e" />
      <circle cx="80" cy="2380" r="85" fill="#466233" />
      <circle cx="50" cy="2500" r="75" />
    </g>

    <!-- East Edge Forest Canopy (X: 1888..2048) -->
    <g fill="#374d28" stroke="#223018" stroke-width="5">
      <circle cx="1980" cy="1100" r="80" />
      <circle cx="1960" cy="1230" r="85" fill="#425c30" />
      <circle cx="1990" cy="1360" r="80" />
      <circle cx="1970" cy="1490" r="90" fill="#425c30" />
      <circle cx="2000" cy="1630" r="85" />
      <circle cx="1980" cy="2250" r="80" fill="#3f582e" />
      <circle cx="1960" cy="2390" r="85" fill="#466233" />
      <circle cx="1990" cy="2510" r="75" />
    </g>

    <!-- Riverbank Willows (Organic Clumps) -->
    <g fill="#3e5932" stroke="#24361d" stroke-width="4">
      <circle cx="220" cy="2600" r="48" fill="#48693a" />
      <circle cx="760" cy="2660" r="42" fill="#48693a" />
      <circle cx="1280" cy="2760" r="45" fill="#48693a" />
      <circle cx="1680" cy="2680" r="50" fill="#48693a" />
      <circle cx="420" cy="2990" r="46" fill="#3f5c31" />
      <circle cx="1420" cy="2990" r="48" fill="#3f5c31" />
    </g>
  </g>
</svg>`;
}

async function generateMaster() {
  const masterDir = path.resolve('art-source', 'terrain');
  fs.mkdirSync(masterDir, { recursive: true });
  const masterPngPath = path.join(masterDir, 'kingdom-base-v5-master.png');

  console.log(`Generating Clean Canvas Master SVG at native ${WIDTH}x${HEIGHT}...`);
  const svgString = buildMasterSvg();
  const svgBuffer = Buffer.from(svgString, 'utf-8');

  console.log(`Rendering native lossless master PNG to ${masterPngPath}...`);
  const pngInfo = await sharp(svgBuffer, { density: 72 })
    .resize(WIDTH, HEIGHT)
    .png({ compressionLevel: 9 })
    .toFile(masterPngPath);

  console.log('Master PNG generated successfully:', pngInfo);
  if (pngInfo.width !== WIDTH || pngInfo.height !== HEIGHT) {
    throw new Error(`Master dimensions mismatch: expected ${WIDTH}x${HEIGHT}, got ${pngInfo.width}x${pngInfo.height}`);
  }
}

generateMaster().catch((err) => {
  console.error('Master generation failed:', err);
  process.exit(1);
});
