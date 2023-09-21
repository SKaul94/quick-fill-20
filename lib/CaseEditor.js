/**
 * @module CaseEditor.js
 * @summary Case Rule Editor
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */

import {Rule} from "./Rule.js";
import {ProfileEditor} from "./ProfileEditor.js";
import {setSelection} from "./global_functions.js";

export class CaseEditor extends ProfileEditor {
  constructor( {root, title, plus_row} ) {
    super( {owner: 'case', root, title, plus_row} );
  }

  templateId(){
    return 'case_template';
  }

  clearListener(){
    return ( event ) => {
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'case' ) rule.value = '';
      });
      Rule.DB.store();
    };
  }

  evalListener(){
    return ( event ) => {
      Rule.DB.forEach( rule => {
        if ( rule.owner === 'case' && rule.value && rule.value.match(/(\${.+?}\$)/g) ) rule.value = Rule.DB.maxReplaced( rule.value );
      });
      Rule.DB.store();
    };
  }

  plusListener() {
    const self = this;
    return (event) => {
      event.stopPropagation();
      const newRule = new Rule({rule_type: 'equal', owner: 'case'});
      const newRow = newRule.toCaseRow(true, 'neuer Wert', newRule.constructor.caseOptions());  // ToDo options
      self.root.querySelector('tbody').insertBefore(newRow, self.plusButtonRow() );
      setSelection(newRow);
      newRule.installCaseListeners();
    }
  }

}
