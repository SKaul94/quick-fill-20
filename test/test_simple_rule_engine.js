/**
 * @summary test simple rule engine
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import test from 'ava';
import {SimpleRuleEngine} from "../lib/simple_rule_engine.js";
import {config} from "../lib/config.js";

console.log( '=== ava testing simple rule engine ===' );

test('simple', t => {
  const engine1 = new SimpleRuleEngine({A:['a']});
  t.is( engine1.final('a'), 'a' );
});



