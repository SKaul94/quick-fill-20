/**
 * @module PersonEditor.js
 * @summary Personal Case Rule Editor
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import {config} from "./config.js";
import {Rule} from "./Rule.js";
import {ProfileEditor} from "./ProfileEditor.js";
import {setSelection} from "./global_functions.js";

export class PersonEditor extends ProfileEditor {
  constructor( {person, root, title, plus_row} ) {
    console.assert( person );
    super( {owner: 'person', root, title, plus_row} );
    this.person = person;
  }

  templateId(){
    return 'person_template';
  }

  displayOwnRules(){
    console.assert( this.person );
    const tbody = this.rules_area.querySelector('tbody');
    for ( const ruleTemplate of config.initialRulesList.template ){
      const rule = new Rule({
        rule_type: ruleTemplate.rule_type, 
        rule: ruleTemplate.rule,
        pdf: ruleTemplate.pdf,
        value: ruleTemplate.value,
        owner: 'person', 
        person: this.person
      });
      if ( ! rule.row ) rule.makeRow();
      tbody.insertBefore( rule.row, this.plusButtonRow() );
      rule.installListeners();
      if ( rule.row.querySelector('.value').innerText.length === 0 ){
        rule.value = Rule.DB.valueFromAllRulesOf( '${' + rule.rule + '}$' ) || '';
      }
      const fields = rule.row.querySelector('.fields');
      if ( fields ) fields.innerHTML = rule.getAllFieldSpans();
    }
  }

  clearListener(){
    return ( event ) => {
      for ( const field of this.rules_area.querySelectorAll('.value') ) {
        field.innerText = '';
        const parentElement = field.parentElement;
        const rule = Rule.DB.find( rule => rule.id === parentElement.id );
        if ( rule ) rule.value = '';
      }
      // ToDo delete value in corresponding rules
      // Rule.DB.forEach( rule => {
      //   owners.add( rule.owner );
      //   if ( rule.owner === 'person' && rule.person === this.person && rule.value && rule.row ){
      //     rule.value = '';
      //     rule.row.querySelector('.value').innerText = '';
      //   } 
      // });
    };
  }

  evalListener(){
    return ( event ) => {
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'person' && rule.person === this.person && rule.value && rule.value.match(/(\${.+?}\$)/g) ){
          rule.value = Rule.DB.maxReplaced( rule.value );
          rule.row.querySelector('.value').innerText = rule.value;
        } 
      });
    };
  }

  plusListener() {
    const self = this;
    return (event) => {
      event.stopPropagation();
      const newRule = new Rule({rule_type: 'equal', owner: 'person', person: self.person});
      const newRow = newRule.toCaseRow(true, 'neuer Wert', newRule.constructor.headerOptions('person'));
      self.root.querySelector('tbody').insertBefore(newRow, self.plusButtonRow() );
      setSelection(newRow);
      newRule.installCaseListeners();
    }
  }

}
