/**
 * @module Doc.js
 * @summary Single PDF document class
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {replaceParams, addCollapseIcons} from './global_functions.js';
import {Field} from './Field.js';
import {qrcode} from "./qrcode.js";

export class PdfDoc  {
  constructor( file, iFrame ) {
    this.file = file;
    this.fileName = file.name;
    this.iFrame = iFrame;
    this.allRulesApplied = false;
    this.pagesRendered = new Set();
    PdfDoc.all.push( this );
  }

  async build(){  // async stuff in constructor is not possible

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
      this.pdfViewerApplication.close();
      this.fragment.parentElement.removeChild( this.fragment );
      this.clear();
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
    // console.log( new Set( Object.values( this._pdfFieldsDict ).map( field => field.typ ) ) );
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

  clear(){
    this.pdfViewerApplication.close();
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
    URL.revokeObjectURL( this.url ); // frees memory
    PdfDoc.all.splice( PdfDoc.all.indexOf( this ), 1 );
  }

  // updatePreview(){
  //   if ( config.log ) console.trace('updatePreview');
  //   if ( config.applyPdfToTable  ) this.applyPdfToTable(); // PDF values overwrites table values
  //   this.applyTableToPDF();   // As the last step, table values are applied to PDF  
  //   PdfDoc.updateAllFieldsArea();
  // }

  static invalidateAllRuleApplications(){
    PdfDoc.log('invalidateAllRuleApplications');
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

  static updateAllFieldsArea(){
    const fields_area = document.getElementById('fields_area');
    fields_area.innerHTML = PdfDoc.all.map( pdfDoc => Object.values( pdfDoc._pdfFieldsDict ).map(field => field.toSpan())).join(', ');
      //Array.from( PdfDoc.all ).map( pdfDoc => Array.from( pdfDoc._allFields ) ).flat().sort((a, b) => a.compare(b)).map(field => field.toSpan()).join(', ');
    fields_area.classList.remove('hide');
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
    PdfDoc.log('applyPdfToTable');
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
    PdfDoc.log('applyRulesToTable');
    this.allRulesApplied = true;
    // this._allFields.forEach( field => { field.reset() } );
    for ( const label of this.pdfTable.querySelectorAll('.label') ){
      if ( ! label.textContent ) continue;
      const fieldObject = this.getFieldByName(label.textContent);
      if ( ! fieldObject ) continue;
      if ( config.ignoreCheckboxes && fieldObject.typ === 'checkbox' ) continue;
      const value = fieldObject.valueFromRules();
      if ( ! value ) continue;
      if ( value === '' ) continue;
      fieldObject.value = value;
    }
  }

  // value from table overwrites value from PDF
  applyTableToPDF(){
    PdfDoc.log('applyTableToPDF');
    for ( const label of this.pdfTable.querySelectorAll('.label') ){
      const fieldObject = this.getFieldByName(label.textContent);
      // if ( ! fieldObject ) continue;
      // value has already been calculated by rules
      fieldObject.setValueInPdf( fieldObject.value );
    }
  }

  get pdfIndex(){
    return this._pdfIndex;
  }
  async pageIndex(){
    if ( ! this._pageIndex ){  // if pageIndex is called before pdfIndex
      this._pageIndex = new Map();
      const index = this.pdfIndex; // fill Map with loop in pdfIndex()
      if ( config.debug ) console.log( 'pdfIndex.size = ', index.size );
    }
    return this._pageIndex;
  }
  getFieldByName( fieldName ){
    return this.pdfIndex.get( fieldName );
  }
  toHTMLElement(){
    debugger;
    const resultTemplate = replaceParams(document.getElementById('single_result').innerHTML, {filename: this.fileName});
    const fragment = document.createElement('div');
    this.fragment = fragment;
    fragment.innerHTML = resultTemplate;
    const result = fragment.querySelector('table.result'); // skip tbody
    const titleSpan = fragment.querySelector('.title');
    const tableHeader = result.firstElementChild.innerHTML;
    this.pdfDocumentInstance.getMetadata().then( metadata => {
      titleSpan.innerHTML = metadata.info.Title || ' ohne Titel ';
    });
    result.innerHTML = tableHeader;
    for ( const fieldObject of this._allFields ){
      if ( config.ignoreFields.includes( fieldObject ) ) continue;
      if ( config.ignoreCheckboxes && fieldObject.typ === 'PDFCheckBox' ) continue;
      const htmlElement = fieldObject.toHTMLTableRowWithEventListeners( this );
      result.appendChild( htmlElement );
    }
    addCollapseIcons(titleSpan, fragment.querySelector('div.result'), this.addFillDefaultButton(titleSpan) );
    this.addUpDownButtonListeners();

    // add delete button
    const deleteButton = fragment.querySelector('.delete');
    deleteButton?.addEventListener('click', event => {
      fragment.parentElement.removeChild( fragment );
    });

    // add a hash of a checksum to the PDF
    const hashButton = fragment.querySelector('button.hash');
    hashButton?.addEventListener('click', async event => {
      const pdfForm = this.pdfDocumentInstance.getForm();
      const hashField = pdfForm.getFieldMaybe( config.hashField );
      if ( hashField ){
        const base64string = await this.checkSum();
        const hashCode = config.crypto + '-' + base64string;
        hashField.setText( hashCode );
        this.pdfDocumentInstance.setSubject( hashCode );  // ToDo check if Subject field is used otherwise
        if ( config.debug ) console.log( hashCode );
      }
    });

    // add a page at the end with QR code
    const qrButton = fragment.querySelector('button.qrcode');
    qrButton?.addEventListener('click', async event => {
      const prefix = config.pdfServer + 'checksum=' + await this.checkSum();
      let nextContainer = prefix + `&pdf=${this.fileName}`;
      const MAX = config.maxNumberOfBytes - nextContainer.length - 2;
      const regex = new RegExp( '.{1,' + MAX + '}', 'g');
      for ( const field of this._allPdfFields ){
        if ( field.getText && field.getText()?.trim() ){
          const nextChunk = `${field.getName()}=${encodeURI( field.getText() )}`;
          if ( nextChunk.length > MAX ){
            // print old chunks
            this.encodeQR( nextContainer );
            // split oversize field into multiple chunks
            const multiChunks = encodeURI( field.getText() ).match( regex );
            multiChunks.forEach((chunk,i)=>{
              // print divided oversize field contents chunk by chunk
              nextContainer = `${prefix}&${field.getName()+'.'+i}=${chunk}`;
              this.encodeQR( nextContainer );
            });
          } else {
            if ( nextContainer.length < MAX - nextChunk.length - 2 ){
              // append next chunk
              nextContainer += '&' + nextChunk;
            } else { // nextContainer would be too big
              this.encodeQR( nextContainer );
              // start fresh with a new container
              nextContainer = prefix + '&' + nextChunk;
            }
          }
        }
      }
      this.encodeQR( nextContainer );
    });
    return fragment;
  }
  encodeQR( container ){ // add page to PDF with QR code
    console.log( 'container.length: ', container.length );
    console.log( container );
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
          if ( ! config.ignoreCheckboxes && inputElement.firstElementChild ) inputElement.firstElementChild.checked = true;
        }
      }
    });
    button.classList.add('hide');
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
}

window.PdfDoc = PdfDoc;
window.PdfDoc.all = []; // new Map();  // adds new PDFs for every open event, maps pdfDocs to HTML fragments, in which it is displayed

