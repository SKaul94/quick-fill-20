/**
 * @module CaseEditor.js
 * @summary Case Rule Editor
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */

import {config} from "./config.js";
import {Rule} from "./Rule.js";
import {ProfileEditor} from "./ProfileEditor.js";
import {setSelection} from "./global_functions.js";

export class CaseEditor extends ProfileEditor {
  constructor( {root, title, plus_row} ) {
    super( {owner: 'case', root, title, plus_row} );
    this.render();
    if ( config.prefill ) this.rules_area.querySelector('.prefill').classList.remove('hide');
    if ( config.eval ) this.rules_area.querySelector('.eval').classList.remove('hide');
  }

  templateId(){
    return 'case_template';
  }

  clearListener(){
    return ( event ) => {
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'case' ) rule.value = '';
      });
    };
  }

  evalListener(){
    return ( event ) => {
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'case' && rule.value && rule.value.match(/(\${.+?}\$)/g) ) rule.value = Rule.DB.maxReplaced( rule.value );
      });
    };
  }

  plusListener() {
    const self = this;
    return (event) => {
      event.stopPropagation();
      const newRule = new Rule({rule_type: 'equal', owner: 'case'});
      const newRow = newRule.toCaseRow(true, 'neuer Wert', newRule.constructor.headerOptions('case'));  // ToDo options
      self.root.querySelector('tbody').insertBefore(newRow, self.plusButtonRow() );
      setSelection(newRow);
      newRule.installCaseListeners();
    }
  }

}
