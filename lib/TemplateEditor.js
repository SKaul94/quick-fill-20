/**
 * @module TemplateEditor.js
 * @summary Template Rule Editor
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import {config} from "./config.js";
import {Rule} from "./Rule.js";
import {ProfileEditor} from "./ProfileEditor.js";
import {setSelection} from "./global_functions.js";
import {saveInitialLists} from "../index.js";

export class TemplateEditor extends ProfileEditor {
  constructor({root, title, plus_row}) {
    super( {owner: 'template', root, title, plus_row} );
    this.owner = 'template';
    console.assert( ! TemplateEditor.instance ); // Singleton
    TemplateEditor.instance = this;
  }

  templateId(){
    return 'template_template';
  }

  displayOwnRules(){
    const tbody = this.rules_area.querySelector('tbody');
    for ( const ruleTemplate of config.initialTemplateList ){
      const rule = Rule.createNew({
        rule_type: ruleTemplate.rule_type, 
        rule: ruleTemplate.rule,
        value: ruleTemplate.value,
        owner: 'template'
      });
      if ( ! rule.row ) rule.toCaseRow( false, rule.rule, Rule.headerOptions( this.owner ) );
      rule.row.setAttribute( 'title', 'Rule Template ' + rule.row.id );
      tbody.insertBefore( rule.row, this.plusButtonRow() );
      rule.installListeners();
    }
  }

  plusListener() {
    const self = this;
    const tbody = this.rules_area.querySelector('tbody');
    const count = tbody.childElementCount - 2;
    return async (event) => {
      event.stopPropagation();
      const newRule = Rule.createNew({ rule_type: 'equal', owner: self.owner });
      newRule.toCaseRow( true, newRule.rule, Rule.headerOptions( self.owner ) );
      newRule.row.id = 'T' + count;
      newRule.row.setAttribute( 'title', 'Rule Template ' + count );
      tbody.insertBefore( newRule.row, this.plusButtonRow() );
      newRule.installListeners();
      setSelection( newRule.row );
      saveInitialLists({silent: true});
    }
  }

  allRuleSpecs(){
    const ruleSpecs = [];
    for ( const row of this.rules_area.querySelectorAll('tbody tr.row') ) { // skip header and footer
      ruleSpecs.push( this.rowToSpec( row ) );
    }
    return ruleSpecs;
  }

  clear(){
    for ( const row of this.rules_area.querySelectorAll('tbody tr.row') ) { // skip header and footer
      row.parentElement.removeChild( row );
    }
    config.initialTemplateList = [];
    Rule.DB.removeAll( rule => rule.owner === this.owner );
  }
}