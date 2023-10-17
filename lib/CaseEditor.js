/**
 * @module CaseEditor.js
 * @summary Case Rule Editor
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */

import {config} from "./config.js";
import {Rule} from "./Rule.js";
import {ProfileEditor} from "./ProfileEditor.js";
import {setSelection} from "./global_functions.js";
import {saveInitialLists} from "../index.js";

export class CaseEditor extends ProfileEditor {
  constructor( {root, title, plus_row} ) {
    super( {owner: 'case', root, title, plus_row} );
    this.render();
    if ( config.prefill ) this.rules_area.querySelector('.prefill').classList.remove('hide');
    if ( config.eval ) this.rules_area.querySelector('.eval').classList.remove('hide');
    console.assert( ! CaseEditor.instance ); // Singleton
    CaseEditor.instance = this;
  }

  async plusListener( event ){
    await super.plusListener.bind( this )( event );
    const ruleField = this.plusButtonRow().previousElementSibling.querySelector('td.rule');
    ruleField.contentEditable = "true";
    setSelection(ruleField);
    ruleField.addEventListener( 'blur', event => {
      const oldRule = Rule.DB.getById( ruleField.parentElement.id );
      const newRule = { rule: ruleField.textContent };
      ProfileEditor.updateConfig( { newRule, oldRule } );
      saveInitialLists({silent: true});
      PdfDoc.updateAll();
    });
  } 

  templateId(){
    return 'case_template';
  }

  displayOwnRules(){
    const tbody = this.rules_area.querySelector('tbody');
    for ( const caseRule of config.caseRules ) {
      if ( Array.from( tbody.querySelectorAll('td.rule') ).map(td => td.innerText).includes(caseRule) ) continue;
      const rule = new Rule({rule_type: 'equal', rule: caseRule, owner: 'case'})
      if ( ! rule.row ) rule.makeRow();
      tbody.insertBefore( rule.row, this.plusButtonRow() );
      rule.installListeners();
      
      // update fields
      const valueField = rule.row.querySelector('.value');
      if ( valueField.innerText.length === 0 ){
        rule.value = Rule.DB.valueFromAllRulesOf( '${' + rule.rule + '}$' ) || '';
        valueField.innerText = rule.value;
      }
      const fields = rule.row.querySelector('.fields');
      if ( fields ) fields.innerHTML = rule.getAllFieldSpans();
    }
    super.displayOwnRules();
  }

  clearListener( event ){
    return ( event ) => {
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'case' ) rule.value = '';
        // td.innerText = ''; is done automatically in Rule
      });
    };
  }

  evalListener( event ){
    return ( event ) => {
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'case' && rule.value && rule.value.match(/(\${.+?}\$)/g) ) rule.value = Rule.DB.maxReplaced( rule.value );
      });
    };
  }

  allCases(){
    const allCaseRules = [];
    for ( const row of this.rules_area.querySelectorAll('tbody tr.row') ) { // skip header and footer
      const rule = row.querySelector('.rule').textContent;
      // const value = row.querySelector('.value').textContent;
      allCaseRules.push( rule );
    }
    return allCaseRules;
  }

  allRuleSpecs(){
    const ruleSpecs = [];
    for ( const row of this.rules_area.querySelectorAll('tbody tr.row') ) { // skip header and footer
      const rule = row.querySelector('.rule').textContent;
      const value = row.querySelector('.value').textContent;
      if ( value ) ruleSpecs.push( { rule, value } );
    }
    return ruleSpecs;
  }

}
