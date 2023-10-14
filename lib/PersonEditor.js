/**
 * @module PersonEditor.js
 * @summary Personal Case Rule Editor
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2023 All Rights reserved by author
 */

import {Rule} from "./Rule.js";
import {ProfileEditor} from "./ProfileEditor.js";
import {setSelection} from "./global_functions.js";
import { TemplateEditor } from "./TemplateEditor.js";

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
    for ( const ruleTemplate of TemplateEditor.instance.allRuleSpecs() ){
      // create personal rule from template
      const rule = new Rule({
        rule_type: ruleTemplate.rule_type || 'equal', 
        rule: ruleTemplate.rule,
        pdf: ruleTemplate.pdf,
        value: ruleTemplate.value,
        owner: ruleTemplate.owner || 'case', 
        person: this.person
      });
      if ( ! rule.row ) rule.row = rule.toCaseRow( false, false, Rule.headerOptions('person' ) );
      console.assert( rule.nr );
      tbody.insertBefore( rule.row, this.plusButtonRow() );
      rule.installListeners();
      const valueField = rule.row.querySelector('.value');
      valueField.addEventListener('blur', async event => {
        rule.value = event.target.textContent;
        const label = Array.from( this.pdfDoc.pdfTable.querySelectorAll('.label') )
          .find( label => label.textContent === rule.rule );
        if ( label ){
          label.nextElementSibling.innerHTML = event.target.textContent;
        } else {
          await this.person.activate();
          this.pdfDoc.applyRulesToTable();
        }
        this.pdfDoc.applyTableToPDF();
      });
    }
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
      // do not store personal data, might be sensitive
    }
  }

}
