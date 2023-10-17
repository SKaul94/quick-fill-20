/**
 * @module ProfileEditor.js
 * @summary Rule Editor
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {config} from "./config.js";
import {Rule} from "./Rule.js";
import {setSelection} from "./global_functions.js";
import {fileOpen, fileSave, directoryOpen} from './FileOpener.js';
import {addSinglePDF, saveInitialLists} from "../index.js";
import {jsonStringifyWithFunctions} from './global_functions.js';
import * as Idb from './idb-keyval.js';


/**
 * Auxiliary classes for learnListener, see below
 */


/**
 * datastructure for triples of [pdf, field, value]
 */
class Triple {
  constructor(pdf, field, value) {
    if (pdf.constructor.name === 'PdfDoc'){
      this.pdf = pdf;
      this.field = field;
      this.value = value;
    } else {
      this.fromObject(pdf);
    }       
  }
  fromObject(params){
    this.pdf = params.pdf;
    this.field = params.field;
    this.value = params.value;
    return this;
  }
  toObject(){
    return { pdf: this.pdf, field: this.field, value: this.value };
  }
  equals(other){
    return this.pdf === other.pdf && this.field === other.field && this.value === other.value;
  }
  toString(){
    return `${this.pdf} ${this.field} ${this.value}`;
  }
  similarTo(other){ // ToDo cluster rules by similarity
    return this.pdf.match(other.pdf) && this.field.match(other.field);
  }
}

/**
 * datastructure for set of triples
 */
class SetOfTriples extends Set {
  constructor(){
    super();
    // datastructures to collect and access all triples efficiently
    this.mapValueToSetOfFieldNames = {};
    this.allValues = new Set();
  }
  add(triple) {
    super.add(triple);
    if ( ! triple instanceof Triple ) throw new Error('SetOfTriples.add: not a Triple');
    const { pdf, field, value } = triple;
    if (!this.mapValueToSetOfFieldNames[value]) this.mapValueToSetOfFieldNames[value] = new Set();
    this.mapValueToSetOfFieldNames[value].add(triple);
    this.allValues.add(value);
  }
  inferRules(){
    const generalRuleValues = Array.from(this.allValues).filter( value => this.mapValueToSetOfFieldNames[value].size >= config.ruleThreshold );
    for ( const value of generalRuleValues ){
      const specialTriples = Array.from(this).filter(triple => triple.value !== value && this.mapValueToSetOfFieldNames[value].has(triple.field));
      for ( const triple of specialTriples ){
        new Rule({rule_type: 'equal', rule: triple.field, value: triple.value, owner: this.owner, pdf: triple.pdf.split('.')[0]});
      }
      new Rule({rule_type: 'equal', 
        rule: Array.from(new Set(Array.from(this.mapValueToSetOfFieldNames[value]).map(triple => triple.field))).join(', '), 
        value, 
        owner: this.owner, 
        pdf: Array.from(new Set(Array.from(this.mapValueToSetOfFieldNames[value]).map(triple => triple.pdf.split('.')[0]))).join(', ')});
    }
  }
}

export class ProfileEditor  {
  constructor( {owner, root, title, plus_row} ) {
    this.owner = owner || name;
    this._root = ( typeof root === 'string' ) ? document.querySelector(`.${root} > .${owner}`) : root;
    this.rules_area = this._root.querySelector('.rules_area');
    this.title = title;
    this.plus_row = plus_row;
    ProfileEditor.all.push(this);

    /**
     * Listeners bind "this" to event.target. 
     * To re-bind this to the ProfileEditor instance, 
     * a workaround with "self = this" is needed.
     * Alternatively, use ".bind(this)", see this.installListeners.
     */
    const self = this;
    this.clearListener = event => self.clear();
    this.prefillListener = function( event ) { self.prefill(); }
  }

  get root(){
    return this._root;
  }

  clear(){
    const plus_row = this.plusButtonRow();
    const hide = plus_row.classList.contains( 'hide' );
    if ( plus_row && ! hide ){
      Rule.DB.removeAll(rule => rule.owner === this.owner );
      for ( const row of this.rules_area.querySelectorAll('tbody tr.row') ) { 
        row.parentElement?.removeChild( row );
      }
    }
  }

  save(){  // ToDo identical to Rule.DB.store(). Duplicate method?
    config.initialRulesList = Rule.DB.toInitialRulesList();
    Idb.set( config.configIdentifier, jsonStringifyWithFunctions( config ) );
  }

  prefill(){
    for ( const rule of Rule.DB.sortedRules() ) {
      if ( rule.owner !== this.owner ) continue;
      rule.value = 'My' + rule.rule;
    }
  }

  plusButtonRow(){
    const plus_row = this.root.querySelector('.plus_row');
    return plus_row;
  }

  displayOwnRules(){
    this.update();
    // const tbody = this.rules_area.querySelector('tbody');
    // for ( const rule of this.allRules() ) {
    //   // if ( rule.person ) continue; // do not show personal rules
    //   if ( tbody.querySelector('#'+rule.id()) || tbody.contains( rule.row ) ) { // avoid duplicate rows
    //     // already exist
    //   } else { // row does not exist within this table
    //     if ( ! rule.row ) rule.makeRow();
    //     tbody.insertBefore( rule.row, this.plusButtonRow() );
    //     rule.installListeners();
    //   }
    //   // ToDo always update relevant fields
    //   // if ( rule.rule === 'Vorgangsnummer' && rule.owner === 'case' ) debugger;
    //   if ( rule.row.querySelector('.value').innerText.length === 0 ){
    //     rule.value = Rule.DB.valueFromAllRulesOf( '${' + rule.rule + '}$' ) || '';
    //   }
    //   const fields = rule.row.querySelector('.fields');
    //   if ( fields ) fields.innerHTML = rule.getAllFieldSpans();
    // }
  }

  allRules(){
    return Rule.DB.filter( rule => rule.owner === this.owner );
  }

  templateId(){
    return 'rules_template';
  }

  static updateConfig( { newRule, oldRule } ){
    for ( const profileEditor of ProfileEditor.all ) {
      switch ( profileEditor.owner ){
        case 'template': 
          config.initialTemplateList = profileEditor.allRuleSpecs();
          break;
        case 'textblock':
          config.autocompleteDict = profileEditor.allRuleSpecs();
          break;
        case 'case': 
          // do not store case values (sensitive information)
          // do store rules only
          if ( newRule ){
            console.assert( newRule.rule );
            if ( ! config.caseRules.includes( newRule.rule ) ) config.caseRules.push( newRule.rule );
          }
          if ( oldRule ){
            console.assert( oldRule.rule );
            // in-place removal
            const index = config.caseRules.indexOf(oldRule.rule);
            if ( index >= 0 ) config.caseRules.splice(index,1);
          }
          break;
        default:
          config.initialRulesList[ profileEditor.owner ] = profileEditor.allRuleSpecs();   
      }
    }
  }

  allRuleSpecs(){
    const ruleSpecs = [];
    for ( const row of this.rules_area.querySelectorAll('tbody tr.row') ) { // skip header and footer
      const rule = Rule.DB.getById( row.id );
      ruleSpecs.push( rule.toJSON() );
    }
    return ruleSpecs;
  }

  rowToSpec( row ){
    const spec = {};
    for ( const td of row.querySelectorAll( 'td' ) ){
      spec[ td.classList[0] ] = td.innerText;
    }
    return spec;
  }

  evalListener( event ){
    Rule.DB.forEach( rule => {
      if ( rule.owner === this.owner &&rule.value && rule.value.match(/(\${.+?}\$)/g) ){
        rule.value = Rule.DB.maxReplaced( rule.value );
        rule.row.querySelector('.value').innerText = rule.value;
      } 
    });
  }

  async importListener( event ) {
    event.stopPropagation();
    const fileHandles = await fileOpen( {
      // List of allowed MIME types, defaults to `*/*`.
      mimeTypes: ['application/json'],
      // List of allowed file extensions (with leading '.'), defaults to `''`.
      extensions: [ '.json' ],
      // Set to `true` for allowing multiple files, defaults to `false`.
      multiple: true,
      // Textual description for file dialog , defaults to `''`.
      description: 'Rules',
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: 'Rules',
      // Include an option to not apply any filter in the file picker, defaults to `false`.
      excludeAcceptAllOption: false,
    } );
    for (const fileHandle of fileHandles) {
      await Rule.DB.addRulesFromJSONFile(fileHandle, this.owner);
    }
    Rule.DB.displayAllRules(this.owner);
  };

  async exportListener( event ){
    event.stopPropagation();
      const json = JSON.stringify( JSON.parse( Rule.DB.toJSON( rule => rule.owner === this.owner ) ), null, 2 );
      const blob = new Blob([json], {type: "application/json"});
      await fileSave( blob, {
        // Suggested file name to use, defaults to `''`.
        fileName: 'Rules.json',
        // Suggested file extensions (with leading '.'), defaults to `''`.
        extensions: ['.json'],
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: 'Rules',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
      });
  }

  async learnListener( event ) {

    event.stopPropagation();
    const dirHandle = await directoryOpen({
      // Set to `true` to recursively open files in all subdirectories,
      // defaults to `false`.
      recursive: true,
      // Suggested directory in which the file picker opens. A well-known directory or a file handle.
      startIn: 'downloads',
      // By specifying an ID, the user agent can remember different directories for different IDs.
      id: 'Tatbestand',
      // Callback to determine whether a directory should be entered, return `true` to skip.
      skipDirectory: (dir) => dir.name.startsWith('.'), // skip hidden directories
    });

    // In Mozilla PDF.js the PDF has to be visible
    document.querySelector('.all_results').classList.remove('hide');  
    await learnRulesFromMultiplePDFs(dirHandle.filter(file=>!file.name.startsWith('.')));
    this.displayOwnRules();
    await new Promise( resolve => setTimeout( resolve, 3000 ) ); // ToDo replace by event
    document.querySelector('.all_results').classList.add('hide');

    async function learnRulesFromMultiplePDFs(dirEntries) {

      const allTriples = new SetOfTriples();

      // build efficient datastructure to cluster triples
      for await (const entry of dirEntries) {
        if (! entry instanceof File && entry.kind !== 'file') continue;
        // read file and make PdfDoc
        const pdfDoc = await addSinglePDF({ entry });
        
        for ( const field of pdfDoc.getFields() ) {
          if (!field.typ) continue;
          if (config.ignoreFields.includes(field.name)) continue;
          const value = field.valueFromPDF();
          if (!value) continue;
          if (config.checkboxOffValues.includes(value)) continue;
          const triple = new Triple({ pdf: pdfDoc.fileName, field: field.name, value });
          allTriples.add(triple);
        }
        pdfDoc.delete();
      }

      // infer rules from the given examples and store them into the rule database
      allTriples.inferRules();
    }
  }

  async plusListener( event ) {
    const newRule = new Rule({ rule_type: 'equal', rule: 'neuer Wert', owner: this.owner });
    const newRow = newRule.makeRow();
    this.root.querySelector('tbody').insertBefore(newRow, this.plusButtonRow() );
    setSelection(newRow);
    newRule.installListeners();
    // do not save case infos, might be sensitive
    if ( ! newRule.isCaseRule() ) saveInitialLists({silent: true});
  }

  render(){
    const ruleTemplate = document.getElementById( this.templateId() );
    const ruleFragment = document.createElement('div');
    ruleFragment.innerHTML = ruleTemplate.innerHTML;
    this.rules_area.appendChild(ruleFragment);
    this.root.querySelector('.title').innerText = this.title;

    this.displayOwnRules();
    this.addEventListeners();

    if ( this.plus_row ) this.root.querySelector('.plus_row').classList.remove('hide');
  }

  addEventListeners(){
    this.root.querySelector('.clear' )?.addEventListener('click', this.clearListener.bind(this) );
    this.root.querySelector('.import' )?.addEventListener('click', this.importListener.bind(this) );
    this.root.querySelector('.export' )?.addEventListener('click', this.exportListener.bind(this) );
    this.root.querySelector('.learn' )?.addEventListener('click', this.learnListener.bind(this) );
    this.root.querySelector('.prefill' )?.addEventListener('click', this.prefillListener.bind(this) );
    this.root.querySelector('.eval' )?.addEventListener('click', this.evalListener.bind(this) );
    this.root.querySelector('button.plus')?.addEventListener('click', this.plusListener.bind(this) );
  }

  update(){
    const tbody = this.rules_area.querySelector('tbody');
    for ( const rule of this.allRules() ){
      let row = rule.row;
      if ( ! row ){
        row = rule.makeRow();
        tbody.insertBefore( row, this.plusButtonRow() );
        rule.installListeners();
      }     
    }
    if ( this.owner === 'case' ){
      this.updateValues();
    } 
  }

  updateValues(){
    for ( const rule of this.allRules() ){
      let row = rule.row;
      const valueField = row.querySelector('.value');
      const computedValue = Rule.DB.valueFromAllRulesOf( '${' + rule.rule + '}$' );
      if ( computedValue ){
        valueField.innerText = computedValue;
        rule.value = computedValue;
      }
    }
  }

}

ProfileEditor.all = [];
