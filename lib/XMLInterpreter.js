/**
 * @module XMLInterpreter.js
 * @summary import XML and interpret it
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {Person} from './Person.js';
import {fileOpen} from './FileOpener.js';
import {Rule} from './Rule.js';
import * as Idb from './idb-keyval.js';

export class XMLInterpreter {
    constructor( button, htmlSpace ) {
        this.button = button;
        this.htmlSpace = htmlSpace;
        this.xml = '';
    }

    static async allLanguages(){
        return Array.from( new Set( (await Idb.keys()).map( key => key.split('_')[1] ) ) );
    }

    async interpret( event ){
        event.stopImmediatePropagation();
        this.button.disabled = true;

        this.menu = this.htmlSpace.querySelector('ul.menu');
        
        // https://wicg.github.io/file-system-access/#api-showopenfilepicker
        const xmlFileHandles = await fileOpen( {
            // List of allowed MIME types, defaults to `*/*`.
            mimeTypes: ['application/xml'],
            // List of allowed file extensions (with leading '.'), defaults to `''`.
            extensions: [ '.xml', '.txt' ],
            // Set to `true` for allowing multiple files, defaults to `false`.
            multiple: true,
            // Textual description for file dialog , defaults to `''`.
            description: 'XML-Daten',
            // Suggested directory in which the file picker opens. A well-known directory or a file handle.
            startIn: 'downloads',
            // By specifying an ID, the user agent can remember different directories for different IDs.
            id: 'XML',
            // Include an option to not apply any filter in the file picker, defaults to `false`.
            excludeAcceptAllOption: false,
        } );
        for ( const fileHandle of xmlFileHandles ) {
            this.xmlFile = fileHandle instanceof File ? fileHandle : await fileHandle.getFile();
            this.xmlFilename = this.xmlFile.name;
            this.xml += (await this.xmlFile.text()).trim();
        }

        try {
            this.xmlDOM = new DOMParser().parseFromString(this.xml, 'application/xml');
        } catch (e) {
            console.error(e);
            alert(e);
            this.xmlDOM = null;
        }

        if ( this.xmlDOM ){
            // find all terminal nodes in XML DOM
            const terminalNodes = {};
            const duplicates = new Set();
            this.xmlFieldLongNameMap = new Map();
            this.xmlLongNameXmlField = new Map(); // inverse Map
            let nr = 0;

            this.allPersons = Array.from( this.xmlDOM.querySelectorAll( ':root objekte > personalie' ));

            // iterate over different persons and mark elements belonging to persons
            if ( this.allPersons ) for ( const personalXMLElement of this.allPersons ){
                nr += 1;
                const person = new Person(nr, personalXMLElement);

                const treeWalker = this.xmlDOM.createTreeWalker(
                    personalXMLElement,
                    NodeFilter.SHOW_ELEMENT,
                );

                // mark all descendant elements in XML tree structure
                // belonging to the current person
                for ( const element of nextElement() ){
                    element.person = person;
                }          
            
                function *nextElement(){
                    let next = treeWalker.nextNode();
                    while ( next ){
                        yield next;
                        next = treeWalker.nextNode();
                    }
                }
            }

            // fill Map with case rules for all persons
            for ( const xmlField of this.xmlDOM.querySelectorAll( ':only-child *' ) ){
                // Terminal XML Element with content
                if ( xmlField.childElementCount === 0 && xmlField.textContent ){  
                    let xmlLongName = this.longName( xmlField );
                    if ( terminalNodes[ xmlLongName ] ){
                      terminalNodes[ xmlLongName ] += 1;
                      duplicates.add(xmlLongName);
                      xmlLongName += `.${terminalNodes[ xmlLongName ]}`;
                    } else {
                      terminalNodes[ xmlLongName ] = 1;
                    }
                    this.xmlFieldLongNameMap.set(xmlField, xmlLongName);
                    this.xmlLongNameXmlField.set(xmlLongName, xmlField);
                }
            } 

            // rename first duplicate
            for ( const xmlLongName of duplicates ){
                const xmlField = this.xmlLongNameXmlField.get(xmlLongName);
                this.xmlFieldLongNameMap.set(xmlField, `${this.xmlFieldLongNameMap.get(xmlField)}.1` );
            }

            // add general case rules
            for ( const [xmlField, xmlLongName] of this.xmlFieldLongNameMap.entries() ){
                if ( ! xmlField.person ){
                    this.addRuleFor( xmlField, xmlLongName ); 
                    for ( const key of Object.keys( config.xmlKeyValuePairs ) ){
                        if ( xmlField.textContent === key ){
                            const textContent = xmlField.nextElementSibling.textContent;
                            this.addRuleFor( { textContent }, config.xmlKeyValuePairs[key] ); 
                        }
                    
                    }
                }
            }

            // iterate over all persons
            nr = 0;
            if ( this.allPersons ) for ( const personalXMLElement of this.allPersons ){
                nr += 1;
                const person = Person.getPersonFromNr(nr);
                const menuNode = document.createElement('li');
                menuNode.innerText = person.name;
                menuNode.href = '#';
                menuNode.addEventListener('click', event => {
                    event.preventDefault();
                    menuNode.parentNode.querySelectorAll('li').forEach( li => li.classList.remove('active') );
                    menuNode.classList.add('active');
                    this.htmlSpace.querySelectorAll('.selected_content').forEach( selected_content => selected_content.classList.add('hidden') );
                    this.htmlSpace.querySelector('#selected_content_'+ person.nr).classList.remove('hidden');
                });
                this.menu.appendChild( menuNode );           

                this.switchPersonalRules( person );

                const language = document.getElementById('language_selector')?.value || 'englisch';
                let pdfDoc = await this.makePdf( person, language );

                pdfDoc.htmlSpace.querySelector('select.language_selector')?.addEventListener('change', eventListener);
                pdfDoc.htmlSpace.classList.add('hidden');

                const self = this;
                async function eventListener( event ){
                    pdfDoc.remove();
                    const language = event.target.value;
                    self.switchPersonalRules( person );
                    pdfDoc = await self.makePdf( person, language ); 
                    const pdfFileKey = self.pdfFileKey( pdfDoc.htmlSpace, person );
                    const personal_language_selector = pdfDoc.htmlSpace.querySelector('select.language_selector');
                    personal_language_selector.value = language;
                    personal_language_selector.addEventListener('change', eventListener );
                    pdfDoc.htmlSpace.querySelector('.filename').innerText = pdfFileKey;
                }
            }

            this.button.removeAttribute('disabled');
        }
    }

    switchPersonalRules( person ){
        // clear old personal case rules before importing from XML data
        Rule.DB.forEach( rule => {
            if ( rule.owner === 'case' && rule.person ) rule.remove();
        });

        // add rules generated by XML data
        for ( const key of Object.keys( config.xmlPersonalRules ) ){
            const personalRule = config.xmlPersonalRules[key];
            this.addRuleFor( person.data[key], personalRule, person.name ); 
        }
     
        // add rules from Map for this person
        for ( const [xmlField, xmlLongName] of this.xmlFieldLongNameMap.entries() ){
            if ( xmlField.person && xmlField.person === person ){
                this.addRuleFor( xmlField, xmlLongName, person.name );  // include all XML data of this person
                for ( const key of Object.keys( config.xmlKeyValuePairs ) ){
                    if ( xmlField.textContent === key ){
                        const textContent = xmlField.nextElementSibling.textContent;
                        this.addRuleFor( { textContent }, config.xmlKeyValuePairs[key], person.name ); 
                    }
                
                }
            }   
        }
    }

    async fillLanguageSelectorWithOptions( languageSelector ){
        languageSelector.innerHTML = '<option value="">--Andere Sprache wählen:--</option>';
        for ( const language of await this.constructor.allLanguages() ){
            const option = document.createElement('option');
            option.value = language;
            option.innerText = language;
            languageSelector.appendChild( option );
        }
    }

    async makePdf( person, language ){
        const selected_content = PdfDoc.createHTMLSpace();

        // add personal language selector
        const personal_language_selector = selected_content.querySelector('select.language_selector');
        personal_language_selector.id = 'language_selector_' + person.nr;
        const personal_language_selector_label = selected_content.querySelector('label.language_selector_label');
        personal_language_selector_label.setAttribute('for', personal_language_selector.id);
        this.fillLanguageSelectorWithOptions( personal_language_selector );
        personal_language_selector.classList.remove('hide');
        personal_language_selector_label.classList.remove('hide');
        
        selected_content.classList.add('selected_content');
        selected_content.id = 'selected_content_' + person.nr;
        selected_content.querySelector('.person').innerText = person.name;
        this.htmlSpace.appendChild( selected_content );

        const pdfFileKey = this.pdfFileKey( selected_content, person );

        return await this.appendPdf( pdfFileKey, selected_content, person );
    }

    /**
     * @summary returns key for accessing the correct PDF file from IndexedDB
     * @param {HTMLElement} selected_content - HTML element that contains the PDF
     * @param {Person} person - person for which the PDF is generated
     * @returns key for accessing the correct PDF file from IndexedDB
     */
    pdfFileKey( selected_content, person ){
        const kindOfPDF = person.isMinor() ? 'unbegleitete' : 'asylgesuch';
        const language_selector = document.getElementById('language_selector');
        const personal_language_selector = selected_content.querySelector('select.language_selector');
        let language = personal_language_selector.value || language_selector.value || localStorage.getItem('quickfill_xml_language') || 'englisch'; 
        localStorage.setItem('quickfill_xml_language', language);
        return kindOfPDF + '_' + language;
    }

    async appendPdf( pdfFileKey, selected_content, person ){
        // create PDF from binary
        const pdfDoc = new PdfDoc( {name: pdfFileKey}, selected_content );

        // fill PDF with data from XML and show in div.selected_content
        let pdfBinary = await Idb.get( pdfFileKey );
        if ( pdfBinary ){
            selected_content.querySelector('.filename').innerText = pdfFileKey;
            await pdfDoc.renderArrayBuffer( pdfBinary );
            pdfDoc.applyRulesToTable( person.name ); // ToDo personalized rules
        } else {
            alert( `Bitte vorher passendes PDF für ${pdfFileKey} laden` );
        } 
        // start viewer with first page
        pdfDoc.scrollPageIntoView({ pageNumber: 1 });
        await pdfDoc.pageReady( 1 );
        pdfDoc.applyTableToPDF();

        return pdfDoc;
    }

    longName( xmlElement ){
        const listOfXMLElements = [ xmlElement ];
        let parent = xmlElement.parentElement;
        while ( parent ){
          listOfXMLElements.push( parent );
          parent = parent.parentElement;
        }
        for ( let i=0; i<config.cutXMLPrefix; i++){  // shorten XML LongName by cutting prefix
          listOfXMLElements.pop();
        }
        return listOfXMLElements.reverse().map( element => element.localName ).join('.');
    }

    addRuleFor( xmlField, xmlLongName, person ){
        // add new case rule to Rule.DB and append new row to case table
        const xmlData = xmlField.textContent ? xmlField.textContent : xmlField;
        const rule = xmlLongName;
        const oldRule = Rule.DB.getRuleByKey( rule );
        if ( oldRule ){
          oldRule.value = xmlData;
          return oldRule;
        }
        if ( xmlData && xmlData.length > 0 && ! config.ignoreXMLFields.includes( rule ) ){
          return new Rule({rule, value: xmlData, rule_type: 'superstring', owner: 'case', person });
        }
    }
}
