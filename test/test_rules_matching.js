/**
 * @summary Test Rule Matching
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import test from 'ava';
import {Rule} from '../lib/Rule.js';
import {replaceParams} from '../lib/global_functions.js';
import {SParser} from "../lib/sexpressions.js";
import {Field} from '../lib/Field.js';

console.log( '=== ava testing rule matching ===' );

const setItem = ( key, value ) => true; // console.log( key, value );
const removeItem = ( key ) => true; //console.log( key );
globalThis[ 'localStorage' ] = { setItem, removeItem };

function loadRules( rules ){
  Rule.DB.clear();
  for ( const rule of rules ){
    Rule.createNew( rule );
  }
}

test('PDF exception', t => {
  const rules = [{
    "pdf": "123",
    "rule_type": "equal",
    "rule": "aaa",
    "value": "bbb"
  },
    {
      "rule_type": "equal",
      "rule": "aaa",
      "value": "ccc"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf( new Field({fileName:'123456789.pdf'}, 'aaa', [ { type: 'text '} ] ) ), 'bbb' );
  t.is( Rule.DB.valueFromAllRulesOf( new Field({fileName:'abcd.pdf'}, 'aaa', [ { type: 'text '} ] ) ), 'ccc' );
});

test('multiple PDF exceptions', t => {
  const rules = [{
    "pdf": "123, 456",
    "rule_type": "equal",
    "rule": "aaa",
    "value": "bbb"
  },
    {
      "rule_type": "equal",
      "rule": "aaa",
      "value": "ccc"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf( new Field({fileName:'123xxx.pdf'}, 'aaa', [ { type: 'text '} ] ) ), 'bbb' );
  t.is( Rule.DB.valueFromAllRulesOf( new Field({fileName:'456xxx.pdf'}, 'aaa', [ { type: 'text '} ] ) ), 'bbb' );
  t.is( Rule.DB.valueFromAllRulesOf( new Field({fileName:'abcd.pdf'}, 'aaa', [ { type: 'text '} ] ) ), 'ccc' );
});

test('apply rule in a single step', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "aaa",
    "value": "bbb"
  }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf( '${aaa}$' ), 'bbb' );
});

test('check rule', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "aaa",
    "value": "${Ort}$"
  },{
    "rule_type": "equal",
    "rule": "bbb",
    "value": "${Ort}"
  },{
    "rule_type": "equal",
    "rule": "ccc",
    "value": "${Ort"
  }];
  loadRules( rules );
  t.is( Rule.DB.getRuleByKey('aaa').check(), true );
  t.is( Rule.DB.getRuleByKey('bbb').check(), false );
  t.is( Rule.DB.getRuleByKey('ccc').check(), false );
});

test('Two level Backtracking', t => {
  const rules = [
    {
      "rule_type": "equal",
      "rule": "a",
      "value": "${b}$ ${c}$",
      owner: "case"
    },
    {
      "rule_type": "equal",
      "rule": "b",
      "value": "${e}$ ${f}$",
    },
    {
      "rule_type": "equal",
      "rule": "e",
      "value": "1",
    },
    {
      "rule_type": "equal",
      "rule": "a",
      "value": "${d}$",
    },
    {
      "rule_type": "equal",
      "rule": "d",
      "value": "2",
    }
  ];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${a}$'), '2' );
});

test ('re-format-date', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "objekte.personalie.geburtsdatum",
    "value": "20000125"
  },{
    rule_type: "substring",
    rule: 'gebdat',
    value: '${(re-format-date (findrule substring personalie.geburtsdatum))}$'
  }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${f.gebdat.1}$'), '25.01.2000' );
});

test('Backtracking Multiple Rules', t => {
  const rules = [
    {
      "rule_type": "substring",
      "rule": "ghi",
      "value": "123",
      owner: "case"
    },
    {
      "rule_type": "substring",
      "rule": "xyz",
      "value": "${abc}$",
    },
    {
      "rule_type": "substring",
      "rule": "xyz",
      "value": "${def}$",
    },
    {
      "rule_type": "substring",
      "rule": "xyz",
      "value": "${ghi}$",
    },
  ];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xyz}$'), '123' );
});

test('apply alternatives first', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "xxx",
    "value": "${yyy, zzz}$"
  },
    {
      "rule_type": "equal",
      "rule": "yyy",
      "value": "y-value"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xxx}$'), 'y-value' );
});



test('simple replacements', t => {
  t.is( replaceParams('${a}$',{a:1}), '1' );
  t.is( replaceParams('${a}$',{}), '${a}$' );
  t.is( replaceParams('${a}$',{b:2}), '${a}$' );
  t.is( replaceParams('${a}$${b}$',{a:1,b:2}), '12' );
});




test('Backtracking Variables and S-Expressions', t => {
  const rules = [
    {
      "rule_type": "superstring",
      "rule": "objekte.personalie.geburtsdatum",
      "value": "20000125",
      owner: "case"
    },
    {
      rule_type: "substring",
      rule: 'gebdat',
      value: 'Anfang ${Geburtsdatum, (transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))}$ Ende' },
  ];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${f.gebdat.1}$'), 'Anfang 25.01.2000 Ende' );
});





test('Backtracking Multiple Variables', t => {
  const rules = [
    {
      "rule_type": "substring",
      "rule": "ghi",
      "value": "123",
      owner: "case"
    },
    {
      "rule_type": "substring",
      "rule": "xyz",
      "value": "${abc, def, ghi}$",
    }
  ];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xyz}$'), '123' );
});

test('Transform values', t => {
  const rules = [
    {
      "rule_type": "superstring",
      "rule": "objekte.personalie.geburtsdatum",
      "value": "20000125",
      owner: "case"
    },
    {
      rule_type: "substring",
      rule: 'gebdat',
      value: '${(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))}$'
    }
  ];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${f.gebdat.1}$'), '25.01.2000' );
  t.is( SParser.seval('${field1}$', '(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))' ), '25.01.2000' );
});

test('Find Rules', t => {
  const rules = [
    {
      "rule_type": "superstring",
      "rule": "objekte.personalie.geburtsdatum",
      "value": "20000125",
      owner: "case"
    }
  ];
  loadRules( rules );
  t.is( Rule.DB.findRule('substring',  'personalie.geburtsdatum').value, '20000125' );
});



test('apply rule in two steps', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "ccc",
    "value": "${ddd}$"
    },
    {
      "rule_type": "equal",
      "rule": "ddd",
      "value": "eee"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${ccc}$'), 'eee' );
});

test('apply rule in three steps', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "f.ort.1",
    "value": "Berlin"
    },
    {
      "rule_type": "substring",
      "rule": "ortdatum",
      "value": "${f.ort.1}$, ${datum}$"
    },
    {
      "rule_type": "substring",
      "rule": "datum",
      "value": "13.9.2024"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf( '${f.ortdatum.1}$' ), 'Berlin, 13.9.2024' );
});

test('apply concatenation first ', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "xxx",
    "value": "${yyy}$, ${zzz}$"
    },
    {
      "rule_type": "equal",
      "rule": "yyy",
      "value": "y-value"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xxx}$'), undefined );
});

test('apply concatenation second', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "xxx",
    "value": "${yyy}$, ${zzz}$"
    },
    {
      "rule_type": "equal",
      "rule": "zzz",
      "value": "z-value"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xxx}$'), undefined );
});

test('apply concatenation both', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "xxx",
    "value": "${yyy}$, ${zzz}$"
    },
    {
      "rule_type": "equal",
      "rule": "yyy",
      "value": "y-value"
    },
    {
      "rule_type": "equal",
      "rule": "zzz",
      "value": "z-value"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xxx}$'), 'y-value, z-value' );
});

test('apply alternatives second', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "xxx",
    "value": "${yyy, zzz}$"
  },
    {
      "rule_type": "equal",
      "rule": "zzz",
      "value": "z-value"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xxx}$'), 'z-value' );
});

test('apply alternatives both', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "xxx",
    "value": "${yyy, zzz}$"
  },
    {
      "rule_type": "equal",
      "rule": "yyy",
      "value": "y-value"
    },
    {
      "rule_type": "equal",
      "rule": "zzz",
      "value": "z-value"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xxx}$'), 'y-value' );
});

test('apply alternatives second substring', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "xxx",
    "value": "${yyy, zzz}$"
  },
    {
      "rule_type": "substring",
      "rule": "z",
      "value": "z-value"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf('${xxx}$'), 'z-value' );
});

test('apply alternatives second equal vorname', t => {
  const rules = [{
    "rule_type": "substring",
    "rule": "vorn",
    "value": "${Vorname, vorname.bezeichnung.2}$"
  },
    {
      "rule_type": "superstring",
      "rule": "objekte.personalie.vorname.bezeichnung.2",
      "value": "Anton",
      owner: "case"
    }];
  loadRules( rules );
  t.is( Rule.DB.valueFromAllRulesOf( '${f.vorn.1}$' ), 'Anton' );
});



