/**
 * @module Person.js
 * @summary personal data and behaviour
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {Rule} from './Rule.js';

export class Person  {
    constructor( nr, personalXMLElement, rawData ) {
        this.nr = nr;
        if ( ! Person.nrPersonMap ) Person.nrPersonMap = new Map();
        Person.nrPersonMap.set( nr, this );
        if ( personalXMLElement ){
          this.personalXMLElement = personalXMLElement;
          this.xmlPersonalData = {};
          for ( const key of Object.keys( config.xmlPersonalRules ) ){
              this.xmlPersonalData[ key ] = personalXMLElement.querySelector( key )?.textContent?.trim();
              if ( this.xmlPersonalData[ key ]?.includes('_') ) this.xmlPersonalData[ key ] = personalXMLElement.querySelector( key + ' name' )?.textContent?.trim();;
          }
          this.vorname = personalXMLElement.querySelector('vorname')?.textContent?.trim() || personalXMLElement.id;
          this.nachname = personalXMLElement.querySelector('familienname')?.textContent?.trim();
          // date, e.g. '20190401' not suitable for Date()-constructor. Therefore use this.norm()
          const birthdate = personalXMLElement.querySelector('geburtsdatum')?.textContent?.trim();
          if ( birthdate ) {
              this.birthDate = new Date( this.norm( birthdate ) );
          }
        } else {
          Object.assign( this, rawData );
        }
        this.name ||= `${this.vorname} ${this.nachname}`;
      }
    

    static getPersonFromNr( nr ){
      return Person.nrPersonMap?.get(nr);
    }

    static getPersonFromName( name ){
      const [ vorname, nachname ] = name.split(/\s+/);
      for ( const person of Person.all() ){
        if ( name.match( person.name ) ) return person;
      }
      return new Person( Person.count() + 1, null, { name, vorname, nachname });
    }

    static all(){
      return Person.nrPersonMap?.values() || [];
    }

    static count(){
      return Person.nrPersonMap?.size || 0;
    }

    activate(){
      if ( ! Person.currentActive ){ 
        Person.currentActive = this;
      } else if ( Person.currentActive !== this ){
        // wait for the former process to be finished
        // await Person.currentActive.pdfDoc?.isReady();
        Person.currentActive = this;
      }
      // this.allPdfs.forEach( p => { 
      //   p.applyHeaderRulesToTable();
      //   p.applyTableToPDF();
      // } );
    }

    get data(){
        return this.xmlPersonalData;
    }

    getName(){
      let name = this.name || Rule.DB.valueFrom('name');
      if ( ! name ) name = this.vorname || Rule.DB.valueFrom('vorname');
      const nachname = this.nachname || Rule.DB.valueFrom('nachname');
      if ( ! name ) name = nachname;
      return name;
    }

    isAdult(){
        return ! this.isMinor();
    }

    /**
     * @summary Checks if a person is minor, i.e. non adult
     * @returns {Boolean} person is non adult
     */
    isMinor() {
        if ( ! this.birthDate ) return false;

        // Erstelle ein Date-Objekt aus dem aktuellen Datum
        let currentDate = new Date();
        // Berechne die Differenz der Jahre
        let yearDiff = currentDate.getFullYear() - this.birthDate.getFullYear();
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
        let monthDiff = currentDate.getMonth() - this.birthDate.getMonth();
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
        let dayDiff = currentDate.getDate() - this.birthDate.getDate();
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
      if ( date.includes('-') ) return date;
      const year = date.substring(0,4);
      const month = date.substring(4,6);
      const day = date.substring(6,8);
      return `${year}-${month}-${day}`;
  }


    
}