/**
 * @module Doc.js
 * @summary Wrapper class for a PDF document
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023, 2024 All Rights reserved by author
 */

import {config} from './config.js';
import {addCollapseIcons, getFromPasteBuffer, blobToBase64} from './global_functions.js';
import {Field} from './Field.js';
import {Rule} from './Rule.js';
import {qrcode} from "./qrcode.js";
import {fileSave} from './FileOpener.js';
import {JSZip} from './jszip.js';

export class PdfDoc extends EventTarget  {

  constructor( file, htmlSpace, person ) {
    super();
    this.file = file;
    this.fileName = file.name;
    this.htmlSpace = htmlSpace ? htmlSpace : this.constructor.createHTMLSpace();     
    this.fragment = this.htmlSpace; // alias for compatibility 
    this.iFrame = this.htmlSpace.querySelector('iframe');
    console.assert( this.iFrame ); 
    this._docStates = [];

    // mix of sync and async code
    // sync call of this.startApp() at the end of the constructor, see below
    const readyStateListener = async event => {
      this.docState = `${event.target.constructor.name}.${event.type}`;
      this.docState = this.iFrame.contentDocument.readyState;
      if ( this.iFrame.contentDocument.readyState === 'complete' ){
        this.iFrame.contentDocument.removeEventListener('DOMContentLoaded', readyStateListener );
        this.iFrame.removeEventListener('load', readyStateListener );
        this.iFrame.contentDocument.removeEventListener('readystatechange', readyStateListener );
        this.iFrame.contentWindow.removeEventListener('load', readyStateListener );
        if ( ! this.docState.includes('loaded') ){
          this.startApp();
        }
      }
    };
    // try to get the readyState === 'complete' event
    // if the listener has been installed late, no success
    // Therefore try additional events
    this.iFrame.contentDocument.addEventListener('DOMContentLoaded', readyStateListener ); 
    this.iFrame.addEventListener('load', readyStateListener );
    this.iFrame.contentDocument.addEventListener('readystatechange', readyStateListener );
    this.iFrame.contentWindow.addEventListener('load', readyStateListener );

    this.htmlSpace.querySelector('.filename').textContent = file.name;
    
    if ( person ){
      this.person = person;
      this.person.pdfDoc = this; // ToDo multiple pdfDocs per person ?
    }

    PdfDoc.all.push( this );
    document.querySelector('.save_all')?.classList.remove('hide');
    document.querySelector('.print_all')?.classList.remove('hide');

    // if the PDF viewer is embedded in XML analyse
    this.invokeDiv = this.htmlSpace.parentElement.parentElement.parentElement;
    // add delete button
    const deleteButton = this.fragment.querySelector('.delete');
    deleteButton?.addEventListener('click', event => {
      this.delete();
    });
    this.addUpDownButtonListeners();

    this.allPagesRenderedPromises = [];
    this.isFullyRendered = false;

    // mix of sync and async code
    this.isFullyRenderedPromise = this.isFullyRendered || new Promise( resolve => {
      this.addEventListener('ready', async event => { 
        console.assert( this.iFrame.contentDocument.readyState === 'complete' )
        console.assert( this.pdfViewerApplication );
        if ( this.person ) console.log( 'Person ready: ', this.person.name, Rule.DB.activePersonRules() );
        
        // this.pdfDocumentInstance is set now
        this.pdfDocumentInstance = this.pdfViewerApplication.pdfDocument;
        console.assert( this.pdfDocumentInstance );
        this.pdfDocumentInstance.annotationStorage.onSetModified();
        this.isFullyRendered = true;
    
        // Print goes to a canvas, which is converted to images in PDFPrintService::useRenderedPage().
        // Store these images into printImages object, if the "summaryButton" option is on.
        if ( config.summaryButton ) this.pdfDocumentInstance.printImages = [];

        // ToDo: collect printImages via page.render(), see below:
        
        // const pdfViewer = this.pdfViewerApplication.pdfViewer;
        // for ( let pageNumber = 1; pageNumber <= pdfViewer.pagesCount; pageNumber++){
        //   pdfViewer.scrollPageIntoView({ pageNumber });
        //   const page = await this.pdfDocumentInstance.getPage( pageNumber );
        //   const width = page._pageInfo.view[2];
        //   const height = page._pageInfo.view[3];
        //   const destCanvas = new OffscreenCanvas( width, height );
        //   const canvasContext = destCanvas.getContext('2d');
        //   const viewport = page.getViewport();
        //   const intent = 'print';
        //   page.render( { canvasContext, viewport, intent } );
        //   const blob = await canvasContext.canvas.convertToBlob( { type: 'image/jpeg', quality: 0.7 } );
        //   const url = URL.createObjectURL(blob);
        //   const img = new Image();
        //   img.onload = event => URL.revokeObjectURL( url );
        //   img.src = url;
        //   this.pdfDocumentInstance.printImages.push( img );
        // }
        
        // add title
        this.metaData = await this.pdfDocumentInstance.getMetadata();
        console.assert( this.metaData );  // or wait for metadataloaded event ?
        this.title = this.metaData.info.Title || config.missingTitle;
        const titleSpan = this.fragment.querySelector('.title');
        titleSpan.innerHTML = this.title;

        // precompute indices into PDF fields and PDF objects for faster access
        // await this.pdfDocumentInstance.readyPromise ???
        this._pdfFieldObjects = await this.pdfDocumentInstance.getFieldObjects();
        console.assert( this._pdfFieldObjects );  // or wait for annotationeditorlayerrendered event ?
        this._allFieldNames = Object.keys( this._pdfFieldObjects || {} );
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

        // add buttons for collapsing and expanding
        addCollapseIcons(titleSpan, this.fragment.querySelector('div.result'), this.addFillDefaultButton(titleSpan) );
        
        this.showAllFieldsAndUpdateForm();

        this.docState = 'ready';
        
        resolve( true );
      });
    });
    
    this.docState = 'constructed';

    // sync call of startApp(), if readyState === 'complete' already.
    // otherwise the readyStateListener fires later, see above
    if ( this.iFrame.contentDocument.readyState === 'complete' ){
      if ( this.iFrame?.contentWindow?.PDFViewerApplication ) this.startApp(); 
    }
  }

  get name(){
    return this.fileName;
  }

  startApp(){
    console.assert( this.constructor.name === 'PdfDoc' );
    this.pdfViewerApplication = this.iFrame.contentWindow.PDFViewerApplication;
    console.assert( this.pdfViewerApplication );
    this.docState = 'loaded';
    this.installListeners();
  }

  get docState(){
    return this._docStates;
  }

  set docState( newState ){
    this._docStates.push( newState );
    this.dispatchEvent( new Event('docState') );
  }

  async waitForState( state ){
    // mix of sync and async code
    return this.docState.includes( state ) || new Promise( resolve => this.addEventListener('docState', event => {
      if ( this.docState.includes( state ) ) resolve();
    }));
  }

  get loadedPromise(){
    return this.waitForState( 'loaded' );
  }

  /**
   * @summary state information of this PdfDoc construction, rendering and printing
   * @returns {Object} state information of this PdfDoc
   */
  state(){
    return {
      docState: this.docState,
      readyState: this.iFrame.contentDocument.readyState,
      isFullyRendered: this.isFullyRendered,
      isFullyRenderedPromise: this.isFullyRenderedPromise,
      allPagesRenderedPromises: this.allPagesRenderedPromises
    };
  }

  /**
   * @summary state information of all PdfDoc instances
   * @returns {Array<Object>} list of the states of all PdfDoc instances
   * @example window.parent.PdfDoc.allStates() (use on console)
   */
  static allStates(){
    return PdfDoc.all.map( pdfDoc => pdfDoc.state() );
  }


  /**
   * @summary install listeners for PDF viewer events and scroll to all pages to render them,
   *         because the PDF pages are rendered on demand, not upfront.
   */
  async installListeners(){
    if ( this._allListenersInstalled ) return;

    // await this.pdfViewerApplication.initializedPromise; ??????

    if ( ! this.pdfViewerApplication ) await this.waitForState('constructed');

    // documentloaded
    this.pdfViewerApplication.eventBus.on('documentloaded', event => {
      console.assert( this.pdfViewerApplication.pagesCount > 0 );
      for ( let pageNumber = 1; pageNumber <= this.pdfViewerApplication.pagesCount; pageNumber++){
        const readyPromise = this.pagerendered( pageNumber ); 
        this.allPagesRenderedPromises.push( readyPromise );
      }
      this.docState = 'documentloaded';
    });

    // The sandboxcreated event is the last event after opening a PDF.
    // Fill form fields after all pages have been rendered:
    this.pdfViewerApplication.eventBus.on( 'sandboxcreated', async event => {
      this.docState = 'sandboxcreated';
      console.log('=== sandboxcreated ===');
      
      // scroll to all pages, that have not been rendered yet, to force rendering
      const pdfViewer = this.pdfViewerApplication.pdfViewer;
      for ( let pageNumber = this.pdfViewerApplication.pagesCount; pageNumber >= 1; pageNumber--){
        try {
          pdfViewer.scrollPageIntoView({ pageNumber });
          await this.annotationeditorlayerrendered( pageNumber );
        } catch( error ){
          console.error( `Error Page ${pageNumber}: ${error.name}`, error );
        }
      }

      // Promise.all is waiting forever because of rare AbortExceptions while rendering
      await Promise.race( this.allPagesRenderedPromises );
      this.dispatchEvent( new Event('ready') ); // for fulfilling the this.isFullyRenderedPromise

      await this.isReady();
      if ( this.person ) await this.person.activate();

      // apply rules to table after all pages have been rendered
      this.applyRulesToTable();   

      // start viewer with first page
      pdfViewer.scrollPageIntoView({ pageNumber: 1 });

    }, { once: true } );  // sandbox is created once only

    // After build, Editing PDF directly induces changes to the HTML table dynamically
    this.iFrame.contentWindow.addEventListener('change',  event => { 
      console.assert( this.isFullyRendered );
      
      if ( ! ['scaleSelect','pageNumber'].includes( event.target.id ) ) {
        const pdfObjectId = event.target.id.split('_').pop();
        const pdfObject = this._pdfObjectsDict[ pdfObjectId ];
        const field = this._pdfFieldsDict[ pdfObject.name ];
        field.value = event.target.value;
        field.markAsDirty();

      
        switch ( field.typ ){
          case 'text':
            field.htmlRow.querySelector('.input').textContent = event.target.value;
            break;
          case 'checkbox': case 'radiobutton':
            const inputElement = Array.from( field.htmlRow.querySelectorAll('label') )
              .find( el => el.textContent === pdfObject.exportValues )
              .firstElementChild;
            inputElement.checked = event.target.checked;
            break;
          case 'combobox': case 'listbox': // same as default
          default:
            field.htmlRow.querySelector('.input').value = event.target.value;
        }
      }
    });

    // prevent configured SELECT elements to delete other PDF form field values
    this.pdfViewerApplication.eventBus.on( "textlayerrendered", event => {
      for ( const elem of this.iFrame.contentDocument.querySelectorAll('#viewer select') ){
        // console.log( `SELECT id=${elem.id}, dataset=${elem.dataset.elementId}`, elem );
        if ( config.disableElements?.includes( elem.getAttribute('name') ) ){
          elem.disabled = true;
          // elem.setAttribute = _=> {debugger};
        } 
      }
    });

    this.pdfViewerApplication.eventBus.on( "pagechanging", event => {
      if ( this.isFullyRendered ) this.applyTableToPDF();
    });

    // handle changes in fields in PDF.js viewer propagating values to HTML table
    this.pdfViewerApplication.eventBus.on( "dispatcheventinsandbox", event => {
      this.docState = 'dispatcheventinsandbox';
      console.assert( this.isFullyRendered );
      const fieldName = event.source.data.fieldName;
      const field = this.getFieldByName( fieldName );
      console.assert( field );
      const oldValue = field.value;
      const newValue = event.detail.value;
      if ( newValue ){
        field.value = newValue;
      } else if ( event.source.constructor.name === 'PushButtonWidgetAnnotationElement' ){ 
        // simulate click on "add image" button
        console.log(`inserting image into field ${fieldName}`);
        const toolbar = this.pdfViewerApplication.appConfig.toolbar;
        toolbar.editorStampButton.click();
        toolbar.editorStampParamsToolbar.click();
      } 
      field.markAsDirty();
      // this.showAllFieldsAndUpdateForm();
    } );
    
    this._allListenersInstalled = true;
    this.docState = 'listeners_installed';
  }

  get allFields(){
    console.assert( this.isFullyRendered ); 
    console.assert( this._pdfFieldsDict );
    return Object.values( this._pdfFieldsDict );
  }

  showAllFieldsAndUpdateForm(){
    // show all form fields, even hidden and disabled fields 
    for ( const elem of this.iFrame.contentDocument.querySelectorAll('#viewer [hidden]') ){
      elem.removeAttribute('hidden');
    }
    for ( const elem of this.iFrame.contentDocument.querySelectorAll('#viewer [disabled]') ){
      if ( ! config.disableElements?.includes( elem.name ) ) elem.removeAttribute('disabled');
    }

    // special cases of layout
    this.autoLayout();

    // fill form fields
    this.applyTableToPDF();
  }

  /**
   * @summary final cleanup to close PDF document and remove HTML DIV element
   */
  delete(){
    // if PDF is embedded in menu, delete menu items of PDF and of person as well
    const invokeDiv = this.invokeDiv;
    const selectedPerson = this.htmlSpace.parentElement.parentElement;
    const submenu = selectedPerson.querySelector('.submenu');
    submenu.querySelector('li.active')?.remove();
    if ( submenu && submenu.childElementCount === 0 ){ // last PDF deleted
      // also delete person menu item
      invokeDiv.querySelector('.menu.all_persons > li.active')?.remove();
    }

    // free space
    this.htmlSpace.remove();
    for ( const img of this.pdfDocumentInstance.printImages ){
      URL.revokeObjectURL( img.src ); // frees memory
    }
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
    this._pdfTable = null;
    this._allRules = null;
    this.url = null;
  }

  remove(){
    this.delete();
  }

  /**
   * @summary render PDF document via URL in iFrame inside clone of template
   */
  async renderURL(){
    const url = URL.createObjectURL(this.file);
    this.url = url;
    await this.loadedPromise;
    console.assert( this.pdfViewerApplication );
    await this.pdfViewerApplication.open( { url } );
    await this.isReady();
  }

  /**
   * @summary render PDF document via ArrayBuffer in iFrame inside clone of template
   */
  async renderArrayBuffer( binaryData ){
    // convert ArrayBuffer to Uint8Array
    const data = binaryData ? binaryData : new Uint8Array( await this.file.arrayBuffer() );
    // wait for iFrame loading completion
    // if ( ! this.pdfViewerApplication ) await new Promise(resolve => this.iFrame.addEventListener( "load", resolve ));
    // wait for PDFViewerApplication initialization
    
    await this.loadedPromise;
    console.assert( this.pdfViewerApplication );
    // await this.pdfViewerApplication.initializedPromise; 
    // open PDF document
    try {
      await this.pdfViewerApplication.open( { data } );
    } catch ( error ) {
      console.error( `${error.name}`, error );
      // wait and try again
      await new Promise( resolve => setTimeout( resolve, 100 ) );
      await this.pdfViewerApplication.open( { data } );
    }
    
    // wait for rendering
    // await new Promise(resolve => this.pdfViewerApplication.eventBus.on( "pagesloaded", resolve ));

    await this.isReady();
  }

  get pdfTable(){
    if ( ! this._pdfTable ){
      this._pdfTable = this.fragment?.querySelector('table.result');
    }
    return this._pdfTable;
  }

  update(){
    this.applyRulesToTable();
    this.applyTableToPDF();
  }

  static updateAll(){
    PdfDoc.applyAllRulesToTables();
    PdfDoc.applyAllTablesToPdf();
  }

  static updateAllFieldsArea(){
    const fields_area = document.getElementById('fields_area');
    const fields_count = document.getElementById('fields_count');
    if ( PdfDoc.allAreReady() ){
      const allFields = new Set( PdfDoc.all.map( pdfDoc => {
        // console.assert( pdfDoc._pdfFieldsDict );
        return Object.values( pdfDoc._pdfFieldsDict || {} )
      }).flat().filter( field => field.typ ) );
      const sortedFields = Array.from( allFields ).sort((a, b) => a.compare(b)).map(field => field.toSpan());
      fields_count.innerText = sortedFields.length;
      fields_area.innerHTML = sortedFields.join(', ');
    }
  }

  static applyAllRulesToTables(){
    for ( const pdfDoc of PdfDoc.all){
      // pdfDoc.allFields.forEach( field => { field.reset() } );
      if ( pdfDoc.person ) pdfDoc.person.activate();
      pdfDoc.applyRulesToTable();
    }
    // PdfDoc.updateAllFieldsArea();
    // Rule.DB.printReasonList();
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
    console.assert( this.isFullyRendered );
    if ( config.log ) console.log('applyPdfToTable', this.fileName, this.person.name );
    // this.allFields.forEach( field => { field.reset() } );
    for ( const fieldObject of this.allFields ){
      const value = fieldObject.valueFromPDF();
      if ( ! value ) continue;
      if ( value === '' ) continue;
      if ( value === 'Off' ) continue;
      if ( fieldObject.typ === null ) continue;
      if ( ! fieldObject.htmlRow ) continue;
      switch ( fieldObject.typ ){
        case "text":
          fieldObject.htmlRow.querySelector('[contenteditable]').innerHTML = value || '';
          break;
        case "checkbox": case "radiobutton":
          fieldObject.htmlRow.querySelector('input').checked = value === 'On';
          break;
        case 'combobox': case 'listbox':
          fieldObject.htmlRow.querySelector('.input').value = value;
          break;
        case 'button':
          break; // ignore
        default:
          console.warn(`cannot get value from field ${fieldObject.fieldName} in ${fieldObject.fileName}.`);
      }
    }
  }

  applyHeaderRulesToTable(){  // fill table with values calculated by header rules
    if ( config.log ) console.log('applyHeaderRulesToTable', this.fileName, this.person?.name );
    this.docState = 'applyHeaderRulesToTable';

    if ( this.person ){
      for ( const headerRule of Object.values( this.person?.headerRules || {} )){
        console.assert( headerRule.rule_type === 'equal' );
        const variables = headerRule.rule.split(',').map(r=>r.trim());
        for ( const variable of variables ){
          const allDependentRules = Rule.DB.allDependentRules( variable );
          variables.push( ...allDependentRules.map(r =>r.rule.split(',').map(r=>r.trim())).flat() );
        }
        for ( const label of this.pdfTable.querySelectorAll('.label') ){
          if ( ! label.textContent ) continue;
          if ( variables.includes(label.textContent)){
            const fieldObject = this.getFieldByName(label.textContent);
            if ( ! fieldObject ) continue;
            if ( this.person ) this.person.activate();
            const value = Rule.DB.valueFrom(label.textContent);
            if ( value ){
              fieldObject.value = value;
              for ( const htmlElement of fieldObject.htmlElements ){
                htmlElement.addEventListener( 'click', event => {
                  fieldObject.setValueInPdf( value );
                  htmlElement.value = value;
                });
              }
              fieldObject.setValueInPdf( value );
            } 
          }
        }
        this.pdfViewerApplication.forceRendering();
      }
    }

    Rule.DB.printReasonList();
    PdfDoc.updateAllFieldsArea();
  }

  applyRulesToTable(){  // fill table with values calculated by rules
    if ( config.log ) console.log('applyRulesToTable', this.fileName, this.person?.name );
    this.docState = 'applyRulesToTable';

    for ( const label of this.pdfTable.querySelectorAll('.label') ){
      if ( ! label.textContent ) continue;
      const field = this.getFieldByName(label.textContent);
      if ( ! field ) continue;
      if ( this.person ) this.person.activate();
      const dirtyValue = field._value;
      const value = config.dirtyStrategy && dirtyValue ? dirtyValue : field.valueFromRules();
      if ( ! value ) continue;
      field.value = value;
    }

    Rule.DB.printReasonList();
    PdfDoc.updateAllFieldsArea();
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
    // console.assert( this.isFullyRendered );
    if ( config.log ) console.log('applyTableToPDF', this.fileName, this.person.name );
    this.docState = 'applyTableToPDF';

    // rule based filling of form fields
    for ( const label of this.pdfTable.querySelectorAll('.label') ){
      const fieldObject = this.getFieldByName(label.textContent);
      if ( ! fieldObject ) continue;
      // if ( [ 'checkbox', 'combobox' ].includes( fieldObject.typ ) ){
      //   if ( config.ignoreCheckboxes ) continue;
      //   const inputElement = fieldObject.htmlRow.querySelector('input:checked');
      //   if ( ! inputElement ) continue;
      // } 
      const disabledElements = [];
      if ( ! config.ignoreDisabledFields ){
        for ( const htmlElement of fieldObject.htmlElements ){
          if ( htmlElement.hasAttribute('disabled')  || htmlElement.hasAttribute('hidden') ){
            disabledElements.push( htmlElement );
            htmlElement.removeAttribute("disabled");
            htmlElement.removeAttribute("hidden");
          } 
        }
      }
      // get the HTML content of the next sibling of the label, including HTML tags and linebreaks
      fieldObject.setValueInPdf( label.nextElementSibling.innerHTML, label.nextElementSibling );
      for ( const htmlElement of disabledElements ){
        // htmlElement.disabled = true;
      }
      this.pdfViewerApplication._annotationStorageModified = true;
      this.pdfViewerApplication.forceRendering();
    }

    // check all checkboxes listed in config.autoCheck
    for ( const pdfObjectId of config.autoCheck ){
      const fElementId = "pdfjs_internal_id_" + pdfObjectId;
      const annotationElement = this.iFrame.contentDocument.getElementById(fElementId);
      if ( ! annotationElement ) continue;
      const fieldObject = this.getFieldByPdfId( annotationElement.dataset.elementId );
      let value = 'On';
      if ( fieldObject ){
        value = fieldObject.exportValues[0] || 'On'; // assuming that the first export value means 'On';
        fieldObject.setValueInTable( value );
      }
      annotationElement.checked = true;
      this.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObjectId, {value}); // value: 'On'
    }

    // select option in select boxes
    const selectElements = this.iFrame.contentDocument.querySelectorAll('select');
    for ( const selectElement of selectElements ){
      const value = config.autoSelect[selectElement.name];
      if ( value ){
        selectElement.value = value;
      }
    }

    // auto fill XML related data
    for ( const xmlKey of Object.keys( config.autoFillXmlRelated ) ){
      const ruleValue = Rule.DB.valueFromAllRulesOf( '${' + xmlKey + '}$' );
      if ( ! ruleValue ) continue;
      let pdfEntry = config.autoFillXmlRelated[ xmlKey ][ ruleValue ];
      if ( ! pdfEntry ){
        pdfEntry = config.autoFillXmlRelated[ xmlKey ];
      }
      if ( pdfEntry.name ) for ( const name of pdfEntry.name.split(',').map( n => n.trim()) ){
        const field = this.getFieldByName( name );
        if ( ! field ) continue;
        field.setValueInTable( pdfEntry.value );
        field.setValueInPdf( pdfEntry.value );
      } else {
        console.warn(`cannot auto fill ${xmlKey} with ${ruleValue}`);
      }
    }

    this.autoLayout();
    this.pdfViewerApplication._annotationStorageModified = true; 
    // this.pdfViewerApplication.pdfDocument.annotationStorage.onSetModified(); 
    this.pdfViewerApplication.forceRendering();

  }

  /**
   * auto layout needed for vertical aligned text
   */
  autoLayout(){
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
    console.assert( this._pdfIndex );
    return this._pdfIndex; // constructed in ready listener
  }

  getFields(){
    return this.pdfIndex.values();
  }

  getFieldByName( fieldName ){
    return this.pdfIndex.get( fieldName );
  }

  getFieldByPdfId( pdfId ){
    return this.getFieldByName( this._pdfObjectsDict[ pdfId ].name );
  }
  
  /**
   * @summary create HTML space for displaying a single PDF file
   * @param {string} mode - viewing mode i.e. 'app' or 'profile'
   */
  static createHTMLSpace( mode ){
    const template = document.getElementById('single_result');
    const htmlSpace = document.createElement('div');
    // const clone = template.content.cloneNode(true); // should work, but does not. Why?
    // add clone to DOM
    htmlSpace.innerHTML = template.innerHTML;
    if ( mode ) htmlSpace.classList.add( mode ); // turn visibility on in a view ("app" or other view modes)
    document.querySelector('.all_results').appendChild(htmlSpace);
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
   * alternatively to saveAllListener, which saves all PDFs consecutively.
   * Use this instead of saveAllListener, in case of demand for Zip archives
   * @param {Event} event - click button event 
   */
  static async saveAllZipListener( event ){
    const cancelButton = document.getElementById('save_all_cancel');
    cancelButton.classList.remove('hide');
    let cancelled = false;
    const cancelListener = ev => {
      cancelled = true;
    };
    cancelButton.addEventListener('click', cancelListener );
    const zip = new JSZip();
    for ( const pdfDoc of PdfDoc.all ){
      if ( cancelled ) break;
      const data = await pdfDoc.pdfDocumentInstance.saveDocument();
      const blob = new Blob([data], {
        type: "application/pdf"
      });
      zip.file( `${pdfDoc.person.name}-${pdfDoc.fileName}.pdf`, blob, {binary:true} );
      // pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.onResetModified();
    }
    if ( ! cancelled ) zip.generateAsync({type:"blob"})
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
    cancelButton.removeEventListener('click', cancelListener );
    cancelButton.classList.add('hide');
  }

  /**
   * save all PDFs consecutively
   * @param {Event} event - click button event 
   */
  static async saveAllListener( event ){
    const cancelButton = document.getElementById('save_all_cancel');
    cancelButton.classList.remove('hide');
    let cancelled = false;
    const cancelListener = ev => {
      cancelled = true;
    };
    cancelButton.addEventListener('click', cancelListener );
    
    for ( const pdfDoc of PdfDoc.all ){
      if ( cancelled ) break;
      pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.onSetModified();
      const data = await pdfDoc.pdfDocumentInstance.saveDocument();
      const blob = new Blob([data], {
        type: "application/pdf"
      });
      await fileSave( blob, {
        // Suggested file name to use, defaults to `''`.
        fileName: `${pdfDoc.person.name}-${pdfDoc.fileName}.pdf`,
        // Suggested file extensions (with leading '.'), defaults to `''`.
        extensions: ['.pdf'],
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: 'save-pdf',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
      });
    }
    cancelButton.removeEventListener('click', cancelListener );
    cancelButton.classList.add('hide');
  }

  saveListener( event ){
    this.pdfViewerApplication.pdfDocument.annotationStorage.onSetModified();  // .onSetModified 
    // this.pdfViewerApplication.eventBus.dispatch('save', { source: this.pdfViewerApplication });
    this.pdfViewerApplication.downloadOrSave({ openInExternalApp: true }); // see Mozilla app.js
  }

  static async printAllListener( event ){
    const cancelButton = document.getElementById('print_all_cancel');
    cancelButton?.classList.remove('hide');
    let cancelled = false;
    const cancelListener = ev => {
      cancelled = true;
    };
    cancelButton?.addEventListener('click', cancelListener );

    let lastDoc, lastParents;
    for ( const pdfDoc of PdfDoc.all ){
      // pdfDoc.printReadyPromise = new Promise( resolve => { 
      //   pdfDoc.iFrame.contentWindow.addEventListener( 'afterprint', function afterPrintListener(){
      //     pdfDoc.iFrame.contentWindow.removeEventListener( 'afterprint', afterPrintListener ); 
      //     resolve();
      //   });
      // });
      if ( lastDoc ){
        lastDoc.iFrame.contentWindow.addEventListener('afterprint', async function onPrintFinished(){
          lastDoc.iFrame.contentWindow.removeEventListener('afterprint', onPrintFinished );
          // await new Promise( resolve => setTimeout( resolve, 1000 ) );
          lastDoc.hideAllParents( lastParents );
          if ( cancelled ) return;
          lastParents = pdfDoc.unhideAllParents();
          // pdfDoc.iFrame.focus();
          pdfDoc.pdfViewerApplication.triggerPrinting();
        });
      } else {
        lastParents = pdfDoc.unhideAllParents();
        // pdfDoc.iFrame.focus();
        pdfDoc.pdfViewerApplication.triggerPrinting();  
      }
      lastDoc = pdfDoc;
    }

    cancelButton?.removeEventListener('click', cancelListener );
    cancelButton?.classList.add('hide');
  }

  hideAllParents( parents ){
    for ( const parent of parents ){
      parent.classList.add('hidden');
    }
  }

  unhideAllParents(){
    const hiddenParents = [];
    let current = this.htmlSpace;
    while ( current !== document.body ){
      if ( current.classList.contains('hidden') ){
        hiddenParents.push( current );
        current.classList.remove('hidden');
      }
      current = current.parentElement;
    }
    return hiddenParents;
  }

  async printListener( event ){
    const self = this;
    const printReadyPromise = new Promise( resolve => { 
      this.iFrame.contentWindow.addEventListener( 'afterprint', function afterPrintListener(){
        self.iFrame.contentWindow.removeEventListener( 'afterprint', afterPrintListener ); 
        resolve();
      });
    });
    // PDF.js renders only visible pages
    const hiddenParents = this.unhideAllParents();

    // function beforePrintListener( eve ) {
    //   self.iFrame.contentWindow.removeEventListener( "beforeprint", beforePrintListener );
    //   // this === self.iFrame.contentWindow
    //   console.log( 'iFrame.contentWindow before print' );
    //   // self.pdfViewerApplication.printService.destroy();
    // };
    // this.iFrame.contentWindow.addEventListener( "beforeprint", beforePrintListener );

    function afterPrintListener( ev ) {
      self.iFrame.contentWindow.removeEventListener( 'afterprint', afterPrintListener ); 
      // this === self.iFrame.contentWindow
      // console.log('iFrame.contentWindow after print');
      // self.pdfViewerApplication.cleanup();
      self.hideAllParents( hiddenParents );
      // self.pdfViewerApplication.printService?.destroy();
    };
    this.iFrame.contentWindow.addEventListener( 'afterprint', afterPrintListener );

    this.iFrame.focus();
    // await this.iFrame.contentWindow.print();
    this.pdfViewerApplication.triggerPrinting(); // see Mozilla app.js
    // wait for printing to be finished
    await printReadyPromise;
    // await new Promise( resolve => setTimeout( resolve, 1000 ) ); 
  }

  static allAreReady(){
    for ( const pdfDoc of PdfDoc.all ){
      if ( ! pdfDoc.isFullyRendered ) return false;
    }
    return true;
  }

  /**
   * @summary test whether this PdfDoc instance is ready ( fully rendered and forms are filled )
   * @returns true iff this PdfDoc instance is ready
   * 
   * recall that async/await is just syntactic sugar for Promises. 
   * In JavaScript, an async function actually wraps its return value 
   * in a Promise object — even if it seems like the function is directly returning a value, 
   * and even if the function does not await anything.
   */
  async isReady(){
    // mix of sync and async code
    return this.isFullyRendered || await this.isFullyRenderedPromise;
  }
   
  async pageReady( pageNumber ){
    // if ( ! this.pdfDocumentInstance ) return false;
    // if ( this.pdfViewerApplication.pdfViewer.pageViewsReady ) return true;
    // await this.textlayerrendered( pageNumber );
    return this.annotationeditorlayerrendered( pageNumber );
  }

  async textlayerrendered( pageNumber ){
    return new Promise( resolve => { 
      this.pdfViewerApplication.eventBus.on('textlayerrendered', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  async pagerendered( pageNumber ){
    return new Promise( resolve => { 
      this.pdfViewerApplication.eventBus.on('pagerendered', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  async annotationeditorlayerrendered( pageNumber ){
    // let the faster promise win
    return Promise.race( [ new Promise( resolve => { 
      this.pdfViewerApplication.eventBus.on('annotationeditorlayerrendered', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    }),
      new Promise( resolve => setTimeout( resolve, 100 ) )
    ] )
  }

  async updateviewarea( pageNumber){
    return new Promise( resolve => { 
      this.pdfViewerApplication.eventBus.on('updateviewarea', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  async pagechanging( pageNumber){
    return new Promise( resolve => { 
      this.pdfViewerApplication.eventBus.on('pagechanging', event => {
        if ( event.pageNumber === pageNumber ) resolve();
      });
    });
  }

  scrollPageIntoView( params ){
    this.pdfViewerApplication.pdfViewer.scrollPageIntoView( params );
  }

  pagesCount(){
    return this.pdfViewerApplication?.pdfViewer?.pagesCount;
  }

  async screenshots(){
    const page = await this.pdfDocumentInstance.getPage(1);
    await this.screenshotOfPage( page );
  }

  // https://gist.github.com/ichord/9808444
  async screenshotOfPage( page ){
    const scale = 1.5;
    const viewport = page.getViewport(scale);

    //
    // Prepare canvas using PDF page dimensions
    //
    const canvas = document.getElementById('screenshot_canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.viewBox[2];
    canvas.height = viewport.viewBox[3]; 

    //
    // Render PDF page into canvas context
    //
    const task = page.render({canvasContext: context, viewport: viewport});
    await task.promise;
    const blob = await new Promise( resolve => {
      canvas.toBlob( resolve, 'image/jpeg', 1 );
    });
    await fileSave( blob, {
      // Suggested file name to use, defaults to `''`.
      fileName: `Page${page._pageIndex + 1}.jpg`,
      // Suggested file extensions (with leading '.'), defaults to `''`.
      extensions: ['.jpg'],
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: 'downloads',
      // Include an option to not apply any filter in the file picker, defaults to `false`.
      excludeAcceptAllOption: false,
    });
  }


  async insertImageFromPasteBuffer( { canvas, blob, url } ){
    if ( ! blob || ! url ){
      ({ blob, url } = await getFromPasteBuffer( 'image/' ));
    } 
    const result = await blobToBase64( blob );
    const ctx = canvas.getContext('2d');
    const pdfObjectId = canvas.parentElement.dataset.annotationId;
    const img = new Image(canvas.width, canvas.height);
    img.onload = () => { 
      ctx.drawImage( img, 0, 0, canvas.width, canvas.height ); 
      // this.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObjectId, {value: result});
      URL.revokeObjectURL( url );
    }
    img.src = url; 
    return result;
  }

}

globalThis.PdfDoc = PdfDoc;
globalThis.PdfDoc.all = []; // new Map();  // adds new PDFs for every open event, maps pdfDocs to HTML fragments, in which it is displayed

