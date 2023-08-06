/**
 * @module TextBlockEditor.js
 * @summary Textblock Editor
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
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
    row.innerHTML = `<td class="shortcut" contenteditable>${shortcut}</td><td class="textblock" contenteditable>${textblock}</td>`;
    let oldShortcut = shortcut;
    for ( const input of row.querySelectorAll('td') ){
      input.addEventListener('blur', event => {
        const newShortcut = row.querySelector('.shortcut').innerText;
        const newTextblock = row.querySelector('.textblock').innerText;
        if ( newShortcut !== oldShortcut ){
          delete config.autocompleteDict[ oldShortcut ]
        }
        oldShortcut = newShortcut;
        config.autocompleteDict[ newShortcut ] = newTextblock;
        this.save();
      });
    }
    return row;
  }

  save(){
    localStorage.setItem( config.autocompleteIdentifier, JSON.stringify( config.autocompleteDict ) );
  }

  addEventListeners(){
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

}
