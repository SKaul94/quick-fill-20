/**
 * @module RuleDataBase.js
 * @summary Database of Rules
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {config} from './config.js';
import {Rule} from './Rule.js';
import {distance} from './levenshtein.js';
import {SParser} from './sexpressions.js';
import {RuleEngine} from './RuleEngine.js';
import {Person} from './Person.js';

export class RuleDataBase  {
  constructor() {
    /* @type {Object.<string,[Rule]>} maps rule.row.id to rule with the id  */
    this._unsortedRules = [];
    /* @type {Object.<string,[Rule]>} maps rule.row.id to rule with the id  */
    this._idIndex = undefined;
    /* @type {Map.<string,[Rule]>} maps rule string x to list of rules with the same rule string x  */
    this._ruleIndex = undefined;
    /* @type {[Rule]} sorted list of rules, case rules first, even case rules with higher numbers */
    this._sortedRules = undefined;
    /* @type {number} count number of rules in this database */
    this._ruleCounter = 1;
    /* @type {number} count number of templates in this database */
    this._templateCounter = 1;
     /* @type {Object.<string, Object.<string, [Rule]>>} maps fields to results and rule chains yielding the result */
    this._reasonList = {};
  }

  printReasonList(){
    const htmlSpace = document.querySelector('.reason-list');
    htmlSpace.innerHTML = '';
    for ( const [ leftHandSide, { result, ruleChain } ] of Object.entries( this._reasonList ) ){
      const li = document.createElement('li');
      li.innerHTML = `Feld <b>"${leftHandSide}"</b> = <em>"${result}"</em> via ${ruleChain}.`;
      htmlSpace.appendChild( li );
    }
  }

  logReasonList( pattern ){
    for ( const [ leftHandSide, { result, ruleChain } ] of Object.entries( this._reasonList ) ){
      if ( ! pattern || leftHandSide.match( pattern ) ) console.log( `Feld "${leftHandSide}" = "${result}" via ${ruleChain}.` );
    }
  }

  matchRule( pattern ){
    return this._unsortedRules.filter(r=>r.rule.match( pattern ));
  }

  matchValue( pattern ){
    return this._unsortedRules.filter(r=>r.value.match( pattern ));
  }

  allReplacements( source ){
    const engine = new RuleEngine( this );
    return Array.from( engine.allGen( source ) );
  }

  /**
   * @summary starting from a variable, which rules use this variable
   * @todo This is only one step deep. A recursive solution would traverse more steps.
   * @param {*} variable - starting point of dependency search
   * @returns set of dependent rules 
   */
  allDependentRules( variable ){
    const dependentRules = [];
    const searchTerm = '${'+variable+'}$';
    for ( const rule of this.sortedRules() ){
      if ( rule.value.includes( searchTerm ) ){
        if (!dependentRules.includes(rule)) dependentRules.push( rule );
      }
    }
    return dependentRules;
  }

  get count() {
    return { rules: this._ruleCounter - 1, templates: this._templateCounter - 1 };
  }

  get idIndex(){
    if ( ! this._idIndex ){
      this._idIndex = {};
      console.assert( this._unsortedRules );
      for ( const rule of this._unsortedRules ){
        this._idIndex[ rule.id() ] = rule; 
      }
    }
    return this._idIndex;
  }

  get ruleIndex(){
    if ( ! this._ruleIndex ){
      this._ruleIndex = new Map();
      console.assert( this._unsortedRules );
      for ( const rule of this._unsortedRules ){
        if ( typeof rule.rule === 'string' ){
          for ( const key of rule.rule.split(/\s*,\s*/) ){
            this.addToRuleList( key, rule );
          }
        } else {
          this.addToRuleList( 'yet-undefined', rule );
        }
      }
    }
    return this._ruleIndex;
  }

  /**
   * @summary sorted list of rules, case rules first, then sorted by number
   */
  sortedRules() {
    if ( ! this._sortedRules ){
      // flatten array of arrays, using Set to remove duplicates (e.g. same rule in multiple lists)
      // this._sortedRules = Array.from( new Set( Array.from( this.ruleIndex.values() ).flat() ) );
      /*** sort rules: case rules first, then profile rules ***/
      this._sortedRules = this._unsortedRules.sort( this.cmp );
    }
    return this._sortedRules;
  }

  cmp(a,b){
    // sort 1. Case Rules 2. Profile Rules
    if ( a.isCaseRule() && b.isCaseRule() ) return a.nr - b.nr;
    if ( a.isCaseRule() ) return -1;
    if ( b.isCaseRule() ) return +1;
    return a.nr - b.nr;
  }

  clear(){
    this._unsortedRules = [];
    this._idIndex = undefined;
    this._ruleIndex = undefined;
    this._sortedRules = undefined;
    this._ruleCounter = 1;
    this._templateCounter = 1;
  }

  rebuild(){
    console.assert( this._unsortedRules );
    const oldRules = this._unsortedRules;
    for ( const oldRule of oldRules ){
      this.buildIndexForRule( oldRule );
    }
  }

  contains( rule ){
    console.assert( this._unsortedRules );
    return this._unsortedRules.find( r => r.equals( rule ) );
  }

  removeAll( filterPredicate ){
    if ( ! filterPredicate ) filterPredicate = rule => false;
    console.assert( this._unsortedRules );
    this._unsortedRules.filter( rule => filterPredicate( rule ) ).forEach( rule => this.remove( rule ) );
    const oldRules = this._unsortedRules.filter( rule => ! filterPredicate( rule ) );
    this.clear();
    this._sortedRules = oldRules;
    this.rebuild();
  }

  find( predicate ){
    console.assert( this._unsortedRules );
    return this._unsortedRules.find( predicate );
  }

  filter( predicate ){
    console.assert( this._unsortedRules );
    return this._unsortedRules.filter( predicate );
  }

  forEach( lambda ){
    console.assert( this._unsortedRules );
    this._unsortedRules.forEach( lambda );
  }

  getRuleByNr( nr ){
    console.assert( this.idIndex );
    console.assert( typeof nr === 'number' );
    return this.idIndex[  'R' + nr  ];
  }

  getTemplateByNr( nr ){
    console.assert( this.idIndex );
    console.assert( typeof nr === 'number' );
    return this.idIndex[  'T' + nr ];
  }

  hasExceptionRuleFor( fieldName ){
    console.assert( this.ruleIndex );
    console.assert( typeof fieldName === 'string' );
    return this.ruleIndex.get( fieldName ).find( r => r.pdf )
  }

  /**
   * @summary delivers all rules of this Rule Database with numbers starting at lowerBound and ending at upperBound
   * @param {Object} param - lower and upper bound optionally
   * @returns {Array} result - array of all rules of this Rule Database with numbers starting at lowerBound and ending at upperBound
   */
  ruleRange( { lowerBound, upperBound } ){
    // without parameters deliver all rules
    if ( arguments.length === 0 ) return this.sortedRules();
    const result = [];
    for ( const rule of this.sortedRules() ){
      if ( ( ! lowerBound || rule.nr >= lowerBound ) && ( ! upperBound || rule.nr <= upperBound ) ) result.push( rule );
    }
    return result;
  }

  /**
   * @summary renumbers all rules of this Rule Database starting at lowerBound
   * @param {Number} lowerBound - minimum number of rule inclusively
   * @param {Boolean} increment - whether to increment or decrement
   */
  renumber( lowerBound , increment ){
    for ( const rule of this.ruleRange( { lowerBound } ) ){
      if ( increment )
        rule.nr += 1;
      else
        rule.nr -= 1;
    }
    this._ruleIndex = undefined;
    this._idIndex = undefined;
    this._sortedRules = undefined;
  }

  /**
   * @summary add newRule to this database of all rules
   * @param {Rule} newRule - rule to be added
   */
  addRule( newRule ){
    newRule.nr = newRule.owner === 'template' ? this._templateCounter++ : this._ruleCounter++;
    this._unsortedRules.push( newRule );
    this._sortedRules = undefined; 
    this._idIndex = undefined; 
    this._ruleIndex = undefined; 
      // this._sortedRules is not valid any more
      // clear cache, sort on next demand, not on every add
      // because of performance reasons
  }

  buildIndexForRule( rule ){
    this.idIndex[ rule.id() ] = rule;
    if ( rule.owner !== 'template' ){
      if ( typeof rule.rule === 'string' ){
        for ( const key of rule.rule.split(/\s*,\s*/) ){
          this.addToRuleList( key, rule );
        }
      } else {
        this.addToRuleList( 'yet-undefined', rule );
      }
    } 
  }

  templates(){
    return this.filter( rule => rule.owner === 'template' );
  }

  persons(){
    return this.filter( rule => !! rule.person );
  }

  activePersonRules(){
    return this.filter( rule => rule.person && rule.person === Person.currentActive );
  }

  remove( oldRule ){
    if ( ! oldRule ) return;
    if ( oldRule.id() ){
      if ( this._idIndex ) delete this._idIndex[ oldRule.id() ];
      for ( const key of oldRule.rule.split(/\s*,\s*/) ){
        this.removeFromRuleList( key, oldRule );
      }
      oldRule.row?.remove();
    }
    this._sortedRules = undefined; // this._sortedRules is not valid any more
    // clear cache, sort on next demand, not on every add
    // this.store() is called at the end of all adding
  }

  addToRuleList( key, newRule ){
    const oldRuleList = this.ruleIndex.get( key );
    if ( oldRuleList ){
      // do not add twice, therefore search for old rules
      const oldRule = oldRuleList.find( r => r.rule === newRule.rule && r.value === newRule.value );
      if ( ! oldRule ) oldRuleList.push( newRule ); // add new rule to list
    } else {
      this.ruleIndex.set( key, [ newRule ] ); // begin new list of rules
    }
  }

  removeFromRuleList( key, oldRule ){
    const oldRuleList = this.ruleIndex.get( key );
    if ( oldRuleList ){
      const newRuleList = oldRuleList.filter( r => r !== oldRule );
      if ( newRuleList.length === 0 ){
        this.ruleIndex.delete( key )
      } else {
        this.ruleIndex.set( key, newRuleList )
      }
    }
  }

  /**
   * interprete config rule sepcs and load rules into Rule Database
   */
  load( fromStore ) { 
    if ( config.initialRulesList ) {  // start with initial rules given in config
      if ( Array.isArray( config.initialRulesList ) ){ // flat array
        for ( const ruleSpec of config.initialRulesList ){
          const rule = Rule.createNew( ruleSpec );
        }
      } else { // nested rule lists of different owners
        for ( const [owner, ruleSpecs] of Object.entries( config.initialRulesList ) ){
          for ( const ruleSpec of ruleSpecs ){
            if ( ! ruleSpec.owner ) ruleSpec.owner = owner;
            const rule = Rule.createNew( ruleSpec );
          }
        }
      }
    } else { // empty startup: rule nr.1 for beginners
      Rule.createNew({rule_type: 'substring', owner: 'PVB'});
    }
  }

  toInitialRulesList() {
    const result = {};
    for ( const rule of Object.values( this.idIndex ) ){
      if ( rule.person ) continue; // skip personal rules
      if ( ! result[ rule.owner ] ) result[ rule.owner ] = [];
      result[ rule.owner ].push( rule.toJSON() );
    }
    return result;  // nested rule lists of different owners
  }

  /**
   * @summary convert RuleDatebase to JSON string
   * @param {Function?} filterPredicate - optional filtering some rules before converting to JSON
   * @returns {String} JSON - output string
   */
  toJSON( filterPredicate ) {  // mapping Rule objects back to stringified JSON objects
    if ( ! filterPredicate ) filterPredicate = rule => true;
    return JSON.stringify(
      Object.values( this.idIndex )
        .filter( filterPredicate )
        .map( rule => rule.toJSON() )
    );
  }

  getRuleByKey(key){
    return this._unsortedRules.find(rule=>rule.rule === key);
  }

  getById( id ){
    return this.idIndex[ id ];
  }

  async addRulesFromJSONFile( fileHandle, owner ){
    const file = await fileHandle.handle.getFile();
    const text = await file.text();
    this.addRulesFromString( text, owner ); 
  }

  addRulesFromString( text, owner ){
    const ruleList = JSON.parse( text );
    this.removeAll( rule => rule.owner === owner );
    for (const ruleObject of ruleList){
      delete ruleObject.fields;
      Rule.createNew( ruleObject );
    }
  }

  displayAllRules( tableClass ){
    const table = document.querySelector('.'+tableClass )?.querySelector('tbody');
    for ( const rule of this.sortedRules() ){
      if ( rule.owner === tableClass ){
        table.insertBefore( rule.toRow(), table.querySelector('tr.plus_row') );
      }
    }
  }

  /**
   * @summary search for a rule in database applying a search pattern
   * @param {String} rule_type - left hand side of rule substitutions
   * @param {String} fieldNamePattern - left hand side of rule substitutions
   * @returns {String} value - after replacements
   */
  findRule( rule_type, fieldNamePattern ) {
    if ( rule_type === 'equal' ){
      return this.ruleIndex[ fieldNamePattern ];
    } else {
      for ( const rule of this.sortedRules() ) {
        if ( rule.rule ) for (const rulePart of rule.rule.split(',')) {  // Commas
          const subRule = rulePart.trim();
          if (subRule) {
            switch ( rule_type.toLowerCase() ) {
              case 'substring':
                if (subRule.includes(fieldNamePattern)) return rule;
                break;
              case 'superstring':
                if (fieldNamePattern.includes(subRule)) return rule;
                break;
              case 'similar':
                if (distance(subRule, fieldNamePattern) < (rule.threshold || 5)) return rule;
                break;
              case 'regex':
                let regex;
                try { regex = new RegExp(fieldNamePattern) } catch (e) { break }
                if (regex && regex.test(subRule)) return rule;
                break;
              case 'formula':
                const value = SParser.seval( subRule, fieldNamePattern );
                if ( value ) return rule || value;
                break;
              default:
                console.warn(`Unknown rule type`, rule_type);
                debugger;
            }
          }
        }
      }
     }
  }


  /**
   * @summary apply all rules of database to fieldName recursively
   * @param {Field|String} field - field or left hand side of rule substitutions
   * @returns {String} value - after replacements
   */
  valueFromAllRulesOf( field ) {
    let result = RuleEngine.firstFinal( field, this );
    if ( result ) return result;
    if ( typeof field !== 'string' ){
      const replaced = this.maxReplaced( field );
      // replacements happened, but there are still variables inside
      // Therefore strip variables
      if ( replaced && replaced !== field.toSource() ) return replaced.replaceAll(/(\${.+?}\$)/g,'');
    }
  }

  /**
   * @summary shortcut for valueFromAllRulesOf( string )
   * @param {String} from - left hand side of rule substitutions without ${ }$
   * @returns {String} value - after replacements
   */
  valueFrom( from ){
    return this.valueFromAllRulesOf( '${' + from + '}$' );
  }

  /**
   * @summary apply all rules and search for max number of replacements
   * @param {Field} field
   * @returns {String} value - after max number of replacements
   */
  maxReplaced( field ){
    const engine = new RuleEngine( this, field );
    return engine.maxReplaced( field.toSource() );
  }

  updateAllFields(){
    for (const rule of this._unsortedRules) {
      rule.updateFields();
    }
  }
}
