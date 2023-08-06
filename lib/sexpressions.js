/**
 * @module sexpressions.js
 * @summary S-Expressions as Domain Specific Language (DSL) for Rule Extensibility
 * @see https://en.wikipedia.org/wiki/S-expression
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */

import {distance} from "./levenshtein.js";
import {Rule} from './Rule.js';

export class SParser {
  constructor( input ){
    this.input = input;
    this.tokens = this.tokenize();
    this.parserState = -1;
  }
  nextToken(){
    this.lookBehind = this.parserState < 0 ? null : this.tokens[ this.parserState ];
    this.parserState += 1;
    this.currentToken = this.parserState < this.tokens.length ? this.tokens[ this.parserState ] : null;
    this.lookAhead = this.parserState < this.tokens.length - 1 ? this.tokens[ this.parserState + 1 ] : null;
    return this.currentToken;
  }
  nextValidToken(){
    this.nextToken();
    if ( ['(',')'].includes( this.currentToken ) ) return true;
    return trimApostrophe( this.currentToken );
  }
  hasTokens(){
    return this.parserState < this.tokens.length;
  }
  isFinished(){
    return this.parserState >= this.tokens.length;
  }
  tokenize(){
    const tokens = [];
    // 1. split a little bit too much
    const words = this.input.split(/(\s+|\(|\))/);
    // 2. re-assemble strings in apostrophes
    let i = 0;
    while ( i < words.length ){
      let word = words[i];
      if ( word.startsWith('"') && ( ! word.endsWith('"') || word.length === 1 ) ){
        const startIndex = i;
        let nextWord = word;
        while ( ( i === startIndex || ! nextWord.endsWith('"') ) && i < words.length - 1 ){
          i += 1;
          nextWord += words[i];  // re-assembling
        }
        tokens.push( nextWord );
      } else {
        tokens.push( word );
      }
      i += 1;
    }
    return tokens.filter(t => t.trim().length > 0); // push real tokens only
  }
  evaluate( field ){
    this.field = field;
    const startToken = this.nextToken();
    if ( startToken === '(' ) return this.sexpr();
    return this.seval( this.input );
  }
  seval( value ){
    return value; // this place for post-processing of the result. Up to now nothing to do.
  }
  sexpr(){
    const operator = trimApostrophe( this.nextToken() );
    const operands = [];
    const firstOperand = this.nextToken();
    if ( firstOperand === '(' ){
      const subExpr = this.sexpr();
      operands.push( subExpr );
    }
    let nextOperand = this.nextToken();
    // collect all operands into an array
    while ( nextOperand && nextOperand === '(' ){
      const subExpr = this.sexpr();
      operands.push( subExpr );
      nextOperand = this.nextToken();
    }

    if ( nextOperand === ')' ){
      nextOperand = null;  // closing bracket is not a valid operand
    } else {
      this.nextToken(); // consume closing bracket of S-expression, if any, or next token for operators with more than 2 operands
    }

    let regex;
    switch ( operator.toLowerCase() ){
      case 'equal': case 'gleich':
        if ( this.field === trimApostrophe( firstOperand ) ) return trimApostrophe( nextOperand ) || true;
        break;
      case 'substring': case 'teilwort':
        if (this.field?.includes(trimApostrophe(firstOperand))) return trimApostrophe( nextOperand ) || true;
        break;
      case 'superstring': case 'oberwort':
        if (trimApostrophe(firstOperand)?.includes(this.field)) return trimApostrophe( nextOperand ) || true;
        break;
      case 'similar': case 'ähnlich':  // has 3 operands because of threshold
        if (distance(trimApostrophe(firstOperand), this.field) < (parseInt( nextOperand ) || 5)) return this.nextValidToken();
        break;
      case 'regex': case 'muster':
        try { regex = new RegExp(trimApostrophe(firstOperand), 'm') } catch (e) { break }
        if (regex && regex.test(this.field)) return trimApostrophe( nextOperand ) || true;
        break;
      case 'or': case 'oder':
        return trimApostrophe( operands.find( operand => this.seval( operand ) ) );
      case 'and': case 'und':
        if ( operands.every( operand => this.seval( operand ) ) ) return trimApostrophe( nextOperand ) || true;
        break;
      case 'not': case 'nicht':
        if ( ! operands[0] ) return trimApostrophe( nextOperand ) || true;
        break;
      case "re-format-date": case "Datum-reformatieren":
        this.nextToken(); // consume closing bracket before return
        const dateString = operands[0] || firstOperand;
        if ( dateString && dateString !== '(' && dateString !== ')' ){
          const match = /(\d{4}).*?(\d{2}).*?(\d{2})/.exec(dateString);
          if ( match  ){
            return `${match[3]}.${match[2]}.${match[1]}`;
          } else {
            console.warn( `Unknown date format ${dateString}.`  );
            debugger;
          }
        }
        return this.currentToken;
        break;
      case 'transform': case 'umstellen': case 'umordnen':
        try { regex = new RegExp(trimApostrophe(firstOperand), 'gm') } catch (e) { break }
        if ( regex ){
          let stringToBeReplaced = this.currentToken;
          if ( stringToBeReplaced === '(' ) { // nested s-expression
            stringToBeReplaced = this.sexpr();
            this.nextToken(); // consume closing bracket
          }
          if ( stringToBeReplaced ){
            const replacement = stringToBeReplaced.replaceAll(regex, trimApostrophe(nextOperand));
            return trimApostrophe( replacement );
          } else {
            this.nextToken(); // consume closing bracket
            return this.currentToken;
          }
        }
        break;
      case "find": case "findrule": case "rule": case "regel":
        const rule = Rule.DB.findRule( firstOperand, nextOperand );
        if ( rule ) return rule.value;
        break;
      default:
        console.warn( `Unknown operator ${operator}.`  );
        debugger;
    }
  }

  static isSExpression( formular ){
    formular = formular.trim();
    if ( ! formular.startsWith('(') ) return false;
    if ( ! formular.endsWith(')') ) return false;
    // add further tests here
    return true;
  }

  /**
   * @summary tokenize a string
   * @param {String} expression - string mixed with variables and s-expressions
   * @returns {Array<String>} array of tokens
   */
  static tokenizeString( expression ){
    const parser = new SParser( expression );
    return parser.tokenize();
  }

  static isFinal( sourceString ){
    return SParser.parseAll(sourceString).length === 0;
  }

  /**
   * @summary parse a right hand side of a rule like "begin ${a}$ ${b}$ end". Therefore "${" and "}$" are not allowed elsewhere.
   * @param {String} anyString - any string mixed with text and container filled with variables and s-expressions
   * @returns {Array<Object>} arrays of objects indicating start and length of each container found in anyString
   */
  static parseAll( anyString ){
    const result = [];
    const regex = /\${.+?}\$/g;
    let match;
    while (match = regex.exec(anyString)) {
      const { variables, sexpressions } = SParser.parse( match[0] );
      result.push({start: match.index, length: match[0].length, variables, sexpressions});
    }
    return result;
  }

  /**
   * @summary parse a variable container string like ${content}$,
   * in which content is a mix of variables and s-expressions separated by comma.
   * Therefore, commas in variable names and s-expressions are not allowed
   * @param {String} expression - string mixed with variables and s-expressions
   * @returns {Object<String,Array<String>>} arrays for both, variables and s-expressions
   */
  static parse( expression ){
    const result = {variables:[], sexpressions:[]};
    if ( expression.startsWith('${')){
      expression = expression.trim().slice(2);
    }
    if ( expression.endsWith('}$')){
      expression = expression.trim().slice(0,-2);
    }

    const tokens = expression.split(/\s*,\s*/).filter( t => t.trim().length !== 0 );
    for ( const token of tokens ){
      if ( token.startsWith('(') ){
        if ( token.endsWith(')') ){
          result.sexpressions.push(token);
        } else {
          console.warn(`No closing bracket found.`, tokens );
          // ToDo re-assemble tokens split by comma
          // concatenate tokens until closing bracket is found
          // while ( ! reassembledTokens.endsWith(')') ) reassembledTokens += nextToken;
        }
      } else {
        result.variables.push(trimApostrophe(token));
      }
    }
    return result;
  }

  /**
   * @summary find position of closing bracket in any string
   * @param {String} anyString - any string taht contains brackets ()
   * @param {Number} startIndex - position of opening bracket
   * @returns {Number} position of closing bracket
   */
  static findClosingBracket(anyString, startIndex) {
    const regex = /\(|\)/g;
    regex.lastIndex = startIndex + 1;
    let level = 1;
    let match;
    while (match = regex.exec(anyString)) {
      if (!(level += anyString[match.index] === "(" ? 1 : -1 )) return match.index;
    }
  }

  /**
   * @summary evaluate a field given an s-expression
   * @param {String} field - the field of which the value has to be calculated
   * @param {String} sexpression - s-expression declaring the value
   * @returns {String} value of the field as the result of the given s-expression
   */
  static seval( field, sexpression ){
    const parser = new SParser( sexpression );
    return parser.evaluate( field );
  }

  static trimApostrophe( token ){
    if ( ! token ) return token;
    if ( typeof token !== 'string') return token;
    let result = token.trim();
    if ( result.startsWith('"') ) result = result.slice(1);
    if ( result.endsWith('"') ) result = result.slice(0,-1);
    return result;
  }

}


/*********** auxiliary private functions (not exported) **************/

function trimApostrophe( token ){
  return SParser.trimApostrophe( token );
}



