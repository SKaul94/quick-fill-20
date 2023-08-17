/**
 * @summary test basic rule engine
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import test from 'ava';
import {config} from "../lib/config.js";

console.log( '=== ava testing basic rule engine ===' );

class BasicRuleEngine{
  constructor( rules ){
    this._rules = rules;
  }
  isFinal( source ){
    return !! ( source && source.match(/^\d*$/) );
  }
  final( source ){
    this._history = [];
    if ( config.debug ) console.log( `Rules: ${JSON.stringify(this._rules)}, source: ${source}` );
    return this.finalGen( source ).next().value;
  }
  * finals( source ){
    this._history = [];
    yield* this.finalGen( source );
  }
  finalsArray( source ){
    return Array.from( this.finals( source ) );
  }
  * finalGen( source ){  // traverse all nested levels
    this._history?.push( source );
    // const allReplacements = Array.from( this.replacementsGen( source ) );  // debug only
    for ( const next of this.replacementsGen( source ) ){  // traverse one level
      if ( this.isFinal( next ) ){
        this._history?.push( next );
        if ( config.debug ) console.log( this._history );
        yield next;
      } else {
        if ( ! this._history?.includes(next) ){
          yield* this.finalGen( next );  // one more level deeper
        }
      }
    }
  }
  * replacementsGen( source ){  // one level only
    const regex = /\w/g;  // a variable is a word character
    let match;
    while (match = regex.exec(source)) {  // next variable
      const variable = match[0];
      const values = this._rules[ variable ];
      if ( values ){
        for ( const value of values ){
          yield source.replaceAll(variable, value);
        }
      }
    }
  }
  replacementsArray( source ){
    return Array.from( this.replacementsGen(source) );
  }
}

test('loops', t => {
  const engine1 = new BasicRuleEngine({a:['a']});
  t.is( engine1.final('a'), undefined );
  const engine2 = new BasicRuleEngine({a:['a',1]});
  t.is( engine2.final('a'), '1' );
  const engine3 = new BasicRuleEngine({a:['b', 1],b:['a']});
  t.is( engine3.final('a'), '1' );
});

test('recursive rules', t => {
  const engine1 = new BasicRuleEngine({a:['bc','d'], b:['e','h'], d: [2]});
  t.is( engine1.final('a'), '2' );
  const engine2 = new BasicRuleEngine({a:['bc','d'], b:['e','h'], d: [2], e: ['f']});
  t.is( engine2.final('a'), '2' );
  const engine3 = new BasicRuleEngine({a:['bc','d'], b:['e','h'], d: ['e','f'], f: ['d','3']});
  t.is( engine3.final('a'), '3' );
});

test('replacementsGen', t => {
  const engine = new BasicRuleEngine({a:['b','c']});
  t.deepEqual( Array.from( engine.replacementsGen('a')), ['b','c'] );
});

test('simple rules', t => {
  const engine = new BasicRuleEngine({a:[1]});
  t.is( engine.final('a'), '1' );
});



