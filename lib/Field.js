/**
 * @module Field.js
 * @summary Single Field in a PDF document
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {makeClassName} from './global_functions.js';
import {config} from './config.js';
import {Rule} from './Rule.js';
import {getFromPasteBuffer} from './global_functions.js';

export class Field  {
  constructor(pdfDoc, fieldName, pdfObjects ) {
    if (config.debug) console.assert( pdfDoc, `PdfDoc should exist, but is ${pdfDoc}` );
    this.pdfDoc = pdfDoc;
    this.fieldName = fieldName;
    this.pdfObjects = pdfObjects;
    this.typ = this.getTypeFromPdfObjects();
    this.exportValues = Array.from( new Set( pdfObjects.filter( x => x.exportValues ).map( pdfObject => pdfObject.exportValues ) ) );
    this._dirty = false;
    this._value = undefined;
  }

  get name() {
    return this.fieldName;
  }

  get fileName() {
    return this.pdfDoc.fileName;
  }

  getTypeFromPdfObjects(){
    for (const pdfObject of this.pdfObjects) {
      if ( pdfObject.type ) return pdfObject.type;
    }
    return null;
  }

  toSource(){
    return '${' + this.fieldName + '}$';
  }

  reset(){
    this._value = null;
  }

  get value(){  // Rules with highest prority, then table, then PDF
    if ( this._value === undefined  ){
      if ( this._dirty ){  
        // do not use rules if dirty
        this._value = this.valueFromTable() || this.valueFromPDF() || null;
      } else {
        // use rules first
        this._value = this.valueFromRules() || this.valueFromTable() || this.valueFromPDF() || null;
      }
    }
    return this._value;
  }

  set value( newValue ){
    this._value = newValue;
    // this.setValueInTable( newValue );
  }

  // transfer value to table
  setValueInTable( newValue ){ // allow to set value to empty string
    // update htmlRow
    if ( newValue !== '' && ! newValue ) newValue = this._value;
    const inputField = this.pdfDoc.pdfTable.querySelector('.' + makeClassName(this.fieldName));
    switch( this.typ ){
      case 'text':
        inputField.innerHTML = newValue?.replaceAll('\n','<br>') || '';
        break;
      case 'checkbox': case 'radiobutton':
        const checkbox = Array.from(inputField.querySelectorAll('input'))
          .find( checkbox => checkbox.parentElement.textContent === newValue );
        if ( checkbox ){
          checkbox.checked = true;
          console.assert( inputField.querySelector('input:checked').value === newValue 
             || inputField.querySelector('input:checked').parentElement.textContent === newValue );
        } 
        break;
      case 'combobox': case 'listbox':
        const selectBox = inputField.querySelector('select'); 
        if ( selectBox ){
          selectBox.value = newValue;
          console.assert( selectBox.selectedIndex < 0 || selectBox.options[selectBox.selectedIndex].value === newValue );
        }
        break;
      case 'button': // ignore
        return null;
      default:
        console.warn(`cannot get value from field ${this.fieldName} in ${this.fileName}.`);
        return null;
    }
  }  

  get htmlElements(){
    return this.pdfObjects
      .filter( pdfObject => pdfObject.type === this.typ )
      .map( pdfObject => this.pdfDoc.iFrame.contentDocument.getElementById("pdfjs_internal_id_" + pdfObject.id) )
      .filter( htmlElement => htmlElement );
  }
  
  /**
   * @summary transfer value to PDF, by rule or manually. Allow to set value to empty string. 
   * @param {any} value - any value, empty string allowed 
   * @param {HTMLElement} tableElement - element in pdfTable to be synchronized with PDF status
   */
  setValueInPdf( value, tableElement ){  
    // Do not write variables into PDF:
    if ( value.includes && value.includes('${') ) return;  // rule processing unfinished
    if ( config.ignoreCheckboxes && this.typ === 'checkbox' ) return;
    if ( this.typ === null ) return;
    if ( ! tableElement ) tableElement = this.pdfDoc.pdfTable.querySelector('td.input.'+makeClassName(this.name));
    switch ( this.typ ){
      case 'text':
        if ( typeof value === 'string' ){
          for ( const pdfObject of this.pdfObjects ){
            if ( pdfObject.type === this.typ ){
              pdfObject.value = value;
              const fElementId = "pdfjs_internal_id_" + pdfObject.id;
              const htmlElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
              let prettyfiedValue = value.replaceAll('<br>',"\n");
              this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {value: prettyfiedValue});
              if ( htmlElement ){
                // htmlElement.addEventListener('input', event => {
                //   prettyfiedValue = htmlElement.value; 
                //   this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {value: prettyfiedValue});             
                // });
                htmlElement.value = prettyfiedValue;              
              }           
            }
          }
        }
        break;
      case 'checkbox': case 'radiobutton':
        // allow for multiple checks
        // const allValues = Array.from( tableElement.querySelectorAll('input:not(.dirty)') ).map( elem => elem.parentElement.textContent );
        const checkedValues = Array.from( tableElement.querySelectorAll('input:not(.dirty):checked') ).map( elem => elem.parentElement.textContent );
        for ( const pdfObject of this.pdfObjects ){
          if ( pdfObject.type === this.typ ){
            const fElementId = "pdfjs_internal_id_" + pdfObject.id;
            const htmlElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
            if ( checkedValues.includes( pdfObject.exportValues ) ){
              pdfObject.editable = true;
              pdfObject.value = 'On';
              if ( htmlElement ) htmlElement.checked = true;
              this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, { value: 'On' });
            } else {
              pdfObject.editable = true;
              pdfObject.value = pdfObject.defaultValue; // 'Off'
              if ( htmlElement ) htmlElement.checked = false;
              this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {});
            }
          }
        }
        break;
      case 'combobox': case 'listbox': 
        const checkedOption = tableElement.querySelector('option:checked');
        if ( checkedOption ){
          for ( const pdfObject of this.pdfObjects ){
            if ( pdfObject.type === this.typ ){
              pdfObject.value = checkedOption.value;
              const fElementId = "pdfjs_internal_id_" + pdfObject.id;
              const htmlElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
              if ( htmlElement ){
                htmlElement.value = checkedOption.value.trim() ? checkedOption.value : this._value;
                this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, { value: htmlElement.value });
                this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
              } 
            }
          }
        }
      case 'button':
        break; // ignore
      default:
        console.warn(`cannot get value from field ${this.fieldName} in ${this.fileName}.`);
    }
  }  

  get htmlRow(){
    if ( ! this._htmlRow ){
      this._htmlRow = this.pdfDoc.fragment.querySelector('.'+makeClassName(this.fieldName));
    }
    return this._htmlRow;
  }

  get dirtyInputElement(){ // get checkbox for switching the dirty flag
    return this.htmlRow.querySelector('input.dirty');
  }

  markAsDirty(){
    this._dirty = true;
    if ( this.htmlRow ){
      this.htmlRow.classList.add('dirty');
      this.dirtyInputElement.checked = true;
    }
  }

  unmarkAsDirty(){
    this._dirty = false;
    if ( this.htmlRow ){
      this.htmlRow.classList.remove('dirty');
      this.dirtyInputElement.checked = false;
    }
  }

  valueFromRulesOrPDF(){  // before the table exists
    return this.valueFromRules() || this.valueFromPDF();
  }

  valueFromRules(){  // from rules
    const value = Rule.DB.valueFromAllRulesOf( this );
    return value;
  }

  valueFromTable(){
    const inputField = this.pdfDoc.pdfTable.querySelector('.' + makeClassName(this.fieldName));
    if ( this.typ === null ) return null;
    switch( this.typ ){
      case 'text':
        return inputField.innerHTML;
      case 'checkbox': case 'radiobutton': // get label(s) of checked as value
        return Array.from( inputField.querySelectorAll('input:checked') ).map( inp => inp.parentElement.textContent ).join(', ');
      case 'combobox': case 'listbox': case 'dropdown': return this.htmlRow.querySelector('select.input').value;
      case 'button': // ignore
        return null;
      default:
        console.warn(`cannot get value from field ${this.fieldName} in ${this.fileName}.`);
        return null;
    }
  }

  valueOfInput( tableCell ){
    // text input
    if ( tableCell.isContentEditable ) return tableCell.textContent;
    // radio buttons or checkboxes. Get label of checked radio button as value
    return Array.from( tableCell.querySelectorAll('input:checked') ).map( elem => elem.parentElement?.textContent );
  }

  getValueFromPdfObjects(){
    for (const pdfObject of this.pdfObjects) {
      if ( pdfObject.value ) return pdfObject.value;
      const fElementId = "pdfjs_internal_id_" + pdfObject.id;
      const fElement = this.pdfDoc.fragment.querySelector('#'+fElementId);
      if ( fElement ) return fElement.value;
      const storedValueObject = this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.getValue( pdfObject.id, {} );
      if ( storedValueObject && storedValueObject.value ) return storedValueObject.value;
      // if ( pdfObject.exportValues ) return pdfObject.exportValues;
    }
    return null;
  }

  valueFromPDF(){ 
    if ( this.typ === null ) return null;
    switch( this.typ ){
      case 'text':
        let fieldValue = this.getValueFromPdfObjects() || '';
        if (fieldValue.includes('\\')) try {
          fieldValue = escape(fieldValue);
        } catch (e) {console.warn(e)}
        if (fieldValue.includes('%20')) try {
          fieldValue = decodeURIComponent(fieldValue);
        } catch (e) {console.warn(e)}
        return fieldValue;
      case 'checkbox': case "radiobutton": // get label of checked radio button as value
        return this.getValueFromPdfObjects();
      case 'combobox': case "listbox": case 'dropdown':
        return this.htmlElements.length ? this.htmlElements[0].value : this.getValueFromPdfObjects();
      case 'button':
        return this.getValueFromPdfObjects(); 
      default:
        console.warn(`cannot get value from field ${this.fieldName} in ${this.fileName}.`);
        debugger;
    }
  }

  toJSON() { // do not stringify pdfField, which would result in circular structures
    return { fileName: this.filename, typ: this.typ, fieldName: this.fieldName };
  }

  toSpan() {
    return `<span title="${this.typ} in ${this.fileName}">${this.name}</span>`;
  }

  // convert this field into a HTML input field
  toHTMLInputField(){
    const value = this.valueFromRulesOrPDF();  // before table exists
    if ( config.ignoreCheckboxes ) return '';
    switch ( this.typ ){
      case 'text': return value;
      // if value still contains variables starting with $, then wait for additional rules
      // case 'checkbox': return `<input type="checkbox" id="${makeClassName(this.name)}" ${value===true||(value.includes && !value.includes('${'))?'checked':''}>`
      case 'checkbox': case 'radiobutton': return this.exportValues.map( exportValue => `<span>${exportValue}<input type="checkbox" id="${makeClassName(this.name+exportValue)}"></span>` ).join(''); 
      case 'combobox': case 'listbox': debugger; return this.exportValues.map( exportValue => `<span>${exportValue}<input type="checkbox" id="${makeClassName(this.name+exportValue)}"></span>` ).join(''); 
      case 'button': return value;
      default: return value;
    }
  }

  matchOnOff( exportValue, thisValue ){
    if ( exportValue === thisValue ) return true;
    if ( typeof exportValue === 'string' ) exportValue = exportValue.toLowerCase();
    if ( typeof thisValue === 'string' ) thisValue = thisValue.toLowerCase();
    if ( exportValue === thisValue ) return true;
    const exportOn = config.checkboxOnValues.includes( exportValue );
    const thisOn   = config.checkboxOnValues.includes( thisValue );
    const exportOff = config.checkboxOffValues.includes( exportValue );
    const thisOff   = config.checkboxOffValues.includes( thisValue );
    const exportYes = config.yesValues.includes( exportValue );
    const thisYes = config.yesValues.includes( thisValue );
    const exportNo = config.noValues.includes( exportValue );
    const thisNo = config.noValues.includes( thisValue );
    const result = ( exportOn && thisOn ) || ( exportOff && thisOff ) || ( exportYes && thisYes ) || ( exportNo && thisNo );
    // console.log( 'matchOnOff: ', this.pdfDoc.name, this.name, exportValue, thisValue, ' => ', result );
    return result
  }

  // convert this field into a HTML table row
  toTableRow() {
    const row = document.createElement('tr');
    this._value = this.valueFromRules(); 
    row.innerHTML = `<td class="dirty"><input class="dirty" type="checkbox"></td><td class="label">${this.name}</td>`;
    switch( this.typ ){
      case 'text':
        row.innerHTML += `<td class="input ${makeClassName(this.name)}" contentEditable>${this.toHTMLInputField()}</td>`;
        break;
      case 'checkbox': case "radiobutton": 
        const checkboxes = this.exportValues.map( (exportValue, i) => `<label>${exportValue}<input type="${( this.exportValues.length === 1 )?'checkbox':'radio'}" name="${makeClassName(this.name)}" ${this.matchOnOff( exportValue, this._value )?" checked":""}></label><br>` ).join('');
        row.innerHTML += `<td class="input ${makeClassName(this.name)}">${checkboxes}</td>`;
        break;
      case 'combobox': case 'listbox': 
        let items = this.pdfObjects[0].items;
        if ( ! items ) items = this.pdfObjects[1].items;  // this.pdfObjects[0] has kids
        const options = items.map( item => `<option value="${item.exportValue}" ${item.exportValue === this._value?" selected":""}>${item.exportValue}</option>` ).join('');
        row.innerHTML += `<td class="${makeClassName(this.name)}"><select class=input ${makeClassName(this.name)}>${options}</select></td>`;
        break;  
      case 'button':
        const dragTarget = this.name.match(/bild|image|img/i) ? `<span class="border-dashed">Click here to insert image from Clipboard</span>` : this.valueFromPDF();
        row.innerHTML += `<td class="input ${makeClassName(this.name)}">${dragTarget}</td>`;
        break;  
      default:
        row.innerHTML += `<td class="input ${makeClassName(this.name)}">${this.toHTMLInputField()}</td>`;  
    }
    this._htmlRow = row;
    return row;
  }

  //========= ToDo: Are listeners with setValueInPdf sufficient? ===========
  // convert this field to table row and add event listeners
  toHTMLTableRowWithEventListeners(){
    const row = this.toTableRow();
    if ( this.typ === null ) return row;
    const inputField = row.querySelector('.input');
    switch ( this.typ ){
      case 'text':
        inputField.addEventListener('blur', async event => {
          this.setValueInPdf( inputField.textContent, row );
          this.markAsDirty();
        });
        break;
      case 'checkbox': case "radiobutton":
        inputField.addEventListener('change', async event => {
          const labelOfTarget = event.target.parentElement.textContent;
          this.setValueInPdf( labelOfTarget, row ); // ToDo: does not uncheck other radio buttons
          this.markAsDirty();
        });
        break;
      case 'combobox': case "listbox": 
        inputField.addEventListener('change', async event => {
          const labelOfTarget = event.target.value;
          this.setValueInPdf( labelOfTarget, row );
          this.markAsDirty();
        });
        break;
      case 'dropdown': 
        inputField.addEventListener('change', async event => {
          this.setValueInPdf( inputField.value, row );
          this.markAsDirty();
        });
        break;
      case 'button':
        if ( this.name.match(/bild|image|img/i) ){
          inputField.addEventListener('click', async event => {
            const blob = await getFromPasteBuffer( 'image/' );
            if ( blob ){
              const url = URL.createObjectURL( blob );
              const img = new Image();
              img.onload = _=> URL.revokeObjectURL( url );
              img.src = url;
              inputField.appendChild( img );
            }
          });
        } else {
          if ( config.debug ) console.warn( `"${this.typ}" field named "${this.name}" ignored.` );
        }
        break;
      default:
        console.warn(`Incomplete switch for type "${this.typ}" field named "${this.name}".`);
        debugger;
    }
    this.dirtyInputElement.addEventListener('change', event => {
      if ( event.target.checked ){
        this.htmlRow.classList.add('dirty');
        this._dirty = true;
      } else {
        this.htmlRow.classList.remove('dirty');
        this._dirty = false;
        this._value = this.valueFromRules();
        this.setValueInTable( this._value );
        this.setValueInPdf( this._value );
      }
    });
    this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
    this.pdfDoc.pdfViewerApplication.forceRendering();
    return row;
  }

  // click on checkbox in table cell induces click on checkbox in pdf
  tableCheckboxClick( labelOfTarget ){
    for ( const pdfObject of this.pdfObjects ) {
      if ( pdfObject.type !== this.typ ) continue;
      const fElementId = "pdfjs_internal_id_" + pdfObject.id;
      const annotationElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
      if ( annotationElement ){
        annotationElement.checked = ( config.yesValues.includes( labelOfTarget ) ) ? ! annotationElement.checked : pdfObject.exportValues === labelOfTarget;
        this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {value: annotationElement.checked?"On":"Off"});  
      } else {
        this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {value: labelOfTarget});  
      } 
      this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
    }
  }

  // select in table cell induces select in pdf
  select( labelOfTarget ){
    for ( const pdfObject of this.pdfObjects ) {
      if ( pdfObject.type !== this.typ ) continue;
      this.pdfDoc.pdfDocumentInstance.annotationStorage.setValue(pdfObject.id, {value: labelOfTarget});
      const fElementId = "pdfjs_internal_id_" + pdfObject.id;
      const annotationElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
      if ( annotationElement ){
        if ( ! config.disableElements?.includes( elem.getAttribute('name') ) ){
          annotationElement.disabled = false;
        }
        annotationElement.hidden = false;
        annotationElement.value = labelOfTarget;
      } 
    }
    this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
  }

  // use String.prototype.localeCompare() to sort fields
  compare(otherField) {
    return this.norm().localeCompare(otherField.norm(), navigator.languages[0].slice(0,2) )
  }

  // normalize field name for sorting
  norm() {
    if (this.name?.includes('.')) {
      const middle = this.name.split('.')[1];
      if (isNaN(parseInt(middle))) {
        return middle;
      }
    }
    return this.name;
  }

}


