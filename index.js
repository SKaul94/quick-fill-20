/**
 * @module index.js
 * @summary main JavaScript code for HTML document with listeners
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */


/*************  imports ***************/

import {config} from './lib/config.js';
import {firstElementWithClass, elementWithID, jsonStringifyWithFunctions, jsonParseWithFunctions, filename_language_mapper, mergeObjects, trashWhiteIconSVG, personPlusSVG, keyPlusSVG, keyMinusSVG, uploadSVG, downloadSVG, shareSVG} from './lib/global_functions.js';
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
import * as BrowserCrypto from './lib/crypto.js';
import {JSZip} from './lib/jszip.js';
import QrScanner from "./lib/qr-scanner.min.js";
import {Person} from './lib/Person.js';
import {PersonEditor} from './lib/PersonEditor.js';
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
for ( const button of document.querySelectorAll('span.keyboard') ){
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
  firstElementWithClass('print_all')?.classList.remove('hide');
  // Rule.DB.updateAllFields();
  switchToState( 'app' );
}

firstElementWithClass('save_all')?.addEventListener('click', PdfDoc.saveAllListener );
firstElementWithClass('print_all')?.addEventListener('click', PdfDoc.printAllListener );
document.querySelector('.open_import_xml_clipboard.app')?.addEventListener('click', xmlHandler(true) );
firstElementWithClass('open_import_xml_file')?.addEventListener('click', xmlHandler(false) );
firstElementWithClass('import_QR_fill_pdf')?.addEventListener('click', import_QR_fill_pdf );

firstElementWithClass('load_pdf_asyl')?.addEventListener('click', pdfLoader('asyl') );
firstElementWithClass('load_pdf_minder')?.addEventListener('click',  pdfLoader('minder') );
firstElementWithClass('load_all_pdf_asyl')?.addEventListener('click', pdfAllLoader() );
firstElementWithClass('load_all_pdf_minder')?.addEventListener('click', pdfAllLoader() );

firstElementWithClass('load_single_pdf')?.addEventListener('click', pdfLoader('other') );
firstElementWithClass('load_all_pdf')?.addEventListener('click', pdfAllLoader() );
firstElementWithClass('load_zip')?.addEventListener('click', pdfZipLoader() );
firstElementWithClass('cloud_load')?.addEventListener('click', async event => loadAndDecryptArchive() );

document.getElementById('add_file_to_list')?.addEventListener('click', async event => {
  const fileHandles = await fileOpen( {
      // List of allowed MIME types, defaults to `*/*`.
      mimeTypes: ['text/plain', 'application/pdf'],
      // List of allowed file extensions (with leading '.'), defaults to `''`.
      extensions: [ '.txt', '.pdf' ],
      // Set to `true` for allowing multiple files, defaults to `false`.
      multiple: true,
      // Textual description for file dialog , defaults to `''`.
      description: `Lade Datei von der lokalen Platte`,
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: 'downloads',
      // Include an option to not apply any filter in the file picker, defaults to `false`.
      excludeAcceptAllOption: false,
  } );
  for ( const fileHandle of fileHandles ){
    const file = fileHandle instanceof File ? fileHandle : await fileHandle.getFile();
    const fileNameComponents = file.name.split('.');
    fileNameComponents.pop();
    const key = fileNameComponents.join('.');
    const binaryContents = await file.arrayBuffer();
    Idb.set( key, new Uint8Array( binaryContents ) );
    managePdfList( key, file );
  }
});

document.getElementById('generate_zip_archive')?.addEventListener('click', async event => {
  const zip = new JSZip();
  if ( (await Idb.keys()).length === 0) { alert('Zuerst PDFs laden!'); return; }
  const defaultFileName = "profile.zip";

  for ( const [ key, pdfBinary ] of await Idb.entries() ){
    const fileName = key.match(/profil/i) ? `${key}.txt` : `${key}.pdf`;
    zip.file( fileName, pdfBinary, { binary: true } );
  }

  const zipContent = await zip.generateAsync({type:"uint8array"});

  const blob = new Blob([zipContent], {type: "application/x-zip"});

  const file = await fileSave( blob, {
      // Suggested file name to use, defaults to `''`.
      fileName: defaultFileName,
      // Suggested file extensions (with leading '.'), defaults to `''`.
      extensions: ['.zip'],
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: 'downloads',
      // Include an option to not apply any filter in the file picker, defaults to `false`.
      excludeAcceptAllOption: false,
    });

  alert( `ZIP-Archiv unverschlüselt gesichert unter ${file.name}.` );

});

/**
 * @summary ask for password
 */
let passwordForEncyption;
firstElementWithClass('password')?.addEventListener('input', function(event){
  passwordForEncyption = this.value;
});

firstElementWithClass('password_visibiliy')?.addEventListener('click', event => {
  const passwordElement = firstElementWithClass('password');
  passwordElement.type = passwordElement.type === 'password' ? 'text' : 'password';
});

/**
 * @summary encrypt all PDFs already loaded into IndexedDB and save as zip archiv
 */
firstElementWithClass('encrypt')?.addEventListener('click', async function(event){
  const zip = new JSZip();
  const password = passwordForEncyption;
  if ( ! password ) { alert('Zuerst Passwort festlegen!'); return; }
  if ( (await Idb.keys()).length === 0) { alert('Zuerst PDFs laden!'); return; }
  const defaultFileName = "all-crypted.zip";

  // create a new file handle before time consuming encryption
  let newHandle;
  
  // showSaveFilePicker must be first action after click
  try {
    newHandle = await window.showSaveFilePicker({
      id: 'save-pdf',
      startIn: 'downloads',
      suggestedName: defaultFileName,
      types: [
        {
          description: "Zip file",
          accept: { "application/zip": [".zip",".ZIP"] },
        },
      ],
    });
  } catch (error) {
    console.error( `${error.name}`, error );
    // new user interaction needed to refresh showSaveFilePicker timeout
    // see @link https://www.extension.ninja/blog/post/solved-this-function-must-be-called-during-a-user-gesture/
  }

  if ( ! newHandle ) return;

  for ( const [ key, pdfBinary ] of await Idb.entries() ){
    const encryptedPdfData = await BrowserCrypto.encrypt( pdfBinary, password );
    const fileName = key.match(/profil/i) ? `${key}.txt` : `${key}.pdf`;
    zip.file( fileName, encryptedPdfData, { binary: true } );
  }

  const zipContent = await zip.generateAsync({type:"uint8array"});

  const file = await newHandle.getFile();

  // create a FileSystemWritableFileStream to write to
  const writableStream = await newHandle.createWritable();
  // write file
  await writableStream.write( zipContent );
  // close the file and write the contents to disk.
  await writableStream.close();

  alert( `Mit "${password}" verschlüselt gesichert unter ${file.name}.` );

} );

const abortController = new AbortController();
document.querySelector("body > .cloud_abort")?.addEventListener( 'click', event => {
  abortController.abort(); 
});

/**
 * @summary derive URL of Zip Archive from fileName
 * @param {String} fileName - name of the zip archive
 */
function archiveUrlFromFileName( fileName ){
  const pathArray = window.location.pathname.split('/');
  pathArray.pop();
  const prefix = pathArray.join('/');
  const longFileName = fileName ? fileName.match(/^https?/i) ? fileName : `${window.location.origin}${prefix}/data/${fileName}` : `${window.location.origin}${prefix}/data/`;
  const url = fileName ? longFileName : prompt(`Bitte URL eingeben oder abbrechen!`, longFileName);
  return url;
}

/**
 * @summary load Zip Archive from URL, decrypt all files from Zip Archive and save each of them into IndexedDB
 * @param {String} fileName - name of the zip archive
 * @param {Boolean} decrypt - the archive is encrypted and has to be decrypted
 */
export async function loadAndDecryptArchive( fileName, decrypt = true ){
  const url = archiveUrlFromFileName( fileName );  
  if ( url ){
    const abortButton = document.querySelector("body > .cloud_abort");
    abortButton?.classList.remove('hide');
    const signal = abortController.signal;
    const mode = config.pdfInitialLoadingMode; // cors, no-cors, *cors, same-origin
    const options = mode ? { signal, mode } : { signal };
    
    let arrayBuffer;

    try {
      const response = await fetch( url, options );  
      if (response.ok){
        arrayBuffer = await response.arrayBuffer();
      } else {
        console.error( `Error: ${response.statusText}: "${url}"` );
        if ( response.status === 404 ) alert( `Falsche Adresse "${url}". Tippfehler?` );
      } 
    } catch ( error ) {
      console.error(`Error: ${error.message} while downloading ${url}`);
      if ( error.name !== 'AbortError' ) alert( `${url} konnte nicht geladen werden.` );
    } finally {
      abortButton.classList.add('hide');
    }
    if ( arrayBuffer ){
      const result = [];
      const jsZip = new JSZip();
      const zip = await jsZip.loadAsync( arrayBuffer );
      let password;
      if ( decrypt ) password = passwordForEncyption ? passwordForEncyption : prompt(`Lade ${url}. Passwort?`);
      if ( ! password ) decrypt = false;

      for ( const singleFileName of Object.keys( zip.files ) ){
        // skip system files
        if ( singleFileName.startsWith('__MAC') ) continue;
        if ( singleFileName.startsWith('.') ) continue;
        // get encrypted file contents
        // see @link https://stuk.github.io/jszip/documentation/api_zipobject/async.html for async types
        let encryptedPdfData = await zip.files[ singleFileName ].async( 'uint8array' );
        /** {ArrayBuffer} pdfData - decrypted content */
        let pdfData;
        try {
          pdfData = decrypt ? await BrowserCrypto.decrypt( encryptedPdfData, password ) : encryptedPdfData;
        } catch (error) {
          console.error( `${error.name}`, error );
          alert( 'Falsches Passwort!' );
        }
        if ( ! pdfData ) break; // wrong password 
        const [ kindOfPDF, language ] = kindOfPDF_language( singleFileName );
        const key = kindOfPDF ? `${kindOfPDF}_${language}` : singleFileName.slice(0,-4);
        await Idb.set( key, new Uint8Array( pdfData ) );
        managePdfList( key, { name: singleFileName } );
        result.push( key );
      }
    
      // XMLInterpreter.resetLastInvokation();
      
      setAllLanguageSelectors();
      return result;
    }
  }
};

document.getElementById('share_xml').addEventListener('click', async event => {
  const file = new File([ await navigator.clipboard.readText() ], 'clipboard.xml', {
    type: "text/xml",
  }); 
  const files = [ file ];
  //validates the files
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({
        files,
        title: "QuickFill XML file",
        text: key,
        url: ''
      });
      alert( "Shared successfully!" );
    } catch (error) {
      alert( error.message );
    }
  } else {
    alert( `Your system doesn't support sharing these files.` );
  }
});

firstElementWithClass('interprete_xml_file')?.addEventListener('click',
  interpretXMLListener( async interpreter =>  interpreter.interpretFile(), 
  `file selection cancelled or error in selected file` ) );

firstElementWithClass('interprete_xml_clipboard')?.addEventListener('click', 
  interpretXMLListener( async interpreter => interpreter.interpretClipBoard( await navigator.clipboard.readText() ) 
  `invalid clipboard buffer content: probably not XML` ) );

function interpretXMLListener( interpreterCallback, errorMessage ){
  return async event => {
    event.target.disabled = true;
    const cancelButton = document.getElementById('interprete_xml_cancel');
    const interpreter = new XMLInterpreter( event.target, document.getElementById('xml_analyse') );
    const myCancelEventListener = cancelEventListener( interpreter );
    cancelButton?.addEventListener('click', myCancelEventListener ); 
    try {
      await interpreterCallback( interpreter );
    } catch ( error ) {
      console.assert( error.name === 'AbortError', error.name, error );
      if ( error.name !== 'AbortError' ){ alert( `Fehler in XML` ); } 
    } finally {
      event.target.removeAttribute('disabled');
      if ( ! interpreter.stop ) cancelButton?.removeEventListener( 'click', myCancelEventListener );
    } 
  };
} 

function cancelEventListener( interpreter ){
  return event => {
    const button = document.getElementById('interprete_xml_cancel');
    if ( button.innerText === 'Abbrechen' ){
      interpreter.cancel();
      button.innerText = 'Fortfahren';
    } else {
      interpreter.proceed();
      button.innerText = 'Abbrechen';
    }
  };
}

language_selector.addEventListener('change', event => {
  event.target.selected = true;
  localStorage.setItem('quickfill_xml_language', event.target.value);
});

/**
 * @summary guess type of PDF form and language from file name
 * @example "sammelvodruck-asylgesuch-albanisch" yields [ "asylgesuch", "albanisch" ]
 * @access const [ kindOfPDF, language ] = kindOfPDF_language( pdfFile );
 * @param {File} pdfFile - instance of file which is PDF
 * @returns tuple with kind of pdf and language
 */
export function kindOfPDF_language( pdfFileName ){
  const kindOfPDF = pdfFileName.split('-')[1];
  const filenameWithoutSuffix = pdfFileName.substring(0, pdfFileName.lastIndexOf('.')) || pdfFileName;
  const language = filenameWithoutSuffix.split('-').pop();
  return [ kindOfPDF, language ];
}

const visiblityListener = event => {
  const li = event.target.parentElement;
  const passwordElement = li.querySelector('.password');
  passwordElement.type = passwordElement.type === 'password' ? 'text' : 'password';
};
const enryptListener = async event => {
  const li = event.target.parentElement;
  const key = li.dataset.key;
  const uint8array = await Idb.get( key );
  const password = li.querySelector('.password')?.value || prompt(`Passwort für die Verschlüsselung von ${key}?`);
  if ( password ){
    const encryptedData = await BrowserCrypto.encrypt( uint8array, password );
    Idb.set( key, encryptedData );
    alert(`${key} wurde mit "${password}" zusätzlich verschlüsselt.`);
  }
  li.querySelector('.password')?.classList.add('hide');
  li.querySelector('.password_visibiliy')?.classList.add('hide');
  li.querySelector('button.encrypt')?.classList.add('hide');
};
const decryptListener = async event => {
  const li = event.target.parentElement;
  const key = li.dataset.key;
  const uint8array = await Idb.get( key );
  const password = li.querySelector('.password')?.value || prompt(`Passwort für die Verschlüsselung von ${key}?`);
  if ( password ){
    let decryptedData;
    try {
      decryptedData = await BrowserCrypto.decrypt( uint8array, password );
    } catch (error) {
      console.error( `${error.name}`, error );
      alert( 'Falsches Passwort!' );
    }
    if ( decryptedData ){
      Idb.set( key, new Uint8Array( decryptedData ) );
      alert(`${key} wurde mit "${password}" entschlüsselt.`);
    }
  }
  li.querySelector('.password')?.classList.add('hide');
  li.querySelector('.password_visibiliy')?.classList.add('hide');
  li.querySelector('button.decrypt')?.classList.add('hide');
};

/**
 * @summary add a list item to the list of loaded PDFs
 * @param {String} key - index of IndexedDB store, where PDF binary is stored
 * @param {File} pdfFile - instance of file which is PDF
 */
function managePdfList( key, pdfFile ){
  const li = document.createElement('li');
  li.dataset.key = key;
  const suffix = key.match(/profil/i) ? '.txt' : '.pdf';
  li.innerHTML = `${pdfFile ? pdfFile.name + ' => ' : ''} ${key} `;
  li.innerHTML += `
    <span class="spacy_width icon small" title="Löschen">${trashWhiteIconSVG}</span>
    <span class="spacy_width icon small" title="auf lokale Platte speichern">${downloadSVG}</span>
    <span class="spacy_width icon small" title="Datei mit anderen teilen (share)">${shareSVG}</span>
    <span class="spacy_width icon small" title="mit Passwort verschlüsseln">${keyPlusSVG}</span>
    <span class="spacy_width icon small" title="mit Passwort entschlüsseln">${keyMinusSVG}</span>
    <input type="password" class="password spacy_width hide" placeholder="Passwort" title="Individuelles Passwort festlegen">
    <input type="checkbox" class="password_visibiliy hide" title="Passwort sichtbar machen">
    <button class="encrypt hide">encrypt</button>
    <button class="decrypt hide">decrypt</button>`;
  if (key.match(/profil/i)) li.innerHTML += `<span class="spacy_width icon small" title="Profil zur Konfiguration hinzu laden">${personPlusSVG}</span>`;  
  
  const [trashIcon, downloadIcon, shareIcon, keyPlusIcon, keyMinusIcon, configIcon] = Array.from(li.querySelectorAll('svg'));

  const passwordVisibility = li.querySelector('input.password_visibiliy');
  const encryptButton = li.querySelector('button.encrypt');
  const decryptButton = li.querySelector('button.decrypt');
  passwordVisibility.addEventListener('click', visiblityListener);
  encryptButton.addEventListener('click', enryptListener);
  decryptButton.addEventListener('click', decryptListener);
  
  trashIcon.addEventListener('click', event => {
    if ( confirm('Wollen Sie diese Datei aus dem Browser entfernen?') ){
      Idb.del( key );
      setAllLanguageSelectors();
      li.remove();
      if ( firstElementWithClass('loaded_pdfs')?.childElementCount === 0 ){
        firstElementWithClass('loaded_pdfs').innerHTML = '<li class="null_item">Keine. (Bitte zuerst PDFs laden!)</li>';
      }
    }
  });
  configIcon?.addEventListener('click', async event => {
    if ( confirm(`Wollen Sie die Konfiguration ${key} dazu laden?`) ){
      const uint8array = await Idb.get( key );
      const fileContents = new TextDecoder().decode( uint8array );
      mergeConfigAndReload( fileContents );
    }
  });
  downloadIcon?.addEventListener('click', async event => {
    const uint8array = await Idb.get( key );
    const blob = new Blob([uint8array], {type: "binary/octet-stream"});
    fileSave( blob, {
      // Suggested file name to use, defaults to `''`.
      fileName: `${key}${suffix}`,
      // Suggested file extensions (with leading '.'), defaults to `''`.
      extensions: [ suffix ],
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: 'downloads',
      // Include an option to not apply any filter in the file picker, defaults to `false`.
      excludeAcceptAllOption: false,
    });
  });
  shareIcon?.addEventListener('click', async event => {
    const uint8array = await Idb.get( key );
    const blob = new Blob([uint8array], {type: "binary/octet-stream"});
    // Create a File from the Blob with a desired file name and MIME type
    const filename = `${key}.pdf`;
    const file = new File([blob], filename, { type: 'application/pdf' });
    const files = [ file ];
    let shareData = {
      files,
      title: "QuickFill file",
      text: filename,
      url: ''
    };
    //validates the files
    if (navigator.canShare && navigator.canShare( shareData )) {
      try {
        await navigator.share( shareData );
        alert( "Shared successfully!" );
      } catch (error) {
        console.error( error.name, error )
        alert( error.message );
      }
    } else {
      alert( `Your system doesn't support sharing these files.` );
    }
  });
  keyPlusIcon?.addEventListener('click', async event => {
    li.querySelector('.password')?.classList.remove('hide');
    li.querySelector('.password_visibiliy')?.classList.remove('hide');
    li.querySelector('button.encrypt')?.classList.remove('hide');
  });
  keyMinusIcon?.addEventListener('click', async event => {
    li.querySelector('.password')?.classList.remove('hide');
    li.querySelector('.password_visibiliy')?.classList.remove('hide');
    li.querySelector('button.decrypt')?.classList.remove('hide');
  });
  firstElementWithClass('loaded_pdfs')?.appendChild(li);
  firstElementWithClass('null_item')?.remove();
}

document.getElementById('share_profile')?.addEventListener('click', async event => {
  ProfileEditor.updateConfig({});
  const initialRulesList = config.initialRulesList;
  const json = JSON.stringify( { initialRulesList }, null, 2 );
  const blob = new Blob([json], {type: "text/plain"});
  // Create a File from the Blob with a desired file name and MIME type
  const file = new File([blob], 'profil.txt', { type: 'text/plain' });
  const files = [ file ];
  //validates the files
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({
        files,
        title: "QuickFill Profil",
        text: 'profil.txt',
        url: ''
      });
      alert( "Shared successfully!" );
    } catch (error) {
      alert( error.message );
    }
  } else {
    alert( `Your system doesn't support sharing these files.` );
  }
});

document.getElementById('share_all_files')?.addEventListener('click', async event => {
  const files = [];
  for ( const [ key, uint8array ] of await Idb.entries() ){
    const blob = new Blob([uint8array]);
    // Create a File from the Blob with a desired file name and MIME type
    const file = new File([blob], key, { type: 'text/plain' });
    files.push( file );
  }
  //validates the files
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({
        files,
        title: "QuickFill Formulare",
        text: 'alle QuickFill Formulare',
        url: ''
      });
      alert( "Shared successfully!" );
    } catch (error) {
      alert( error.message );
    }
  } else {
    alert( `Your system doesn't support sharing these files.` );
  }
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
      if ( pdfFile.name?.slice(-4)?.toLowerCase() !== '.pdf' ) continue;
      const pdfBinary = new Uint8Array( await pdfFile.arrayBuffer() );
      const [ kindOfPDF, language ] = kindOfPDF_language( pdfFile.name );
      const key = kindOfPDF ? `${kindOfPDF}_${language}` : pdfFile.name.slice(0,-4);

      // store binary in IndexedDB:
      await Idb.set( key, pdfBinary );
      managePdfList( key, pdfFile );
    }
    setAllLanguageSelectors();
  };
}

export function pdfLoader(){
  return async event => {
      event.stopImmediatePropagation();

      const pdfFileHandles = await fileOpen( {
        // List of allowed MIME types, defaults to `*/*`.
        mimeTypes: ['application/pdf', 'text/plain'],
        // List of allowed file extensions (with leading '.'), defaults to `''`.
        extensions: [ '.pdf', '.PDF', '.txt', '.TXT' ],
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
    const [ kindOfPDF, language ] = kindOfPDF_language( pdfFile.name );
    const pdfFileNameComponents = pdfFile.name.split('.');
    pdfFileNameComponents.pop();
    // key serves (1.) as index into IndexedDB and (2.) as class name in HTML. Therefore no special chars allowed 
    const key = kindOfPDF && language ? `${kindOfPDF}_${language}` : pdfFileNameComponents.join('_');

    if ( await Idb.get( key ) ){
      console.error( `${key} already loaded. Please delete first.` );
      alert( `"${key}" ist bereits geladen. Bitte zuerst löschen!` );
    } else {
      await Idb.set( key, new Uint8Array( await pdfFile.arrayBuffer() ));
      setAllLanguageSelectors();
      managePdfList( key, pdfFile );
    }  
  };

}

firstElementWithClass('delete_pdfs').addEventListener('click', async event => {
  if ( confirm('Wollen Sie alle gespeicherten Dateien aus dem Browser entfernen?') ){
    for ( const key of await Idb.keys() ){
      if ( key === config.configIdentifier ) continue;
      Idb.del( key );
    }
    setAllLanguageSelectors();
    event.target.parentElement.parentElement.nextElementSibling.innerHTML = '<li class="null_item">Keine. (Bitte zuerst PDFs laden!)</li>';
  }
});

let qrScanner;

function import_QR_fill_pdf( event ){
  const videoContainer = document.getElementById('qr-video-container');
  const qrVideo = document.getElementById('qr-video');
  const qrErrorMessage = document.getElementById('qr-error-message');
  if ( videoContainer.classList.contains('hide') ){
    videoContainer.classList.remove('hide');
    qrScanner = new QrScanner( qrVideo, result => createPdfFromCollectedData( result ), {
      onDecodeError: error => {
          qrErrorMessage.innerText = `Bitte Kamera auf den QR-Code richten! ${error}`;
      },
      // maxScansPerSecond: 5,
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });
    qrScanner.start();
  } else {
    qrScanner?.stop();
    videoContainer.classList.add('hide');
  } 
}

// let qrDataPool = [];

// function collectData( result ){
//   qrDataPool.push( result );
//   setTimeout( qrScanner.stop, 200 );
//   setTimeout( createPdfFromCollectedData, 250 );
// }

async function createPdfFromCollectedData( result ){
  qrScanner.stop();
  document.getElementById('qr-video-container').classList.add('hide');
  // const MAX = Math.max( qrDataPool.map( res => res.data.length ) );
  const bestResult = result; // qrDataPool.find( res => res.data.length === MAX );
  const data = Object.fromEntries( bestResult.data.split('|').map( f => f.split('=') ) );
  document.getElementById('qr-error-message').innerText = `QR-Code gefunden!`;
  const person = Person.getPersonFromName( data.name );
  const ruleTable = document.querySelector('.app table.rule_table');
  for ( const [ rule, value ] of Object.entries( data ) ){
    if ( rule === 'PDF' ) continue;
    Rule.createNew({ rule, value, person });
  }
  const root = ruleTable.parentElement;
  root.innerHTML = '';
  const title = `Eingelesene Daten von ${data.name}`;
  const personEditor = new PersonEditor({person, root, title, plus_row: true});
  personEditor.rules_area = root;
  personEditor.render();

  const keyOrFilename = data.PDF;
  const pdfBinary = await Idb.match( keyOrFilename );
  const newPdfDoc = new PdfDoc( {name: keyOrFilename}, null, person );
  await newPdfDoc.renderArrayBuffer( pdfBinary );
  // qrDataPool = [];
  return newPdfDoc;
}

document.getElementById('qr-start-button').addEventListener('click', event => {
  document.getElementById('qr-video').classList.remove('hide');
  qrScanner.start();
});

document.getElementById('qr-stop-button').addEventListener('click', event => {
  qrScanner.stop();
  document.getElementById('qr-video').classList.add('hide');
});

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
    if ( silent ) console.log( failureMessage ); else if ( error.name !== 'AbortError' ) alert( failureMessage );
    console.error( `${error.name}`, error );
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

const profileSelector = document.getElementById('select_profile');
profileSelector?.addEventListener('change', async event => {
  const selectedValue = event.target.value;
  if ( selectedValue ){
    const encryptedUInt8Array = await Idb.get( selectedValue );
    let decryptedUInt8Array;
    if ( selectedValue.match(/mustermann/i) ){ // Mustermann does not need a Password
      decryptedUInt8Array = encryptedUInt8Array;
    } else {
      const individualPassword = prompt(`Individuelles Passwort für ${selectedValue}?`);
      try {
        decryptedUInt8Array = await BrowserCrypto.decrypt( encryptedUInt8Array, individualPassword );
      } catch (error) {
        console.error( `${error.name}`, error );
        alert( 'Falsches Passwort!' );
      }
    }
    if ( decryptedUInt8Array ){
      const fileContents = new TextDecoder().decode( decryptedUInt8Array );
      mergeConfigAndReload( fileContents );
      alert(`Profil ${selectedValue} wurde importiert.`);
    }
  } else {
    alert('Es wurde kein Profil ausgewählt.');
  }
  profileSelector.classList.add('hide');
  document.getElementById('config_import')?.removeAttribute('disabled');
});

export const configImportHandler = async event => {
  document.getElementById('config_import').disabled = true;
  // unreliable disabled = true, is in conflict with FileOpener user gesture immediacy
  // await new Promise( resolve => requestAnimationFrame( _=> requestAnimationFrame( resolve ) ) );
  let fileContents;
  if ( confirm( 'Import von lokaler Datei?' ) ){
    const fileHandle = await fileOpen( {
      // List of allowed MIME types, defaults to `*/*`.
      mimeTypes: [ 'text/plain' ],
      // List of allowed file extensions (with leading '.'), defaults to `''`.
      extensions: [ '.txt' ],
      // Set to `true` for allowing multiple files, defaults to `false`.
      multiple: false,
      // Textual description for file dialog , defaults to `''`.
      description: 'QuickFill Configuration importieren',
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: 'downloads',
      // Include an option to not apply any filter in the file picker, defaults to `false`.
      excludeAcceptAllOption: false,
    } );
    const file = fileHandle instanceof File ? fileHandle : await fileHandle.getFile();
    fileContents = await file.text();
    if ( fileContents ){
      mergeConfigAndReload( fileContents );
    } 
    document.getElementById('config_import')?.removeAttribute('disabled');
  } else {
    const url = prompt('URL des Profil-Archivs?', archiveUrlFromFileName( 'profile.zip' ) );
    if ( url ){
      // Archive is not encrypted, but files are encrypted with different passwords
      // Therefore, do not decrypt archive.
      const result = await loadAndDecryptArchive( url, false );
      if ( result.length ){ 
        // delete old options
        profileSelector.innerHTML = `<option value="">--Profil wählen:--</option>`;
        // create new options
        for ( const key of result ){
          const option = document.createElement('option');
          option.value = key;
          option.innerText = key;
          profileSelector.appendChild( option );
        }
        profileSelector.classList.remove('hide');
      } else {
        document.getElementById('config_import')?.removeAttribute('disabled');
      }  
    } else {
      document.getElementById('config_import')?.removeAttribute('disabled');
    } 
  }
};

function mergeConfigAndReload( fileContents ){
  const quickFillConfig = jsonParseWithFunctions( fileContents );
  if ( quickFillConfig ){
    const mergedObjects = mergeObjects( config, quickFillConfig );
    mergedObjects.version = mergedObjects.version.split('.').map( (num,i) => i==1?parseInt(num)+1:num ).join('.'); 
    setAndLoad();
    async function setAndLoad(){
      // wait for IndexedDB to be ready, before reload of page
      await Idb.set(config.configIdentifier, jsonStringifyWithFunctions( mergedObjects ) );
      // load quickFillConfig from IndexedDB automatically, when loading
      location.reload(); 
      // Instead of reload: 
      // Object.assign( config, quickFillConfig );
      // for (const profileEditor of ProfileEditor.all){
      //   profileEditor.update();
      // } 
    } 
  } else {
    alert('Import fehlgeschlagen.');
    debugger;
  } 
}

/**
 * export initialRulesList only
 * @param {Event} event 
 */
export const configExportHandler = event => {
  ProfileEditor.updateConfig({});
  const initialRulesList = config.initialRulesList;
  const json = JSON.stringify( { initialRulesList }, null, 2 );
  const blob = new Blob([json], {type: "text/plain"});
  fileSave( blob, {
    // Suggested file name to use, defaults to `''`.
    fileName: 'name_profile.txt',
    // Suggested file extensions (with leading '.'), defaults to `''`.
    extensions: ['.txt'],
    // Suggested directory in which the file picker opens. A well-known directory or a file handle.
    startIn: 'downloads',
    // By specifying an ID, the user agent can remember different directories for different IDs.
    id: 'downloads',
    // Include an option to not apply any filter in the file picker, defaults to `false`.
    excludeAcceptAllOption: false,
  });
};

/**
 * export complete config with ALL properties
 * @param {Event} event 
 */
export const configExportAllHandler = event => {
  ProfileEditor.updateConfig({});
  const json = jsonStringifyWithFunctions( config, 2 );
  const blob = new Blob([json], {type: "text/plain"});
  fileSave( blob, {
    // Suggested file name to use, defaults to `''`.
    fileName: 'name_profile.txt',
    // Suggested file extensions (with leading '.'), defaults to `''`.
    extensions: ['.txt'],
    // Suggested directory in which the file picker opens. A well-known directory or a file handle.
    startIn: 'downloads',
    // By specifying an ID, the user agent can remember different directories for different IDs.
    id: 'downloads',
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
  await pdfDoc.waitForState('constructed');

  const pdfBinary = new Uint8Array( await pdfFile.arrayBuffer() );
  const [ kindOfPDF, language ] = kindOfPDF_language( pdfFile.name );
  const key = `${kindOfPDF}_${language}`;
  pdfDoc.key = key;

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
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

setDarkMode( localStorage.getItem('DarkMode') === 'true' );

document.getElementById('dark_button')?.addEventListener('click', event => {
  const DarkMode = localStorage.getItem('DarkMode') !== 'true';
  setDarkMode( DarkMode );
  localStorage.setItem('DarkMode', DarkMode);
});

if ( ! (await Idb.keys()).length ){
  for ( const fileName of config.pdfInitialLoading ){
    // initial loading
    if ( confirm( `${fileName} laden?` ) ) loadAndDecryptArchive( fileName );
  }
}

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

async function allLanguages(){
  const all_Languages = Array.from( new Set( ( await Idb.keys() ).map( filename_language_mapper ) ) );
  return all_Languages.filter( name => name !== 'profile' );
}

async function setAllLanguageSelectors(){
  const lastLanguage = localStorage.getItem('quickfill_xml_language');
  for ( const language_selector of document.querySelectorAll('.language_selector') ){
    language_selector.innerHTML = `
      <option value="">--Bitte auswählen:--</option>
      <option value="englisch">englisch</option>
    `;
    if ( lastLanguage && ( lastLanguage !== 'englisch' ) ){
      language_selector.innerHTML += `
        <option value="${lastLanguage}">${lastLanguage}</option>
    `;
    }
    for ( const language of await allLanguages() ){
      if ( language !== 'englisch' && language !== lastLanguage ){
        if ( language === 'profile' ) continue;
        const option = document.createElement('option');
        option.innerText = language;
        option.value = language;
        language_selector.appendChild(option);
      }
    }
  }
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
  const all_loaded_pdfs = await Idb.keys(); // .filter( key => key.includes('_') );
  const all_languages = await allLanguages();
  switch ( state ){
    case 'pdf_loader':
      const list = firstElementWithClass('loaded_pdfs');
      list.innerHTML = `<li class="null_item">Keine. (Bitte zuerst PDFs laden!)</li>`;
      for ( const key of all_loaded_pdfs ){
        managePdfList( key );
      }
      break;
    case 'xml':
      if ( PdfDoc.all.length === 0 ){
        firstElementWithClass('save_all')?.classList.add('hide');
        firstElementWithClass('print_all')?.classList.add('hide');
      }
      await setAllLanguageSelectors();
      const language_selector = document.getElementById('language_selector');
      const language = localStorage.getItem('quickfill_xml_language') || 'englisch'; 
      if ( all_languages.includes( language ) ){
        language_selector.value = language;
        localStorage.setItem('quickfill_xml_language', language);
      }
      break;
    case 'app':
      CaseEditor.instance?.update();
      await PdfDoc.updateAll();
      break;
    case 'profile':
      document.querySelector('body > .cloud_abort')?.classList.add('hide');
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
  } catch (error) {
    console.assert( error.name === 'AbortError', error.name, error );
    if ( error.name !== 'AbortError' ) alert( `Fehler in XML` );
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
      return Rule.createNew({rule, value: xmlData, rule_type: 'superstring', owner: 'case' });

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
  const configPropertyEditorDiv = document.querySelector('#config_editor > div.properties');
  configPropertyEditorDiv.innerHTML = `<fieldset><legend>config.js Input Fields</legend><ul></ul></fieldset>
    <button class="import">Import</button>
    <button class="export">Export All</button>
  `;
  const propertyList = configPropertyEditorDiv.querySelector('ul');
  for ( const [ key, value ] of Object.entries( config ) ){
    const li = document.createElement('li');
    let input;
    switch ( typeof value ) {
      case 'boolean': 
        li.innerHTML = `${key}: <input id="config_${key}" type="checkbox">`;
        propertyList.append( li );
        input = li.querySelector('input');
        input.checked = value;
        input.addEventListener('change', event => { config[key] = input.checked; updateFulltext( event ); });
        break;
      case 'string':
        li.innerHTML = `${key}: <input id="config_${key}" type="text">`;
        propertyList.append( li );
        input = li.querySelector('input');
        input.value = value;
        input.addEventListener('input', event => { config[key] = input.value; updateFulltext( event ); });
        break; 
      case 'number':
        li.innerHTML = `${key}: <input id="config_${key}" type="number">`;
        propertyList.append( li );
        input = li.querySelector('input');
        input.value = value;
        input.addEventListener('input', event => { config[key] = input.value; updateFulltext( event ); });
        break;
      default:   
    }
  }
  const configEditorDiv = document.querySelector('#config_editor > div.fulltext');
  const config_json = jsonStringifyWithFunctions( config, 2 );
  configEditorDiv.innerHTML = `<fieldset><legend>config.js Fulltext Editor</legend><div contenteditable>
      <pre>${config_json}</pre>
      </div>
      </fieldset>
    `;
  const configEditorContents = configEditorDiv.querySelector('pre');
  const importButton = document.querySelector('#config_editor .import');
  const exportButton = document.querySelector('#config_editor .export');

  function updateFulltext( event ){
    configEditorContents.innerText = jsonStringifyWithFunctions( config, 2 );
    Idb.set( 'quickFillConfig', jsonStringifyWithFunctions( config ) );
  }

  function blurListener( event ){
    const config_json = configEditorContents.innerText;
    const newConfig = jsonParseWithFunctions( config_json );
    Object.assign( config, newConfig );
    Idb.set( 'quickFillConfig', jsonStringifyWithFunctions( config ) );
    // Rule.DB.load();
    // for ( const profileEditor of ProfileEditor.all ){
    //   profileEditor.update();
    // }
    // location.reload();
  }

  configEditorContents.addEventListener( 'blur', blurListener );

  importButton.addEventListener( 'click', configImportHandler );

  exportButton.addEventListener( 'click', configExportAllHandler );
  
  window.scrollBy(0, window.innerHeight / 3);
  configEditorDiv.focus();
  
} );