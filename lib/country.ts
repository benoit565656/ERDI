// 3-Letter (ISO/ADB) to 2-Letter ISO Country Code Mapping for Flags
export const ISO3_TO_ISO2: Record<string, string> = {
  AFG: 'af', ARM: 'am', AUS: 'au', AZE: 'az', BAN: 'bd', BGD: 'bd', BTN: 'bt', BHU: 'bt',
  BRN: 'bn', BRU: 'bn', KHM: 'kh', CAM: 'kh', CHN: 'cn', PRC: 'cn', COK: 'ck', COO: 'ck',
  FJI: 'fj', FIJ: 'fj', GEO: 'ge', HKG: 'hk', IND: 'in', IDN: 'id', INO: 'id', JPN: 'jp',
  KAZ: 'kz', KIR: 'ki', KOR: 'kr', KGZ: 'kg', LAO: 'la', MYS: 'my', MAL: 'my', MDV: 'mv',
  MLD: 'mv', MHL: 'mh', MSH: 'mh', RMI: 'mh', FSM: 'fm', MNG: 'mn', MON: 'mn', MMR: 'mm',
  MYA: 'mm', NRU: 'nr', NAU: 'nr', NPL: 'np', NEP: 'np', NZL: 'nz', PAK: 'pk', PLW: 'pw',
  PAL: 'pw', PNG: 'pg', PHL: 'ph', PHI: 'ph', WSM: 'ws', SAM: 'ws', SGP: 'sg', SIN: 'sg',
  SLB: 'sb', SOL: 'sb', LKA: 'lk', SRI: 'lk', TWN: 'tw', TAP: 'tw', TJK: 'tj', TAJ: 'tj',
  THA: 'th', TLS: 'tl', TIM: 'tl', TON: 'to', TKM: 'tm', TUV: 'tv', UZB: 'uz', VUT: 'vu',
  VAN: 'vu', VNM: 'vn', VIE: 'vn', NIU: 'nu',
  
  // Other countries in DB
  ALB: 'al', AND: 'ad', AUT: 'at', BLR: 'by', BIH: 'ba', BGR: 'bg', GBR: 'gb', UKG: 'gb',
  HRV: 'hr', CYP: 'cy', CZE: 'cz', DEN: 'dk', EST: 'ee', FRO: 'fo', FIN: 'fi', FRA: 'fr',
  GER: 'de', DEU: 'de', GIB: 'gi', GRC: 'gr', HUN: 'hu', ISL: 'is', IRE: 'ie', IRL: 'ie',
  IMN: 'im', ITA: 'it', LVA: 'lv', LIE: 'li', LTU: 'lt', LUX: 'lu', MLT: 'mt', MCO: 'mc',
  MNE: 'me', NET: 'nl', NOR: 'no', POL: 'pl', MDA: 'md', ROU: 'ro', RUS: 'ru', SMR: 'sm',
  SRB: 'rs', SVK: 'sk', SVN: 'si', SPA: 'es', ESP: 'es', SWE: 'se', CHE: 'ch', UKR: 'ua',
  AIA: 'ai', ATG: 'ag', ARG: 'ar', ABW: 'aw', BHS: 'bs', BRB: 'bb', BLZ: 'bz', BRA: 'br',
  VGB: 'vg', BES: 'bq', CYM: 'ky', CHL: 'cl', COL: 'co', CRI: 'cr', CUB: 'cu', CUW: 'cw',
  DMA: 'dm', DOM: 'do', ECU: 'ec', SLV: 'sv', FLK: 'fk', GUF: 'gf', GRD: 'gd', GLP: 'gp',
  GTM: 'gt', GUY: 'gy', HTI: 'ht', HND: 'hn', JAM: 'jm', MTQ: 'mq', MEX: 'mx', MSR: 'ms',
  NIC: 'ni', PAN: 'pa', PRY: 'py', PER: 'pe', PRI: 'pr', SXM: 'sx', KNA: 'kn', LCA: 'lc',
  VCT: 'vc', SUR: 'sr', VEN: 've', BOL: 'bo', TTO: 'tt', TCA: 'tc', VIR: 'vi', URY: 'uy',
  CAN: 'ca', USA: 'us', BHR: 'bh', BWA: 'bw', COD: 'cd', LBR: 'lr', MDG: 'mg', NGA: 'ng',
  SDN: 'sd', BEL: 'be', VAT: 'va', COG: 'cg', CIV: 'ci', DJI: 'dj', EGY: 'eg', GNQ: 'gq',
  ERI: 'er', SWZ: 'sz', ETH: 'et', GAB: 'ga', GMB: 'gm', GHA: 'gh', GIN: 'gn', GNB: 'gw',
  KEN: 'ke', LSO: 'ls', LBY: 'ly', MWI: 'mw', MLI: 'ml', MRT: 'mr', MUS: 'mu', MYT: 'yt',
  MAR: 'ma', MOZ: 'mz', NAM: 'na', NER: 'ne', REU: 're', RWA: 'rw', STP: 'st', SEN: 'sn',
  SYC: 'sc', SLE: 'sl', SOM: 'so', ZAF: 'za', SSD: 'ss', SHN: 'sh', TZA: 'tz', TGO: 'tg',
  TUN: 'tn', UGA: 'ug', ESH: 'eh', ZMB: 'zm', ZWE: 'zw', TUR: 'tr', IRN: 'ir', IRQ: 'iq',
  ISR: 'il', JOR: 'jo', KWT: 'kw', LBN: 'lb', OMN: 'om', QAT: 'qa', SAU: 'sa', SYR: 'sy',
  ARE: 'ae', YEM: 'ye', DZA: 'dz', AGO: 'ao', BEN: 'bj', BFA: 'bf', BDI: 'bi', CMR: 'cm',
  CPV: 'cv', CAF: 'cf', TCD: 'td', COM: 'km', POR: 'pt', MKD: 'mk'
};

// Capitalizes the first letter of each word in a string
export function capitalizeWords(str: string): string {
  if (!str) return '';
  return str
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Formats multiplier and unit name cleanly, ignoring placeholder/Units/0 multipliers and capitalizing words
export function formatUnit(multiplier?: string, unit?: string): string {
  let mult = multiplier && multiplier.toLowerCase() !== 'units' && multiplier !== '0'
    ? multiplier
    : '';
  let u = unit || '';
  if (u.toLowerCase() === 'percent' || u.toLowerCase() === 'percentage' || u === '%') {
    u = 'Percent';
  }

  mult = capitalizeWords(mult);
  u = capitalizeWords(u);

  if (mult && u) {
    return `${mult} ${u}`;
  }
  return mult || u;
}

// Formats value along with unit (e.g. 15.5% or 48.08 Persons Per Square Kilometer)
export function formatValueWithUnit(value: any, multiplier?: string, unit?: string): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const formattedVal = num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const cleaned = formatUnit(multiplier, unit);

  if (cleaned.toLowerCase() === 'percent' || cleaned === '%') {
    return `${formattedVal}%`;
  } else if (cleaned) {
    return `${formattedVal} ${cleaned}`;
  }
  return formattedVal;
}

// Unifies multipliers within an indicator dataset to the majority multiplier representation.
// Also detects unit discrepancies (e.g. one economy reports "Unit" while others report "Persons").
// Items that were numerically converted are flagged with _wasConverted: true.
export function unifyMultipliers(data: any[]): {
  data: any[];
  conversionNotes: string[];
  unitDiscrepancies: string[];
} {
  if (!data || data.length === 0) return { data: [], conversionNotes: [], unitDiscrepancies: [] };

  const scales: Record<string, number> = {
    'units': 1,
    '0': 1,
    '': 1,
    'single': 1,
    'thousands': 1000,
    'millions': 1000000,
    'billions': 1000000000
  };

  // Group by indicatorCode since different indicators have different bases
  const indicatorGroups: Record<string, any[]> = {};
  data.forEach(item => {
    if (!indicatorGroups[item.indicatorCode]) {
      indicatorGroups[item.indicatorCode] = [];
    }
    const cloned = {
      ...item,
      _originalValue: item._originalValue !== undefined ? item._originalValue : item.obsValue,
      _originalMultiplierName: item._originalMultiplierName !== undefined ? item._originalMultiplierName : item.multiplierName,
    };
    indicatorGroups[item.indicatorCode].push(cloned);
  });

  const processedData: any[] = [];
  const conversionNotesSet = new Set<string>();
  const unitDiscrepanciesSet = new Set<string>();

  Object.keys(indicatorGroups).forEach(indCode => {
    const group = indicatorGroups[indCode];
    const indicatorName = group[0]?.indicatorName || indCode;

    // ── UNIT DISCREPANCY DETECTION ──────────────────────────────────────────
    // Detect when the same indicator has different unitName values across economies.
    // The majority unit is considered correct; outliers are flagged as discrepancies.
    const unitCounts: Record<string, number> = {};
    group.forEach(item => {
      const uKey = (item.unitName || '').trim().toLowerCase();
      unitCounts[uKey] = (unitCounts[uKey] || 0) + 1;
    });
    const unitKeys = Object.keys(unitCounts);
    if (unitKeys.length > 1) {
      // Find majority unit
      let majorityUnit = '';
      let maxUnitCount = -1;
      unitKeys.forEach(uKey => {
        if (unitCounts[uKey] > maxUnitCount) { maxUnitCount = unitCounts[uKey]; majorityUnit = uKey; }
      });
      // Find example row with the majority unit to get its multiplier for display
      const majorityExample = group.find(g => (g.unitName || '').trim().toLowerCase() === majorityUnit);
      const majorityDisplay = formatUnit(majorityExample?.multiplierName, majorityExample?.unitName);

      group.forEach(item => {
        const uKey = (item.unitName || '').trim().toLowerCase();
        if (uKey !== majorityUnit) {
          const econName = item.economyName || item.economyCode;
          const outlierDisplay = formatUnit(item.multiplierName, item.unitName);
          unitDiscrepanciesSet.add(
            `⚠ Unit discrepancy in "${indicatorName}": ${econName} uses "${outlierDisplay}" while most economies use "${majorityDisplay}".`
          );
          // Flag on the item so the table can highlight it
          item._unitDiscrepancy = true;
          item._expectedUnit = majorityDisplay;
        }
      });
    }

    // ── MULTIPLIER CONVERSION ────────────────────────────────────────────────
    // Group by base unit (within this indicator) and unify multipliers to the majority.
    const unitGroups: Record<string, any[]> = {};
    group.forEach(item => {
      const uKey = (item.unitName || '').trim().toLowerCase();
      if (!unitGroups[uKey]) {
        unitGroups[uKey] = [];
      }
      unitGroups[uKey].push(item);
    });

    Object.keys(unitGroups).forEach(uKey => {
      const uGroup = unitGroups[uKey];
      
      // Count frequency of multipliers
      const multCounts: Record<string, number> = {};
      uGroup.forEach(item => {
        const mKey = (item.multiplierName || '').trim().toLowerCase();
        multCounts[mKey] = (multCounts[mKey] || 0) + 1;
      });

      const multKeys = Object.keys(multCounts);
      if (multKeys.length <= 1) {
        // All have the same multiplier, no conversion needed
        processedData.push(...uGroup);
        return;
      }

      // Find majority multiplier
      let majorityMult = '';
      let maxCount = -1;
      multKeys.forEach(mKey => {
        if (multCounts[mKey] > maxCount) {
          maxCount = multCounts[mKey];
          majorityMult = mKey;
        }
      });

      // Target scale
      const targetScale = scales[majorityMult] || 1;

      uGroup.forEach(item => {
        const mKey = (item.multiplierName || '').trim().toLowerCase();
        if (mKey !== majorityMult) {
          const sourceScale = scales[mKey] || 1;
          if (item.obsValue !== null && item.obsValue !== undefined && !isNaN(Number(item.obsValue))) {
            const originalVal = Number(item.obsValue);
            // Convert value
            item.obsValue = originalVal * (sourceScale / targetScale);
          }

          // Flag as converted so the table can mark values with *
          item._wasConverted = true;
          item._convertedFrom = mKey;
          item._convertedTo = majorityMult;
          
          // Generate note
          const sourceLabel = formatUnit(mKey, ''); // e.g. "Thousands"
          const targetLabel = formatUnit(majorityMult, ''); // e.g. "Millions"
          if (sourceLabel && targetLabel) {
            conversionNotesSet.add(`* Note: Number has been converted from ${sourceLabel.toLowerCase()} to ${targetLabel.toLowerCase()}`);
          }
          
          // Update multiplier name to match the target multiplier
          item.multiplierName = majorityMult.charAt(0).toUpperCase() + majorityMult.slice(1);
        }
        processedData.push(item);
      });
    });
  });

  return {
    data: processedData,
    conversionNotes: Array.from(conversionNotesSet),
    unitDiscrepancies: Array.from(unitDiscrepanciesSet),
  };
}
