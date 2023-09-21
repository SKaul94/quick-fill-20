/**
 * @module SimpleRuleEngine.js
 * @summary simple engine for executing rules for filling forms
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import {config} from './config.js';

class SimpleRuleEngine {
    constructor( { personal, universal } ){
        this.personalRuleBase = personal;
        this.universalRuleBase = universal;
        this._cache = null;
        this._ruleIndex = null;
        this._history = null;
        this.init();
    }

    get cache(){
        if ( ! this._cache ) this._cache = new MultiMap();
        return this._cache;
    }

    get ruleIndex(){
        if ( ! this._ruleIndex ) this._ruleIndex = new MultiMap();
        return this._ruleIndex;
    }

    get history(){
        if ( ! this._history ) this._history = new Map();
        return this._history;
    }

    init(){
        this.clear();
        for ( rule of this.universalRuleBase ){
            this.ruleIndex.add( rule.rule, rule );
        }
        for ( rule of this.personalRuleBase ){
            this.ruleIndex.add( rule.rule, rule );
        }
        this._ruleIndex.sort( (r1, r2) => r1.nr - r2.nr );
    }
    

    clear(){
        this._cache = null;
        this._ruleIndex = null;
    }

    *recursiveSearch( input ){
        const cachedResult = this.cache.get( input );
        if ( cachedResult ) for ( const output of cachedResult ){
            yield output;
        }
        for ( const rule of this.fittingRules( input ) ){
            for (const output of this.executeRule( input, rule ) ){
                if ( this.isFinal( output ) ){
                    this.cache.add( input, output );
                    yield output;
                }
                else {
                    yield* this.recursiveSearch( output );
                }
            }
        }
    }

    *fittingRules( input ){
        for ( const rule of this.ruleIndex.get( input ) ){
            yield rule;
        }
    }

    *executeRule( input, rule ){
        for ( const placeholder of input.match(/(\$\{.+?\}\$)/gim) ){
            yield input.replace( placeholder, rule.value );
        }
    }

    isFinal( output ){
        return ! output.match(/\$\{.+\}\$/gim); // if there is any placeholder, it's not final
    }
}
