/**
 * @module XMLInterpreter.js
 * @summary import XML and interpret it
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2023, 2024 All Rights reserved by author
 */

import {config} from './config.js';
import {filename_language_mapper, makeClassName} from './global_functions.js';
import {Person} from './Person.js';
import {fileOpen} from './FileOpener.js';
import {Rule} from './Rule.js';
import { PersonEditor } from './PersonEditor.js';
import * as Idb from './idb-keyval.js';
import {ICONV} from './iconv.js';
import {loadAndDecryptArchive} from '../index.js';
// import {JsCharDet} from './jschardet.js';

function pdfArchiveOf( fileNames ){
  if ( typeof fileNames === 'string' ) fileNames = [ fileNames ]; 
  for ( const [ archiveName, fileMapping ] of Object.entries( config.pdfPerPerson ) ){
    for ( let patterns of Object.values( fileMapping ) ){
        if ( typeof patterns === 'string' ) patterns = [ patterns ];
        for ( const fileName of fileNames ){
            for ( const pattern of patterns ){
                if ( nameMatch( fileName, pattern ) ) return `${archiveName}.zip`;
            }
        }
    }
  }
}

function nameMatch( fileName, pattern ){
    if ( fileName.match( pattern ) ) return true;
    return false;
}

export class XMLInterpreter {
    constructor( button, htmlSpace ) {
        XMLInterpreter.count += 1;
        this.count = XMLInterpreter.count;
        this.button = button;
        this.htmlSpace = htmlSpace;
        this.xml = '';

        const xml_interpreter_invocation_template = document.getElementById('xml_interpreter_invocation_template');
        const div = document.createElement('div');
        div.classList.add( 'invoke' );
        this.invocationId = 'invoke' + this.count;
        div.id = this.invocationId;
        div.innerHTML = xml_interpreter_invocation_template.innerHTML;
        htmlSpace.appendChild( div );

        this.invocationDiv = div;
        this.menu = this.invocationDiv.querySelector('ul.menu');
        this.stop = false;
    }

    static async allLanguages(){
        const allLanguages = Array.from( new Set( (await Idb.keys()).map( filename_language_mapper ) ) );
        return allLanguages.filter( name => name !== 'profile' );
    }

    async interpretFile( event ){
        // https://wicg.github.io/file-system-access/#api-showopenfilepicker
        const xmlFileHandle = await fileOpen( {
            // List of allowed MIME types, defaults to `*/*`.
            mimeTypes: ['application/xml'],
            // List of allowed file extensions (with leading '.'), defaults to `''`.
            extensions: [ '.xml', '.txt' ],
            // Set to `true` for allowing multiple files, defaults to `false`.
            multiple: false,
            // Textual description for file dialog , defaults to `''`.
            description: 'XML-Daten',
            // Suggested directory in which the file picker opens. A well-known directory or a file handle.
            startIn: 'downloads',
            // By specifying an ID, the user agent can remember different directories for different IDs.
            id: 'XML',
            // Include an option to not apply any filter in the file picker, defaults to `false`.
            excludeAcceptAllOption: false,
        } );

        const xmlFile = xmlFileHandle instanceof File ? xmlFileHandle : await xmlFileHandle.getFile();
        const arrayBuffer = await xmlFile.arrayBuffer();

        const buffer = ICONV.Buffer.from( arrayBuffer );
        // const hexString = Array.from( buffer, byte => '\\x' + byte.toString(16).padStart(2, "0") ).join('');
        // const proposedEncoding = JsCharDet.jschardet.detect( JsCharDet.Buffer.from( buffer ), { detectEncodings: ["utf8", "iso-8859-1", "windows-1252"] } );
        const proposedEncoding = this.detect( buffer, { detectEncodings: ["utf8", "iso-8859-1", "windows-1252"] } );
        console.log( 'XML proposed encoding', proposedEncoding );
        // JsCharDet: const encoding = proposedEncoding.confidence > 0.5 ? proposedEncoding.encoding : 'utf8';
        const encoding = config.xmlEncoding || proposedEncoding;
        const decoded = ICONV.iconv.decode( buffer, encoding, { defaultEncoding: 'utf8' } );
        const encodedBufferUtf8 = ICONV.iconv.encode( decoded, 'utf8' );
        this.xml = new TextDecoder().decode( encodedBufferUtf8 );

        await this.interpret();
    }

    async interpretClipBoard( clipBoardText ){
        this.xml = clipBoardText;

        await this.interpret();
    }

    async interpret(){
        document.getElementById('interprete_xml_cancel').classList.remove('hide');
        try {
            this.xmlDOM = new DOMParser().parseFromString(this.xml, 'application/xml');
        } catch (e) {
            console.error( `${e.name}`, e );
            if ( e.name !== 'AbortError' ) alert(`Fehler in XML.`);
            this.xmlDOM = null;
        }

        if ( this.xmlDOM?.body?.innerHTML?.match(/parsererror/i) ){
            console.error( 'parseerror', this.xmlDOM?.body?.innerHTML );
            alert(`Fehler in XML.`);
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
            if ( this.allPersons.length ) for ( const personalXMLElement of this.allPersons ){
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

            // add general case rules for all persons
            for ( const [xmlField, xmlLongName] of this.xmlFieldLongNameMap.entries() ){
                if ( ! xmlField.person ){
                    this.addRuleFor( xmlField, xmlLongName, undefined, 'equal' ); 

                    // === config.xmlKeyValuePairs only for person-related rules? ===

                    // for ( const key of Object.keys( config.xmlKeyValuePairs ) ){
                    //     if ( xmlField.textContent === key ){
                    //         const textContent = xmlField.nextElementSibling.textContent;
                    //         this.addRuleFor( { textContent }, config.xmlKeyValuePairs[key], undefined, 'equal' ); 
                    //     }
                    // }
                }
            }

            // iterate over all persons generating rules for each person
            for ( const person of Person.all() ){
                this.generatePersonalRules( person );
            }         

            // iterate over all persons generating menu node and PDF area
            if ( this.allPersons ) loop: for ( const person of Person.all() ){
                if ( this.stop ) break;
                const personDiv = this.invocationDiv.querySelector('#selected_person_'+ person.nr);
                if ( personDiv ){
                    if ( personDiv.classList.contains('finished') ) continue;
                } else { // personDiv has to be created
                    const menuNode = document.createElement('li');
                    menuNode.innerText = person.name;
                    menuNode.href = '#';
                    menuNode.addEventListener('click', event => {
                        event.stopImmediatePropagation();
                        if ( event.target.classList.contains('active') ){
                            event.target.classList.remove('active');
                            this.invocationDiv.querySelectorAll('.selected_person').forEach( selected_person => selected_person.classList.add('hidden') );
                            this.invocationDiv.querySelectorAll('img.printed_page').forEach( img => img.classList.add('hide') );
                        } else {
                            person.activate();
                            menuNode.parentNode.querySelectorAll('li').forEach( li => li.classList.remove('active') );
                            menuNode.classList.add('active');
                            this.invocationDiv.querySelectorAll('.selected_person').forEach( selected_person => selected_person.classList.add('hidden') );
                            this.invocationDiv.querySelector('#selected_person_'+ person.nr).classList.remove('hidden');
                        }
                     });
                    this.menu.appendChild( menuNode );
                }
                          
                person.activate();
                let selectedLanguage = document.getElementById('language_selector')?.value || localStorage.getItem('quickfill_xml_language') || 'englisch';
                let { div: selectedPersonDiv, pdfs } = await this.makeMultiplePdfs( person, selectedLanguage, personDiv );
                if ( ! pdfs.length ) break;
                
                selectedPersonDiv.classList.add('hidden');

                /**
                 * Event listener for change events of personal language selector (single person)
                 * @param {Event} event - change event in language selector 
                 */
                const languageChangeListener = async event => {
                    event.stopImmediatePropagation();
                    selectedLanguage = event.target.value;
                    selectedPersonDiv = document.querySelector(`#${this.invocationId} .selected_person`);
                    const personEditor = selectedPersonDiv.parentElement.querySelector('.person.editor').parentElement;

                    // remove old editors and PDFs and DIVs
                    personEditor.remove();
                    pdfs.forEach( pdf => pdf.remove() );
                    selectedPersonDiv.remove();
                    
                    // generate new PDFs and fill forms
                    const result = await this.makeMultiplePdfs( person, selectedLanguage );
                    selectedPersonDiv = result.div;
                    // append old person editor with old values stored inside
                    selectedPersonDiv.appendChild( personEditor );
                    
                    selectedPersonDiv.parentElement.querySelector('.active')?.classList.remove('active');
                    // selectedPersonParent.appendChild( result.div );  // This does not work: PDFs must not be re-positioned
                    
                    // set value of all language selectors of active person
                    pdfs = result.pdfs;
                    setLanguageSelector();         
                }

                setLanguageSelector();
                await Promise.all(pdfs.map( pdf => pdf.isReady()));

                function setLanguageSelector(){
                    for ( const pdfDoc of pdfs ){
                        const personal_language_selector = pdfDoc.htmlSpace.querySelector('select.language_selector');
                        personal_language_selector.value = selectedLanguage;
                        personal_language_selector.addEventListener('change', languageChangeListener );
                    }  
                }
            }

            // this.button.removeAttribute('disabled');
        }
        if ( ! this.stop ) document.getElementById('interprete_xml_cancel').classList.add('hide');
    }

    cancel(){
        this.stop = true;     
    }

    proceed(){
        this.stop = false;
        this.interpret();
    }

    generatePersonalRules( person ){
        // add rules generated by XML data
        for ( const key of Object.keys( config.xmlPersonalRules ) ){
            if ( person.data[key] ){
                const personalRule = config.xmlPersonalRules[key];
                this.addRuleFor( person.data[key], personalRule, person, 'equal' ); 
            }
        }
     
        // add rules from Map for this person
        for ( const [xmlField, xmlLongName] of this.xmlFieldLongNameMap.entries() ){
            if ( xmlField.person && xmlField.person === person ){
                this.addRuleFor( xmlField, xmlLongName, person, 'superstring' );  // include all XML data of this person
                for ( const key of Object.keys( config.xmlKeyValuePairs ) ){
                    if ( xmlField.textContent === key ){
                        const textContent = xmlField.nextElementSibling.textContent;
                        this.addRuleFor( { textContent }, config.xmlKeyValuePairs[key], person, 'equal' ); 
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

    defaultValue( headerValue ){
        return undefined;
        // return Rule.DB.valueFromAllRulesOf( headerRule );
        // return xmlField.nextElementSibling.textContent
    }

    async makeMultiplePdfs( person, selectedLanguage, personDiv ){
        const category = this.htmlSpace.querySelector('select.category_selector')?.value;
        const pdfPerPerson = Object.assign( {}, config.pdfPerPerson[ category ] ? config.pdfPerPerson[ category ] : { "PDF": null });

        const selected_person_space = personDiv || document.createElement('div');
        selected_person_space.id = 'selected_person_' + person.nr;
        selected_person_space.classList.add('selected_person');

        if ( config.personHeaderRules ){
            /************* Rules in the Header of each person. see config.personHeaderRules ******************/
            // e.g. 
            //   personHeaderRules: {
            //     'Header-Vorgangsnummer': 'Vorgangsnummer, vorgang.nummer, f.tgbnr.1, f.vorgangsnr.1, f.vorgangsnummer.1, f.vgnummer.1, f.checkliste_vorgangsnummer',
            //     'Header-AZR-Nummer': 'AZR-Nummer, E-Nummer, Eingabe-Nummer',
            //   },
            const personHeader = document.createElement('div');
            personHeader.classList.add('person_header', 'center');
            let personHeaderHTML = '';
            for ( const headerValue of Object.keys( config.personHeaderRules ) ){
                const shortHeaderValueMatch = headerValue.match(/^(Header-)(.*)$/i);
                const shortHeader = shortHeaderValueMatch ? shortHeaderValueMatch[2] : headerValue;
                personHeaderHTML += `<fieldset class="inline"><legend>${shortHeader}</legend><input placeholder="${shortHeader}" class="${headerValue} large center" type="text"></fieldset>`;
            }
            personHeader.innerHTML = personHeaderHTML;
            selected_person_space.appendChild( personHeader );
    
            person.headerValues = {};
            person.headerRules = {};
    
            for ( const [headerValue, headerRules] of Object.entries( config.personHeaderRules ) ){
                const input = personHeader.querySelector(`input.${headerValue}`);
                person.headerValues[ headerValue ] = this.defaultValue( headerValue );
                person.headerRules[ headerValue ] = Rule.createNew({
                    rule_type: 'equal', 
                    rule: headerRules, 
                    value: '${' + headerValue + '}$',
                    owner: 'case',
                    header: true,
                    person
                });
                const listener = event => {
                    person.activate();
                    person.headerValues[ headerValue ] = event.target.value;
                    person.headerRules[ headerValue ].value = event.target.value;
                    person.allPdfs.forEach( p => p.update() );
                };
                input.addEventListener('input', listener );
                // input.addEventListener( 'blur', listener );
            }
        }
        
        const menu = selected_person_space.querySelector('ul.submenu') || document.createElement('ul');
        if ( ! menu.classList.contains('submenu') ){ // new menu
            selected_person_space.appendChild( menu );
            menu.classList.add('menu', 'submenu');
        }
        
        this.invocationDiv.appendChild( selected_person_space );
        person.allPdfs = [];

        const classForPdf = ( pdfFile, pdfDoc ) => pdfFile ? makeClassName( 'Pdf'+pdfFile ) : makeClassName( pdfDoc?.pdfFileKey ); 

        let count = 0;
        const maxCountPdfs = Object.keys( pdfPerPerson ).length; 
 
        for ( const [ pdfName, pdfFile ] of Object.entries( pdfPerPerson ) ){
            if ( this.stop ) break;
            count += 1;
            if ( selected_person_space.querySelector('.'+classForPdf( pdfFile, null )) ) continue;

            const selected_pdf = document.createElement('div');       
            selected_person_space.appendChild( selected_pdf );

            const menuNode = document.createElement('li');
            menuNode.innerText = pdfName;
            menuNode.href = '#';
            menu.appendChild( menuNode );

            const pdfDoc = await this.makePdf( person, selected_pdf, pdfFile, selectedLanguage );
            if ( ! pdfDoc ){
                menuNode.remove();
                break;
            } 
                    
            person.allPdfs.push( pdfDoc );
            selected_pdf.classList.add('selected_pdf', classForPdf( pdfFile, pdfDoc), 'hidden');

            menuNode.addEventListener('click', async event => {
                // event.stopImmediatePropagation();
                if ( event.target.classList.contains('active') ){
                    event.target.classList.remove('active');
                    selected_person_space.querySelectorAll('.selected_pdf').forEach( selected_pdf => selected_pdf.classList.add('hidden') );
                } else {
                    await person.activate();
                    menuNode.parentNode.querySelectorAll('li').forEach( li => li.classList.remove('active') );
                    menuNode.classList.add('active');
                    selected_person_space.querySelectorAll('.selected_pdf').forEach( selected_pdf => selected_pdf.classList.add('hidden') );
                    selected_person_space.querySelectorAll('img.printed_page').forEach( img => img.classList.add('hide') );
                    selected_pdf.classList.remove('hidden');
                    selected_pdf.querySelectorAll('.hidden').forEach( elem => elem.classList.remove('hidden') );
                    if ( person.profileEditor ){
                        person.profileEditor.htmlSpace.remove();
                        selected_person_space.appendChild( person.profileEditor.htmlSpace );
                    }
                    await pdfDoc.isReady();
                }
            } );
            if ( count === maxCountPdfs ) selected_person_space.classList.add('finished');
        }
        selected_person_space.classList.add('hidden');

        if ( config.summaryButton ){
            const menuNode = document.createElement('li');
            menuNode.innerText = config.summaryButtonLabel;
            menuNode.href = '#';
            menu.appendChild( menuNode );
    
            const mergedPdf = document.createElement('div'); 
            mergedPdf.classList.add('selected_pdf');      
            selected_person_space.appendChild( mergedPdf );
    
            menuNode.addEventListener( 'click', async event => {
                person.profileEditor?.htmlSpace?.classList?.add('hidden');
                if ( event.target.classList.contains('active') ){
                    event.target.classList.remove('active');
                    selected_person_space.querySelectorAll('.selected_pdf').forEach( selected_pdf => selected_pdf.classList.add('hidden') );
                    mergedPdf.querySelectorAll('img.printed_page').forEach( img => img.classList.add('hide') );
                } else {
                    menuNode.parentNode.querySelectorAll('li').forEach( li => li.classList.remove('active') );
                    menuNode.classList.add('active');
                    selected_person_space.querySelectorAll('.selected_pdf').forEach( selected_pdf => selected_pdf.classList.add('hidden') );
                    mergedPdf.classList.remove('hidden');
                    if ( mergedPdf.childElementCount === 0 ){
                        mergedPdf.innerHTML = `<h1>Alle PDFs von ${person.name} hintereinander zusammen</h1><ol></ol>`;
                        const docuList = mergedPdf.querySelector('ol');
                        
                        for ( const pdfDoc of person.allPdfs ){
                            const li = document.createElement('li');
                            li.innerText = pdfDoc.title;
                            docuList.appendChild( li );
                            await pdfDoc.printListener();
                            for ( const img of pdfDoc.pdfDocumentInstance.printImages ){
                                await img.decode();
                                mergedPdf.appendChild( img ); 
                                img.classList.add('printed_page');
                                // URL.revokeObjectURL(img.src); without img loss ?
                            } 
                        }
                    } else {
                        mergedPdf.querySelectorAll('img.printed_page').forEach( img => img.classList.remove('hide') );
                    }
                    // mergedPdf.focus();
                }
                const pagebreak = document.createElement('div');
                pagebreak.classList.add('pagebreak');
                mergedPdf.appendChild( pagebreak );
            });
        }

        return { div: selected_person_space, pdfs: person.allPdfs };
    }

    async makePdf( person, htmlSpace, pdfFiles, selectedLanguage ){
        const selected_pdf = PdfDoc.createHTMLSpace();
        const pdfFileKey = Array.isArray( pdfFiles ) ? this.pdfFileKey( selected_pdf, person, pdfFiles, selectedLanguage ) : pdfFiles;

        // general language selector 
        const language = selectedLanguage || document.getElementById('language_selector')?.value || 'englisch';

        // add personal language selector
        const personal_language_selector = selected_pdf.querySelector('select.language_selector');
        // personal_language_selector.id = makeClassName('language_selector_' + person.name + '_' + pdfFileKey);
        const personal_language_selector_label = selected_pdf.querySelector('label.language_selector_label');
        personal_language_selector_label.setAttribute('for', personal_language_selector.id);
        this.fillLanguageSelectorWithOptions( personal_language_selector );
        personal_language_selector.classList.remove('hide');
        personal_language_selector_label.classList.remove('hide');
        
        selected_pdf.classList.add('selected_pdf');
        selected_pdf.id = 'selected_pdf_' + person.nr;
        selected_pdf.querySelector('.person').innerText = person.name;
        htmlSpace.appendChild( selected_pdf );

        // add Personal Data Editor
        // if ( ! person.profileEditor ){
        //     for ( const rule of config.initialTemplateList ){
        //         Rule.createNew({rule_type: 'equal', rule: rule.rule, value: '', owner: 'case', person });
        //     }
        //     const personDataTemplate = document.getElementById('personal_data_template');
        //     const personDataEditorSpace = document.createElement('div');
        //     personDataEditorSpace.innerHTML = personDataTemplate.innerHTML;
        //     htmlSpace.appendChild( personDataEditorSpace );
        //     person.profileEditor = new PersonEditor( {person, root: personDataEditorSpace, title: 'Angaben zur Person editieren unter "Wert":', plus_row: true } );
        //     person.profileEditor.render();
        // }
        
        const pdfDoc = await this.appendPdf( pdfFileKey, selected_pdf, person );

        if ( pdfDoc ) pdfDoc.pdfFileKey = pdfFileKey;
        return pdfDoc;
    }

    /**
     * @summary returns key for accessing the correct PDF file from IndexedDB
     * @param {HTMLElement} selected_content - HTML element that contains the PDF
     * @param {Person} person - person for which the PDF is generated
     * @param {Array|String} kindsOfPDFs - optional list of pdfFile types
     * @returns key for accessing the correct PDF file from IndexedDB
     */
    pdfFileKey( selected_content, person, kindsOfPDFs, selectedLanguage ){
        if ( typeof kindsOfPDFs === 'string' ) return kindsOfPDFs;
        const kindOfPDF = Array.isArray( kindsOfPDFs ) ? person.isMinor() ? kindsOfPDFs[0] : kindsOfPDFs[1] : kindsOfPDFs;
        const language_selector = document.getElementById('language_selector');
        const personal_language_selector = selected_content.querySelector('select.language_selector');
        const language = selectedLanguage || personal_language_selector.value || language_selector.value || localStorage.getItem('quickfill_xml_language') || 'englisch'; 
        localStorage.setItem('quickfill_xml_language', language);
        return kindOfPDF + '_' + language;
    }

    async appendPdf( pdfFileKey, selected_content, person ){
        // create PDF from binary
        let pdfDoc;

        // fill PDF with data from XML and show in div.selected_content
        let pdfBinary = await Idb.match( pdfFileKey );
        if ( ! pdfBinary ){
            // First load PDF from archive on demand
            const archive = pdfArchiveOf( pdfFileKey );
            if ( archive ){
                console.log(`Passendes Archiv mit PDFs gefunden: "${archive}"`);
            } else { 
                alert('PDFs noch nicht geladen und kein passendes Archiv gefunden.'); 
                return; 
            }
            try {
                const result = await loadAndDecryptArchive( archive );
                if ( result.length ){
                    pdfBinary = await Idb.match( pdfFileKey );
                } else {
                    this.constructor.resetLastInvokation();
                }
            } catch (error) {
                console.error( `${error.name}`, error );
                this.constructor.resetLastInvokation();
                if ( error.name !== 'AbortError' ) alert( `Bitte zuerst passendes PDF "${pdfFileKey}" laden!` );
                return;
            } 
        }

        if ( ! pdfBinary ){
            this.constructor.resetLastInvokation();
            return;
        }
        
        pdfDoc = new PdfDoc( {name: pdfFileKey}, selected_content, person );
        selected_content.querySelector('.filename').innerText = pdfFileKey;
        await pdfDoc.renderArrayBuffer( pdfBinary ); // implicit applyRulesToTable
    
        // start viewer with first page
        pdfDoc.scrollPageIntoView({ pageNumber: 1 });
        await pdfDoc.isReady();
    
        return pdfDoc;
    }

    static resetLastInvokation(){
        const last = document.getElementById( this.invocationId );
        if ( last ){
            last.remove();
            document.querySelector('button.save_all')?.classList.add('hide');
            document.querySelector('button.print_all')?.classList.add('hide');
        }
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

    addRuleFor( xmlField, xmlLongName, person, rule_type ){
        // add new case rule to Rule.DB and append new row to case table
        const xmlData = xmlField.textContent ? xmlField.textContent : xmlField;
        const rule = xmlLongName;
        const oldRule = Rule.DB.getRuleByKey( rule );
        // ToDo 
        if ( oldRule && oldRule.owner !== 'template' && person && oldRule.person === person ){
          oldRule.value = xmlData;
          return oldRule;
        }
        if ( xmlData && xmlData.length > 0 && ! config.ignoreXMLFields.includes( rule ) ){
          return Rule.createNew({rule, value: xmlData, rule_type, owner: 'case', person });
        }
    }

    detect( buffer ){
        const latin1Codes = [196, 214, 220, 228, 246, 252, 223]; // ÄÖÜäöüß
        for ( const code of latin1Codes ){
            if ( buffer.includes( code ) ) return 'iso-8859-1';
        }
        // const utf8Codes = [195]; // hex c3
        // "ÄÖÜäöüß" === "c3 84 c3 96 c3 9c c3 a4  c3 b6 c3 bc c3 9f"
        return 'utf8'; // default
    }
}

XMLInterpreter.count = 0;
