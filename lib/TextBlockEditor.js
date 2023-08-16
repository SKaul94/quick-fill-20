/**
 * @module TextBlockEditor.js
 * @summary Textblock Editor
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {ProfileEditor} from "./ProfileEditor.js";
import {setSelection} from "./global_functions.js";
import {config} from './config.js';
import {fileOpen, fileSave} from './FileOpener.js';

export class TextBlockEditor extends ProfileEditor {
  constructor( {root, title, plus_row} ) {
    const storedAutocompleteDict = localStorage.getItem( config.autocompleteIdentifier );
    if ( storedAutocompleteDict ){
      config.autocompleteDict = JSON.parse( storedAutocompleteDict );
    }
    super( {name: 'textblock', root, title, plus_row} );
  }

  displayOwnRules(){
    const tbody = this.rules_area.querySelector('tbody');
    for ( const [ shortcut, textblock ] of Object.entries( config.autocompleteDict ) ){
      const newRow = this.makeRow( shortcut, textblock );
      tbody.insertBefore( newRow, this.plusButtonRow() );
    }
  }

  makeRow( shortcut, textblock ){
    const row = document.createElement('tr');
    row.classList.add('row');
    row.innerHTML = `<td class="shortcut" contenteditable>${shortcut}</td><td class="textblock" contenteditable>${textblock}</td>`+
      // delete botton per row  
    `<td class="delete"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
      <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg></td>`;

    for ( const input of row.querySelectorAll('[contenteditable]') ){
      input.addEventListener('blur', event => {
        // nothing to do if empty shortcut or textblock
        if ( ! row.querySelector('.shortcut').innerText ) return false;
        if ( ! row.querySelector('.textblock').innerText ) return false;

        // Functional approach:
        // autocompleteDict is a function of the displayed table entries in the web view
        config.autocompleteDict = Object.fromEntries( Array.from( this.root.querySelectorAll('.shortcut') )
          .filter( el => el.innerText && el.nextElementSibling.innerText )
          .map( el => [ el.innerText, el.nextElementSibling.innerText ] ) );

        this.save();
      });
    }
    row.querySelector('.delete')?.addEventListener('click', event => {
      event.stopPropagation();
      if ( confirm( "Diesen Textbaustein löschen?" ) ){
        delete config.autocompleteDict[ row.querySelector('.shortcut').innerText ];
        row.remove();      
        this.save();
      }
    });
    return row;
  }

  save(){
    localStorage.setItem( config.autocompleteIdentifier, JSON.stringify( config.autocompleteDict ) );
  }

  addEventListeners(){
    this.root.querySelector('.clear')?.addEventListener('click', event => {
      if ( confirm( "Alle Textbausteine löschen?" ) ){
        this.removeAll();
      }
    });
    this.root.querySelector('.import')?.addEventListener('click', async event => {
      const fileHandle = await fileOpen( {
        // List of allowed MIME types, defaults to `*/*`.
        mimeTypes: ['application/json'],
        // List of allowed file extensions (with leading '.'), defaults to `''`.
        extensions: [ '.json' ],
        // Set to `true` for allowing multiple files, defaults to `false`.
        multiple: false,
        // Textual description for file dialog , defaults to `''`.
        description: 'Textbausteine',
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: 'Textbausteine',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
      } );
      const newRules = JSON.parse( await fileHandle.text() );
      if ( confirm( "Zu den alten Textbausteinen hinzufügen?" ) ){
        for ( const [ shortcut, textblock ] of Object.entries( newRules ) ){
          config.autocompleteDict[ shortcut ] = textblock;
        }
      } else {
        config.autocompleteDict = newRules;
      }
      this.save();
      this.rules_area.innerHTML = ''; // delete old
      this.render( true );   // render new with plus row
    });
    this.root.querySelector('.export')?.addEventListener('click', async event => {
      const json = JSON.stringify( config.autocompleteDict );
      const blob = new Blob([json], {type: "application/json"});
      await fileSave( blob, {
        // Suggested file name to use, defaults to `''`.
        fileName: 'Textbausteine.json',
        // Suggested file extensions (with leading '.'), defaults to `''`.
        extensions: ['.json'],
        // Suggested directory in which the file picker opens. A well-known directory or a file handle.
        startIn: 'downloads',
        // By specifying an ID, the user agent can remember different directories for different IDs.
        id: 'Textbausteine',
        // Include an option to not apply any filter in the file picker, defaults to `false`.
        excludeAcceptAllOption: false,
      });
    });
  }

  templateId(){
    return 'textblock_template';
  }

  plusListener() {
    const self = this;
    return (event) => {
      event.stopPropagation();
      const newRow = this.makeRow( '', '' );
      self.root.querySelector('tbody').insertBefore( newRow, self.plusButtonRow() );
      setSelection( newRow );
    }
  }

  removeAll( filterPredicate ){
    if ( ! filterPredicate ) filterPredicate = () => true;
    const rows = this.root.querySelectorAll('tbody tr.row');
    for ( const row of rows ){
      if ( filterPredicate( row ) ) row.remove();
    }
    config.autocompleteDict = {};
    localStorage.setItem( config.autocompleteIdentifier, JSON.stringify( config.autocompleteDict ) );
  }

}
