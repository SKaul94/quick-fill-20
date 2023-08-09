/**
 * @module ProfileEditor.js
 * @summary Rule Editor
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */

import {Rule} from "./Rule.js";
import {setSelection} from "./global_functions.js";
import {fileOpen, fileSave, directoryOpen} from './FileOpener.js';
import {config} from "./config.js";
// import {PDFDocument} from "../node_modules/pdf-lib/dist/pdf-lib.esm.js";
// import {PDFDocument} from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm";
// Problem with PDF-LIB is its disability to read compressed PDFs 
// causing "Error: Unknown compression method in flate stream"

export class ProfileEditor  {
  constructor( {name, root, title, plus_row} ) {
    this.name = name;
    this._root = document.querySelector(`.${root} > .${name}`);
    this.rules_area = this._root.querySelector('.rules_area');
    this.title = title;
    this.render( plus_row );
  }

  get root(){
    return this._root;
  }

  clear(){
    // for ( const ruleTable of this.root.querySelectorAll('.rule_table') ){
    //   for ( const row of ruleTable.querySelectorAll('tr') ){
    //     if ( row.querySelector('th') ) continue;
    //     if ( row.querySelector('button') ) continue;
    //     ruleTable.firstElementChild.removeChild( row );  // tbody
    //   }
    // }
    Rule.DB.removeAll(rule => rule.owner === this.name );
  }

  prefill(){
    for ( const rule of Rule.DB.sortedRules() ) {
      if ( rule.owner !== this.name ) continue;
      rule.value = 'My' + rule.rule;
    }
    Rule.DB.store();
  }

  plusButtonRow(){
    return this.root.querySelector('.plus_row');
  }

  displayOwnRules(){
    const tbody = this.rules_area.querySelector('tbody');
    for ( const rule of Rule.DB.sortedRules() ) {
      if ( rule.owner !== this.name ) continue; // separate ProfileEditor for every owner
      if ( tbody.querySelector('#'+rule.id()) || tbody.contains( rule.row ) ) { // avoid duplicate rows
        // already exist
      } else { // row does not exist within this table
        if ( ! rule.row ) rule.makeRow();
        tbody.insertBefore( rule.row, this.plusButtonRow() );
        rule.installListeners();
      }
      // ToDo always update relevant fields
      // if ( rule.rule === 'Vorgangsnummer' && rule.owner === 'case' ) debugger;
      if ( rule.row.querySelector('.value').innerText.length === 0 ){
        rule.value = Rule.DB.valueFromAllRulesOf( '${' + rule.rule + '}$' ) || '';
      }
      const fields = rule.row.querySelector('.fields');
      if ( fields ) fields.innerHTML = rule.getAllFieldSpans();
    }
  }

  templateId(){
    return 'rules_template';
  }

  clearListener(){
    const self = this;
    return ( event ) => {
      self.clear();
    }
  }

  prefillListener(){
    const self = this;
    return ( event ) => {
      self.prefill();
    }
  }

  importListener() {
    const self = this;
    return async ( event ) => {
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
        await Rule.DB.addRulesFromJSONFile(fileHandle, self.name);
      }
      Rule.DB.displayAllRules(self.name);
    }
  };

  exportListener(){
    const self = this;
    return async ( event )  => {
      event.stopPropagation();
      const json = JSON.stringify( JSON.parse( Rule.DB.toJSON( rule => rule.owner === self.name ) ), null, 2 );
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
  }

  learnListener() {
    const self = this;
    return async (event) => {
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
        skipDirectory: (entry) => entry.name[0] === '.',
      });

      learnRulesFromMultiplePDFs(dirHandle.values());

      const self = this;
      async function learnRulesFromMultiplePDFs(dirEntries) {
        const fieldIndex = {};
        // build fieldIndex by inverting field - value mapping
        for await (const entry of dirEntries) {
          // read file and make PdfDoc
          const pdfDoc = await self.addSinglePDF({entry, preview: false});
          const pdfForm = pdfDoc.getForm();
          for ( const field of pdfForm.getFields() ) {
            const value = field.getText ? field.getText() : '';
            if (!value) continue;
            if (config.ignoreFields.includes(field.getName())) continue;
            if (!fieldIndex[value]) fieldIndex[value] = new Set();
            fieldIndex[value].add(field.getName());
          }
        }
        // insert rules
        for (const [value, fieldNames] of Object.entries(fieldIndex)) {
          // ToDo try to unify fields, e.g. via substring ...  any higher order aggregation of rules

          // create rules from collected fields and values
          new Rule({rule_type: 'equal', rule: Array.from(fieldNames).join(', '), value, owner: self.name});
        }
        self.displayOwnRules();
        Rule.DB.store();
      }
    }
  }

  async addSinglePDF( params ){
    const { entry, preview } = params;
    if (!entry.name.endsWith('.pdf')) return;
    let oldFileName, formBytes, pdfDocumentInstance;
    const file = entry instanceof File ? entry : await entry.getFile();
    oldFileName = file.name;
    // Load the PDF with form fields, see https://pdf-lib.js.org/docs/api/classes/pdfdocument
    formBytes = await file.arrayBuffer();
    try {
      pdfDocumentInstance = await PDFDocument.load(formBytes, {
        throwOnInvalidObject: true,
        updateMetadata: true,
        // ignoreEncryption: true,
        parseSpeed: 100
      }).catch(error => {
        console.log(error);
        const errorElement = document.querySelector('.error');
        errorElement.innerHTML = `<p class="error-message">
          PDF muss vorher mit <a href="http://qpdf.sourceforge.net">qpdf</a> decrypted werden: 
          <code>qpdf --decrypt infile.pdf outfile.pdf</code>
        </p><p>oder öffnen Sie PDFs aus dem QPDF-Verzeichnis.</p>`;
        errorElement.classList.remove('hide');
      })
    } catch (e) {
      console.log('Skipped ' + oldFileName + e);
      return;
    }
    return pdfDocumentInstance;
  }

  plusListener() {
    const self = this;
    return async (event) => {
      event.stopPropagation();
      const newRule = new Rule({ rule_type: 'equal', owner: self.name });
      const newRow = newRule.toRow();
      self.root.querySelector('tbody').insertBefore(newRow, self.plusButtonRow() );
      setSelection(newRow);
      newRule.installListeners();
    }
  }

  render( plus_row ){
    const ruleTemplate = document.getElementById( this.templateId() );
    const ruleFragment = document.createElement('div');
    ruleFragment.innerHTML = ruleTemplate.innerHTML;
    this.rules_area.appendChild(ruleFragment);
    this.root.querySelector('.title').innerText = this.title;

    this.displayOwnRules();
    this.addEventListeners();

    if ( plus_row ) this.root.querySelector('.plus_row').classList.remove('hide');
    this.rules_area.querySelector('button.plus')?.addEventListener('click', this.plusListener() );
  }

  addEventListeners(){
    this.root.querySelector('.clear' )?.addEventListener('click', this.clearListener() );
    this.root.querySelector('.import' )?.addEventListener('click', this.importListener() );
    this.root.querySelector('.export' )?.addEventListener('click', this.exportListener() );
    this.root.querySelector('.learn' )?.addEventListener('click', this.learnListener() );
    this.root.querySelector('.prefill' )?.addEventListener('click', this.prefillListener() );
    this.root.querySelector('.eval' )?.addEventListener('click', this.evalListener() );
  }

  update(){
    // ToDo insert new values
    // for ( const rule of Rule.DB.sortedRules().filter( rule => rule.owner === this.name ) ) {
    //   if ( ! rule.value ){
    //     rule.value = Rule.DB.valueFromAllRulesOf( '${' + rule.rule + '}$' );  // ToDo
    //   }
    // }
    // update display
    this.displayOwnRules();
  }

}
