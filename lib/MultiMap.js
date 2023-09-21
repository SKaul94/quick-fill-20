/**
 * @module MultiMap.js
 * @summary Map with arrays as values
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

class MultiMap extends Map {
    constructor() {
        super();
        this.add = function( key, value ) {
            const valueArray = super.get( key );
            if ( ! valueArray ) this.set( key, [] );
            valueArray.push( value );
        };
        this.sort = function( comparator ){
            for ( const valueArray of this.values() ){
                valueArray.sort( comparator );
            }
        }
    }
}