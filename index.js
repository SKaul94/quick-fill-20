/**
 * @module index.js
 * @summary main JavaScript code for HTML document with listeners
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */


/*************  imports ***************/

import {config} from './lib/config.js';
import {firstElementWithClass, elementWithID, jsonStringifyWithFunctions, jsonParseWithFunctions} from './lib/global_functions.js';
import {fileOpen, fileSave, directoryOpen} from './lib/FileOpener.js'; // './node_modules/browser-fs-access/dist/esm/index.js';
// import {PDFDocument, StandardFonts} from "./node_modules/pdf-lib/dist/pdf-lib.esm.js"; // replaced by Mozilla PDF.js
import {Rule} from './lib/Rule.js';
import {PdfDoc} from './lib/Doc.js';
import {Keyboard} from './lib/simple-keyboard-index.modern.es6.js';
import {ProfileEditor} from "./lib/ProfileEditor.js";
import {TemplateEditor} from "./lib/TemplateEditor.js";
import {CaseEditor} from "./lib/CaseEditor.js";
import {TextBlockEditor} from "./lib/TextBlockEditor.js";
import {XMLInterpreter} from "./lib/XMLInterpreter.js";
// store binary in IndexedDB:
import * as Idb from './lib/idb-keyval.js';
// Material Design
// import * as MWC from './lib/mwc.min.js';

// Additional imports for adding other fonts:
// import {fontkit} from './lib/fontkit.es.js';
// import {FontBytes} from './lib/Arial.js';

/* * *********** config ************* * */

document.title = `QuickFill ${config.version}`;
const configVersionHeader = document.getElementById('config_version_header');
configVersionHeader.innerText = config.version;

export const configIncrement = _ => {
  const [ major, minor ] = config.version.split('.');
  const next = parseInt(minor) + 1;
  config.version = `${major}.${next}`;
  document.title = `QuickFill ${config.version}`;
  configVersionHeader.innerText = config.version;
};

// init QuickFill Statistics
globalThis[ 'QuickFillStatistics' ] = {};

// switch drag and drop
const dragAndDropSwitch = document.getElementById('drag_switch');
// initial state is unchecked
// dragAndDropSwitch.checked = false;
export const switchDragAndDrop = event => {
  for ( const draggable of document.querySelectorAll('[draggable]') ){
    draggable.setAttribute('draggable', dragAndDropSwitch.checked );
  }
}
dragAndDropSwitch.addEventListener('click', switchDragAndDrop);


/* *  ***********  enhance object inspection for debugging only ************* * */
if ( config.debug ) Object.prototype.allPropFun = function(){
  let allNames = new Set();
  for (let o = this; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (let name of Object.getOwnPropertyNames(o)) {
      allNames.add(name);
    }
  }
  return Array.from(allNames);
}

/* *  ***********  add SVG icon to both, app and profile  ************* * */
for ( const button of document.querySelectorAll('button.keyboard') ){
  const svg = document.querySelector('svg.keyboard-svg').cloneNode( true );
  svg.classList.remove('hide');
  button.innerHTML = svg.outerHTML;
  button.addEventListener('click', event => {
    button.parentElement.parentElement.querySelector('.keyboard-container').classList.toggle('hide');
    Rule.refocus();
  });
}

/* *  ***********  add language chooser ( country flag button )  ************* * */
globalThis[ 'QuickFill_Language' ] = 'de';
document.getElementById('select-flag')?.addEventListener('click', event => {
  const icons = document.querySelectorAll('#select-flag > svg');
  if ( document.querySelectorAll('#select-flag > svg:not(.hide)').length === 1 ){
    for ( const icon of icons ){
      icon.classList.remove('hide');
    }
  } else {
    if ( event.target.tagName !== 'SPAN' ){ // SVG or PATH
      for ( const icon of icons ){
        if ( icon.contains( event.target ) ){
          globalThis[ 'QuickFill_Language' ] = icon.dataset.value || icon.id.split('-').pop();
        } else {
          icon.classList.add('hide');
        }
      }
    }
  }
});


/* *  ***********  Event Handler ************* * */
// DirectoryPicker
for (const openButton of document.body.querySelectorAll('.open')) {
  openButton.addEventListener('click', async event => {
    event.stopImmediatePropagation();

    if ( PdfDoc.all.size > 0 ){
      const answer = confirm('Weitere PDFs hinzufügen?');
      if ( ! answer ){
        switchToState( 'app' );
        return;
      }
    }

    const dirHandle = await directoryOpen({
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: openButton.dataset.remember || 'Tatbestand',
      // Callback to determine whether a directory should be entered, return `true` to skip.
      skipDirectory: (dir) => dir.name.startsWith('.'), // skip hidden directories
    });

    document.querySelector('.error').classList.add('hide');
    for await (const entry of dirHandle.values()) {
      await addSinglePDF( { entry } );
    }

    updatePdfAndDB();

    statisticsDiv.classList.remove('hide');

  });
}

( firstElementWithClass('open') || firstElementWithClass('file_chooser') || document.getElementById('profile') ).focus();

// ******************************************************************************** //
//              FilePicker for single PDF using Mozilla PDF.js
// ******************************************************************************** //
firstElementWithClass('file_chooser')?.addEventListener('click', async event => {
  event.stopImmediatePropagation();

  const htmlSpace = PdfDoc.createHTMLSpace('app');
  const fileInput = htmlSpace.querySelector('input.file_chooser');

  // open on click immediately
  fileInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if ( ! file ) return;  // request cancelled
      htmlSpace.querySelector('.filename').textContent = file.name;
      const pdfDoc = new PdfDoc( file, htmlSpace );
      // create URL from file, render complete PDF and fill fields based on rules
      await pdfDoc.renderURL();  // PDFViewerApplication.open( { url } )
      // Alternatively, render PDF from ArrayBuffer:
      // await pdfDoc.renderArrayBuffer();  // PDFViewerApplication.open( { data } )  
   });

   fileInput.click();
   
});

function updatePdfAndDB(){
  PdfDoc.updateAllFieldsArea();
  firstElementWithClass('save_all')?.classList.remove('hide');
  // Rule.DB.updateAllFields();
  switchToState( 'app' );
}

firstElementWithClass('save_all')?.addEventListener('click', PdfDoc.saveAllListener );
firstElementWithClass('open_import_xml_clipboard')?.addEventListener('click', xmlHandler(true) );
firstElementWithClass('open_import_xml_file')?.addEventListener('click', xmlHandler(false) );

firstElementWithClass('load_pdf_asyl')?.addEventListener('click', pdfLoader('asyl') );
firstElementWithClass('load_pdf_minder')?.addEventListener('click',  pdfLoader('minder') );
firstElementWithClass('load_all_pdf_asyl')?.addEventListener('click', pdfAllLoader() );
firstElementWithClass('load_all_pdf_minder')?.addEventListener('click', pdfAllLoader() );
firstElementWithClass('load_single_pdf')?.addEventListener('click', pdfLoader('other') );

firstElementWithClass('interprete_xml_file')?.addEventListener('click', function(event){
  const interpreter = new XMLInterpreter( this, document.getElementById('xml_analyse') );
  interpreter.interpret( event );
} );

language_selector.addEventListener('change', event => {
  localStorage.setItem('quickfill_xml_language', event.target.value);
});

function pdfAllLoader(){
  return async event => {
    event.stopImmediatePropagation();

    const openButton = event.target;

    const dirHandle = await directoryOpen({
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: openButton.dataset.remember || 'Tatbestand',
      // Callback to determine whether a directory should be entered, return `true` to skip.
      skipDirectory: (dir) => dir.name.startsWith('.'), // skip hidden directories
    });
  
    // document.querySelector('.error').classList.add('hide');
    for await (const entry of dirHandle.values()) {
      const pdfFile = entry instanceof File ? entry : await entry.getFile();
      if ( pdfFile.name?.match(/\(\d+\)/) ) continue;
      const pdfBinary = new Uint8Array( await pdfFile.arrayBuffer() );
      const kindOfPDF = pdfFile.name.split('-')[1];
      const language = pdfFile.name.split('-').slice(-1)[0].split('.')[0];
      const key = `${kindOfPDF}_${language}`;

      // store binary in IndexedDB:
      await Idb.set( key, pdfBinary );
      const li = document.createElement('li');
      li.innerText = `${key} => ${pdfFile.name}`;
      firstElementWithClass('loaded_pdfs')?.appendChild(li);
      firstElementWithClass('null_item')?.remove();
    }
  };
}

export function pdfLoader(){
  return async event => {
      event.stopImmediatePropagation();

      const pdfFileHandles = await fileOpen( {
        // List of allowed MIME types, defaults to `*/*`.
        mimeTypes: ['application/pdf'],
        // List of allowed file extensions (with leading '.'), defaults to `''`.
        extensions: [ '.pdf', '.PDF' ],
        // Set to `true` for allowing multiple files, defaults to `false`.
        multiple: false,
        // Textual description for file dialog , defaults to `''`.
        description: 'PDF',
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: event.target.dataset.remember || 'PDF',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
    } );

    const pdfFile = pdfFileHandles instanceof File ? pdfFileHandles : await pdfFileHandles.getFile();

    // store binary in IndexedDB:
    const kindOfPDF = pdfFile.name.split('-')[1];
    const language = pdfFile.name.split('-').slice(-1)[0].split('.')[0];
    const pdfFileNameComponents = pdfFile.name.split('.');
    pdfFileNameComponents.pop();
    // key serves (1.) as index into IndexedDB and (2.) as class name in HTML. Therefore no special chars allowed 
    const key = kindOfPDF && language ? `${kindOfPDF}_${language}` : pdfFileNameComponents.join('_');

    if ( ! await Idb.get(key) ) {
      await Idb.set(key, new Uint8Array( await pdfFile.arrayBuffer() ));
      const li = document.createElement('li');
      li.innerText = `${key} => ${pdfFile.name}`;
      firstElementWithClass('loaded_pdfs')?.appendChild(li);
      firstElementWithClass('null_item')?.remove();
    }  
  };

}

export const configResetHandler = async event => {
  if ( confirm('Wollen Sie alle Regeln und Textbausteine auf den Anfangszustand zurücksetzen?') ){
    Idb.del(config.configIdentifier);
  }
  location.reload();  // loading module config.js automatically
  // config.js is the initial state, to which QuickFill returns via Reset
};

export const saveInitialLists = async ({silent}) => {
  try {
    configIncrement();
    await Idb.set(config.configIdentifier, jsonStringifyWithFunctions( config ) );
    const successMessage = 'Im Browser persistent gespeichert. Um auf den Anfangszustand zurückzugehen: Reset.';
    if ( silent ) console.log( successMessage ); else alert( successMessage );
  } catch (error) {
    const failureMessage = 'Konnte leider nicht im Browser gespeichert werden.';
    if ( silent ) console.log( failureMessage ); else alert( failureMessage );
    console.error( error );
    debugger;
  }
};

export const configSaveHandler = async event => {
  ProfileEditor.updateConfig({});
  saveInitialLists({silent: false});
};

export const configSilentSaveHandler = async event => {
  ProfileEditor.updateConfig({});
  saveInitialLists({silent: true});
};

export const configImportHandler = async event => {
  const fileHandle = await fileOpen( {
    // List of allowed MIME types, defaults to `*/*`.
    mimeTypes: ['application/json'],
    // List of allowed file extensions (with leading '.'), defaults to `''`.
    extensions: [ '.json', '.txt' ],
    // Set to `true` for allowing multiple files, defaults to `false`.
    multiple: false,
    // Textual description for file dialog , defaults to `''`.
    description: 'QuickFill Configuration',
    // Suggested directory in which the file picker opens. A well-known directory or a file handle.
    startIn: 'downloads',
    // By specifying an ID, the user agent can remember different directories for different IDs.
    id: 'config',
    // Include an option to not apply any filter in the file picker, defaults to `false`.
    excludeAcceptAllOption: false,
  } );
  const file = fileHandle instanceof File ? fileHandle : await fileHandle.getFile();
  const fileContents = await file.text();
  const quickFillConfig = jsonParseWithFunctions( fileContents );
  Idb.set(config.configIdentifier, jsonStringifyWithFunctions( quickFillConfig ) );
  location.reload();  // loading quickFillConfig from IndexedDB automatically
  // Object.assign( config, quickFillConfig );
  // for (const profileEditor of ProfileEditor.all){
  //   profileEditor.update();
  // }
  
};

export const configExportHandler = event => {
  ProfileEditor.updateConfig({});
  const json = jsonStringifyWithFunctions( config );
  const blob = new Blob([json], {type: "application/json"});
  fileSave( blob, {
    // Suggested file name to use, defaults to `''`.
    fileName: 'config.json',
    // Suggested file extensions (with leading '.'), defaults to `''`.
    extensions: ['.json'],
    // Suggested directory in which the file picker opens. A well-known directory or a file handle.
    startIn: 'downloads',
    // By specifying an ID, the user agent can remember different directories for different IDs.
    id: 'config',
    // Include an option to not apply any filter in the file picker, defaults to `false`.
    excludeAcceptAllOption: false,
  });
};

firstElementWithClass('reset')?.addEventListener('click', configResetHandler );
firstElementWithClass('save')?.addEventListener('click', configSaveHandler );
firstElementWithClass('import')?.addEventListener('click', configImportHandler );
firstElementWithClass('export')?.addEventListener('click', configExportHandler );

export function xmlHandler( clipBoard ){
  return async event => {
    event.stopImmediatePropagation();

    const xmlArea = document.getElementById('xml_area');
    const xmlTemplate = document.getElementById('xml_template');
    const xmlFragment = document.createElement('div');
    xmlFragment.innerHTML = xmlTemplate.innerHTML;
    const header = xmlFragment.querySelector('h2');
    const textArea = xmlFragment.querySelector('textarea');

    // const importButton = xmlFragment.querySelector('button');
    // importButton.addEventListener('click', importListener( textArea ) );

    if ( clipBoard ){
      const clipBoardText = await navigator.clipboard.readText();
      if ( clipBoardText && clipBoardText.length > 2 ){
        header.classList.add('hide');
        textArea.value = clipBoardText;
      }
    } else { // https://wicg.github.io/file-system-access/#api-showopenfilepicker
      const fileHandles = await fileOpen( {
        // List of allowed MIME types, defaults to `*/*`.
        mimeTypes: ['application/xml'],
        // List of allowed file extensions (with leading '.'), defaults to `''`.
        extensions: [ '.xml', '.txt' ],
        // Set to `true` for allowing multiple files, defaults to `false`.
        multiple: true,
        // Textual description for file dialog , defaults to `''`.
        description: 'XML-Daten',
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: 'XML',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
      } );
      for ( const fileHandle of fileHandles ) {
        const file = fileHandle instanceof File ? fileHandle : await fileHandle.getFile();
        const filename = file.name;
        header.innerText = header.innerText.replaceAll(/\${filename}/igm, filename);
        const textArea = xmlFragment.querySelector('textarea');
        textArea.value = (await file.text()).trim();
      }
    }
    xmlArea.appendChild(xmlFragment);
    if ( config.debug ) xmlArea.classList.remove('hide');
    importXML( textArea );
  };
}

export function reportError( message ){
  const errorElement = document.querySelector('.error');
  errorElement.innerHTML = `<p class="error-message">${message}</p>`;
  errorElement.classList.remove('hide');
}

export async function addSinglePDF( params ){
  const { entry, mode } = params;
  if (!entry.name.endsWith('.pdf')){
    reportError(`Datei muss auf ".pdf" enden.`);
    return;
  } 
  const pdfFile = entry instanceof File ? entry : await entry.getFile();
  const htmlSpace = PdfDoc.createHTMLSpace( mode );
  const pdfDoc = new PdfDoc( pdfFile, htmlSpace );

  const pdfBinary = new Uint8Array( await pdfFile.arrayBuffer() );
  const kindOfPDF = pdfFile.name.split('-')[1];
  const language = pdfFile.name.split('-').slice(-1)[0].split('.')[0];
  const key = `${kindOfPDF}_${language}`;

  // store binary in IndexedDB:
  Idb.set( key, pdfBinary );

  await pdfDoc.renderArrayBuffer( pdfBinary );
  // await pdfDoc.renderURL();  // alternate method via URL.createObjectURL( file )

  return pdfDoc;
}

/* *  ***********  Profile Editors ************* * */

// convert rule specs from config into Rules and load them into the Rule Database:
Rule.DB.load();
if ( config.profileEditors ){
  for ( const profileEditorSpec of config.profileEditors ){
    if ( ! profileEditorSpec.owner ) profileEditorSpec.owner = profileEditorSpec.name;
    const profileEditor = profileEditorSpec.owner === 'template' ? new TemplateEditor( profileEditorSpec ): new ProfileEditor( profileEditorSpec );
    profileEditor.render();
  }
}

/* *  ***********  Textblock Editor ************* * */
const textBlockEditor = new TextBlockEditor( {root: 'profile_area', title: 'Kürzel und Textbausteine eingeben', plus_row: true }, );

/**
 * @summary set dark mode iff parameter is true
 * @param {Boolean} DarkMode
 * @link https://dev.to/ananyaneogi/create-a-dark-light-mode-switch-with-css-variables-34l8 
 */
export const setDarkMode = ( DarkMode ) => {
  if ( DarkMode ){
    document.body.style['color'] = 'white';
    document.body.style['background-color'] = '#282828';  // almost black
  } else {
    document.body.style['color'] = 'black';
    document.body.style['background-color'] = 'white';
  }
}

setDarkMode( localStorage.getItem('DarkMode') === 'true' );

document.getElementById('dark_button')?.addEventListener('click', event => {
  const DarkMode = localStorage.getItem('DarkMode') !== 'true';
  setDarkMode( DarkMode );
  localStorage.setItem('DarkMode', DarkMode);
});

/* *  ***********  SPA Router: switch between SPA states ************* * */

const QuickFillParams = new URLSearchParams( document.location.search );
const QuickFillState = QuickFillParams.get('state') || 'xml';
const numberOfLoadedPDFs = (await Idb.keys()).length;

// states of SPA
const QuickFillAllStates = ['pdf_loader','xml','app','profile','help'];
let currentState = numberOfLoadedPDFs ? QuickFillState :'pdf_loader'; // initial state

switchToState( currentState );

window.onpopstate = function(event) {
  if ( event.state ) switchToState( event.state.state );
};

for ( const state of QuickFillAllStates ){
  elementWithID( state + '_button' ).addEventListener('click', event => {
    switchToState( state );
  });
}

async function switchToState( state ){
  if ( state === currentState && isVisible( state ) ) return;
  const basicUrl = document.location.origin + document.location.pathname;
  const oldHash = document.location.hash;
  window.history.pushState( { state }, state, `${basicUrl}?state=${state}${oldHash}` );
  for ( const hideElement of document.querySelectorAll( QuickFillAllStates.map( sel => '.' + sel ).join(',') ) ){  // '.' + currentState
    hideElement.classList.add('hide');
  }
  for ( const showElement of document.querySelectorAll( '.' + state ) ){
    showElement.classList.remove('hide');
  }
  const all_loaded_pdfs = (await Idb.keys()).filter( key => key.includes('_') );
  const allLanguages = Array.from( new Set( all_loaded_pdfs.map( key => key.split('_')[1] ) ) );
  switch ( state ){
    case 'pdf_loader':
      const list = firstElementWithClass('loaded_pdfs');
      list.innerHTML = `<li class="null_item">Keine. (Bitte zuerst PDFs laden!)</li>`;
      for ( const pdf of all_loaded_pdfs ){
        const li = document.createElement('li');
        li.innerText = pdf;
        list?.appendChild(li);
        firstElementWithClass('null_item')?.remove();
      }
      break;
    case 'xml':
      for ( const language_selector of document.querySelectorAll('.language_selector') ){
        language_selector.innerHTML = '<option value="">--Bitte auswählen:--</option>';
        for ( const language of allLanguages ){
          const option = document.createElement('option');
          option.innerText = language;
          option.value = language;
          language_selector.appendChild(option);
        }
      }
      const language_selector = document.getElementById('language_selector');
      const language = localStorage.getItem('quickfill_xml_language') || 'englisch'; 
      if ( allLanguages.includes( language ) ){
        language_selector.value = language;
        localStorage.setItem('quickfill_xml_language', language);
      }
      break;
    case 'app':
      CaseEditor.instance?.update();
      await PdfDoc.updateAll();
      break;
    case 'profile':
      Rule.DB.updateAllFields();
      break;
    case 'help':
      break;
    default:
      debugger;
  }
  currentState = state;
}

function isVisible( state ){
  for ( const targetElement of document.querySelectorAll('.'+state) ){
    if ( targetElement.classList.contains('hide') ) return false;
  }
  return true;
}

/* *  ***********  Case Data Editor ************* * */

const caseDiv = document.querySelector('.case');
const caseEditor = new CaseEditor( { root: 'app_area', title: 'Dateneingabe unter Wert', plus_row: true } );
if ( ! caseDiv.querySelector('[autofocus]') ) caseDiv.querySelector('[contenteditable]')?.setAttribute('autofocus', 'true');
if ( config.prefill ) document.querySelector('.prefill').classList.remove('hide');

/* *  ***********  Keyboard ************* * */

let lastFocusElement;
const addTextInput = ( content ) => {
  if ( document.activeElement ){
    if ( document.activeElement.tagName === 'IFRAME' ){ // nested PDF viewer
      lastFocusElement = document.activeElement.contentDocument.activeElement;
      switch ( lastFocusElement.type ){
        case 'text': case 'textarea':
          lastFocusElement.value += content;
          
          break;
        default:
          console.assert(false, lastFocusElement.type);  
      }
    } else if ( document.activeElement.tagName === 'TD' ) {
      document.activeElement.innerText += content;
      // Rule.lastActiveRow = document.activeElement.parentElement;
      lastFocusElement = document.activeElement;
    }
  } else if ( Rule.lastActiveRow && Rule.lastActiveRow.tagName === 'TR' ){
    console.assert( false );
    const valueElement = Rule.lastActiveRow.querySelector('.value');
    if ( valueElement ){
      valueElement.innerText += content;
      lastFocusElement = valueElement;
    }
  } else if ( lastFocusElement ){
    if ( lastFocusElement.tagName === 'TD' ){
      lastFocusElement.innerText += content;
    } else {
      lastFocusElement.value += content;
    }  
  } else {
    const valueInput = document.querySelector('.value');
    lastFocusElement = valueInput;
    valueInput.innerText += content;
    // Rule.lastActiveRow = valueInput.parentElement;
  }
  // lastFocusElement.blur();
  // lastFocusElement.focus();
}

/* *  ***********  add keyboard to both, app and profile  ************* * */
makeKeyboard('app-keyboard', config.appKeyboardLayout );
makeKeyboard('profile-keyboard', config.profileKeyboardLayout );
makeKeyboard('xml-keyboard', config.xmlKeyboardLayout );

function makeKeyboard( aClassSelector, layout ){
  const keyboard = new Keyboard('.'+aClassSelector, {
    layout,
    preventMouseDownDefault: true,
    preventMouseUpDefault: true,
    stopMouseDownPropagation: true,
    stopMouseUpPropagation: true,
    onKeyPress: button => {
      let currentLayout, shiftToggle;
      switch ( button ){
        case '{esc}':
          const keyboardElement = document.querySelector('.'+aClassSelector);
          keyboardElement.parentElement.classList.add('hide');
          break;
        case '{space}':
          addTextInput(" " );
          break;
        case '{enter}':
          addTextInput("\n" );
          break;
        case '{shift}':
          currentLayout = keyboard.options.layoutName;
          shiftToggle = currentLayout === "shift" ? "default" : "shift";
          keyboard.setOptions({
            layoutName: shiftToggle
          });
          break;
        case '{lock}':
          currentLayout = keyboard.options.layoutName;
          shiftToggle = currentLayout === "caps" ? "default" : "caps";
          keyboard.setOptions({
            layoutName: shiftToggle
          });
          break;
        case '{bksp}':
          if ( Rule.lastActiveRow ){
            const oldValue = Rule.lastActiveRow.querySelector('.value').innerText;
            Rule.lastActiveRow.querySelector('.value').innerText = oldValue.slice(0,-1);
          }
          break;
        case 'heute':
          addTextInput( config.heute() );
          break;
        case 'jetzt':
          addTextInput( config.jetzt() );
          break;
        default:
          const textBlock = config.textBlock[ button ];
          switch ( typeof textBlock ){
            case 'undefined':
              addTextInput( button );
              break;
            case 'string':
              const value = Rule.DB.valueFromAllRulesOf( textBlock );
              addTextInput( value || textBlock );
              break;
            case 'function':
              addTextInput( textBlock( button ) );
              break;
            default:
              console.assert( false, `Wrong type for text block "${button}".` );
          }
      }
      // Rule.refocus();
    }
  });
}



/* *  ***********  XML Import ************* * */

export function importXML( textArea ){
  let xmlDOM;
  try {
    xmlDOM = new DOMParser().parseFromString(textArea.value, 'application/xml');
  } catch (e) {
    console.error(e);
    alert(e);
    xmlDOM = null;
  }

  if ( xmlDOM ){
    // find all terminal nodes in XML DOM
    const terminalNodes = {};
    const duplicates = new Set();
    const xmlFieldLongNameMap = new Map();
    const xmlLongNameXmlField = new Map(); // inverse Map
    for ( const xmlField of xmlDOM.querySelectorAll( ':only-child *' ) ){
      if ( xmlField.childElementCount === 0 && xmlField.textContent ){  // Terminal XML Element with content
        let xmlLongName = longName( xmlField );
        if ( terminalNodes[ xmlLongName ] ){
          terminalNodes[ xmlLongName ] += 1;
          duplicates.add(xmlLongName);
          xmlLongName += `.${terminalNodes[ xmlLongName ]}`;
        } else {
          terminalNodes[ xmlLongName ] = 1;
        }
        xmlFieldLongNameMap.set(xmlField, xmlLongName);
        xmlLongNameXmlField.set(xmlLongName, xmlField);
      }
    }

    // rename first duplicate
    for ( const xmlLongName of duplicates ){
      const xmlField = xmlLongNameXmlField.get(xmlLongName);
      xmlFieldLongNameMap.set(xmlField, `${xmlFieldLongNameMap.get(xmlField)}.1` );
    }

    // clear old case rules before importing from XML data
    if ( config.autoClear ){
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'case' ) rule.value = '';
      });
    }

    // add rules generated by XML data
    for ( const [xmlField, xmlLongName] of xmlFieldLongNameMap.entries() ){
      addRuleFor( xmlField, xmlLongName );  // include all XML data of this person
    }

    if ( config.autoupdate ){
      PdfDoc.updateAll();
    }

    caseEditor.update();
    
  }

  function addRuleFor( xmlField, xmlLongName ){
    // add new case rule to Rule.DB and append new row to case table
    const xmlData = xmlField.textContent ? xmlField.textContent : xmlField;
    const rule = xmlLongName;
    const oldRule = Rule.DB.getRuleByKey( rule );
    if ( oldRule ){
      oldRule.value = xmlData;
      return oldRule;
    }
    if ( xmlData && xmlData.length > 0 && ! config.ignoreXMLFields.includes( rule ) ){
      return new Rule({rule, value: xmlData, rule_type: 'superstring', owner: 'case' });

      // caseDiv.querySelector('tbody').insertBefore(newRow, caseDiv.querySelector('tr.plus_row'));
      // newRule.installCaseListeners(); // withRuleEditing = false
      // newRow.blur();
    }
  }

  function longName( xmlElement ){
    const listOfXMLElements = [ xmlElement ];
    let parent = xmlElement.parentElement;
    while ( parent ){
      listOfXMLElements.push( parent );
      parent = parent.parentElement;
    }
    for ( let i=0; i<config.cutXMLPrefix; i++){  // shorten XML LongName by cutting prefix
      listOfXMLElements.pop();
    }
    return listOfXMLElements.reverse().map( element => element.localName ).join('.');
  }
}


/* *  ***********  QuickFill Statistics ************* * */

const statisticsDiv = document.getElementById('statistics');
statisticsDiv.addEventListener('click', _ => {
  statisticsDiv.querySelector('table').classList.remove('hide');
  const tBody = statisticsDiv.querySelector('tbody');
  tBody.innerHTML = '';
  const QuickFillStatistics = globalThis[ 'QuickFillStatistics' ];
  let nr = 0, sumFields = 0, sumChars = 0, minFields = 999, maxFields = 0, minChars = 999, maxChars = 0;
  const count = Object.keys( QuickFillStatistics ).length;
  for ( const pdf of Object.keys( QuickFillStatistics ).sort() ){
    nr += 1;
    const tr = document.createElement('tr');
    const fields = QuickFillStatistics[ pdf ].fields.sort().join(', ');
    const countFields = QuickFillStatistics[ pdf ].countFields; sumFields += countFields;
    minFields = Math.min( countFields, minFields );
    maxFields = Math.max( countFields, maxFields );
    const countChars = QuickFillStatistics[ pdf ].countChars; sumChars += countChars;
    minChars = Math.min( countChars, minChars );
    maxChars = Math.max( countChars, maxChars );
    tr.innerHTML = `<td>${nr}</td><td>${pdf}</td><td>${fields}</td><td>${countFields}</td><td>${countChars}</td>`;
    tBody.appendChild( tr );
  }

  addRow('Min', minFields, minChars );
  addRow('Max', maxFields, maxChars );
  addRow('Summe', sumFields, sumChars );
  addRow( 'Durchschnitt', (sumFields/count).toFixed(1), (sumChars/count).toFixed(1) );

  const countFieldArray = Object.values( QuickFillStatistics ).map( val => val.countFields ).sort((a, b) => a - b);
  const countCharArray = Object.values( QuickFillStatistics ).map( val => val.countChars ).sort((a, b) => a - b);
  const medianFields = countFieldArray[ Math.floor( countFieldArray.length / 2 ) ];
  const medianChars = countCharArray[ Math.floor( countCharArray.length / 2 ) ];
  addRow( 'Median', medianFields, medianChars );

  window.scrollBy(0, window.innerHeight / 3);

  function addRow( name, fields, chars ){
    const trSum = document.createElement('tr');
    trSum.innerHTML = `<td colspan="3"><b>${name}</b></td><td>${fields}</td><td>${chars}</td>`;
    tBody.appendChild( trSum );
  }
});

/* *  ***********  Rule Database Pretty Print ************* * */

document.querySelector('#rule_pretty_print>h2').addEventListener('click', event => {
  const prettyPrintDiv = document.querySelector('#rule_pretty_print > div');
  prettyPrintDiv.innerHTML = '';
  for ( const owner of new Set( Rule.DB.sortedRules().map( r => r.owner ) ) ){
    const h3 = document.createElement('h3');
    h3.innerHTML = owner;
    prettyPrintDiv.appendChild( h3 );
    const ol = document.createElement('ol');
    prettyPrintDiv.appendChild( ol );
    for ( const rule of Rule.DB.filter( r => r.owner === owner ) ){
      const li = document.createElement('li');
      li.innerHTML = rule.prettyPrint();
      ol.appendChild( li );
    }
  }
  window.scrollBy(0, window.innerHeight / 3);
} );



/* * ***********  Configuration Editor ************* * */

document.querySelector('#config_editor>h2').addEventListener('click', event => {
  const configEditorDiv = document.querySelector('#config_editor > div');
  const config_json = jsonStringifyWithFunctions( config, 2 );
  configEditorDiv.innerHTML = `<div contenteditable>
      <pre>${config_json}</pre>
      </div>
      <button class="import">Import</button>
      <button class="export">Export</button>
    `;
  const configEditorContents = configEditorDiv.querySelector('pre');
  const importButton = document.querySelector('#config_editor .import');
  const exportButton = document.querySelector('#config_editor .export');

  configEditorContents.addEventListener('blur', event => {
    const config_json = configEditorContents.innerText;
    const newConfig = jsonParseWithFunctions( config_json );
    Object.assign( config, newConfig );
    Idb.set( 'quickFillConfig', config );
    Rule.DB.load();
    for ( const profileEditor of ProfileEditor.all ){
      profileEditor.update();
    }
    // location.reload();
  } );

  importButton.addEventListener('click', configImportHandler );

  exportButton.addEventListener('click', configExportHandler );
  
  window.scrollBy(0, window.innerHeight / 3);
  configEditorDiv.focus();
  
} );