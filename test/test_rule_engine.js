/**
 * @summary test rule engine
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import test from 'ava';
import {SParser} from '../lib/sexpressions.js';
import {RuleEngine} from '../lib/RuleEngine.js';
import {Rule} from '../lib/Rule.js';

console.log( '=== ava testing rule engine ===' );

function loadRules( rules ){
  Rule.DB.clear();
  for ( const rule of rules ){
    new Rule( rule );  // implicit Rule.DB.addRule
  }
}

test('remove all', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "vorn",
    "value": "${Vorname}$"
  },
    {
      "rule_type": "equal",
      "rule": "Vorname",
      "value": "Anton",
      "owner": "case"
    }];
  loadRules( rules );
  t.is( Rule.DB.count(), 2 );
  Rule.DB.removeAll( rule => rule.owner === 'case' );
  t.is( Rule.DB.count(), 1 );
});

test('remove rule', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "vorn",
    "value": "${Vorname}$"
  },
    {
      "rule_type": "equal",
      "rule": "Vorname",
      "value": "Anton"
    }];
  loadRules( rules );
  t.is( Rule.DB.count(), 2 );
  const engine = new RuleEngine( Rule.DB );
  const ruleToBeRemoved = Rule.DB.getRuleByKey('vorn');
  ruleToBeRemoved.remove();
  t.is( Rule.DB.count(), 1 );
  t.is( engine.final('${Vorname}$'), 'Anton' );
});

test('simple rules', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "vorn",
    "value": "${Vorname}$"
  },
    {
      "rule_type": "equal",
      "rule": "Vorname",
      "value": "Anton"
    }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${vorn}$'), 'Anton' );
  t.is( Rule.DB.valueFromAllRulesOf('${vorn}$'), 'Anton' );

});

test('partial replacements 1', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "Alk_am_Steuer",
    "value": "Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille}$\u2030."
  },
    {
      "rule_type": "equal",
      "rule": "Familienname",
      "value": "Abraham"
    }];
  loadRules(rules);
  const engine = new RuleEngine(Rule.DB);
  t.deepEqual(engine.replacementsArray('${Alk_am_Steuer}$'),  [
      '${Alk_am_Steuer}$',
      'Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille}$‰.',
      'Blutprobe bei PGÜ Abraham ergab ${Promille}$‰.'
    ]
  );
});

test('partial replacements 2', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "Alk_am_Steuer",
    "value": "Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille}$\u2030."
  },
    {
      "rule_type": "equal",
      "rule": "Familienname",
      "value": "Abraham"
    },
    {
      "rule_type": "equal",
      "rule": "Promille",
      "value": "123"
    }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.deepEqual( engine.replacementsArray( '${Alk_am_Steuer}$'), [
    '${Alk_am_Steuer}$',
    'Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille}$‰.',
    'Blutprobe bei PGÜ Abraham ergab ${Promille}$‰.',
    'Blutprobe bei PGÜ ${Familienname}$ ergab 123‰.',
    'Blutprobe bei PGÜ Abraham ergab 123‰.',
  ] );
});

test('partial replacements 3', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "Alk_am_Steuer",
    "value": "Blutprobe bei PGÜ ${Familienname1}$ ergab ${Promille1}$\u2030."
  },
    {
      "rule_type": "equal",
      "rule": "Familienname1",
      "value": "${Familienname}$"
    },
    {
      "rule_type": "equal",
      "rule": "Promille1",
      "value": "${Promille}$"
    },
    {
      "rule_type": "equal",
      "rule": "Familienname",
      "value": "Abraham"
    },
    {
      "rule_type": "equal",
      "rule": "Promille",
      "value": "123"
    }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.deepEqual( engine.replacementsArray( '${Alk_am_Steuer}$'), [
    '${Alk_am_Steuer}$',
    'Blutprobe bei PGÜ ${Familienname1}$ ergab ${Promille1}$‰.',
    'Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille1}$‰.',
    'Blutprobe bei PGÜ ${Familienname1}$ ergab ${Promille}$‰.',
    'Blutprobe bei PGÜ Abraham ergab ${Promille1}$‰.',
    'Blutprobe bei PGÜ ${Familienname}$ ergab ${Promille}$‰.',
    'Blutprobe bei PGÜ Abraham ergab ${Promille}$‰.',
    'Blutprobe bei PGÜ Abraham ergab 123‰.',
    'Blutprobe bei PGÜ ${Familienname}$ ergab 123‰.',
    'Blutprobe bei PGÜ ${Familienname1}$ ergab 123‰.',
  ] );
});

test('date conversion', t => {
  const rules = [{
    "rule_type": "date",
    "rule": "f.geburtsdatum.1",
    "value": "20131030"
  },{
    "rule_type": "date",
    "rule": "f.geburtsdatum.2",
    "value": "${personalie.geburtsdatum}$"
  },
    {
      "rule_type": "superstring",
      "rule": "objekt.personalie.geburtsdatum",
      "value": "20131030"
    }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${f.geburtsdatum.1}$'), '30.10.2013' );
  t.is( engine.final('${f.geburtsdatum.2}$'), '30.10.2013' );
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
    },
    {
      "rule_type": "equal",
      "rule": "zzz",
      "value": "z-value"
    }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xxx}$'), 'y-value, z-value' );
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
      "value": "${heute}$"
    },
    {
      "rule_type": "equal",
      "rule": "heute",
      "value": "13.9.2024",
    }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${f.ortdatum.1}$'), 'Berlin, 13.9.2024' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${a}$'), '2' );
});

test('value with loops', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "vorn",
    "value": "${vorn}$"
  },
    {
      "rule_type": "equal",
      "rule": "vorn",
      "value": "${zwischen}$"
    },
    {
      "rule_type": "equal",
      "rule": "zwischen",
      "value": "${vorn}$"
    },
    {
      "rule_type": "equal",
      "rule": "vorn",
      "value": "Anton"
    }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${vorn}$'), 'Anton' );
});

test('loops', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "vorn",
    "value": "${vorn}$"
  }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${vorn}$'), undefined );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${f.gebdat.1}$'), '25.01.2000' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xyz}$'), '123' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xxx}$'), 'y-value' );
});

test('apply rule in a single step', t => {
  const rules = [{
    "rule_type": "equal",
    "rule": "aaa",
    "value": "bbb"
  }];
  loadRules( rules );
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${aaa}$'), 'bbb' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${f.gebdat.1}$'), 'Anfang 25.01.2000 Ende' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xyz}$'), '123' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${f.gebdat.1}$'), '25.01.2000' );
  t.is( SParser.seval('field1', '(transform "(\\d{4})(\\d{2})(\\d{2})" "$3.$2.$1" (findrule substring personalie.geburtsdatum))' ), '25.01.2000' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${ccc}$'), 'eee' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xxx}$'), 'y-value, z-value' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xxx}$'), 'z-value' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xxx}$'), 'y-value' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${xxx}$'), 'z-value' );
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
  const engine = new RuleEngine( Rule.DB );
  t.is( engine.final('${f.vorn.1}$'), 'Anton' );
});



