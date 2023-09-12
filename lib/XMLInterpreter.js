/**
 * @module XMLInterpreter.js
 * @summary import XML and interpret it
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {fileOpen, fileSave} from './FileOpener.js';
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
            const xmlFieldLongNameMap = new Map();
            const xmlLongNameXmlField = new Map(); // inverse Map
            let nr = 0;

            this.allPersons = Array.from( this.xmlDOM.querySelectorAll( ':root objekte > personalie' ));

            // iterate over different persons
            if ( this.allPersons ) for ( const person of this.allPersons ){
                nr += 1;
                const uniquePersonNumber = nr;
                const xmlPersonalData = {};
                for ( const key of Object.keys( config.xmlPersonalRules ) ){
                    xmlPersonalData[ key ] = person.querySelector( key )?.textContent?.trim();
                    if ( xmlPersonalData[ key ].includes('_') ) xmlPersonalData[ key ] = person.querySelector( key + ' name' )?.textContent?.trim();;
                }
                
                const vorname = person.querySelector('vorname')?.textContent?.trim() || person.id;
                const nachname = person.querySelector('familienname')?.textContent?.trim();
                const personName = `${vorname} ${nachname}`;
                const birthDate = person.querySelector('geburtsdatum')?.textContent?.trim();
                
                const menuNode = document.createElement('li');
                menuNode.innerText = personName;
                menuNode.href = '#';
                menuNode.addEventListener('click', event => {
                    event.preventDefault();
                    menuNode.parentNode.querySelectorAll('li').forEach( li => li.classList.remove('active') );
                    menuNode.classList.add('active');
                    this.htmlSpace.querySelectorAll('.selected_content').forEach( selected_content => selected_content.classList.add('hide') );
                    this.htmlSpace.querySelector('#selected_content_'+ uniquePersonNumber).classList.remove('hide');
                });
                this.menu.appendChild( menuNode );

                const _nodesOfOtherPersons = this.nodesOfOtherPersons( person );
                for ( const xmlField of this.xmlDOM.querySelectorAll( ':only-child *' ) ){
                    if ( _nodesOfOtherPersons.includes( xmlField ) ) continue;
                    if ( xmlField.childElementCount === 0 && xmlField.textContent ){  // Terminal XML Element with content
                        let xmlLongName = this.longName( xmlField );
                        if ( terminalNodes[ xmlLongName ] ){
                          terminalNodes[ xmlLongName ] += 1;
                          duplicates.add(xmlLongName);
                          xmlLongName += `.${terminalNodes[ xmlLongName ]}`;
                        } else {
                          terminalNodes[ xmlLongName ] = 1;
                        }
                        xmlFieldLongNameMap.set(xmlField, xmlLongName);
                        xmlLongNameXmlField.set(xmlLongName, xmlField);
                    }
                }

                // rename first duplicate
                for ( const xmlLongName of duplicates ){
                    const xmlField = xmlLongNameXmlField.get(xmlLongName);
                    xmlFieldLongNameMap.set(xmlField, `${xmlFieldLongNameMap.get(xmlField)}.1` );
                }

                // clear old personal case rules before importing from XML data
                if ( config.autoClear ){
                    Rule.DB.forEach( rule => {
                    if ( rule.owner === 'case' && rule.person ) rule.remove();
                    });
                }

                // add rules generated by XML data
                for ( const key of Object.keys( config.xmlPersonalRules ) ){
                    const personalRule = config.xmlPersonalRules[key];
                    this.addRuleFor( xmlPersonalData[key], personalRule, personName ); 
                }
             
                for ( const [xmlField, xmlLongName] of xmlFieldLongNameMap.entries() ){
                    this.addRuleFor( xmlField, xmlLongName, personName );  // include all XML data of this person
                    for ( const key of Object.keys( config.xmlKeyValuePairs ) ){
                        if ( xmlField.textContent === key ){
                            const textContent = xmlField.nextElementSibling.textContent;
                            this.addRuleFor( { textContent }, config.xmlKeyValuePairs[key], personName ); 
                        }
                    
                    }
                }

                const language = document.getElementById('language_selector')?.value || 'englisch';
                let pdfDoc = await this.makePdf( uniquePersonNumber, personName, language, birthDate );

                pdfDoc.htmlSpace.querySelector('select.language_selector')?.addEventListener('change', eventListener);
                pdfDoc.htmlSpace.classList.add('hide');

                const self = this;
                async function eventListener( event ){
                    pdfDoc.remove();
                    const language = event.target.value;
                    pdfDoc = await self.makePdf( uniquePersonNumber, personName, language, birthDate ); 
                    const pdfFileKey = self.pdfFileKey( pdfDoc.htmlSpace, birthDate );
                    const personal_language_selector = pdfDoc.htmlSpace.querySelector('select.language_selector');
                    personal_language_selector.value = language;
                    personal_language_selector.addEventListener('change', eventListener);
                    pdfDoc.htmlSpace.querySelector('.filename').innerText = pdfFileKey;
                }
            }

            this.button.removeAttribute('disabled');
        }
    }

    async makePdf( nr, personName, language, birthDate ){
        const selected_content = PdfDoc.createHTMLSpace();

        // add personal language selector
        const personal_language_selector = selected_content.querySelector('select.language_selector');
        personal_language_selector.id = 'language_selector_' + nr;
        const personal_language_selector_label = selected_content.querySelector('label.language_selector');
        personal_language_selector_label.setAttribute('for', personal_language_selector.id);
        personal_language_selector.innerHTML = '<option value="">--Andere Sprache wählen:--</option>';
        for ( const language of await this.constructor.allLanguages() ){
            const option = document.createElement('option');
            option.value = language;
            option.innerText = language;
            personal_language_selector.appendChild( option );
        }
        personal_language_selector.classList.remove('hide');
        personal_language_selector_label.classList.remove('hide');
        
        selected_content.classList.add('selected_content');
        selected_content.id = 'selected_content_' + nr;
        selected_content.querySelector('.person').innerText = personName;
        this.htmlSpace.appendChild( selected_content );

        const pdfFileKey = this.pdfFileKey( selected_content, birthDate  );

        return await this.appendPdf( pdfFileKey, selected_content, personName );
    }

    /**
     * @summary returns key for accessing the correct PDF file from IndexedDB
     * @param {String} birthDate 
     * @returns key for accessing the correct PDF file from IndexedDB
     */
    pdfFileKey( selected_content, birthDate ){
        // geburtsdatum + 18 Jahre >= heute ? 'unbegleitete' : 'asylgesuch';
        const kindOfPDF = birthDate && this.isMinor( this.norm( birthDate) ) ? 'unbegleitete' : 'asylgesuch';
        const language_selector = document.getElementById('language_selector');
        const personal_language_selector = selected_content.querySelector('select.language_selector');
        let language = personal_language_selector.value || language_selector.value || localStorage.getItem('quickfill_xml_language') || 'englisch'; 
        localStorage.setItem('quickfill_xml_language', language);
        return kindOfPDF + '_' + language;
    }

    async appendPdf( pdfFileKey, selected_content, personName ){
        // create PDF from binary
        const pdfDoc = new PdfDoc( {name: pdfFileKey}, selected_content );

        // fill PDF with data from XML and show in div.selected_content
        let pdfBinary = await Idb.get( pdfFileKey );
        if ( pdfBinary ){
            selected_content.querySelector('.filename').innerText = pdfFileKey;
            await pdfDoc.renderArrayBuffer( pdfBinary );
            pdfDoc.applyRulesToTable( personName ); // ToDo
            pdfDoc.applyTableToPDF();   
        } else {
            alert( `Bitte vorher passendes PDF für ${pdfFileKey} laden` );
        } 
        await pdfDoc.ready();
        // await new Promise( resolve => setTimeout(resolve, 2000) );

        return pdfDoc;
    }

    /**
     * @summary Checks if a person is minor
     * @param {String} birthdate - in a format accepted by Date() constructor
     * @returns {Boolean} person is non adult
     */
    isMinor( birthdate ) {
        if ( ! birthdate ) return false;
        // Erstelle ein Date-Objekt aus dem Geburtsdatum
        let birthDate = new Date(birthdate);
        // Erstelle ein Date-Objekt aus dem aktuellen Datum
        let currentDate = new Date();
        // Berechne die Differenz der Jahre
        let yearDiff = currentDate.getFullYear() - birthDate.getFullYear();
        // Wenn die Differenz kleiner als 18 ist, ist die Person minderjährig
        if (yearDiff < 18) {
          return true;
        }
        // Wenn die Differenz größer als 18 ist, ist die Person volljährig
        if (yearDiff > 18) {
          return false;
        }
        // Wenn die Differenz gleich 18 ist, muss man auch die Monate und Tage vergleichen
        // Berechne die Differenz der Monate
        let monthDiff = currentDate.getMonth() - birthDate.getMonth();
        // Wenn die Differenz der Monate kleiner als 0 ist, ist die Person minderjährig
        if (monthDiff < 0) {
          return true;
        }
        // Wenn die Differenz der Monate größer als 0 ist, ist die Person volljährig
        if (monthDiff > 0) {
          return false;
        }
        // Wenn die Differenz der Monate gleich 0 ist, muss man auch die Tage vergleichen
        // Berechne die Differenz der Tage
        let dayDiff = currentDate.getDate() - birthDate.getDate();
        // Wenn die Differenz der Tage kleiner oder gleich 0 ist, ist die Person minderjährig
        if (dayDiff <= 0) {
          return true;
        }
        // Wenn die Differenz der Tage größer als 0 ist, ist die Person volljährig
        return false;
    }

    /**
     * @summary Normalizes a date string to a format accepted by Date() constructor
     * @param {String} date, e.g. '20190401'
     * @returns {String} in a format accepted by Date() constructor, e.g. '2019-04-01'
     */  
    norm( date ){
        if ( ! date ) return false;
        const year = date.substring(0,4);
        const month = date.substring(4,6);
        const day = date.substring(6,8);
        return `${year}-${month}-${day}`;
    }

    nodesOfOtherPersons( person ){
        const _nodesOfOtherPersons = [];
        for ( const other of this.allPersons ){
            if ( other === person ) continue;
            for ( const xmlField of this.xmlDOM.querySelectorAll( ':only-child *' ) ){
                if ( other.contains( xmlField ) ) _nodesOfOtherPersons.push( xmlField ); 
            }
        }
        return _nodesOfOtherPersons;
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
