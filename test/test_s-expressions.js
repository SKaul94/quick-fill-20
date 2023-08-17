/**
 * @summary Test S-Expressions
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import test from 'ava';
import {SParser} from '../lib/sexpressions.js';

console.log( '=== ava testing s expressions ===' );

test ('re-format-date', t => {
  t.is( SParser.seval('gebdat', '(re-format-date 20000125)' ), '25.01.2000' );
  t.is( SParser.seval('gebdat', '(re-format-date 2000/01/25)' ), '25.01.2000' );
  t.is( SParser.seval('gebdat', '(re-format-date 2000-01-25)' ), '25.01.2000' );
  t.is( SParser.seval('gebdat', '(re-format-date 2000:01:25)' ), '25.01.2000' );
  t.is( SParser.seval('gebdat', '(re-format-date 2000_01_25)' ), '25.01.2000' );
  t.is( SParser.seval('gebdat', '(re-format-date 2000.01.25)' ), '25.01.2000' );
});

test('SParser seval', t => {
  t.is( SParser.seval('f.gebdat.1', '(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))' ), null );
  t.is( SParser.seval('field', '(equal "field" "value")' ), 'value' );
  t.is( SParser.seval('field', '(equal field value)' ), 'value' );
  t.is( SParser.seval('field', '(equal "field" "value" )' ), 'value' );
  t.is( SParser.seval('field', '(substring "fi" value)' ), 'value' );
  t.is( SParser.seval('field', '(substring "fi" value )' ), 'value' );
  t.is( SParser.seval('field', '(superstring longfield.added "value")' ), 'value' );
  t.is( SParser.seval('field', '(superstring longfield.added "value" ) ' ), 'value' );
});

test('SParser parse all', t => {
  t.deepEqual( SParser.parseAll('${Geburtsdatum, (transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))}$'), [{start:0, length:109, variables:['Geburtsdatum'],sexpressions:['(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))']}]);
  t.deepEqual( SParser.parseAll('Anfang ${Geburtsdatum, (transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))}$ Ende'), [{start:7, length:109, variables:['Geburtsdatum'],sexpressions:['(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))']}]);
  t.deepEqual( SParser.parseAll('an ${a}$ ende'), [{start:3, length:5, variables:['a'],sexpressions:[]}] );
  t.deepEqual( SParser.parseAll('an ${a}$ mitte ${b}$ ende'), [{start:3, length:5, variables:['a'],sexpressions:[]}, {start:15, length:5, variables:['b'],sexpressions:[]}]);
});

test('SParser parse variables', t => {
  t.deepEqual( SParser.parse('${a, b, (c)}$'), {variables:['a','b'], sexpressions:['(c)']} );
  t.deepEqual( SParser.parse('${Geburtsdatum, (transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))}$'), {variables:['Geburtsdatum'], sexpressions:['(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))']} );
  t.deepEqual( SParser.parse('${}$'), {variables:[], sexpressions:[]} );
  t.deepEqual( SParser.parse('${a}$'), {variables:['a'], sexpressions:[]} );
  t.deepEqual( SParser.parse('${a, b}$'), {variables:['a','b'], sexpressions:[]} );
  t.deepEqual( SParser.parse('${(a)}$'), {variables:[], sexpressions:['(a)']} );
  t.deepEqual( SParser.parse('${(a),(b)}$'), {variables:[], sexpressions:['(a)','(b)']} );
  t.deepEqual( SParser.parse('${"a", "b", ("c")}$'), {variables:['a','b'], sexpressions:['("c")']} );
});

test('Transform expressions', t => {
  t.is( SParser.seval('field1', '(transform "(\\w+),\\s*(\\w+)" "$2 $1" "Berlinger, Anton")' ), 'Anton Berlinger' );
  t.is( SParser.seval('field1', '(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" 20000125)' ), '25.01.2000' );
});

test('NOT expressions', t => {
  t.is( SParser.seval('field1', '(not (substring abc) value1)' ), 'value1' );
  t.is( SParser.seval('field1', '(not (or (substring abc)(superstring xyz)) value1)' ), 'value1' );
  t.is( SParser.seval('field1', '(not (and (substring abc)(superstring xyz)) value1)' ), 'value1' );
});

test('tokenizer is OK', t => {
  t.deepEqual( SParser.tokenizeString('"(\\d{4})(\\d{2})(\\d{2})"'), ['"(\\d{4})(\\d{2})(\\d{2})"'] );
  t.deepEqual( SParser.tokenizeString('"$3.$2.$1" 20000125'), ['"$3.$2.$1"', "20000125"] );
  t.deepEqual( SParser.tokenizeString('" (\\d{4}) (\\d{2}) (\\d{2} ) "'), ['" (\\d{4}) (\\d{2}) (\\d{2} ) "'] );
  t.deepEqual( SParser.tokenizeString('(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" 20000125 ) '), ['(','transform','"(\\d{4})(\\d{2})(\\d{2})"', '"$3.$2.$1"','20000125',')'] );
  t.deepEqual( SParser.tokenizeString('"ab" "cd"'), ['"ab"', '"cd"'] );
  t.deepEqual( SParser.tokenizeString('"ab cd"'), ['"ab cd"'] );
  t.deepEqual( SParser.tokenizeString('(equal "str" "Ku damm")'), ['(','equal','"str"','"Ku damm"',')'] );
  t.deepEqual( SParser.tokenizeString('( equal "str" "Kudamm" )'), ['(','equal','"str"','"Kudamm"',')'] );
  t.deepEqual( SParser.tokenizeString('(or (or (a)(b))(c))'), [
      '(', 'or', '(', 'or',
      '(', 'a',  ')', '(',
      'b', ')',  ')', '(',
      'c', ')',  ')'
    ]
  );
});

test('AND/OR combinations', t => {
  t.is( SParser.seval('field1', '(and (or (substring fie)(superstring field123)) value1)' ), 'value1' );
  t.is( SParser.seval('field1', '(or (and (substring fie)(superstring field123) value1 ))' ), 'value1' );
  t.is( SParser.seval('field1', '(or (and (substring fie)(superstring field123) value1 )(equal field1 value2))' ), 'value1' );
  t.is( SParser.seval('field1', '(or (equal field1 value2)(and (substring fie)(superstring field123) value1 ))' ), 'value2' );
});

test('AND expressions', t => {
  t.is( SParser.seval('field1', '(and (substring fie)(superstring field123) value1)' ), 'value1' );
  t.is( SParser.seval('field1', '(and (superstring field123)(substring fie) value1)' ), 'value1' );
  t.is( SParser.seval('field1', '(and (substring fie)(superstring field123) "value1" )' ), 'value1' );
});

test('OR expressions', t => {
  t.is( SParser.seval('field3', '(or (or (equal field1 value1)(equal field2 value2))(equal field3 value3))' ), 'value3' );
  t.is( SParser.seval('field2', '(or (or (equal field1 value1)(equal field2 value2))(equal field3 value3))' ), 'value2' );
  t.is( SParser.seval('field1', '(or (or (equal field1 value1)(equal field2 value2))(equal field3 value3))' ), 'value1' );
  t.is( SParser.seval('field2', '(or (equal field1 value1)(equal field2 value2))' ), 'value2' );
  t.is( SParser.seval('field1', '(or (equal field1 value1)(equal field2 value2))' ), 'value1' );
});





