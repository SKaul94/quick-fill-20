/**
 * @module Doc.js
 * @summary Wrapper class for a PDF document
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {addCollapseIcons} from './global_functions.js';
import {Field} from './Field.js';
import {Rule} from './Rule.js';
import {qrcode} from "./qrcode.js";
import {fileOpen, fileSave} from './FileOpener.js';
import {JSZip} from './jszip.js';

export class PdfDoc extends EventTarget  {

  constructor( file, htmlSpace, person ) {
    super();
    this.file = file;
    this.fileName = file.name;
    if (  htmlSpace ){ 
      this.htmlSpace = htmlSpace; // HTML space already exists
      this.fragment = this.htmlSpace; // alias for compatibility 
      this.iFrame = this.htmlSpace.querySelector('iframe');
      this.htmlSpace.querySelector('.filename').textContent = file.name;
    }
    if ( person ){
      this.person = person;
      this.person.pdfDoc = this;
    }
    this.pagesRendered = new Set();
    PdfDoc.all.push( this );
    document.querySelector('.save_all').classList.remove('hide');
    document.querySelector('.print_all').classList.remove('hide');
    this.isFullyRendered = false;
    this.isFullyRenderedPromise = new Promise( resolve => {
      this.addEventListener('ready', async event => { 
        console.log( 'Person ready: ', this.person?.name, Rule.DB.activePersonRules() );
        resolve();
      } );
    });
    this.isFullyRenderedPromiseOrTimeout = Promise.race([
      this.isFullyRenderedPromise,
      new Promise( resolve => setTimeout( resolve, 5000 ) )
    ]);
  }

  /**
   * @summary async build stuff, that cannot be included in constructor, because of async calls
   */
  async build(){ 
    if ( ! this.htmlSpace ){
      this.htmlSpace = this.createHTMLSpace();
      this.fragment = this.htmlSpace; // alias for compatibility 
      this.iFrame = this.htmlSpace.querySelector('iframe');
      this.htmlSpace.querySelector('.filename').textContent = file.name;
    }    

    // wait for PDF viewer to be initialized ???
    // await this.iFrame.contentWindow.PDFViewerApplication.initializedPromise;

    // access PDF datastructures directly
    this.pdfViewerApplication = this.iFrame.contentWindow.PDFViewerApplication;
    this.pdfDocumentInstance = this.pdfViewerApplication.pdfDocument; 
    
    // add title
    this.metaData = await this.pdfDocumentInstance.getMetadata();
    this.title = this.metaData.info.Title || config.missingTitle;
    const titleSpan = this.fragment.querySelector('.title');
    titleSpan.innerHTML = this.title;

    // add delete button
    const deleteButton = this.fragment.querySelector('.delete');
    deleteButton?.addEventListener('click', event => {
      // this.pdfViewerApplication.close(); // see delete
      // this.fragment.parentElement.removeChild( this.fragment ); // see delete
      this.delete();
    });

    // add buttons for collapsing and expanding
    addCollapseIcons(titleSpan, this.fragment.querySelector('div.result'), this.addFillDefaultButton(titleSpan) );
    this.addUpDownButtonListeners();
  
    // precompute indices into PDF fields and PDF objects for faster access
    this._pdfFieldObjects = await this.pdfViewerApplication.pdfDocument.getFieldObjects();
    this._allFieldNames = Object.keys( this._pdfFieldObjects );
    this._pdfObjectsDict = {}; // maps pdfObject.id to pdfObject
    this._pdfFieldsDict = {};  // maps fieldName to Field
    for ( const fieldName of this._allFieldNames ){
      const pdfObjectsList = this._pdfFieldObjects[ fieldName ];
      this._pdfFieldsDict[ fieldName ] = new Field( this, fieldName, pdfObjectsList );
      for ( const pdfObject of pdfObjectsList ){
        this._pdfObjectsDict[ pdfObject.id ] = pdfObject;
      }
    }
    // if ( config.log ) console.log( new Set( Object.values( this._pdfFieldsDict ).map( field => field.typ ) ) );
    this._pdfIndex = new Map(Object.entries( this._pdfFieldsDict ));  // alias for compatibility 

    // add data rows to table with rule based values
    const result = this.fragment.querySelector('table.result');
    for ( const fieldObject of Object.values( this._pdfFieldsDict ) ){
      if ( fieldObject.typ === null ) continue;  // ignore fields without type (e.g. buttons)
      if ( config.ignoreFields.includes( fieldObject.name ) ) continue;
      if ( config.ignoreCheckboxes && fieldObject.typ === 'checkbox' ) continue;
      const htmlElement = fieldObject.toHTMLTableRowWithEventListeners( this );
      result.appendChild( htmlElement );
    }

    this._allFields = Object.values( this._pdfFieldsDict );
  }

  /**
   * @summary final cleanup to close PDF document and remove HTML DIV element
   */
  delete(){
    this.htmlSpace.parentElement.removeChild( this.htmlSpace );
    this.pdfViewerApplication.close();
    URL.revokeObjectURL( this.url ); // frees memory
    PdfDoc.all.splice( PdfDoc.all.indexOf( this ), 1 );
    this.file = null;
    this.htmlSpace = null;
    this.iFrame = null;
    this.metaData = null;
    this.fragment = null;
    this._pdfFieldObjects = null;
    this._allFieldNames = null;
    this._pdfObjectsDict = null;
    this._pdfFieldsDict = null;
    this._pdfIndex = null;
    this._allFields = null;
    this._pdfTable = null;
    this._allRules = null;
    this.url = null;
  }

  remove(){
    this.delete();
  }

  /**
   * @summary install listeners for PDF viewer events and scroll to all pages to render them,
   *         because the PDF pages are rendered on demand, not upfront.
   */
  installListeners(){
    const pageReadyPromises = [];
    const pdfViewer = this.iFrame.contentWindow.PDFViewerApplication.pdfViewer;
    for ( let pageNumber = 1; pageNumber <= pdfViewer.pagesCount; pageNumber++){
      pageReadyPromises.push( this.pageReady( pageNumber ) );
    }

    this.iFrame.contentWindow.onbeforeunload = event => console.log;

    // The sandboxcreated event is the last event after opening a PDF.
    // Fill form fields after all pages have been rendered:
    this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "sandboxcreated", async event => {
      if ( config.log ) console.log('=== sandboxcreated ===');
      
      // scroll to all pages, that have not been rendered yet, to force rendering
      const pdfViewer = this.iFrame.contentWindow.PDFViewerApplication.pdfViewer;
      for ( let pageNumber = pdfViewer.pagesCount; pageNumber >= 1; pageNumber--){
        pdfViewer.scrollPageIntoView({ pageNumber });
        await this.annotationeditorlayerrendered( pageNumber );
      }

      await Promise.all( pageReadyPromises );

      if ( this.person ) await this.person.activate();
    
      // start viewer with first page
      pdfViewer.scrollPageIntoView({ pageNumber: 1 });
      if ( pdfViewer.currentPageNumber !== 1 ) await this.pagechanging( 1 );

      // apply rules to table after all pages have been rendered
      this.applyRulesToTable();   
      this.applyTableToPDF();

      this.isFullyRendered = true;
      this.dispatchEvent( new Event('ready') ); // for fulfilling the this.isFullyRenderedPromise
    }, { once: true } );  // sandbox is created once only

    // After build, Editing PDF directly induces changes to the HTML table dynamically
    this.iFrame.contentWindow.addEventListener('change',  event => { 
      if ( ! ['scaleSelect','pageNumber'].includes( event.target.id ) ) {
        const pdfObjectId = event.target.id.split('_').pop();
        const pdfObject = this._pdfObjectsDict[ pdfObjectId ];
        const field = this._pdfFieldsDict[ pdfObject.name ];
      
        switch ( field.typ ){
          case 'checkbox':
            const inputElement = Array.from( field.htmlRow.querySelectorAll('label') )
              .find( el => el.textContent === pdfObject.exportValues )
              .firstElementChild;
            inputElement.checked = event.target.checked;
            break;
          case 'combobox': case 'text':
            field.htmlRow.querySelector('.input').textContent = event.target.value;
            break;
          default:
            field.htmlRow.querySelector('input').value = event.target.value;
        }
      }
    });

    // handle changes in fields in PDF.js viewer propagating values to HTML table
    this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "dispatcheventinsandbox", event => {
      const fieldName = event.source.data.fieldName;
      const newValue = event.detail.value;
      const field = this.getFieldByName( fieldName );
      if ( field ) field.value = newValue;
    } );

    // 
    this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "updateviewarea", event => {
      for ( const elem of this.iFrame.contentDocument.querySelectorAll('[hidden]') ){
        elem.removeAttribute('hidden');
      }
      for ( const elem of this.iFrame.contentDocument.querySelectorAll('[disabled]') ){
        elem.removeAttribute('disabled');
      }
    } );

    /**
     * additional listener for image button called "stampEditor" in the pdf.js toolbar
     * to prevent container from overlaying the inserted image
     */
    this.iFrame.contentDocument.getElementById('editorStamp').addEventListener('click', async event => {
      await new Promise(resolve => 
        this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "switchannotationeditorparams", resolve )); 
      await new Promise(resolve => 
          this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "annotationeditorstateschanged", resolve ));
      for ( const insertedImage of this.iFrame.contentDocument.querySelectorAll('.stampEditor') ){
        // prevent container from overlaying the inserted images
        insertedImage.style['z-index']='33'; // the underlying container has z-index 22  
        const container = this.iFrame.contentDocument.querySelector('section.linkAnnotation.buttonWidgetAnnotation.pushButton');
        if ( container ){
          insertedImage.style['left']=container.style['left'];
          insertedImage.style['top']=container.style['top'];
          insertedImage.style['width']=container.style['width'];
          insertedImage.style['height']=container.style['height'];
          // Get the bounding rectangle of the div element
          // const rect = container.getBoundingClientRect();
          // Set the top, left, width and height of the image to match the div element
          // insertedImage.style.position = "absolute";
          // insertedImage.style.top = rect.top + "px";
          // insertedImage.style.left = rect.left + "px";
          // insertedImage.style.width = rect.width + "px";
          // insertedImage.style.height = rect.height + "px";
        }
      }
      // inserted images have IDs similar to 'pdfjs_internal_editor_0'. So alternatively: 
      // this.iFrame.contentDocument.getElementById('pdfjs_internal_editor_0')
    });

    this.iFrame.contentDocument.body.addEventListener('click', async event => {
      if ( ! event.target.classList.contains('pushButton') ) return true;
      // open file dialog to select an image
      const imageFile = await fileOpen( {
        // List of allowed MIME types, defaults to `*/*`.
        mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/tiff', 'image/bmp', 'image/webp'],
        // List of allowed file extensions (with leading '.'), defaults to `''`.
        extensions: [ '.png', '.jpg', '.jpeg', '.gif', '.svg', '.tiff', '.bmp', '.webp' ],
        // Set to `true` for allowing multiple files, defaults to `false`.
        multiple: false,
        // Textual description for file dialog , defaults to `''`.
        description: 'Bilder',
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: 'Images',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
      } );
      // insert image on top of event.target
      if ( imageFile ){
        const image = this.iFrame.contentDocument.createElement('img');
        image.src = URL.createObjectURL( imageFile );
        image.classList.add('stampEditor');
        image.style['z-index']='33'; // the underlying container has z-index 22
        image.style['position']='absolute';
        event.target.style['position']='relative';
        event.target.appendChild( image );
        // adapt size to event.target
        // image.style['top']='0px';
        // image.style['left']='0px';
        // image.style['width']='100%';
        // image.style['height']='100%';

        const container = this.iFrame.contentDocument.querySelector('section.linkAnnotation.buttonWidgetAnnotation.pushButton');
        if ( container ){
          insertedImage.style['left']=container.style['left'];
          insertedImage.style['top']=container.style['top'];
          insertedImage.style['width']=container.style['width'];
          insertedImage.style['height']=container.style['height'];
        }
       }
      
    });

    // ToDo
    this.iFrame.contentDocument.body.addEventListener( 'dragover', event  => {
      if ( ! event.target.classList.contains('pushButton') ) return true;
        // prevent default to allow drop
        event.preventDefault();
        debugger; // ToDo
        // insert image on top of event.target
        // adapt size to event.target
      },
      false,
    );
    
    
  }

  /**
   * @summary render PDF document via URL in iFrame inside clone of template
   */
  async renderURL(){
    const url = URL.createObjectURL(this.file);
    this.url = url;
    await this.iFrame.contentWindow.PDFViewerApplication.open( { url } );
    await this.build();
    this.installListeners();
    await new Promise( resolve => setTimeout( resolve, 100 ) );
    this.applyTableToPDF();
  }

  /**
   * @summary render PDF document via ArrayBuffer in iFrame inside clone of template
   */
  async renderArrayBuffer( binaryData ){
    // convert ArrayBuffer to Uint8Array
    const data = binaryData ? binaryData : new Uint8Array( await this.file.arrayBuffer() );
    // wait for iFrame loading completion
    if ( ! this.iFrame.contentWindow.PDFViewerApplication ) await new Promise(resolve => this.iFrame.addEventListener( "load", resolve ));
    // wait for PDFViewerApplication initialization
    await this.iFrame.contentWindow.PDFViewerApplication.initializedPromise; 
    // open PDF document
    await this.iFrame.contentWindow.PDFViewerApplication.open( { data } );
    // wait for rendering
    await new Promise(resolve => 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "pagesloaded", resolve ));

    await this.build();
    this.installListeners();
    // await new Promise( resolve => setTimeout( resolve, 100 ) );
    // this.applyTableToPDF();
  }

  get pdfTable(){
    if ( ! this._pdfTable ){
      this._pdfTable = this.fragment.querySelector('table.result');
    }
    return this._pdfTable;
  }

  static async updateAll(){
    await PdfDoc.applyAllRulesToTables();
    PdfDoc.applyAllTablesToPdf();
  }

  static updateAllFieldsArea(){
    const fields_area = document.getElementById('fields_area');
    fields_area.innerHTML = PdfDoc.all.map( pdfDoc => Object.values( pdfDoc._pdfFieldsDict ).filter( field => field.typ ).sort((a, b) => a.compare(b)).map(field => field.toSpan())).join(', ');
      //Array.from( PdfDoc.all ).map( pdfDoc => Array.from( pdfDoc._allFields ) ).flat().sort((a, b) => a.compare(b)).map(field => field.toSpan()).join(', ');
  }

  static async applyAllRulesToTables(){
    for ( const pdfDoc of PdfDoc.all){
      // pdfDoc._allFields.forEach( field => { field.reset() } );
      if ( pdfDoc.person ) await pdfDoc.person.activate();
      pdfDoc.applyRulesToTable();
    }
    PdfDoc.updateAllFieldsArea();
  }

  static applyAllTablesToPdf(){
    for ( const pdfDoc of PdfDoc.all){
      pdfDoc.applyTableToPDF();
    }
  }

  static log(...args){
    if ( config.trace ) 
      console.trace(...args);
    else if ( config.log ) console.log(...args);
  }

  applyPdfToTable(){
    if ( config.log ) console.log('applyPdfToTable');
    // this._allFields.forEach( field => { field.reset() } );
    for ( const fieldObject of this._allFields ){
      const value = fieldObject.valueFromPDF();
      if ( ! value ) continue;
      if ( value === '' ) continue;
      if ( value === 'Off' ) continue;
      if ( fieldObject.typ === null ) continue;
      if ( ! fieldObject.htmlRow ) continue;
      switch ( fieldObject.typ ){
        case "text":
          fieldObject.htmlRow.querySelector('[contenteditable]').innerHTML = value || '';
          break;
        case "checkbox": case "combobox":
          if ( ! config.ignoreCheckboxes ) fieldObject.htmlRow.querySelector('input').checked = value === 'On';
          break;
        case 'dropdown':
        case 'button':
          break; // ignore
        default:
          console.warn(`cannot get value from field ${fieldObject.fieldName} in ${fieldObject.fileName}.`);
      }
    }
  }

  applyRulesToTable(){  // fill table with values calculated by rules
    if ( config.log ) console.log('applyRulesToTable');

    // this._allFields.forEach( field => { field.reset() } );
    for ( const label of this.pdfTable.querySelectorAll('.label') ){
      if ( ! label.textContent ) continue;
      const fieldObject = this.getFieldByName(label.textContent);
      if ( ! fieldObject ) continue;
      if ( fieldObject.typ === 'checkbox' ) continue;
      const value = fieldObject.valueFromRules();
      if ( ! value ) continue;
      if ( value === '' ) continue;
      fieldObject.value = value;
    }
    if ( ! config.ignoreCheckboxes ) this.applyChecksFromRules();
  }

  applyChecksFromRules(){
    // ToDo 
  }

  get pdfTableMap(){
    if ( ! this._pdfTableMap ){
      this._pdfTableMap = new Map();
      for ( const label of this.pdfTable.querySelectorAll('.label') ){
        this._pdfTableMap.set( label.textContent, label.nextElementSibling.innerHTML );
      }
    } 
    return this._pdfTableMap;
  }

  // value from table overwrites value from PDF
  applyTableToPDF(){
    if ( config.log ) console.log('applyTableToPDF');

    // rule based filling of form fields
    for ( const label of this.pdfTable.querySelectorAll('.label') ){
      const fieldObject = this.getFieldByName(label.textContent);
      if ( ! fieldObject ) continue;
      if ( [ 'checkbox', 'combobox' ].includes( fieldObject.typ ) ){
        if ( config.ignoreCheckboxes ) continue;
        const inputElement = fieldObject.htmlRow.querySelector('input:checked');
        if ( ! inputElement ) continue;
      } 
      if ( ! config.ignoreDisabledFields ){
        for ( const htmlElement of fieldObject.htmlElements ){
          htmlElement.removeAttribute("disabled");
          htmlElement.removeAttribute("hidden");
        }
      }
      // get the HTML content of the next sibling of the label, including HTML tags and linebreaks
      fieldObject.setValueInPdf( label.nextElementSibling.innerHTML );
    }

    // check all checkboxes listed in config.autoCheck
    for ( const pdfObjectId of config.autoCheck ){
      const fElementId = "pdfjs_internal_id_" + pdfObjectId;
      const annotationElement = this.iFrame.contentDocument.getElementById(fElementId);
      if ( ! annotationElement ) continue;
      annotationElement.checked = true;
      this.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObjectId, {value: "On"}); 
      this.pdfViewerApplication._annotationStorageModified = true; 
    }

    // select option in select boxes
    const selectElements = this.iFrame.contentDocument.querySelectorAll('select');
    for ( const selectElement of selectElements ){
      selectElement.value = config.autoSelect[selectElement.name];
    }

    // auto fill XML related data
    for ( const xmlKey of Object.keys( config.autoFillXmlRelated ) ){
      const ruleValue = Rule.DB.valueFromAllRulesOf( '${' + xmlKey + '}$' );
      if ( ! ruleValue ) continue;
      let pdfEntry = config.autoFillXmlRelated[ xmlKey ][ ruleValue ];
      if ( ! pdfEntry ){
        pdfEntry = config.autoFillXmlRelated[ xmlKey ];
      }
      for ( const name of pdfEntry.name.split(',').map( n => n.trim()) ){
        const fieldObject = this.getFieldByName( name );
        if ( ! fieldObject ) continue;
        fieldObject.setValueInPdf( pdfEntry.value );
      }
    }

    // auto layout needed for vertical aligned text
    for ( const fieldName of Object.keys( config.autoLayout ) ){
      const fieldLayout = config.autoLayout[ fieldName ];
      const fieldObject = this.getFieldByName( fieldName );
      if ( ! fieldObject ) continue;
      for ( const htmlElement of fieldObject.htmlElements ){
        if ( fieldLayout.parent ){
          const parentElement = htmlElement.parentElement;
          parentElement.style[ fieldLayout.parent.name ] = fieldLayout.parent.value;
        }    
        if ( fieldLayout.attributes ) for ( const attribute of fieldLayout.attributes ){
          htmlElement.setAttribute( attribute.name, attribute.value );
        }
        if ( fieldLayout.css ) for ( const [key, value] of Object.entries( fieldLayout.css ) ){
          htmlElement.style[ key ] = value;
        }
      }
    }
  }
  

  get pdfIndex(){
    return this._pdfIndex; // constructed in build()
  }

  getFields(){
    return this.pdfIndex.values();
  }

  getFieldByName( fieldName ){
    return this.pdfIndex.get( fieldName );
  }
  
  /**
   * @summary create HTML space for displaying a single PDF file
   * @param {string} mode - viewing mode i.e. 'app' or 'profile'
   */
  static createHTMLSpace( mode ){
    const template = document.getElementById('single_result');
    const htmlSpace = document.createElement('div');
    if ( mode ) htmlSpace.classList.add( mode ); // turn visibility on in a view ("app" or other view modes)
    // const clone = template.content.cloneNode(true); // should work, but does not. Why?
    htmlSpace.innerHTML = template.innerHTML;
    const iFrame = htmlSpace.querySelector('iframe');
    // add clone to DOM
    document.querySelector('.all_results').appendChild(htmlSpace);
    // ToDo: await iframe loaded
    return htmlSpace;
  }

  encodeQR( container ){ // add page to PDF with QR code
    if ( config.log ) console.log( 'container.length: ', container.length );
    if ( config.log ) console.log( container );
    const page = this.pdfDocumentInstance.addPage();
    const fontSize = 30;
    const colorBlack = { type: 'RGB', red: 0, green: 0, blue: 0 };
    page.drawText('Daten als QR Code', {
      x: 100,
      y: page.getHeight() - 3 * fontSize,
      size: fontSize,
      color: colorBlack // rgb(0,0,0),
    });
    const qr = qrcode( config.typeNumber, config.errorCorrectionLevel );
    qr.addData( container );
    qr.make();
    const svgPath = qr.createSvgPath( config.cellSize );
    page.moveTo(3, page.getHeight() - 3 * fontSize)
    page.moveDown(25);
    const scale = 3.3 - 0.075 * config.typeNumber;
    page.drawSvgPath(svgPath, { color: colorBlack, borderOpacity: 0, scale: config.scaleSVG || scale });
  }

  async checkSum(){ // calculate hash code of content sum
    const encoder = new TextEncoder();
    const encoded = encoder.encode( this.contentSum() + config.SALT )
    const hashBuffer = await crypto.subtle.digest( config.crypto, encoded );
    const base64string = btoa(
      String.fromCharCode( ...new Uint8Array( hashBuffer ) )
    );
    return base64string;
  }

  contentSum(){ // concatenate contents of all fields
    return this._allPdfFields.map( f => f.getText && f.getText()?.trim() ? `${f.getName()}=${f.getText()}` : '' ).join();
  }

  addFillDefaultButton( span ){
    const button = document.createElement('button');
    button.innerText = "Alle Werte testweise mit Feldbezeichnern füllen";
    span.parentElement.appendChild(button);
    button.addEventListener('click', event => {
      for ( const label of this.pdfTable.querySelectorAll('td.label') ){
        const labelContent = label.textContent;
        const inputElement = label.nextElementSibling;
        if ( inputElement.hasAttribute('contenteditable')){ // no checkbox
          inputElement.innerText = labelContent;
        } else {
          if ( ! config.ignoreCheckboxes && inputElement.firstElementChild?.firstElementChild ) inputElement.firstElementChild.firstElementChild.checked = true;
        }
      }
    });
    button.style.display = 'none';
    if ( ! config.debug ) button.classList.add('hide');
    return button;
  }

  addUpDownButtonListeners(){
    const result = this.fragment.querySelector('div.result');
    const buttonsDiv = this.fragment.querySelector('.buttons');
    const resultIndex = {};
    for ( const label of result.querySelectorAll('.label') ){
      resultIndex[ label.innerText ] = label.nextElementSibling;
    }
    const downButton = buttonsDiv.querySelector('.down');
    downButton.addEventListener('click', event => {
      this.applyTableToPDF();
    });
    const upButton = buttonsDiv.querySelector('.up');
    upButton.addEventListener('click', event => {
      this.applyPdfToTable();
    });
    return buttonsDiv;
  }

  /**
   * save all PDFs in a ZIP-File and download it
   * @param {Event} event - click button event 
   */
  static async saveAllListener( event ){
    const zip = new JSZip();
    for ( const pdfDoc of PdfDoc.all ){
      const data = await pdfDoc.pdfDocumentInstance.saveDocument();
      const blob = new Blob([data], {
        type: "application/pdf"
      });
      zip.file( `${pdfDoc.person.name}-${pdfDoc.fileName}.pdf`, blob, {binary:true} );
    }
    zip.generateAsync({type:"blob"})
    .then(function(content) {
      fileSave( content, {
        // Suggested file name to use, defaults to `''`.
        // new Date().toISOString().slice(0,16)
        fileName: new Date().toLocaleString("de-DE", {timeZone: "Europe/Berlin"}).split(', ').join('_') + "-all-pdfs.zip",
        // Suggested file extensions (with leading '.'), defaults to `''`.
        extensions: ['.zip'],
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: 'save-pdf',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
      });
    });
  }

  saveListener( event ){
    // this.pdfViewerApplication.eventBus.dispatch('save', { source: this.pdfViewerApplication });
    this.pdfViewerApplication.downloadOrSave({ openInExternalApp: true }); // see Mozilla app.js
  }

  static printAllListener( event ){
    for ( const pdfDoc of PdfDoc.all ){
      if ( ! confirm( pdfDoc.fileName + ' drucken?') ) break;
      pdfDoc.printListener( event );
    }
  }

  printListener( event ){
    this.pdfViewerApplication.triggerPrinting(); // see Mozilla app.js
  }

  static async allAreReady(){
    PdfDoc.all.every( pdfDoc => pdfDoc.isFullyRendered );
    return Promise.all( PdfDoc.all.map( pdfDoc => pdfDoc.isFullyRenderedPromiseOrTimeout ) );
  }

  async isReady(){
    if ( this.isFullyRendered ) return true;
    return this.isFullyRenderedPromiseOrTimeout;
  }

  async pageReady( pageNumber ){
    // if ( ! this.pdfDocumentInstance ) return false;
    // if ( this.iFrame.contentWindow.PDFViewerApplication.pdfViewer.pageViewsReady ) return true;
    // await this.textlayerrendered( pageNumber );
    return this.annotationeditorlayerrendered( pageNumber );
  }

  async textlayerrendered( pageNumber ){
    return new Promise( resolve => { 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on('textlayerrendered', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  async pagerendered( pageNumber ){
    return new Promise( resolve => { 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on('pagerendered', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  async annotationeditorlayerrendered( pageNumber ){
    return Promise.race( [ new Promise( resolve => { 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on('annotationeditorlayerrendered', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    }),
      new Promise( resolve => setTimeout( resolve, 100 ) )
    ] )
  }

  async updateviewarea( pageNumber){
    return new Promise( resolve => { 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on('updateviewarea', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  async pagechanging( pageNumber){
    return new Promise( resolve => { 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on('pagechanging', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  scrollPageIntoView( params ){
    this.iFrame.contentWindow.PDFViewerApplication.pdfViewer.scrollPageIntoView( params );
  }

  pagesCount(){
    return this.iFrame.contentWindow.PDFViewerApplication?.pdfViewer?.pagesCount;
  }

}





globalThis.PdfDoc = PdfDoc;
globalThis.PdfDoc.all = []; // new Map();  // adds new PDFs for every open event, maps pdfDocs to HTML fragments, in which it is displayed

