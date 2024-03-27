/**
 * @module RuleEngine.js
 * @summary Rule Engine for processing rules
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */

import {SParser} from './sexpressions.js';
import {config} from './config.js';
import {distance} from './levenshtein.js';
import {Person} from './Person.js';

export class RuleEngine{
  constructor( ruleDatabase, field, maxLevel ){
    /* @type {RuleDataBase} collection of rules for filling a single field by replacing variables */
    this._ruleDatabase = ruleDatabase;
    /* @type {Field} PDF field to be filled */
    this._field = field;
    /* @type {Number} max number of levels for replacements avoiding infinite loops */
    this._maxLevel = maxLevel || config.maxRecursionDepth || 100;
    /* @type {[String]} chain of replacements for filling a single field */
    this._history = [];
    /* @type {[Rule]} chain of rules for filling a single field */
    this._ruleChain = [];
  }
  static savings(){
    return { sumFields: RuleEngine.sumFields, sumLength: RuleEngine.sumLength };
  }
  static round( num, separator ){
    const result = String( (Math.round(num * 100) / 100).toFixed(2) );
    return result.replace('.', separator);
  }
  static time( num ){
    const msec = ""+num % 1000; num /= 1000; num = Math.floor( num );
    const sec = ""+num % 60; num /= 60; num = Math.floor( num );
    const min = ""+num % 60; num /= 60; num = Math.floor( num );
    const hours = ""+num % 24; num /= 24; num = Math.floor( num );
    if ( num === 0 && hours === '0' && min === '0' && sec === '0' ) return `0.${msec.padStart(3, '0')} Millisekunden`;
    if ( num === 0 && hours === '0' ) return `${min.padStart(2, '0')} Minuten : ${sec.padStart(2, '0')} Sekunden`;
    if ( num === 0 ) return `${hours.padStart(2, '0')} Stunden : ${min.padStart(2, '0')} Minuten : ${sec.padStart(2, '0')} Sekunden`;
    const days = ""+num;
    return `${days} Tage .${hours.padStart(2, '0')} Stunden : ${min.padStart(2, '0')} Minuten : ${sec.padStart(2, '0')} Sekunden`;
  }
  /**
   * @summary update document placeholder showing time savings via QuickFill
   */
  static updateSavings(){
    const { sumFields, sumLength } = RuleEngine.savings();
    const time =  sumLength * config.costModel.timeCharFactor + sumFields * config.costModel.timeFieldFactor;
    const timeToString = RuleEngine.time( time );
    const money = RuleEngine.round( ( config.costModel.moneyFactor * time ) / (1000*60*60*24), ',' );
    if ( globalThis['document'] ) globalThis['document'].querySelector('.savings').innerHTML = `Danke, dass Sie QuickFill gewählt haben! Durch die Benutzung von QuickFill haben Sie bisher schon ${sumLength}  Tastaturanschläge zum Ausfüllen von ${sumFields} Feldern und damit ungefähr ${timeToString} Zeit eingespart.`;
    // Das entspricht rund ${money} Euros.
  }
  isFinal( source ){
    return SParser.isFinal( source );
  }
  /**
   * @summary apply all rules of rule database to fieldName recursively
   * @param {Field|String} field or left hand side of rule substitutions
   * @param {RuleDataBase} ruleDatabase - rule database with all rules
   * @returns {String} value - first final match after recursive replacements
   */
  static firstFinal( field, ruleDatabase ){
    const engine = new RuleEngine( ruleDatabase, field );
    return engine.final( field );
  }
  pushToRuleChain( rule ){
    const index = this._ruleChain.indexOf( rule );
    // if ( index >= 0 ) debugger;  // in case of debugging infinite loops
    if ( index < 0 ) this._ruleChain.push( rule );
  }
  printRuleChain(){
    return this._ruleChain.join(', \n');
  }
  /**
   * @summary apply all rules of rule database to fieldName recursively
   * @param {Field|String} field or left hand side of rule substitutions
   * @returns {String} value - first final match after recursive replacements
   */
  final( field ){
    this._field = field;
    this._history = [];
    this._ruleChain = [];
    this._level = 0;
    const source = field.constructor.name === 'Field' ? field.toSource() : field;
    this._origin = source;
    const result = this.finalGen( source ).next().value;
    if ( result && result.trim().length > 0 && this._ruleChain.length > 0 ){
      if ( globalThis[ 'QuickFillStatistics' ] ){
        const QuickFillStatistics = globalThis[ 'QuickFillStatistics' ];
        if ( this._field.pdfDoc ){
          const pdfName = this._field.pdfDoc.fileName;
          if ( ! QuickFillStatistics[ pdfName ] ) QuickFillStatistics[ pdfName ] = {};
          if ( ! QuickFillStatistics[ pdfName ].countFields ) QuickFillStatistics[ pdfName ].countFields = 0;
          if ( ! QuickFillStatistics[ pdfName ].countChars ) QuickFillStatistics[ pdfName ].countChars = 0;
          if ( ! QuickFillStatistics[ pdfName ].fields ) QuickFillStatistics[ pdfName ].fields = [];
          if ( ! QuickFillStatistics[ pdfName ].fields.includes( field.fieldName ) ){  // once only
            QuickFillStatistics[ pdfName ].fields.push( field.fieldName );
            QuickFillStatistics[ pdfName ].countFields += 1;
            QuickFillStatistics[ pdfName ].countChars += result.length;
            if ( config.debug ) console.log( `${QuickFillStatistics[ pdfName ].countFields}. Feld: ${field.fieldName}, Value: ${result} mit ${result.length} Zeichen.` );
          }
        }
      }
      RuleEngine.sumFields += 1;
      RuleEngine.sumLength += result.length;
      const leftHandSide = this._field?.fieldName || this._origin.slice(2,-2);
      this._ruleDatabase._reasonList[ leftHandSide ] = { result, ruleChain: this.printRuleChain() };
      let printFieldRules = `Feld <b>"${leftHandSide}"</b> = <em>"${result}"</em> via ${this.printRuleChain()}.`;
      if ( ! globalThis[ 'document' ] ){ // run tests in Node.js
        if ( config.debug ) console.log( `Feld "${source}" = "${result}" via ${this.printRuleChain()}` );
      }
    }
    if ( RuleEngine.sumLength ) RuleEngine.updateSavings();
    return result;
  }
  * finals( source ){
    this._history = [];
    this._level = 0;
    yield* this.finalGen( source );
  }
  finalsArray( source ){
    return Array.from( this.finals( source ) );
  }
  * finalGen( source ){  // traverse all nested levels until final
    if ( source.constructor.name === 'Field' ) source = source.toSource();
    this._history?.push( source );
    // const allReplacements = Array.from( this.replacementsGen( source ) );  // debug only
    for ( const next of this.replacementsGen( source ) ){  // traverse one level
      if ( this.isFinal( next ) ){
        this._history?.push( next );
        yield next;
      } else {
        if ( ! this._history?.includes(next) ){
          this._level += 1; // one more level deeper
          if ( this._level > this._maxLevel ){
            console.warn('Max nesting level exceeded', next );
            return next;
          }
          yield* this.finalGen( next );
        }
      }
    }
  }
  * allGen( source ){  // traverse all nested levels, non-final included
    if ( ! this._history?.includes( source ) ){
      this._history?.push( source );
      yield source;
    }
    const allNext = [];
    // const allReplacements = Array.from( this.replacementsGen( source ) );  // debug only
    for ( const next of this.replacementsGen( source ) ){  // traverse one level
      if ( ! this._history?.includes( next ) ){
        this._level += 1; // one more level deeper
        if ( this._level > this._maxLevel ){
          console.warn('Max nesting level exceeded', next );
          return next; // stop recursion
        } else {
          this._history?.push( next );
          allNext.push( next );
          yield next; // breadth first
        }
      }
    }
    if ( ! allNext.find( next => this.isFinal( next ) ) ){
      for ( const next of allNext ){
        yield* this.allGen( next );  // depth search after breadth first
      }
    }
  }
  * replacementsGen( source ){  // one level only
    const allContainers = SParser.parseAll(source);
    if ( allContainers.length === 0 ) return source;
    for ( const container of allContainers ){
      const {start, length, variables, sexpressions} = container;
      let containerString = source.substr(start, length);

      // replace ${variables}$ embedded in containerString
      for ( const variable of variables ){
        // replace by all possible values (config as fallback default values)
        for ( const value of this.oneStepValueFromAllRules( variable ) ){
          if ( value && value !== source && value !== this._origin ) {
            yield source.replace(containerString, typeof value === 'function' ? value(this._origin) : value );
          }
        }
      }

      // replace ${(s-expressions)}$ in containerString
      for ( const sexpression of sexpressions ) {
        const value = SParser.seval( this._origin, sexpression );
        if ( value ) { // ToDo yield* this.replacementsGen
          yield source.replaceAll(containerString, typeof value === 'function' ? value(this._origin) : value);
        }
      }
    }
  }
  /**
   * @summary generates all values of a variable, one level only, no recursion.
   * @param {Field|String} field - simple variable name used as left hand side of rule substitution
   * @returns {String} value - of given key. The result may include other variables.
   */
  * oneStepValueFromAllRules(field){
    let atomicString, pdfName;
    if ( field.constructor.name === 'Field' ){
      atomicString = field.fieldName;
      pdfName = field.pdfDoc.fileName;
    } else {
      atomicString = field;
    }
    if ( ! pdfName ) pdfName = this._field?.pdfDoc?.fileName;
    // direct access to the proper subset of rules
    const ruleList = this._ruleDatabase.ruleIndex.get( atomicString );
    if ( ruleList ) {
      const headerRules = Object.values( Person.currentActive?.headerRules || {} ) 
      // const headerRules = ruleList.filter(rule => rule.value && rule.header && rule.person === Person.currentActive);
      const personalRules = ruleList.filter(rule => rule.value && ! rule.header && rule.person === Person.currentActive).sort((a, b) => a.nr - b.nr);
      const caseRules = ruleList.filter(rule => rule.value && rule.isCaseRule() && ! rule.isPersonRule() ).sort((a, b) => a.nr - b.nr);
      let specificRules = ruleList.filter(rule => rule.value && ! rule.isCaseRule() && ! rule.isPersonRule()).sort((a, b) => a.nr - b.nr);
      const pdfSpecificRules = specificRules.filter(rule => rule.pdf?.split(',').find(p => pdfName?.match(p.trim())));
      specificRules = specificRules.filter(rule => ! rule.pdf && ! rule.isPersonRule());

      if ( headerRules.length ) {  // 1. Header rules with highest priority
        for ( const rule of headerRules ){
          const value = this.oneStepValueFromRule(field, rule);
          if (value && atomicString !== value) { // a replacement happened
            this.pushToRuleChain(rule);
            yield value;
          }
        }
      } 
      
      if (pdfSpecificRules.length) {  // 2. PDF-specific rules first
        specificRules = pdfSpecificRules;
        for (const subList of [caseRules, specificRules]) {
          for (const rule of subList) {
            const value = this.oneStepValueFromRule(field, rule);
            if (value && atomicString !== value) { // a replacement happened
              this.pushToRuleChain(rule);
              yield value;
            }
          }
        }
      } 
      
      if (personalRules.length + caseRules.length + specificRules.length) {  // 3. equal-Rules
        for (const subList of [personalRules, caseRules, specificRules]) {
          for (const rule of subList) {
            if ( rule.owner === 'template' ) continue; 
            const value = this.oneStepValueFromRule(field, rule);
            if (value && atomicString !== value) { // a replacement happened
              this.pushToRuleChain(rule);
              yield value;
            }
          }
        }
      } else {  // 4. iterate all equal rules
        for (const rule of ruleList.sort((a, b) => a.nr - b.nr)) { // sorted implies case rules first
          const value = this.oneStepValueFromRule(field, rule);
          if (value && atomicString !== value) { // a replacement happened
            this.pushToRuleChain(rule);
            yield value;
          }
        }
      }
    } else {  // 5. iterate all other rules if there are no equal rules and no PDF exceptions
      for (const rule of this._ruleDatabase.sortedRules()) { // sorted implies case rules first
        if ( rule.rule_type === 'equal' ) continue;
        const value = this.oneStepValueFromRule(field, rule);
        if (value && atomicString !== value) { // a replacement happened
          this.pushToRuleChain(rule);
          yield value;
        }
      }
    }
    // 6. Special cases ( even functions ) in config
    if ( config[ atomicString ] ){
      this.pushToRuleChain( `config(${atomicString} = ${config[ atomicString ]})` );
      yield config[ atomicString ]; // fallback default values given in config
    }
  }

  preventRuleApplication( field, rule ){
    if ( rule.person && Person.currentActive !== rule.person ) return true;
    if ( field.constructor.name === 'Field' ){
      if ( rule.person && field.pdfDoc.person !== rule.person ) return true;
    }
    if ( rule.owner === 'template' ) return true; 
    return false;
  }


  /**
   * @summary apply one subrule of one rule to a single field, one step only, no recursion
   * @param {Field|String} field - left hand side of rule substitution
   * @param {Rule} rule - rule in Rule.DB
   * @returns {String} value - computed by applying subRule to field
   */
  oneStepValueFromRule(field, rule) {
    if ( this.preventRuleApplication( field, rule ) ) return false;
    const sourceString = field.constructor.name === 'Field' ? field.fieldName : field;
    // Is rule restricted to a single PDF?
    if ( rule.pdf ){
      const allPdfRestrictions = rule.pdf.split(',').map( pdf => pdf.trim() );
      const restrictionApplies = () => {
        for ( const pdf of allPdfRestrictions ){
          if ( field.fileName && field.fileName.includes( pdf ) ) return true;
          if ( this._field && this._field.fileName && this._field.fileName.includes( pdf ) ) return true;
        }
        return false;
      }
      // if no restriction applies, return
      if ( ! restrictionApplies() ) return sourceString;
    }
    // decompose composed rules into subRules
    for ( const subRule of rule.rule.split(/\s*,\s*/) ){
      // apply subrule and return value
      switch (rule.rule_type.toLowerCase()) {
        case 'equal':
          if (subRule === sourceString) return rule.value;
          break;
        case 'substring':
          if (sourceString?.includes(subRule)) return rule.value;
          break;
        case 'superstring':
          if (subRule?.includes(sourceString)) return rule.value;
          break;
        case 'similar':
          if (distance(subRule, sourceString) < (rule.threshold || 5)) return rule.value;
          break;
        case 'regex':
          let regex;
          try { regex = new RegExp(subRule) } catch (e) { break }
          if (regex && regex.test(sourceString)) return rule.value;
          break;
        case 'formula':
          const value = SParser.seval( sourceString, subRule );
          if ( value ) return rule.value || value;
          break;
        case 'date':
          if (subRule === sourceString){
            const regex = /(\d{4})(\d{2})(\d{2})/;
            const valueOfDatabase = this._ruleDatabase.valueFromAllRulesOf( rule.value );
            return ( valueOfDatabase || rule.value ).replace( regex, "$3.$2.$1");
          }
          break;
        case 'switch':
          if (subRule === sourceString){
            const parts = rule.value.split(/\s+/);
            const variable = parts[0];
            const valueOfDatabase = this._ruleDatabase.valueFromAllRulesOf( '${' + variable + '}$' );
            const index = rule.rule.split(/,\s*/).indexOf( subRule );
            const result = valueOfDatabase == parts[ index + 1 ] ? 1 : 0;
            return result;
          }
          break;  
        default:
          console.assert(false, `Unknown rule type`, rule.rule_type);
          debugger;
      }
    }
    return sourceString;  // remains unchanged
  }
  replacementsArray( source ){
    this._history = [];
    this._level = 0;
    this._origin = source;
    return Array.from( this.allGen( source ) );
  }
  /**
   * @summary search for maximum replacements and return maximum
   * @param {String} source - string with variables
   * @returns {String} lastCandidate - the string with maximum replacements
   */
  maxReplaced( source ){
    const allReplaced = this.replacementsArray( source );
    let lastMax = 0, lastCandidate = source;
    for ( const partial of allReplaced ){
      const terminalLength = this.nonVariableLength( partial );
      if ( lastMax < terminalLength ){
        lastMax = terminalLength;
        lastCandidate = partial;
      }
    }
    return lastCandidate;
  }
  /**
   * @summary calculate the length of the string without the containing variables inside
   * @param {String} partial - the string with the containing variables inside
   * @returns {Number} value - the length without variables
   */
  nonVariableLength( partial ){
    return partial.replaceAll( /(\${.+?}\$)|[-_,;+?#*.:/\s]/g, '' ).length;
  }
}

RuleEngine.sumLength = 0;
RuleEngine.sumFields = 0;
