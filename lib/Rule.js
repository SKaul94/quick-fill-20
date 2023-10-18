/**
 * @module Rule.js
 * @summary Single Rule for variable substitution
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {RuleDataBase} from './RuleDataBase.js';
import {PdfDoc} from './Doc.js';
import {SParser} from './sexpressions.js';
import {makeClassName, setSelection, trashWhiteIconSVG} from "./global_functions.js";
import {distance} from "./levenshtein.js";
import {ProfileEditor} from './ProfileEditor.js';
import {saveInitialLists} from '../index.js';

export class Rule  {
  constructor({rule_type, rule, value, threshold, caseRule, pdf, owner, person}) {
    // if (config.debug) console.assert( typeof rule_type === 'string', `Rule type should be string, but is ${rule_type}` );
    if (config.debug) console.assert( ! rule || typeof rule === 'string', `Rule should be string, but is ${rule}` );
    if ( value && config.debug ) console.assert( ['string','function'].includes(typeof value), `Value should be string, but is ${value}` );
    this.rule_type = rule_type || 'equal';
    console.assert( typeof rule === 'string' );
    this._rule = rule;
    this._value = value;
    // this.fields = fields; // calculate on demand
    this.threshold = threshold;  // optional
    if ( caseRule ) this.owner = 'case'; // optional
    this.pdf = pdf; // optional
    this.owner = owner; // optional
    this.person = person; // optional
    // this.row // runtime property of Rule
    const oldRule = Rule.DB.contains(this);
    console.assert( ! oldRule );
    if ( oldRule ) console.warn(`Duplicate rules: ${oldRule.prettyPrint()} and ${this.prettyPrint()}`);
    if ( this.owner === 'template' ){
      this.nr = Rule.DB._templateCounter++;
    } else {
      Rule.DB.addRule( this );  // every Rule is in the Rule Database automatically
    } 
    console.assert( this.nr );
    console.assert( this.check() );
  }

  equals( otherRule ){
    return this.rule === otherRule.rule 
      && this.rule_type === otherRule.rule_type
      && this.value === otherRule.value
      && this.threshold === otherRule.threshold
      && this.owner === otherRule.owner
      && this.pdf === otherRule.pdf
      && this.person === otherRule.person;
  }

  isPersonRule(){
    return !! this.person;
  }

  isCaseRule(){  
    return this.owner === 'case' && ! this.person;
  }

  isTemplate(){
    return this.owner === 'template';
  }

  isGeneralRule(){
    return ! this.person && this.owner !== 'case' && this.owner !== 'template';
  }

  check(){
    if ( ! this.value ) return true; // nothing to check
    const countOpenBrackets = Array.from( this.value.matchAll(/(\${)/g) ).length;
    const countCloseBrackets = Array.from( this.value.matchAll(/(}\$)/g) ).length;
    if ( countOpenBrackets !== countCloseBrackets ){
      console.warn( `WARN: ${countOpenBrackets} Klammer auf, aber  ${countCloseBrackets} Klammer zu, in ${this.toString()}` );
      return false;
    }
    return true;
  }

  static refocus(){
    if ( Rule.lastActiveRow ){
      Rule.lastActiveRow.classList.add('editing');
      const valueElement = Rule.lastActiveRow.querySelector('.value');
      setSelection( valueElement, valueElement.childNodes.length );
    }
  }

  isEmpty(){
    return this.rule.trim() === '' && this.value.trim() === '';
  }

  set rule( newRule ){
    this._rule = newRule;
    Rule.DB.rebuild();
  }

  get rule(){
    return this._rule;
  }

  set value( value ){
    this._value = value;
    if ( this._row ){
      const valueElement = this._row.querySelector('.value');
      if ( valueElement ){
        valueElement.innerText = value;
      }
    }
  }

  get value(){
    return this._value;
  }

  set nr( nr ){
    this._nr = nr;
    const row = this.row;
    if ( row ){
      const nrField = row.querySelector('.nr');
      if ( nrField ) nrField.innerText = nr;
      row.id = (this.owner === 'template' ? 'T' : 'R') + nr;
      console.assert( this.id() === row.id );
    }
  }

  get nr(){
    return this._nr;
  }

  toString(){
    const pdf = this.pdf ? ` (PDF ${this.pdf})` : '';
    const kindOf = this.owner === 'template' ? 'Template' : 'Rule';
    return ` ${kindOf}${this.nr}(${this.rule_type} ${this.rule_type === 'formula' ? this.rule : '"'+this.rule+'"'} "${this.value}"${pdf}) `;
  }

  prettyPrint(){
    const pdf = this.pdf ? `(PDF ${this.pdf})` : '';
    const value = this.value ? `"${this.value}"` : '';
    const person = this.person ? `(Person ${this.person.name})` : '';
    return `(${[this.id(), this.rule_type, this.rule, value, pdf, person].filter(Boolean).join(' ')})`;
  }

  /**
   * @summary persist Rule in JSON format. Do not store fields. Calculate fields on demand. Do not store DOM references.
   * @returns JSON format of this rule.
   */
  toJSON() {
    const result = { // store obligatory persistent properties
      rule_type: this.rule_type,
      rule: this.rule,
      value: this.value
    };
    // add optional persistent properties, if any
    if ( this.pdf ) result.pdf = this.pdf;
    if ( this.caseRule ) result.owner = 'case';
    if ( this.threshold ) result.threshold = this.threshold;
    if ( this.owner ) result.owner = this.owner;
    return result;
  }

  trashIcon(){
    return trashWhiteIconSVG;
  }

  /**
   * @summary 
   * @param {String} owner - select kind of template, case_template or person_template 
   * @returns options object
   */
  static headerOptions( owner ){ // options are specified by HTML declarations
    if ( ! owner ) return {};
    const template = document.querySelector('#' + owner + '_template') || document.querySelector('#rules_template');
    const templateContent = template.content;
    const options = {
      nr:  !! templateContent.querySelector('th.nr'),
      typ: !! templateContent.querySelector('th.typ'),
      pdf: !! templateContent.querySelector('th.pdf'),
      del: !! templateContent.querySelector('th.del')
    };
    return options;
  }

  get row(){
    if ( this._row ) return this._row;
    if ( globalThis['document'] ){
      this._row = globalThis['document'].getElementById( this.id() );
      if ( this._row ) return this._row;
    }
    return null; // return this.makeRow(); // ToDo Do not generate unused tr element
  }

  set row( row ){
    this._row = row;
  }

  makeRow(){
    // console.assert( this.owner, `owner="${this.owner}"`); // does not hold for template 
    // console.assert( ! this.row,`Rule ${this.id()} already has a row.`);
    this._row = this.isGeneralRule() ? this.toRow() : this.toCaseRow( false, this.rule, this.constructor.headerOptions( this.owner ) );
    console.assert( this._row.id === this.id() );
    return this._row;
  }

  id(){
    return (this.owner === 'template' ? 'T' : 'R') + this.nr;
  }

  toRow() {  // convert to HTML
    if ( this.isCaseRule() ) return this.toCaseRow( false, this.rule, this.constructor.headerOptions( this.owner ) );
    const row = document.createElement('tr');
    row.draggable = false;
    row.classList.add('row', this.rule_type);
    row.id = this.id();
    Rule.DB.idIndex[ row.id ] = this;
    const thresholdHTML = this.rule_type === 'similar' ? `<td><input type="number" class="threshold" min="0" max="40" value="${this.threshold || 5}"></td>` : '';
    row.innerHTML = `<td class="nr">${this.nr}</td><td><select class="rule_type">
            <option value="equal">gleich</option>
            <option value="substring">Teilwort</option>
            <option value="date">Datum</option>
            <option value="superstring">Oberwort</option>
            <option value="similar">ähnlich zu</option>
            <option value="regex">Muster</option>
            <option value="formula">Formel</option>
            <option value="delete">Löschen</option>
        </select></td><td class="pdf" contenteditable>${this.pdf || ''}</td>${thresholdHTML}
        <td colspan="${this.rule_type === 'similar' ? 1 : 2}" class="rule" contenteditable>${this.rule || ''}</td><td class="fields">${this.getAllFieldSpans() || ''}</td><td class="value" contenteditable>${this.value || ''}</td><td class="delete" title="Löschen">${this.trashIcon(this.nr)}</td>`;
    if (!this.rule_type) this.rule_type = 'substring';
    row.querySelector(`option[value="${this.rule_type}"]`).selected = 'selected';
    this._row = row;
    // this.installListeners();  // call later
    return row;
  }

  toCaseRow( withRuleEditing, caseRule, options ) {  // convert to 2-column HTML row with equal rule
    const row = document.createElement('tr');
    row.classList.add('row', this.rule_type);
    row.id = this.id();
    Rule.DB.idIndex[ row.id ] = this;
    row.setAttribute('title', 'Rule ' + this.nr );
    const nr_td  = options.nr  ? `<td class="nr">${this.nr}</td>`  : ''; 
    const typ_td = options.typ ? `<td class="typ">${this.rule_type || this.typ}</td>` : '';
    const pdf_td = options.pdf ? `<td class="pdf">${this.pdf}</td>` : '';
    const del_td = options.del ? `<td class="del">${this.trashIcon()}</td>` : '';
    row.innerHTML = `${nr_td}${typ_td}${pdf_td}<td class="rule" ${withRuleEditing ? 'contenteditable' : ''}>${this.rule || 'neue Regel'}</td>`;
    if ( typeof caseRule === 'object' ){  // radio buttons or checkboxes
      let tableCell = '';
      tableCell += `<td class="value">`;
      for ( const value of caseRule.values ){
        tableCell += `<div class="avoid-line-break"><input type="${caseRule.type}" id="${makeClassName(value)}" name="${caseRule.name}" value="${value}"><label for="${makeClassName(value)}">${value}</label></div> `;
      }
      tableCell += `</td>`;
      row.innerHTML += tableCell;
    } else {
      if ( this.value && this.value.startsWith('<') ){ // HTML Tag
        row.innerHTML += `<td class="value">${this.value}</td>`;
      } else {
        row.innerHTML += `<td class="value" contenteditable>${this.value || ''}</td>`;
      }
    }
    
    if ( del_td ) row.innerHTML += del_td;

    if (!this.rule_type) this.rule_type = 'equal';
    this._row = row;
    this.installCaseListeners( withRuleEditing );
    return row;
  }

  updateFields(){
    const allNewFields = this.getAllFields();
    const fieldsElement = this.row?.querySelector('.fields');
    if ( fieldsElement ){
      fieldsElement.innerHTML = allNewFields.map(field => field.toSpan()).join(', ');
    }
  }

  updateValuesInTables(){
    const oldFields = this.fields;
    const newFields = this.getAllFields();
    this.fields = newFields;
    const touchedPdfDocs = new Set();
    for (const field of newFields.concat(oldFields || [])) {
      const fieldPdfDoc = field.pdfDoc;
      touchedPdfDocs.add( fieldPdfDoc );
      for (const td of fieldPdfDoc?.fragment.querySelectorAll('.' + makeClassName(field.name))) {
        const value = Rule.DB.valueFromAllRulesOf(field);
        if ( value ) td.innerHTML = value || '';
      }
    }
    if ( config.autoupdate ) touchedPdfDocs.forEach( pdfDoc => { pdfDoc.applyTableToPDF(); } );
  }

  dragStart(){  // Dragged Source Element Handler
    return event => {
      document.body.style.cursor = "move";
      event.dataTransfer.effectAllowed = "move";
      // remember dragSource globally as class property
      Rule.dragSource = this;
      Rule.dragSourceNr = this.nr;
      console.assert( Rule.dragSource.nr === Rule.dragSourceNr );
    }
  }

  dragOver(){  // Drop Target Zone Handler
    return event => {
      event.preventDefault();  // default is to deny drag over
      event.dataTransfer.dropEffect = "move";
      // Rule.dragSource.nr = this.nr;
          // Rule.dragSourceNr >= this.nr || this.nr > Rule.DB.count() + 1 ? this.nr : this.nr + 1;
    }
  }

  drop(){  // Drop Target Zone Handler
    return event => {
      event.preventDefault();  // default is to deny drop ???
      if ( Rule.dragSourceNr !== this.nr ){
        const sourceRow = Rule.dragSource.row;
        const targetRow = this.row;
        const table = targetRow.parentElement;
        const thisNr = this.nr;
        if ( Rule.dragSourceNr > thisNr ){
          table.insertBefore(sourceRow,targetRow);
          let row = sourceRow;
          let rule;
          for ( let count = 0; count <= Rule.dragSourceNr - thisNr; count++ ){
            if ( row.id ) {
              rule = Rule.DB.getById(row.id);
              rule.nr = thisNr + count;
              row = row.nextElementSibling;
            }
          }
        } else {
          // insert after
          const ruleDragSourceNr = Rule.dragSourceNr;
          const nextRow = sourceRow.nextElementSibling;
          table.insertBefore(sourceRow,targetRow.nextElementSibling);
          let row = nextRow;
          let rule;
          for ( let count = 0; count <= thisNr - ruleDragSourceNr; count++ ){
            if ( row.id ) {
              rule = Rule.DB.getById(row.id);
              rule.nr = ruleDragSourceNr + count;
              row = row.nextElementSibling;
            }
          }
        }
      }
      document.body.style.cursor = "auto";
      Rule.DB.rebuild();
      saveInitialLists({silent:true});
      PdfDoc.updateAll();
    };
  }

  // removeRow(){
  //   const row = this.row;
  //   if ( confirm('Ganze Zeile löschen?') ) {
  //     row?.parentElement?.removeChild(row);
  //     Rule.DB.remove( this );
  //     Rule.DB.renumber( this.nr );
  //   }
  // }

  installListeners(){
    if ( this.isCaseRule() ) return this.installCaseListeners();
    const row = this.row;
    if (!this.rule_type) this.rule_type = 'substring'; // default

    row.addEventListener('dragstart', this.dragStart() );
    row.addEventListener('dragover', this.dragOver() );
    row.addEventListener('drop', this.drop() );

    const ruleElement = row.querySelector('.rule');
    const pdfElement = row.querySelector('.pdf');
    const selector = row.querySelector('.rule_type');
    const valueElement = row.querySelector('.value');
    const fieldsElement = row.querySelector('.fields');
    const delElement = row.querySelector('.delete');

    if ( delElement ) delElement.addEventListener( 'click', this.removeListener() );

    let thresholdCell = row.querySelector('.threshold'); // td cell
    if (!thresholdCell) {
      thresholdCell = document.createElement('td');
      // start HTML
      thresholdCell.innerHTML = `<input type="number" class="threshold" min="1" max="30" value="${this.threshold || 5}">`;
    } else {
      thresholdCell = thresholdCell.parentElement;
    }
    thresholdCell?.querySelector('input').addEventListener('change', event => {
      
      if (this.threshold !== thresholdCell.querySelector('input').value){
        this.threshold = thresholdCell.querySelector('input').value;
        fieldsElement.innerHTML = this.getAllFieldSpans();
        this.updateValuesInTables();
      }
    });
    selector?.addEventListener('change', event => {
      
      const selectedOption = selector.options[selector.selectedIndex].value;
      if (this.rule_type !== selectedOption){
        if ( selectedOption === 'delete' ){
          this.removeListener()( event );
        } else {
          this.rule_type = selectedOption;
          row.classList.add(this.rule_type);
          if (this.rule_type === 'similar') {
            if (!row.querySelector('.threshold')) {
              ruleElement.setAttribute('colspan', 1);
              row.insertBefore(thresholdCell, ruleElement);
              if (!this.threshold) this.threshold = 5;
            }
          } else if (row.querySelector('.threshold')) { // is in DOM
            row.removeChild(thresholdCell);
            ruleElement.setAttribute('colspan', 2);
          }
          if (fieldsElement) fieldsElement.innerHTML = this.getAllFieldSpans();
          this.updateValuesInTables();
        }
      }
    });
    ruleElement.addEventListener('blur', this.blurListener( 'rule' ).bind(this) );
    ruleElement.addEventListener('keydown', this.keyListener( 'rule' ).bind(this) );
    ruleElement.addEventListener('focus', this.focusListener( 'rule' ).bind(this) );

    valueElement.addEventListener('blur', this.blurListener( 'value' ).bind(this) );
    valueElement.addEventListener('keydown', this.keyListener( 'value' ).bind(this) );
    valueElement.addEventListener('focus', this.focusListener( 'value' ).bind(this) );

    if ( pdfElement ){
      pdfElement.addEventListener('blur', this.blurListener( 'pdf' ).bind(this) );
      pdfElement.addEventListener('keydown', this.keyListener( 'pdf' ).bind(this) );
      pdfElement.addEventListener('focus', this.focusListener( 'pdf' ).bind(this) );
    }
  }


  /**
   * @summary higher order function generating a focus event listener for Rule Table Entries
   * @param {String} category - is either 'rule' or 'value' or 'pdf'
   * @returns a focus listener
   */
  focusListener( category ){
    return event => {
      const row = this.row;
      Rule.lastActiveRow = row;
    };
  }
  /**
   * @summary higher order function generating a blur event listener for Rule Table Entries
   * @param {String} category - is either 'rule' or 'value' or 'pdf'
   * @returns a blur listener
   */
  blurListener( category ){
    return (function ( event ) {
      event.stopImmediatePropagation();
      const row = this.row;
      Rule.lastActiveRow = row;
      row.classList.remove('editing');
      const keyElement = row.querySelector('.'+category);
      if ( this[ category ] !== keyElement.innerText ){
        // change this rule
        this[ category ] = keyElement.innerText;
        // do not store case values
        if ( this.isCaseRule() && category === 'value' ) return; 
        // do not store empty rules
        if ( this.rule && this.rule !== 'neuer Wert' ){
          // change corresponding spec in config
          ProfileEditor.updateConfig( { newRule: this } );
          saveInitialLists({silent: true});
          PdfDoc.updateAll();
        }
      }
    }).bind( this );
  }

  /**
   * @summary higher order function generating a remove event listener for Rule Table Entries.
   *    In the PDFs the corresponding fields are not deleted. They are not set to the empty string.
   * @returns a remove listener
   */
  removeListener(){ 
    return event => {
      event.stopImmediatePropagation();
      const row = this.row;
      Rule.lastActiveRow = row;
      row?.classList?.remove('editing');
      this.value = "";
      for ( const field of this.getAllFields() ){
        field.value = ""; 
      }
      row?.parentElement?.removeChild(row);
      Rule.DB.remove(this);
      ProfileEditor.updateConfig( { oldRule: this } );
      saveInitialLists({silent: true});
      PdfDoc.updateAll();
    };
  }

  autocomplete( field ){
    for ( const key of Object.keys( config.autocompleteDict ) ){
      if ( field.innerText.endsWith( key ) ){
        const phrase = config.autocompleteDict[ key ];
        field.innerText = field.innerText.slice( 0, -key.length ) + phrase;
        return true;
      }
    }
    for ( const word of config.autocompleteList ){
      for ( let i = 0; i<word.length; i++ ){
        const wordBegin = word.slice(0,i+1);
        if ( field.innerText.endsWith( wordBegin ) ){
          field.innerText += word.slice( wordBegin.length );
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @summary keyboard event listener for Rule Table Entries
   * @param {String} category - is either 'rule' or 'value' or 'pdf'
   * @returns a KeyBoard Listener
   */
  keyListener( category ){
    return event => {
      const row = this.row;
      Rule.lastActiveRow = row;

      // process enter event for editing multiple lines
      if ( event.shiftKey && event.key === 'Enter' ) return true;

      // autocomplete only in value fields
      if ( event.key === config.autocompleteKey && category === 'value' ){
        const field = row.querySelector('.'+category);
        if ( this.autocomplete( field ) ){
          event.preventDefault(); // do not move cursor to next input field
          setSelection( field, field.childNodes.length );  // set cursor to the end
          return false; // stop event propagation
        }
      }

      // navigation keys
      if ( event.shiftKey || event.ctrlKey || event.altKey || event.metaKey ) return false;
      const nextRow = ['Enter','ArrowDown'].includes( event.key ) ? row.nextElementSibling : ['ArrowUp'].includes( event.key ) ? row.previousElementSibling : null;

      // plus button handler
      if ( nextRow && ! nextRow.querySelector('.plus') ){
        row.classList.remove('editing');
        const keyElement = row.querySelector('.'+category);
        keyElement.blur();
        const nextKeyElement = nextRow.querySelector('.'+category);
        if ( nextKeyElement ){
          nextRow.classList.add('editing');
          setSelection(nextKeyElement);
          Rule.lastActiveRow = nextRow;
        }
      }
    };
  }

  installCaseListeners( withRuleEditing ){
    console.assert( this.isCaseRule() || this.isTemplate() );
    const row = this.row;
    const ruleElement = row.querySelector('.rule');
    const valueElement = row.querySelector('.value');
    const delElement = row.querySelector('.del');
    if ( withRuleEditing ){
      ruleElement.addEventListener('blur', this.blurListener( 'rule' ).bind(this) );
      ruleElement.addEventListener('keydown', this.keyListener( 'rule' ).bind(this) );
      ruleElement.addEventListener('focus', this.focusListener( 'rule' ).bind(this) );
    }
    valueElement.addEventListener('blur', this.blurListener( 'value' ).bind(this) );
    valueElement.addEventListener('keydown', this.keyListener('value').bind(this) );
    valueElement.addEventListener('focus', this.focusListener( 'value' ).bind(this) );

    if ( delElement ) delElement.addEventListener( 'click',  this.removeListener() );

    // radio buttons and checkboxes
    if ( ! config.ignoreCheckboxes ) valueElement.addEventListener('click', event => {
      
      // Radio Button
      if ( event.target.constructor.name === 'HTMLInputElement' && event.target.type === 'radio'
        && this.value !== event.target.value ){  // value changed: another choice has been clicked
        this.rule = event.target.value;
        this._value = 'checked';
        PdfDoc.updateAll();
        
      } else if ( event.target.constructor.name === 'HTMLInputElement' && event.target.type === 'checkbox' ){
        // Checkbox
        if ( this.value === event.target.value ){
          this.rule = event.target.value;
          this._value = 'checked';
        } else {
          new Rule({rule_type:'equal', rule: event.target.value, value: 'checked', owner: 'case' });
        }
        PdfDoc.updateAll();
       }
    });
  }

  static fromRow(rowElement) { // read from HTML form
    const rule = new Rule({});
    const selector = rowElement.querySelector('.rule_type');
    rule.rule_type = selector.options[selector.selectedIndex].value;
    rule.rule = rowElement.querySelector('.rule').innerText;
    rule._value = rowElement.querySelector('.value').innerText;
    rule.fields = rowElement.querySelector('.fields').innerText; // is used
    rule.threshold = rowElement.querySelector('.threshold')?.innerText;
    return rule;
  }

  getAllFields() {
    const result = [];
    if (!this.rule) return '';
    for (const rulePart of this.rule.split(/\s*,\s*/m)) {  // Commas
      const subRule = rulePart.trim();
      if ( subRule ) for ( const pdfDoc of PdfDoc.all ){
        if ( this.pdf && ! pdfDoc.fileName.includes(this.pdf) ) continue;
        for (const field of pdfDoc.pdfIndex.values()) {
          switch (this.rule_type.toLowerCase()) {
            case 'equal':
              if (subRule === field.name) result.push(field);
              break;
            case 'substring':
              if (field.name.includes(subRule)) result.push(field);
              break;
            case 'date':
              if (field.name.includes(subRule)) result.push(field);
              break;
            case 'superstring':
              if (subRule.includes(field.name)) result.push(field);
              break;
            case 'similar':
              if (distance(subRule, field.norm()) < (this.threshold || 5)) result.push(field);
              break;
            case 'regex':
              let regex;
              try { regex = new RegExp(subRule) } catch (e) { break }
              if (regex && regex.test(field.name)) result.push(field);
              break;
            case 'formula':
              const value = SParser.seval( field.name, subRule );
              if ( value ) result.push( field );
              break;
            default:
              console.warn(`Unknown rule type`, this.rule_type);
              debugger;
          }
        }
      }
    }
    this.fields = result;
    return result;
  }

  getAllFieldSpans(){
    this.getAllFields();
    return this.fields ? this.fields.map(field => field.toSpan()).join(', ') : '';
  }
}

/* @type {RuleDataBase} for global access */
Rule.DB = new RuleDataBase();

if ( globalThis ){ // see https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/globalThis
  globalThis.DB = Rule.DB;  // for debugging purposes: access Rule Database in DevTools console via "DB"
}
