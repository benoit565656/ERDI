/**
 * LOCAL CURRENCY UNIT CODES
 * ─────────────────────────────────────────────────────────────────────────────
 * These are unit codes that represent local / national currencies used in the
 * ERDI database (e.g. "P" = Philippine Peso, "Y" = Japanese Yen, "AF" = Afghan
 * Afghani, "USD" = US Dollar, etc.).
 *
 * Stored as a Set for O(1) look-ups.
 *
 * Long-term goal: migrate all observations that use any of these codes to the
 * harmonised "NCU" (National Currency Unit) code via the Unit Quality module.
 */
export const LOCAL_CURRENCY_CODES = new Set<string>([
  'AF',      // Afghan Afghani
  'ALEK',    // Albanian Lek
  'DA',      // Algerian Dinar
  'KZ',      // Angolan Kwanza
  'A',       // generic (country-specific)
  'DRAMS',   // Armenian Dram
  'ARF',     // Argentine Peso
  'AUSD',    // Australian Dollar
  'AUSD_S',  // Australian Dollar (special)
  'S',       // generic (country-specific)
  'MAN',     // Azerbaijani Manat
  'NMAN',    // New Azerbaijani Manat
  'BUSD',    // Brunei Dollar
  'BD',      // Bahraini Dinar
  'TK',      // Bangladeshi Taka
  'BDS',     // Barbadian Dollar
  'BF',      // Burkina Faso CFA Franc
  'BZUSD',   // Belize Dollar
  'BERUSD',  // Bermudian Dollar
  'NU',      // Bhutanese Ngultrum
  'BOL',     // Bolivian Boliviano
  'BP',      // Pound (generic)
  'NCZUSD',  // New Caledonia / NZ related
  'BRUUSD',  // Brunei / USD proxy
  'BLEV',    // Bulgarian Lev
  'FBU',     // Burundian Franc
  'CAN_USD', // Canadian Dollar
  'CVES',    // Cape Verdean Escudo
  'CAYUSD',  // Cayman Islands Dollar
  'BENF',    // generic Franc
  'CFPF',    // CFP Franc (Polynesia)
  'CHUSD',   // Chilean / USD proxy
  'CHY',     // Chinese Yuan
  'CNY_USD', // Chinese Yuan / USD
  'SOLUSD',  // Colombian Sol / USD
  'CONST_USD', // Constant USD (base)
  'CRC',     // Costa Rican Colón
  'CUBP',    // Cuban Peso
  'CID',     // generic
  'CURR_USD',// Current USD proxy
  'LC',      // Local Currency (generic)
  'CZKO',    // Czech Koruna
  'DKR',     // Danish Krone
  'DM',      // Deutsche Mark
  'DF',      // Djiboutian Franc
  'RDUSD',   // Dominican Republic Peso / USD
  'ECUSD',   // Ecuador / USD
  'ECS',     // Ecuadorian Sucre
  'LE',      // Egyptian Pound
  'EB',      // Eritrean Birr
  'FIL',     // Filipino / Philippine Peso alt
  'FUSD',    // Fijian Dollar
  'FMK',     // Finnish Markka
  'FF',      // French Franc
  'GEL',     // Georgian Lari
  'GC',      // Ghanaian Cedi
  'GIBL',    // Gibraltar Pound
  'DR',      // Greek Drachma
  'Q',       // Guatemalan Quetzal
  'PG',      // Papua New Guinean Kina alt
  'GF',      // Guinean Franc
  'GUSD',    // Guyanese Dollar
  'HKUSD',   // Hong Kong Dollar
  'HFT',     // Hungarian Forint
  'ISK',     // Icelandic Króna
  'RS',      // Indian / Pakistani Rupee
  'RP',      // Indonesian Rupiah
  'IRLS',    // Iranian Rial / Irish Pound
  'ID',      // Iraqi Dinar
  'LIR',     // Italian Lira
  'JUSD',    // Jamaican Dollar
  'Y',       // Japanese Yen
  'JD',      // Jordanian Dinar
  'KR',      // Korean Won alt / Krone
  'KSH',     // Kenyan Shilling
  'W',       // Korean Won
  'W_USD',   // Korean Won / USD
  'KD',      // Kuwaiti Dinar
  'KN',      // Croatian Kuna
  'LL',      // Lebanese Pound
  'LM',      // Liberian / Maltese alt
  'LIBUSD',  // Libyan Dinar / USD
  'LD',      // Libyan Dinar
  'LF',      // Libyan / Luxembourg Franc
  'FMG',     // Malagasy Franc
  'MAKW',    // Malawian Kwacha
  'RM',      // Malaysian Ringgit
  'RF',      // Maldivian Rufiyaa
  'MARK',    // Deutsche Mark alt
  'MRS',     // Mauritanian Ouguiya alt
  'MEXUSD',  // Mexican Peso
  'MDH',     // Moroccan Dirham
  'BK',      // generic
  'NRS',     // Nepalese Rupee
  'NLAG',    // generic
  'F',       // generic Franc
  'ND',      // generic Dinar
  'NTUSD',   // New Taiwan Dollar
  'NZUSD',   // New Zealand Dollar
  'CS',      // generic
  'N',       // Nigerian Naira
  'NKR',     // Norwegian Krone
  'P',       // Philippine Peso
  'ESC',     // Portuguese Escudo
  'QR',      // Qatari Riyal
  'RO',      // Romanian Old Leu
  'LEI',     // Romanian Leu
  'RWF',     // Rwandan Franc
  'SALC',    // Saudi Arabia / generic
  'DB',      // generic Dirham / Dollar
  'SR',      // Saudi Riyal / Sierra Leone Leone
  'SEYR',    // generic
  'SUSD',    // Singaporean Dollar
  'SIUSD',   // Solomon Islands Dollar
  'SOSH',    // Somali Shilling
  'R',       // South African Rand
  'RUB',     // Russian Ruble
  'PTA',     // Spanish Peseta
  'SLRS',    // Sri Lankan Rupee
  'LSD',     // Sudanese Pound (old)
  'SURF',    // Surinamese Dollar / Guilder
  'E',       // Swazi Lilangeni alt
  'SKR',     // Swedish Krona
  'SWF',     // Swiss Franc
  'LS',      // Lesotho Loti alt
  'SMN',     // generic
  'TSH',     // Tanzanian Shilling
  'B',       // Thai Baht
  'TUSD',    // Trinidad & Tobago Dollar
  'TTUSD',   // Trinidad & Tobago Dollar alt
  'TD',      // Tunisian Dinar
  'TL',      // Turkish Lira
  'TMAN',    // Turkmenistan Manat
  'TNMAN',   // New Turkmenistan Manat
  'DH',      // UAE Dirham
  'UGSH',    // Ugandan Shilling
  'UNCU',    // National Currency Unit (unified)
  'NURUSD',  // generic
  'USD',     // US Dollar
  'SUM',     // Uzbekistani Sum
  'VT',      // Vanuatu Vatu
  'BS',      // Venezuelan Bolívar
  'VD',      // Vietnamese Dong
  'WSUSD',   // generic
  'YRLS',    // Yemeni Rial
  'YD',      // Yemeni Dinar
  'ZK',      // Zambian Kwacha
  'ZUSD',    // Zimbabwean Dollar
  'ECU',     // European Currency Unit
  'DG',      // Dutch Guilder
  'LMPR',    // Luxembourgish / Maltese
  'NIS',     // Israeli New Shekel
  'LIT',     // Lithuanian Litas
  'T',       // generic Tenge / Tugrik
  'SOM',     // Kyrgyz Som
  'PA',      // Panamanian Balboa
  'LMT',     // Lithuanian Litas alt
  'UM',      // Mauritanian Ouguiya
  'TUG',     // Mongolian Tögrög
  'PB',      // generic
  'PK',      // generic
  'PARG',    // Paraguayan Guaraní alt
  'I',       // generic
  'ZL',      // Polish Zloty
  'L',       // Albanian Lek / generic
  'LEO',     // generic
  'Z',       // generic
  'NCU',     // National Currency Unit (target harmonised code)
]);

/**
 * Returns true if the given unitCode is a known local/national currency code.
 */
export function isLocalCurrencyCode(unitCode: string | null | undefined): boolean {
  if (!unitCode) return false;
  return LOCAL_CURRENCY_CODES.has(unitCode.trim().toUpperCase());
}
