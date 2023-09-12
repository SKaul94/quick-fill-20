/**
 * @module Doc.js
 * @summary Wrapper class for a PDF document
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {replaceParams, addCollapseIcons} from './global_functions.js';
import {Field} from './Field.js';
import {Rule} from './Rule.js';
import {qrcode} from "./qrcode.js";

export class PdfDoc  {

  constructor( file, htmlSpace ) {
    this.file = file;
    this.fileName = file.name;
    if (  htmlSpace ){ 
      this.htmlSpace = htmlSpace; // HTML space already exists
      this.fragment = this.htmlSpace; // alias for compatibility 
      this.iFrame = this.htmlSpace.querySelector('iframe');
      this.htmlSpace.querySelector('.filename').textContent = file.name;
    }
    this.allRulesApplied = false;
    this.pagesRendered = new Set();
    PdfDoc.all.push( this );
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
    this._allRulesApplied = null;
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

    // create array of promises and resolvers for each page being fully rendered
    let renderPromise, resolveRenderPromise;

    // Set of pages that have already been rendered 
    this.pagesRendered = new Set(); 

    // The PDF pages are rendered on demand, not upfront.
    // Therefore, form data have to be filled in after the page has been rendered.
    // This happends with the annotationeditorlayerrendered event.
    this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "annotationeditorlayerrendered", async event => {
      // add current rendered page to the set
      this.pagesRendered.add( parseInt( event.pageNumber ) );
      if ( config.log ) console.log('annotationeditorlayerrendered');
      if ( ! renderPromise ){  
        // create array of promises at first event only
        [renderPromise, resolveRenderPromise] = this.pageRenderThreads();
      }
      // resolve promise for current page
      // Array index starts with 0, page numbers start with 1
      resolveRenderPromise[ parseInt( event.pageNumber ) - 1 ](); 
      delete renderPromise[ parseInt( event.pageNumber ) - 1 ];
    }, { once: false } );

    // sandboxcreated event is the last event after opening a PDF
    this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "sandboxcreated", async event => {
      if ( config.log ) console.log('=== sandboxcreated ===');

      // apply rules to table after all pages have been rendered
      this.applyRulesToTable(); 

      // scroll to all pages, that have not been rendered yet, to render them
      const pdfViewer = this.iFrame.contentWindow.PDFViewerApplication.pdfViewer;
      if ( config.log ) console.log( 'getJSActions', 'pdfDocumentInstance', await this.pdfDocumentInstance.getJSActions() );
      for ( let pageNumber = pdfViewer.pagesCount; pageNumber >= 1; pageNumber--){
        this.pageNum = pageNumber;
        if ( ! this.pagesRendered.has( pageNumber ) ){
          if ( config.log ) console.log( "scrollPageIntoView", pageNumber );
          pdfViewer.scrollPageIntoView({ pageNumber });
          // await annotationeditorlayerrendered event
          if ( renderPromise && renderPromise[ pageNumber - 1 ] ){
            await renderPromise[ pageNumber - 1 ]; // Array index starts with 0, page numbers start with 1
          } else {
            if ( config.log ) console.log( "######### Timeout fired #########" );
            await new Promise(resolve => setTimeout(resolve, 33)); // Timeout if needed
          } 
        }
        if ( config.log ) console.log( 'getJSActions', pageNumber, await (await this.pdfDocumentInstance.getPage(pageNumber)).getJSActions() );
      }
      if ( config.log ) console.log( "pageViewsReady", this.iFrame.contentWindow.PDFViewerApplication.pdfViewer.pageViewsReady );

      // start viewer with first page
      pdfViewer.scrollPageIntoView({ pageNumber: 1 });
    }, { once: true } );  // sandbox is created once only

    this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "textlayerrendered", async event => {
      await new Promise(resolve => 
        this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "annotationlayerrendered", resolve )); 
      await new Promise(resolve => 
        this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "annotationeditorlayerrendered", resolve )); 
      this.applyTableToPDF();
      // show statistics
      document.getElementById('statistics').classList.remove('hide');
    }, { once: false } );

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

    /**
     * additional listener for image button called "stampEditor" in the pdf.js toolbar
     */
    this.iFrame.contentDocument.getElementById('editorStamp').addEventListener('click', async event => {
      await new Promise(resolve => 
        this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "switchannotationeditorparams", resolve )); 
      await new Promise(resolve => 
          this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "annotationeditorstateschanged", resolve ));
      const insertedImage = this.iFrame.contentDocument.querySelector('.stampEditor') || this.iFrame.contentDocument.getElementById('pdfjs_internal_editor_0');
      // prevent container from overlaying the inserted image   
      if ( insertedImage ){
        insertedImage.style['z-index']='33'; // the underlying container has z-index 22  
      }
    });
    
  }

  /**
   * @summary create a separate thread for each page to render, 
   *        because you have to wait for rendering to be completed before accessing form fields
   * @link https://stackoverflow.com/questions/35718645/resolving-a-promise-with-eventlistener
   */
  pageRenderThreads () {
    const pagesCount = this.iFrame.contentWindow.PDFViewerApplication.pdfViewer.pagesCount;
    let resolve = [], reject = [], promise = [];  // Array index starts with 0, page numbers start with 1
    for ( let i = 0; i < pagesCount; i++ ){
      promise.push( new Promise((res, rej) => {
        resolve[i] = res;
        reject[i] = rej;
      }));
    }
    return [promise, resolve, reject];
  }

  static thread(){
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return [promise, resolve, reject]
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
  }

  /**
   * @summary render PDF document via ArrayBuffer in iFrame inside clone of template
   */
  async renderArrayBuffer( binaryData ){
    let webviewerloaded = false;
    
    // try to catch webviewerloaded event fired by PDF.js viewer
    this.iFrame.contentWindow.addEventListener('webviewerloaded', async event => {
      webviewerloaded = true;
      // PDFViewerApplication is now available
      await this.iFrame.contentWindow.PDFViewerApplication.initializedPromise;
      await this.iFrame.contentWindow.PDFViewerApplication.open( { data } );
      await this.build();
      this.installListeners(); 
    });

    // convert ArrayBuffer to Uint8Array
    const data = binaryData ? binaryData : new Uint8Array( await this.file.arrayBuffer() );

    // give webviewerloaded event a chance to fire
    await new Promise(resolve => setTimeout(resolve, 150));  
    // ToDo find later event than webviewerloaded, e.g.
    // await new Promise(resolve => this.iFrame.contentWindow.PDFViewerApplication.eventBus.on( "textlayerrendered", resolve )); 


    // if webviewerloaded event did not fire, wait for PDFViewerApplication to be available
    if ( ! webviewerloaded && ! this.iFrame.contentWindow.PDFViewerApplication ){
      if ( config.log ) console.log('>>> Timeout for PDFViewerApplication <<<');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Timeout needed
    } 

    // if webviewerloaded event did not fire, opening the PDF has still to be done
    if ( ! webviewerloaded ){
      await this.iFrame.contentWindow.PDFViewerApplication.initializedPromise; // ToDo test without
      await this.iFrame.contentWindow.PDFViewerApplication.open( { data } );
      await this.build();
      this.installListeners();
    } 
  }

  static invalidateAllRuleApplications(){
    if ( config.log ) console.log('invalidateAllRuleApplications');
    for ( const pdfDoc of PdfDoc.all){
      pdfDoc.allRulesApplied = false;
      // pdfDoc._allFields.forEach( field => { field.reset() } );
    }
  }

  get pdfTable(){
    if ( ! this._pdfTable ){
      this._pdfTable = this.fragment.querySelector('table.result');
    }
    return this._pdfTable;
  }

  static updateAll(){
    PdfDoc.invalidateAllRuleApplications();
    PdfDoc.applyAllRulesToTables();
    PdfDoc.applyAllTablesToPdf();
  }

  static updateAllFieldsArea(){
    const fields_area = document.getElementById('fields_area');
    fields_area.innerHTML = PdfDoc.all.map( pdfDoc => Object.values( pdfDoc._pdfFieldsDict ).filter( field => field.typ ).sort((a, b) => a.compare(b)).map(field => field.toSpan())).join(', ');
      //Array.from( PdfDoc.all ).map( pdfDoc => Array.from( pdfDoc._allFields ) ).flat().sort((a, b) => a.compare(b)).map(field => field.toSpan()).join(', ');
  }

  static applyAllRulesToTables(){
    for ( const pdfDoc of PdfDoc.all){
      // pdfDoc._allFields.forEach( field => { field.reset() } );
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
        case "checkbox":
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
    if ( this.allRulesApplied ) return;
    if ( config.log ) console.log('applyRulesToTable');
    this.allRulesApplied = true;
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
      if ( fieldObject.htmlElements.find( el => el.hasAttribute('disabled') ) ){
        if ( ! config.ignoreDisabledFields ){
          for ( const htmlElement of fieldObject.htmlElements ){
            if ( config.log ) console.log(`"disabled" removed from ${htmlElement.tagName} ${htmlElement.name}`);
            htmlElement.removeAttribute("disabled");
            htmlElement.removeAttribute("hidden");
          }
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
      event.stopImmediatePropagation();
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
      event.stopImmediatePropagation();
      this.applyTableToPDF();
    });
    const upButton = buttonsDiv.querySelector('.up');
    upButton.addEventListener('click', event => {
      event.stopImmediatePropagation();
      this.applyPdfToTable();
    });
    return buttonsDiv;
  }

  static saveAllListener( event ){
    event.stopImmediatePropagation();
    for ( const pdfDoc of PdfDoc.all ){
      pdfDoc.saveListener( event );
    }
  }

  saveListener( event ){
    // this.pdfViewerApplication.eventBus.dispatch('save', { source: this.pdfViewerApplication });
    this.pdfViewerApplication.downloadOrSave({ openInExternalApp: true }); // see Mozilla app.js
  }

  async ready( pageNumber ){
    if ( ! this.pdfDocumentInstance ) return false;
    await this.pdfDocumentInstance.initializedPromise;
    await this.pagerendered( pageNumber || this.pagesCount() );
    await this.annotationeditorlayerrendered( pageNumber || this.pagesCount() );
    return new Promise( resolve => {
      if ( this.iFrame.contentWindow.PDFViewerApplication.pdfViewer.pageViewsReady ) resolve();
    });
  }

  async pagerendered( pageNum ){
    return new Promise( resolve => { 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on('pagerendered', () => {
        if ( this.pageNum === pageNum ) resolve();
      });
    });
  }

  async annotationeditorlayerrendered( pageNum ){
    return new Promise( resolve => { 
      this.iFrame.contentWindow.PDFViewerApplication.eventBus.on('annotationeditorlayerrendered', () => {
        if ( this.pageNum === pageNum ) resolve();
      });
    });
  }

  pagesCount(){
    return this.iFrame.contentWindow.PDFViewerApplication?.pdfViewer?.pagesCount;
  }

}





globalThis.PdfDoc = PdfDoc;
globalThis.PdfDoc.all = []; // new Map();  // adds new PDFs for every open event, maps pdfDocs to HTML fragments, in which it is displayed

