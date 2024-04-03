/**
 * @module config.js
 * @summary global configuration of WebApp
 * @version 2.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import { jsonParseWithFunctions } from './global_functions.js';
import * as Idb from './idb-keyval.js';

const configIdentifier = 'quickFillConfig';

const quickFillConfigString = globalThis['indexedDB'] ? await Idb.get( configIdentifier ) : null;

const quickFillConfig = quickFillConfigString ? jsonParseWithFunctions( quickFillConfigString ) : undefined;

if ( quickFillConfig ){
  document.title = `QuickFill ${quickFillConfig.version}`;
  const configVersionHeader = document.getElementById('config_version_header');
  configVersionHeader.innerText = quickFillConfig.version;
}

/**
 * The global configuration of this WebApp is stored in the config object.
 * The config object is set in this file and imported into other modules.
 * In index.js event handler for import and export are installed, so that 
 * the config object can be written to file and read from file. In this case,
 * the config object is stored in globalThis['quickFillConfig'].
 *
 * @typedef {Object} config - key value map of all configuration parameters
 */
export const config = quickFillConfig ? quickFillConfig : {
  version: '2.0',
  debug: true, // reduces performance
  log: true, // log to console
  prefill: false,  // prefill case editor values with default data for testing
  eval: false, // button for re-evaluation of values inside case editor
  configIdentifier: configIdentifier,  // see constant above, should not be changed
  rulesShouldBeDeletable: true,
  ruleThreshold: 2, // minimum number of PDFs with the same value to infer a common rule in learning mode
  profileColor: '#9dd2f6', // background color of profile area
  autoupdate: true, // dynamic refresh of PDF on every blur event in table
  autoClear: true, // clear case rules before importing XML data
  costModel: {
    timeCharFactor: 1250, // milliseconds per character input, e.g. 1/1.9 = 0.526 sec = 526 msec
    timeFieldFactor: 0, // milliseconds per field
    moneyFactor: 1000, // Cents per hour
  },
  pdfTableNegativeFilter: [ 'button' ], // which field types are NOT to be listed in pdf table
  dirtyStrategy: true, // manual entries in PDF overwrites rule based values
  summaryButton: true, // all PDFs summarized in one large HTML page
  summaryButtonLabel: 'Alle zusammen',
  // disableElements: ['Bundesland'],
  // PDF constants used in example PDF forms
  missingTitle: ' ohne Titel ',
  checkboxOnValues: [ 'checked','on', '1' ], // lowercase
  checkboxOffValues: [ 'unchecked','off', '0' ],
  yesValues: [ 'yes', 'ja', '1' ],
  noValues: [ 'no', 'nein', '0' ],

  directory: 'example', // directory for adding single files

  /************* Rules in the Header of each person have highest priority ******************/
  personHeaderRules: {
    'Header-Vorgangsnummer': 'Vorgangsnummer, f.tgbnr.1, f.vorgangsnr.1, f.vorgangsnummer.1, f.vgnummer.1, f.checkliste_vorgangsnummer',
    'Header-AZR-Nummer': 'AZR-Nummer, E-Nummer, Eingabe-Nummer',
  },

  /************* Example how to initialize the rule lists of all stakeholders ******************/
  initialRulesList: {
    PVB: [
      {rule_type: "equal", rule: "BPOL-Diensthabender", value: "Max Mustermann" },
      {rule_type: "equal", rule: "Dienstrang", value: "PKA"},
      {rule_type: "equal", rule: "f.amtsbez.1", value: "${BPOL-Diensthabender}$, ${Dienstrang}$" },
    ],
    DGL: [
      {rule_type: "equal", rule: "f.email.1", value: "Musterbahnhof@bpol.de"},
      {rule_type: "equal", rule: "Dienststelle", value: "PZDSt Musterbahnhof"},
      {rule_type: "equal", rule: "f.an.1", value: "Meine Anschrift\nMusterstraße 1\n12345 Musterstadt"},
      {rule_type: "equal", rule: "Ort", value: "Musterort"},
      {rule_type: "equal", rule: "Diensttelefon", value: "0123456789"},
      {rule_type: "substring", rule: "fax, faxnr", value: "01234567899"},
      {rule_type: "equal", rule: "f.bundesland.1", value: "BPOLD-Musterdirektion"},
      {rule_type: "equal", rule: "f.inspektion.1", value: "BPOLI-Musterinspektion"},
      {rule_type: "equal", rule: "f.einsatzabschnitt.1", value: "BPOLR-Musterrevier/abschnitt"},
      {rule_type: "equal", rule: "f.adresse.280, f.adresse.281", value: "Poststr. 72\n15890 Eisenhüttenstadt"},
      {rule_type: "equal", rule: "Mail_Bundesland", value: "Muster-Posteingang@bamf.bund.de"},
      {rule_type: "equal", rule: "Bundesland", value: "Brandenburg"},
    ],
    Allgemein: [
      {rule_type: "equal", rule: "sprachmittler, sprachmittler_unterschrift, f.dolmetscher.1", value: '${Sprachmittler}$' },
      {rule_type: "equal", rule: "E-Nummer", value: '${AZR-Nummer}$' },
      {rule_type: "equal", pdf: '1_00_134', rule: "f.unterschrift.2", value: '${Sprachmittler}$' },
      {rule_type: "equal", rule: "Eingabe-Nummer", value: '${E-Nummer}$' },
      {rule_type: "equal", rule: "Text1", value: 'Asylgesuch - Polizei - AZR${E-Nummer}$' },
      {rule_type: "equal", rule: "Text2", value: 'Asylgesuch - ABH - AZR${E-Nummer}$' },
      {rule_type: "equal", rule: "f.checkliste_aufgriffsort", value: '${Aufgriffsort}$' },
      {rule_type: "equal", rule: "f.checkliste_aufgriffsort", value: '${Ort}$' },
      {rule_type: "equal", rule: "f.datum_asylgesucht", value: '${Aufgriffsdatum}$' },
      {rule_type: "equal", rule: "f.datum_asylgesucht", value: '${heute}$' },
      {rule_type: "equal", rule: "f.befristung_datum, DateField", value: '${heutePlus2Tage}$' },
      {rule_type: "equal", rule: "bemerkungen", value: '${kurzdarstellung}$' },
      {rule_type: "equal", pdf: "1_00_17", rule: "f.ort.1", value: '${Ort}$, ${jetzt}$' },
      {rule_type: "equal", pdf:"1_10_123", rule: "f.ort.1", value: "${Ort}$, ${heute}$"},
      {rule_type: "equal", rule: "f.ort.1, f.checkliste_ort, Checkliste", value: "${Ort}$"},
      {rule_type: "equal", pdf: "1_00_134, 1_60_030", rule: "f.ortdatum.1", value: '${Ort}$' },
      {rule_type: "equal", rule: "f.ortdatum.1, f.ortdatum.2, f.ortdatum.3, f.ortdatum.4", value: '${Ort}$, ${heute}$' },
      // {rule_type: "substring", rule: "f.ortdatum", value: '${Ort}$, ${heute}$' },
      {rule_type: "equal", rule: "f.datum.1, f.dat.1, f.datum_datum, f.checkliste_datum, Datum", value: "${heute}$"},

      {rule_type: "equal", pdf: "1_00_17", rule: "f.vgnr.1", value: '${Dienststelle}$, ${Vorgangsnummer}$' },
      {rule_type: "equal", pdf: "1_00_17", rule: "f.name.2", value: '${BPOL-Diensthabender}$, ${Dienstrang}$' },
      {rule_type: "equal", pdf: "1_10_12", rule: "f.name.1", value: '${Familienname}$' },
      {rule_type: "equal", rule: "f.name.1", value: '${Familienname}$, ${Vorname}$' },
      // {rule_type: "equal", pdf: "1_00_17, 1_00_33", rule: "f.name.1", value: '${Vorname}$, ${Familienname}$' },
      {rule_type: "equal", pdf: "1_00_134, 1_10_039", rule: "f.telefon.1", value: "${PGÜ-Telefon}$"},
      {rule_type: "equal", rule: "f.telefon.1, f.telefon.2", value: "${Diensttelefon}$"},
      {rule_type: "equal", pdf: "1_00_056", rule: "f.tel.1", value: "${PGÜ-Telefon}$"},
      {rule_type: "equal", pdf: "1_00_056", rule: "f.gebdat.1", value: "${Geburtsname, personalie.geburtsname}$"},
      {rule_type: "equal", pdf: "1_00_056", rule: "f.ort.2", value: "${Geburtsdatum}$"},

      {rule_type: "substring", rule: "telnr.1, f.tel.1", value: "${Diensttelefon}$"},
      {rule_type: "equal", pdf: "asylgesuch, unbegleitete", rule: "f.dienststelle.1", value: "${Dienststelle}$, Tel. ${Diensttelefon}$"},
      {rule_type: "equal", rule: "f.dienstst.1, f.dienststelle, f.dienststelle.1", value: "${Dienstadresse}$"},
     
      // {rule_type: "regex", rule: "^f\\.dienstst[a-z]*(\\.1)?$", value: "${Dienststelle}$"},
      // {rule_type: "substring", rule: "ortdatum, datum_datum", value: "${f.ort.1}$, ${heute}$"},
      {rule_type: "equal", rule: "f.bearbeiter.1, f.sachbearbeiter, f.sachbearbeiter.1, f.sachbe.1, f.ersteller.1, sachbearbeiter, Sachbearbeiter", value: "${Dienstrang}$ ${BPOL-Diensthabender}$"},
      // {rule_type: "substring", rule: "vorgang.nummer", value: "${Vorgangsnummer}$"},
      {rule_type: "equal", rule: "Vorgangsnummer", value: "${objekte.vorgang.nummer}$"},
      {rule_type: "equal", rule: "f.sammelvorgangsnr.1, f.sammelvorgang.1, f.sammelnr.1", value: "${Sammelvorgangsnummer}$"},
      {rule_type: "equal", rule: "f.tgbnr.1, f.vorgangsnr.1, f.vorgangsnummer.1, f.vgnummer.1, f.checkliste_vorgangsnummer", value: "${Vorgangsnummer}$"},
      {rule_type: "equal", pdf: "1_00_024, 1_00_033", rule: "f.tgbnr.1, f.tgbnr.2", value: "${Vorgangsnummer}$"},
      {rule_type: "equal", rule: "f.tgbnr.1", value: "${Tagebuchnummer}$"},
      {rule_type: "equal", rule: "Geburtsort", value: "${personalie.geburtsort}$"},
      {rule_type: "equal", rule: "f.gebort.1, f.geburtsort.1", value: "${Geburtsort}$"},
      // {rule_type: "substring", rule: "gebort", value: "${Geburtsort}$"},

      {rule_type: "equal", rule: "f.str.1", value: "${Straße}$ ${Hausnummer}$"},
      {rule_type: "equal", rule: "f.land.1, f.plz.1", value: "${Postleitzahl}$, ${Wohnort}$, ${Staat-des-Wohnorts}$"},
      {rule_type: "equal", rule: "f.tatort.1", value: "${Tatort}$"},

      {rule_type: "equal", pdf: "1_60_030", rule: "f.wohnort.1", value: "${Staat-des-Wohnorts}$, ${Postleitzahl}$ ${Wohnort}$"},
      {rule_type: "substring", rule: "wohnort", value: "${Wohnort}$"},

      {rule_type: "date", rule: 'geburtsdatum, Geburtsdatum', value: '${personalie.geburtsdatum}$' },  // from XML
      {rule_type: "equal", pdf: '1_00_17', rule: 'f.gebdat.1', value: '${Geburtsdatum}$, ${Geburtsort}$' },
      {rule_type: "equal", pdf: '1_10_079', rule: 'f.gebdatum', value: '${Geburtsdatum-des-ersten-Kindes}$' },
      {rule_type: "equal", rule: 'geburtsdatum, f.gebdat.1, f.gebdatum.1, f.geburtsdatum.1, Geburt_Datum', value: '${Geburtsdatum}$' },
      {rule_type: "equal", rule: 'geburtsort, Ort_Geburt', value: '${Geburtsort}$' },
      // {rule_type: "substring", rule: 'gebdat, geburtsdatum.1', value: '${Geburtsdatum}$' },

      {rule_type: "equal", rule: "Vorname", value: "${vorname.bezeichnung}$"},
      {rule_type: "equal", rule: "vorname, f.vor.1, f.vorn.1, f.vorname.1, First_name", value: "${Vorname}$"},
      // {rule_type: "substring", rule: "vorn", value: "${Vorname}$"},

      {rule_type: "equal", rule: "familienname, Familienname", value: "${familienname.bezeichnung}$"},
      {rule_type: "substring", rule: "familienname, f.nach, f.nachn, f.nachname, Nachname", value: "${Familienname}$"},
      {rule_type: "substring", rule: "nach", value: "${Familienname}$"},
      // {rule_type: "substring", rule: "nachn", value: "${Familienname}$"},
      {rule_type: "substring", rule: "anrede", value: "${Familienname}$"},

      {rule_type: "equal", rule: "Geburtsname", value: "${geburtsname.bezeichnung}$"},
      {rule_type: "equal", rule: "f.gebn.1, f.gebname.1, f.geburt.1", value: "${Geburtsname}$"},
      {rule_type: "substring", rule: "gebn", value: "${Geburtsname}$"},

      {rule_type: "equal", rule: "staatsangehoerigkeit, staat, Staat, f.staatsangehoerigkeit.1", value: "${Staatsangehörigkeit}$"},
      {rule_type: "equal", rule: "Staatsangehörigkeit", value: "${staatsangehoerigkeit.katalog.name}$"},

      {rule_type: "equal", rule: "Straftat", value: "${vorgang.bezeichnung}$"},
      {rule_type: "equal", rule: "f.bezeichnung.1", value: "${Straftat}$"},

      {rule_type: "equal", rule: "Kurzbeschreibung", value: "${straftat.kurzdarstellung}$"},
      {rule_type: "equal", rule: "f.beschreibung.1", value: "${Kurzbeschreibung}$"},
      {rule_type: "equal", rule: "f.beruf.1, f.eangaben.1", value: "${Beruf}$"},
      {rule_type: "equal", rule: "f.haus.1", value: "${Straße}$ ${Hausnummer}$"},
      {rule_type: "equal", pdf: "1_00_056", rule: "f.stand.1", value: "${Geburtsort}$"},
      {rule_type: "equal", rule: "f.kreis.1", value: "${Geburtsort}$"},
      {rule_type: "equal", rule: "f.stand.1", value: "${Familienstand}$"},
      {rule_type: "equal", rule: "f.familienname.1", value: "${Familienname}$"},
      {rule_type: "equal", rule: "f.anrede.1", value: "${Familienname}$, ${Vorname}$"},
      {rule_type: "equal", rule: "f.gebland.1", value: "${Geburtsland}$"},
      {rule_type: "equal", rule: "f.strasse.1", value: "${Straße}$ ${Hausnummer}$"},
      {rule_type: "equal", rule: "f.telefon.2", value: "${PGÜ-Telefon}$"},

      // {rule_type: "equal", rule: "Straftat-Beginn", value: "${(re-format-date (findrule substring straftat.beginn.datum))}$"},
      {rule_type: "date", rule: "Straftat-Beginn", value: "${straftat.beginn.datum}$"},
      {rule_type: "equal", rule: "f.datum.2", value: "${Straftat-Beginn}$"},

      {rule_type: "equal", pdf: "1_00_17, 1_00_043, 1_00_134, 1_10_039, 1_10_128, 1_10_129", rule: "f.unter.1, f.unterschrift.1", value: "${Familienname}$, ${Vorname}$" },
      {rule_type: "equal", pdf: "1_00_17, 1_00_043, 1_00_056, 1_10_039", rule: "f.unter.2, f.unterschrift.2, f.unterschrift.3", value: "${BPOL-Diensthabender}$, ${Dienstrang}$" },
      {rule_type: "equal", pdf: "1_00_134", rule: "f.unterschrift.2", value: '${Dolmetscher}$' },
      {rule_type: "equal", pdf: "1_00_134", rule: "f.unterschrift.3", value: "${BPOL-Diensthabender}$, ${Dienstrang}$" },
      {rule_type: "equal", pdf: "1_60_030", rule: "f.unterschrift.2, f.unterschrift.4", value: "${Familienname}$, ${Vorname}$" },
      {rule_type: "equal", pdf: "1_00_056", rule: "f.unter.3, f.unter.4", value: "${Familienname}$, ${Vorname}$" },
      {rule_type: "equal", pdf: "1_00_033", rule: "f.unterschrift.10", value: "${Familienname}$, ${Vorname}$" },
      {rule_type: "equal", pdf: "1_00_033", rule: "f.unterschrift.20", value: "${BPOL-Diensthabender}$, ${Dienstrang}$" },
      {rule_type: "equal", pdf: "1_00_033", rule: "f.unterschrift.11", value: "${BPOL-Diensthabender}$, ${Dienstrang}$" },
      {rule_type: "equal", pdf: "1_00_033", rule: "f.unterschrift.1", value: '${Dolmetscher}$' },
      {rule_type: "equal", rule: "sprachmittler, sprachmittler_unterschrift", value: '${Dolmetscher}$' },

      {rule_type: "equal", rule: "f.unter.1, f.unterschrift.1, unterschrift_sachbearbeiter", value: '${BPOL-Diensthabender}$, ${Dienstrang}$' },
      {rule_type: "equal", pdf: "1_00_148", rule: "f.amtsbezeichnung.1", value: "${BPOL-Diensthabender}$, ${Dienstrang}$" },

      {rule_type: "equal", rule: "f.angeordnet_durch.1", value: "${BPOL-Diensthabender}$, ${Dienstrang}$"},
      {rule_type: "equal", rule: "f.angeordnet_durch.2", value: "${BPOL-Diensthabender}$, ${Dienstrang}$"},

      {rule_type: "equal", pdf: "1_00_007, 1_00_013, 1_00_014, 1_00_015, 1_00_016", rule: "f.am.1", value: "${Besuchsdatum}$"},
      {rule_type: "equal", rule: "f.am.1", value: "${heute}$"},
      {rule_type: "equal", pdf: "1_00_007, 1_00_013, 1_00_014, 1_00_015, 1_00_016", rule: "f.um.1", value: "${Besuchszeit}$"},
      {rule_type: "equal", rule: "f.um.1", value: "${uhrzeit}$"},

      {rule_type: "equal", rule: "f.anschrift.1, f.wohnsitz.1", value: "${Straße}$ ${Hausnummer}$; ${Postleitzahl}$ ${Wohnort}$; ${Staat-des-Wohnorts}$"},

      // ========== Rules for Checkboxes ========== 
      {rule_type: "equal", rule: "f.geschlecht.1", value: "${geschlecht.name}$"},
      {rule_type: "equal", pdf: "1_00_152", rule: "f.kk.105", value: "${geschlecht.name}$"},
      {rule_type: "switch", pdf: "1_10_154", rule: "f.kk.14, f.kk.15, f.kk.16", value: "geschlecht.name männlich weiblich divers"},
      // {rule_type: "equal", pdf: "1_10_154", rule: "f.kk.15", value: "${geschlecht.name}$"},
      // {rule_type: "equal", pdf: "1_10_154", rule: "f.kk.16", value: "${geschlecht.name}$"},
      // {rule_type: "equal", rule: "f.geschlecht.1", value: "männlich"},

      // ========== Examples for Rules for Checkboxes ========== 
      // checkbox f.kk.zeuge with only one choice
      // {rule_type: "equal", rule: "f.kk.zeuge", value: "Ja"},

      // checkbox f.kk.10 Familienstand with multiple choices
      // {rule_type: "equal", rule: "f.kk.10", value: "ledig"},

      // ========== Examples for Formula Rules ========== 
      // {rule_type: "formula", rule: "(or (equal f.dienstst.1)(equal f.dienstst.2))", value: '${f.ort.1}$' },
    ]
  },

  initialTemplateList: [  // owner: 'template' is converted to owner: 'person' per person
    // {rule_type: "equal", rule: "Geschlecht", value: "maennlich"}, 
    // {rule_type: "equal", rule: "Familienstand", value: "ledig"},   
    // {rule_type: "equal", rule: "Sprachmittler", value: '' },
    // {rule_type: "equal", rule: "AZR-Nummer", value: '' },
  ],

  xmlPersonalRules: {
    "vorname": "vorname, Vorname, First_name",
    "familienname": "nachname, Nachname, familienname, Familienname",
    "geburtsdatum": "geburtsdatum, Geburtsdatum, f.gebdat.1, f.gebdatum.1, f.geburtsdatum.1, Geburt_Datum",
    "geburtsort": "geburtsort, Geburtsort, f.gebort.1, f.geburtsort.1, Geburt_Ort",
    "geburtsname": "geburtsname, Geburtsname, f.gebnam.1, Geburt_Name",
    "geschlecht": "geschlecht, Geschlecht, f.geschlecht.1, f.geschlecht.2, Geschlecht, f.kk.105",
    "familienstand": "familienstand, Familienstand, f.kk.3, f.kk.10, Familienstand, f.familienstand.1",
    "geburtsstaat": "geburtsstaat, Geburtsstaat, f.gebstaat.1, Geburt_Staat",
    "staatsangehoerigkeit": "Staatsangehoerigkeit, f.staat.1",
  },


  xmlKeyValuePairs: {
    'AZR-Nummer': 'E-Nummer, Eingabe-Nummer'
  },
 
  pdfPerPerson: {  // Syntax: (menu button label): (file name prefix without ".pdf")
    asylum: { // === PDFs for application for asylum ===
      "Asylgesuch": ["unbegleitete", "asylgesuch"],
      "Zustellungsbevollmächtigte": "1_00_134",
      "Erklärung": "1_10_039",
    },
    refusal: { // === PDFs for refusal of entry ===
      "Anhörung zur Einreiseverweigerung":"BRAS_120_vs_nfd",
      "Einreiseverweigerung": "1_10_154",
      "Benennung eines Empfangsbevollmächtigten": "1_90_119",
    },
    identity: { // === PDFs for identity verification ===
      "Erklärung": "1_00_152",
      "Belehrung": "1_00_171",
      "Benennung": "1_00_134",
    }
  },

  // initial loading on start of empty QuickFill, i.e. QuickFill has no PDFs stored already.
  // (Beware of same origin policy or CORS.)
  pdfInitialLoading: [ // Syntax: filename or https-URL
    // 'identity.zip' // identity.zip is loaded from origin on start, if PDF database is empty 
  ],

  // fetch mode, see https://developer.mozilla.org/en-US/docs/Web/API/Request/mode
  // null is default
  pdfInitialLoadingMode: null, // fetch( url, { mode: "cors" } ), cors, no-cors, *cors, same-origin

  profileEditors: [
    {owner: 'PVB', root: 'profile_area', title: 'PVB-Dateneingabe unter Wert', plus_row: false },
    {owner: 'DGL', root: 'profile_area', title: 'DG-Dateneingabe unter Wert', plus_row: true },
    {owner: 'Allgemein', root: 'profile_area', title: 'Regeln zur automatischen Befüllung der PDF-Formulare', plus_row: true },
    // {owner: 'template', root: 'profile_area', title: 'Schablone für Daten pro Person', plus_row: true },
  ],

  // list of checkboxes to be checked in the PDF documents
  autoCheck: ['1479R','1536R','1543R','1545R','1551R','1552R','1553R','1554R','1555R','1556R','1557R','1558R','1559R','1560R','1561R','1562R','1563R','1564R','1565R','1566R','1567R','1568R','1569R','1570R','1571R','1573R','1579R','1582R','860R','855R','876R','874R','872R','930R'],

  // list of select boxes to be selected in the PDF documents
  autoSelect: {
    "Bundesland": "Brandenburg",
    "f.an.2": "Erstaufnahmeeinrichtung Eisenhüttenstadt",
    "f.an.3": "Erstaufnahmeeinrichtung der Zentralen Ausländerbehörde Eisenhüttenstadt",
  },

  // map XML names and values to PDF names and values
  autoFillXmlRelated: {
    "geschlecht.name": {
      "männlich": { name: "f.kk.2, f.kk.11, f.kk.15, f.kk.17, f.kk.180, f.kk.201", value: "maennlich" },
      "weiblich": { name: "f.kk.2, f.kk.30, f.kk.202", value: "weiblich" },
      "divers": { name: "f.kk.2, f.kk.40, f.kk.203", value: "divers" }
    },
    // "familienstand.name": {
    //   "ledig": {},
    //   "verheiratet": {},
    //   "geschieden": {},
    //   "verwitwet": {},
    //   "nicht bekannt": {}
    // }
    // "sonstigeNummer.nummernwert": { name: "Eingabe-Nummer, E-Nummer" }
  },

  autoLayout: {
    "E-Nummer": { 
      parent: { name: "position", value: "relative" },
      attributes: [ { name: "data-main-rotation", value: "270" } ],
      css: {
        margin: "0",
        padding: "0",
        position: "absolute",
        top: "-70%",
        left: "-500%",
        width: "calc(8rem * var(--scale-factor))",
        height: "calc(0.8rem * var(--scale-factor))",
        "letter-spacing": "calc(2px * var(--scale-factor))",
        "font-size": "calc(0.8rem * var(--scale-factor))",
        "line-height": "calc(0.8rem * var(--scale-factor))",
       // "transform-origin": "0 0",
       // transform: "translateX(calc(-30% * var(--scale-factor))) translateY(calc(-50% * var(--scale-factor))) rotate(-90deg)",
      }
    }
  },

  ignoreFields: ['hinweis.1','h.hinweis.1', 's.hinweis.1', 's.merkblatt'],  // List of fields in the PDF documents to be ignored
  ignoreDisabledFields: false,
  ignoreCheckboxes: false,

  // Checksum
  hashField: 'hinweis.1',
  crypto: 'SHA-384', // "SHA-256", "SHA-512", name of crypto algorithm
  SALT: 'IrgendeinGeheimesWort',

  // QR Code
  typeNumber: 31, // 32 yields Stackoverflow Error in PDFPage:1082
  errorCorrectionLevel: 'L',
  maxNumberOfBytes: 1840, // see https://kazuhikoarase.github.io/qrcode-generator/js/demo/
  cellSize: 4,
  // scaleSVG: 0.96, // optional, scale: 0.96 for qrcode(31,'L'), scale: 3 for qrcode(4,'L')
  pdfServer: 'http://localhost/pdf?',

  // Dialog text
  recommendLoadPDFs: "Bitte zuerst Tatbestand wählen!",
  maxRecursionDepth: 100, // nested string variables, e.g. ort = 'xxx${ort}$yyy'
  caseRules: [ 'Tagebuchnummer','Vorgangsnummer','Sammelvorgangsnummer','Familienname','Vorname','Geburtsname','Geburtsdatum','Geburtsort','Geburtsland','Familienstand','Staatsangehörigkeit', 'Beruf', 'Aufgriffsort', 'Aufgriffsdatum', 'Kurzbeschreibung','Sprachmittler', 'AZR-Nummer' ],

  /**************** XML Reader config *****************/
  // xmlEncoding: 'utf8', // 'utf8', // 'iso-8859-1', // force choice of encoding
  cutXMLPrefix: 2, // cut the upper n levels of XML hierarchy
  ignoreXMLFields: ['absender','empfaenger','version','anfrageID'], // do not import ignored fields

  removeDuplicatesInFieldRulesList: false,

  // Special Characters (Sonderzeichen)
  // standardFont: 'Helvetica',
  // customFont: './lib/Arial.js',
  // customFontSize: 10,
  // https://hodgef.com/simple-keyboard/documentation/options/layout/

  appKeyboardLayout: {
    default: [
      '{esc} € @ % \u2030 @bpol.de heute jetzt {bksp}',  // Promille
      '{lock} \u011B \u0161 \u010D \u0159 \u017E \u00FD \u00E1 \u00ED \u00E9 \u00FA \u016F', // czech
      '{shift} \u00E9 \u00E8 \u00E7 \u00E0 \u0141 \u0119 \u017A \u0144 \u0107 \u017C \u015B \u0142 \u0105 \u00F3 {enter}', // french and polish
      'Handy_am_Steuer Fahrerflucht Einbruch Diebstahl',
      'Ordnungswidrigkeit Körperverletzung Hausfriedensbruch',
    ],
    shift: [
      '{esc} ~ ! @ # $ % ^ & * ( ) _ + {bksp}',
      ' Q W E R T Y U I O P { } |',
      '{lock} A S D F G H J K L : " {enter}',
      '{shift} Z X C V B N M < > ? {shift}',
    ],
    caps: [
      '{lock} Alk_am_Steuer Fahrerflucht Einbruch Diebstahl',
      'Ordnungswidrigkeit Körperverletzung Hausfriedensbruch',
      'Lorem ipsum dolor sit amet consetetur sadipscing elitr',
      'sed diam nonumy eirmod tempor invidunt ut labore et dolore',
    ]
  },

  profileKeyboardLayout: {
    default: [
      '{esc} @bpol.de heute jetzt {bksp}',
      '\u011B \u0161 \u010D \u0159 \u017E \u00FD \u00E1 \u00ED \u00E9 \u00FA \u016F', // czech
      '\u00E0 \u00E1 \u00E2 \u00E3 \u00E4 \u00E5 \u00E6 \u00E7 \u00E8 \u00E9 \u00EA \u00EB \u00EC \u00ED \u00EE \u00EF \u00F0 \u00F1',  // a + e
      '{shift} \u00E9 \u00E8 \u00E7 \u00E0 \u0141 \u0119 \u017A \u0144 \u0107 \u017C \u015B \u0142 \u0105 \u00F3 {enter}', // french and polish
      '${BPOL-Diensthabender}$ ${heute}$ ${jetzt}$' +
      ''
    ],
    shift: [
      '{esc} ~ ! @ # $ % ^ & * ( ) _ + {bksp}',
      ' Q W \u00CA \u00CB T Y \u00DB \u00CE \u00D4 P { } |',
      ' \u00C6 \u0160 \u00D0 F G H J K L : " {enter}',
      '{shift} Z X C V B N M < > ? {shift}',
    ]
  },

  xmlKeyboardLayout: {
    default: [
      '{esc} @bpol.de heute jetzt {bksp}',
      '\u011B \u0161 \u010D \u0159 \u017E \u00FD \u00E1 \u00ED \u00E9 \u00FA \u016F', // czech
      '\u00E0 \u00E1 \u00E2 \u00E3 \u00E4 \u00E5 \u00E6 \u00E7 \u00E8 \u00E9 \u00EA \u00EB \u00EC \u00ED \u00EE \u00EF \u00F0 \u00F1',  // a + e
      '{shift} \u00E9 \u00E8 \u00E7 \u00E0 \u0141 \u0119 \u017A \u0144 \u0107 \u017C \u015B \u0142 \u0105 \u00F3 {enter}', // french and polish
      '${BPOL-Diensthabender}$ ${heute}$ ${jetzt}$' +
      ''
    ],
    shift: [
      '{esc} ~ ! @ # $ % ^ & * ( ) _ + {bksp}',
      ' Q W \u00CA \u00CB T Y \u00DB \u00CE \u00D4 P { } |',
      ' \u00C6 \u0160 \u00D0 F G H J K L : " {enter}',
      '{shift} Z X C V B N M < > ? {shift}',
    ]
  },

  // keyBoardDelay: 15, // seconds

  textBlock: {
    Handy_am_Steuer: "PGÜ ${Familienname}$ wurde während der Fahrt mit Handy am Steuer gesichtet.",
    Alk_am_Steuer: "Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille}$\u2030.",
    Fahrerflucht: "PGÜ ${Familienname}$ beging Fahrerflucht.",
    Einbruch: "PGÜ ${Familienname}$ beging Einbruch.",
    Diebstahl: "PGÜ ${Familienname}$ beging Diebstahl.",
    Ordnungswidrigkeit: "PGÜ ${Familienname}$ beging Ordnungswidrigkeit.",
    "Körperverletzung": "PGÜ ${Familienname}$ beging Körperverletzung.",
    Hausfriedensbruch: "PGÜ ${Familienname}$ beging Hausfriedensbruch.",
  },

  textBlock2: {
    Einreisekontrolle: "Einreisekontrolle Flug ${Flugnr}$; PGÜ ${Familienname}$ legte ${Staatsangehörigkeit}$ Reisepass vor; INPOL negativ; AZR negativ; PGÜ gab an für drei Monate nach Deutschland arbeiten zu kommen; Arbeitsvertrag vorgelegt; nach Rücksprache mit GL und DGL wird PGÜ zurückgewiesen am ${jetzt}$ mit selber Airline; PGÜ hat kein Reisegepäck."
  },

  autocompleteKey: "Tab",
  autocompleteList: [ 'Ordnungswidrigkeit', 'Körperverletzung', 'Hausfriedensbruch', 'Order' ],
  autocompleteDict: {
    ".ich": "${Dienstrang}$ ${BPOL-Diensthabender}$",
    ".pro": "Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille}$\u2030.",
    ".han": "PGÜ ${Familienname}$ wurde während der Fahrt mit Handy am Steuer gesichtet."
  },

  /***** Dynamic Rules computed at runtime are functions with one parameter "field_name" *****/
  // EindeutigeNummer: _=> `${(new Date()).toISOString()}`,
  ID: key => key,  // use field name as contents of field by using variable ${ID}$
  heute: _=> (new Date).toLocaleString('de').split(',')[0].split('.').map(x => parseInt(x)>99?x:('0'+x).slice(-2)).join('.'), // "19.07.2024"
  heutePlus2Tage: _=> {
    const d = new Date;
    d.setDate(d.getDate()+2);
    return d.toLocaleString('de').split(',')[0].split('.').map(x => parseInt(x)>99?x:('0'+x).slice(-2)).join('.'); // "21.07.2024"
  },
  jetzt: _=> (new Date).toLocaleString('de'), // "19.7.2024, 14:48:56" by ${jetzt}$
  uhrzeit: _=> (new Date).toLocaleString('de').split(',')[1].trim(), // "14:48:56" by ${uhrzeit}$

  /***** case data *****/
  addresses: {
    "Bamberg": "\nBau C\nBuchenstraße 4\n96050 Bamberg, Bayern\n",
    "Deggendorf": "\nStadtfeldstr. 11\n94469 Deggendorf, Bayern\n",
    "Dresden": "\nNossener Brücke 12\n01187 Dresden, Sachsen\n",
    "Lebach": "\nSchlesierallee  17\n66822 Lebach, Saarland\n",
    "Manching": "\nImmelmannstr.  7\n85077 Manching, Bayern\n",
    "Regensburg": "\nBajuwarenstr. 4\n93053 Regensburg, Bayern\n",
    "Schweinfurt": "\nGebäude 29\nConn-Barracks 2\n97464 Niederwerrn, Bayern\n",
    "Zirndorf": "\nRothenburger Straße 29\n90513 Zirndorf, Bayern\n",
    "Berlin": "\nBadensche Straße 23\n10715 Berlin\n",
    "Bielefeld": "\nAm Stadtholz 24\n33609 Bielefeld, Nordrhein-Westfalen\n",
    "Bonn": "\nReuterstraße 63a\n53115 Bonn, Nordrhein-Westfalen\n",
    "Bramsche": "\nIm Rehhagen 12\n49565  Bramsche, Niedersachsen\n",
    "Bremen": "\nLindenstraße 110\n28755 Bremen\n",
    "Chemnitz": "\nOtto-Schmerbach-Str.  20\n09117 Chemnitz, Sachsen\n",
    "Eisenhüttenstadt": "\nPoststraße 72\n15890 Eisenhüttenstadt, Brandenburg\n",
    "Gießen": "\nLufthansastraße 13\n35394 Gießen\n",
    "Halberstadt": "\nFriedrich-List-Straße 3\n38820  Halberstadt, Sachsen-Anhalt\n",
    "Hamburg": "\nConcordiahaus B\nSachsenstraße  12+14\n20097  Hamburg\n",
    "Heidelberg": "\nPatrick-Henry-Village, Gebäude 4498/4511\nGrasweg (Zufahrt über Osttor)\n69124  Heidelberg, Baden-Württemberg\n",
    "Leipzig": "\nBrahestr. 8\n04347  Leipzig, Sachsen\n",
    "Mönchengladbach": "\nChazal Road 3-4\n41179 Mönchengladbach, Nordrhein-Westfalen\n",
    "Schwerin": "\nGebäude 20-22\nStern-Buchholz  16\n19061 Schwerin, Mecklenburg-Vorpommern\n",
    "Suhl": "\nWeidbergstraße 5\n98527 Suhl, Thüringen\n",
    "Trier": "\nAm Wissenschaftspark 29\n54296 Trier, Rheinland-Pfalz\n",
    "Unna": "\nHeinrich-Werner-Platz 3\n59427 Unna, Nordrhein-Westfalen\n",
    "Augsburg": "\nAindlinger Straße  16\n86167 Augsburg, Bayern\n",
    "Bayreuth": "\nDr.-Hans-Frisch-Str. 4\n95448  Bayreuth, Bayern\n",
    "Bochum": "\nAlleestr. 165\n44793 Bochum, Nordrhein-Westfalen\n",
    "Braunschweig": "\nHermann-Blenk-Straße 22a\n38108  Braunschweig, Niedersachsen\n",
    "Büdingen": "\nArmstrong Kaserne, Gebäude 2204\nOrleshäuser Straße 26\n63654 Büdingen , Hessen\n",
    "Dortmund": "\nHainallee 1\n44139 Dortmund, Nordrhein-Westfalen\n",
    "Düsseldorf": "\nErkrather Straße 389\n40231 Düsseldorf\n",
    "Ellwangen": "\nDie Außenstelle des Bundesamtes und die Landeserstaufnahmeeinrichtung liegt im Süden der Reinhardt-Kaserne, ca. 500 m von der Adresse entfernt\nGeorg-Elser-Str. 2\n73479 Ellwangen, Baden-Württemberg\n",
    "Essen": "\nOverhammshof  29\n45239 Essen, Nordrhein-Westfalen\n",
    "Frankfurt-Flughafen": "\nGebäude 587 C\nFrankfurt-Flughafen, Cargo City Süd\n60549  Frankfurt, Hessen\n",
    "Frankfurt/Oder": "\nGeorg-Quincke-Str. 1\n15236 Frankfurt/Oder, Brandenburg\n",
    "Freiburg": "\nBötzinger Str. 31\n79111 Freiburg, Baden-Württemberg\n",
    "Friedland": "\nHeimkehrerstraße 16\n37133  Friedland, Niedersachsen\n",
    "Jena": "\nVom Bahnhof Hermsdorf/Bad Klosterlausnitz gehen Sie die Treppe hoch zum Busbahnhof. Dieser befindet sich direkt links neben dem Haupteingang des Bahnhofes. Dort steigen Sie in die Buslinie 444 oder 427 ein und fahren in Richtung Kahla. Steigen Sie an der Bushaltestelle Hermsdorf/Fußweg Rasthof aus und folgen Sie der Ausschilderung zum „Bundesamt“ (Bundesamt für Migration und Flüchtlinge). Bitte benutzen Sie den Fußgängertunnel A9 zum Rasthof. Nach 5 bis 10 Minuten haben Sie Ihr Ziel erreicht.\nAm Rasthof 2\n07629 Hermsdorf, Thüringen\n",
    "Karlsruhe": "\nPfizerstraße 1\n76139 Karlsruhe, Baden-Württemberg\n",
    "Köln": "\nPoller Kirchweg 101\n51105 Köln, Nordrhein-Westfalen\n",
    "München": "\nStreitfeldstr. 39\n81673 München, Bayern\n",
    "Neumünster": "\nBrachenfelder Straße 45\n24534 Neumünster, Schleswig-Holstein\n",
    "Neustadt": "\nErnst-Moritz-Arndt-Kaserne, Gebäude 34\nNiederkleiner Straße 21\n35279 Neustadt, Hessen\n",
    "Nostorf-Horst": "\nNostorfer Straße 1\n19258 Nostorf-Horst, Mecklenburg-Vorpommern\n",
    "Oldenburg": "\nKlostermark 70-80\n26135 Oldenburg, Niedersachsen\n",
    "Osnabrück": "\nSedanstr. 115\n49090 Osnabrück, Niedersachsen\n",
    "Sigmaringen": "\nGraf-Stauffenberg-Kaserne, Gebäude 80\nBinger Str. 28\n72488  Sigmaringen, Baden-Württemberg\n",
    "Speyer": "\nSpaldinger Straße 100\n67346 Speyer, Rheinland-Pfalz\n",
    "Stuttgart": "\nWolframstraße  62\n70191 Stuttgart , Baden-Württemberg\n",
    "Würzburg": "\nVeitshöchheimer Straße 100\n97080 Würzburg, Bayern\n",
    "Nürnberg": "\nNeumeyerstraße 22-26\n90411 Nürnberg, Bayern\n"
  },
  address: key => this.addresses[ key ], 

};
