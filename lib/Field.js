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

export class Field  {
  constructor(pdfDoc, fieldName, pdfObjects ) {
    if (config.debug) console.assert( pdfDoc, `PdfDoc should exist, but is ${pdfDoc}` );
    this.pdfDoc = pdfDoc;
    this.fieldName = fieldName;
    this.pdfObjects = pdfObjects;
    this.typ = this.getTypeFromPdfObjects();
    this.exportValues = Array.from( new Set( pdfObjects.filter( x => x.exportValues ).map( pdfObject => pdfObject.exportValues ) ) );
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
    if ( ! this._value ){
      this._value = this.valueFromRulesOrPDF() || this.valueFromTable() || this.valueFromPDF() || '';
    } 
    return this._value;
  }

  set value( newValue ){
    this._value = newValue;
    this.setValueInTable( newValue );
  }

  // transfer value to table
  setValueInTable( newValue ){ // allow to set value to empty string
    // update htmlRow
    if ( newValue !== '' && ! newValue ) newValue = this._value;
    const inputField = this.pdfDoc.pdfTable.querySelector('.' + makeClassName(this.fieldName));
    switch( this.typ ){
      case 'text':
        inputField.innerHTML = newValue.replaceAll('\n','<br>') || '';
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
          console.assert( selectBox.options[selectBox.selectedIndex].value === newValue );
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

  // transfer value to PDF
  setValueInPdf( value, tableElement ){  // allow to set value to empty string
    if ( value !== '' && ! value ) value = this._value;
    if ( value !== '' && ! value ) return;
    // Do not write variables into PDF:
    if ( value.includes && value.includes('${') ) return;  // case values missing, rules unfinished
    if ( config.ignoreCheckboxes && this.typ === 'checkbox' ) return;
    if ( this.typ === null ) return;
    switch ( this.typ ){
      case 'text':
        if ( typeof value === 'string' ){
          for ( const pdfObject of this.pdfObjects ){
            if ( pdfObject.type === this.typ ){
              pdfObject.value = value;
              const fElementId = "pdfjs_internal_id_" + pdfObject.id;
              const htmlElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
              let prettyfiedValue = value.replaceAll('<br>',"\n");
              if ( htmlElement ){
                htmlElement.addEventListener('input', event => {
                  prettyfiedValue = htmlElement.value; 
                  this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {value: prettyfiedValue});             
                  this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
                });
                htmlElement.value = prettyfiedValue;              
                this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {value: prettyfiedValue});
                this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
              } else {
                // if ( ! pdfObject.kids ) console.warn( fElementId, 'not found', pdfObject );
              }            
            }
          }
        }
        break;
      case 'checkbox': case 'radiobutton':
        for ( const pdfObject of this.pdfObjects ){
          if ( pdfObject.type === this.typ ){
            const checkedElement = tableElement?.querySelector('input:checked');
            if ( checkedElement ) value = checkedElement.parentElement.textContent;
            if ( pdfObject.exportValues === value ){
              pdfObject.value = 'On';
              const fElementId = "pdfjs_internal_id_" + pdfObject.id;
              const htmlElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
              if ( htmlElement ){
                htmlElement.checked = true;
                this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, { value: 'On' });
                this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
              } else {
                // if ( ! pdfObject.kids ) console.warn( fElementId, 'not found', pdfObject );
              } 
            }
          }
        }
        break;
      case 'combobox': case 'listbox': 
        const checkedOption = tableElement?.querySelector('option:checked');
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
      case 'checkbox': case 'combobox': // get label of checked radio button as value
        return inputField.querySelector('input:checked')?.parentElement?.textContent;
      case 'dropdown': break; // ignore
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
      const fElementId = "pdfjs_internal_id_" + pdfObject.id;
      const fElement = this.pdfDoc.fragment.querySelector('#'+fElementId);
      if ( fElement ) return fElement.value;
      if ( pdfObject.value ) return pdfObject.value;
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
        return this.getValueFromPdfObjects();
      case 'button':  // ignore button labels used as hint or advisory text
        return '';  
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

  // convert this field into a HTML table row
  toTableRow() {
    const row = document.createElement('tr');
    this._value = this.valueFromRulesOrPDF(); 
    row.innerHTML = `<td class="label">${this.name}</td>`;
    switch( this.typ ){
      case 'text':
        row.innerHTML += `<td class="input ${makeClassName(this.name)}" contentEditable>${this.toHTMLInputField()}</td>`;
        break;
      case 'checkbox': case "radiobutton": 
        const checkboxes = this.exportValues.map( (exportValue, i) => `<label for="${makeClassName(this.name+i)}">${exportValue}<input type="${( this.exportValues.length === 1 )?'checkbox':'radio'}" name="${makeClassName(this.name)}" id="${makeClassName(this.name+i)}" ${exportValue === this.value?" checked":""}></label><br>` ).join('');
        row.innerHTML += `<td class="input ${makeClassName(this.name)}">${checkboxes}</td>`;
        break;
      case 'combobox': case 'listbox': 
        let items = this.pdfObjects[0].items;
        if ( ! items ) items = this.pdfObjects[1].items;  // this.pdfObjects[0] has kids
        const options = items.map( item => `<option value="${item.exportValue}">${item.exportValue}</option>` ).join('');
        row.innerHTML += `<td class="${makeClassName(this.name)}"><select class=input ${makeClassName(this.name)}>${options}</select></td>`;
        break;  
      default:
        row.innerHTML += `<td class="input ${makeClassName(this.name)}">${this.toHTMLInputField()}</td>`;  
    }
    this._htmlRow = row;
    return row;
  }

  // convert this field to table row and add event listeners
  toHTMLTableRowWithEventListeners(){
    const row = this.toTableRow();
    if ( this.typ === null ) return row;
    const inputField = row.querySelector('.input');
    switch ( this.typ ){
      case 'text':
        inputField.addEventListener('blur', async event => {
          if ( config.autoupdate ) { this.setValueInPdf( inputField.textContent ); }
          if ( this.pdfDoc.person ) await this.pdfDoc.person.activate();
          this.pdfDoc.applyRulesToTable(); 
          this.pdfDoc.applyTableToPDF();
        });
        break;
      case 'checkbox': case "radiobutton":
        inputField.addEventListener('change', async event => {
          const labelOfTarget = event.target.parentElement.textContent;
          this.tableCheckboxClick( labelOfTarget );
          if ( this.pdfDoc.person ) await this.pdfDoc.person.activate();
          this.pdfDoc.applyRulesToTable(); 
          this.pdfDoc.applyTableToPDF();
        });
        break;
      case 'combobox': case "listbox": // ToDo same as dropdown ?
        inputField.addEventListener('change', async event => {
          const labelOfTarget = event.target.value;
          this.select( labelOfTarget );
          if ( this.pdfDoc.person ) await this.pdfDoc.person.activate();
          this.pdfDoc.applyRulesToTable(); 
          this.pdfDoc.applyTableToPDF();
        });
        break;
      case 'dropdown': // ToDo same as combobox ?
        debugger;
        inputField.addEventListener('change', async event => {
          this.pdfField.select( inputField.value );
          if ( config.autoupdate ) { this.setValueInPdf( inputField.value ); }
          if ( this.pdfDoc.person ) await this.pdfDoc.person.activate();
          this.pdfDoc.applyRulesToTable(); 
          this.pdfDoc.applyTableToPDF();
        });
        break;
      case 'button':
        if ( config.debug ) console.warn( `"${this.typ}" field named "${this.name}" ignored.` );
        break;
      default:
        console.warn(`Incomplete switch for type "${this.typ}" field named "${this.name}".`);
        debugger;
    }
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
      const fElementId = "pdfjs_internal_id_" + pdfObject.id;
      const annotationElement = this.pdfDoc.iFrame.contentDocument.getElementById(fElementId);
      if ( annotationElement ) annotationElement.value = labelOfTarget;
      this.pdfDoc.pdfViewerApplication.pdfDocument.annotationStorage.setValue(pdfObject.id, {value: labelOfTarget});
      this.pdfDoc.pdfViewerApplication._annotationStorageModified = true;
    }
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


