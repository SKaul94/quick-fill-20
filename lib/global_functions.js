/**
 * @module global_functions.js
 * @summary global constants, SVG icons and auxiliary functions
 * @version 2.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022, 2023 All Rights reserved by author
 */


/***************** auxiliary functions ******************/

/**
 * Preprocessing of objects before storing them into IndexedDB:
 * convert all function values in an object to strings in order to conform with "The structured clone algorithm"
 * @param {Object} obj - object with function values
 * @returns {Object} converted object without function values
 * @link https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#Things_that_don%27t_work_with_structured_clones
 */
export const objectWithStringifiedFunctions = (obj) => Object.fromEntries( Object.entries( obj ).map( (key, value) => (key, typeof value === 'function' ? `(${value})` : value )) );

export const objectWithParsedFunctions = (obj) => Object.fromEntries( Object.entries( obj ).map( (key, value) => (key, (typeof value === 'string' && value.indexOf('function') >= 0) ? eval(value) : value )) );

export const jsonStringifyWithFunctions = (obj, space) => JSON.stringify( obj, (key, value) => {
  if (typeof value === 'function') {
    return `(${value})`; // make it a string, surround it by parenthesis to ensure we can revive it as an anonymous function
  }
  return value;
}, space);

export const jsonParseWithFunctions = text => {
  let result = '';
  try {
    result = JSON.parse( text, (key, value) => {
      if (typeof value === 'string' && (( value.indexOf('function') >= 0 ) || value.includes('=>') )) {
        return eval(value);  // convert strings to functions
      }
      return value;
    });
  } catch (error) {
    alert(error);
    debugger;
  }
  return result;
}

export function makeClassName(text) {  // replace all special characters
  return text?.replaceAll(/\s/gi, '_').replaceAll(/\./gi, '_dot_').replaceAll(/#/gi, '_hash_');
}

/**
 * @summary simple replacement of all variables in a string by their values.
 * @param {String} str - string with variables to be substituted
 * @param {Object} params - key-value pairs, in which keys are the variable names
 * @returns {String} result - string with replacements
 */
export function replaceParams(str, params) {
  if (str && params){
    // find all variables in str
    const iterator = str.matchAll(/\${(.+?)}\$/gm);
    for ( const match of iterator ){
      const anyKey = match[1];  // without ${...}$ brackets, maybe composed key
      const subKeys = anyKey.split(/\s*,\s*/);
      const validKey = subKeys.find( subKey => params[ subKey ] );
      const value = params[ validKey ];
      if ( value ) str = str.replaceAll(match[0], typeof value === "function" ? value( validKey ): value );
    }
  }
  return str;
}

export function shorten(str, n) {
  return (str.length > n) ? str.substr(0, n - 2) + '++' : str;
}

export function elementWithID(id) {
  return document.getElementById(id);
}

export function firstElementWithClass(klass) {
  return document.querySelector('.' + klass);
}

export function setSelection( editableNode, startPosition, endPosition ){
  const range = document.createRange();
  const selection = window.getSelection();
  if ( ! editableNode.isContentEditable ) {
    editableNode = editableNode.querySelector('[contenteditable]');
  }
  range.setStart(editableNode,startPosition || 0);
  range.setEnd(editableNode, endPosition || editableNode.childNodes?.length);
  selection.removeAllRanges();
  selection.addRange(range);
  editableNode.focus();
}

/************************* global UI function ****************************/

export const openViewSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="open_view" viewBox="0 0 16 16">
      <path d="M8.5 6a.5.5 0 0 0-1 0v1.5H6a.5.5 0 0 0 0 1h1.5V10a.5.5 0 0 0 1 0V8.5H10a.5.5 0 0 0 0-1H8.5V6z"/>
      <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>
    </svg>`;
export const closeViewSVG = `<svg class="close_view" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M5.5 8a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5z"/>
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
    </svg>`;
export const trashWhiteIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
  <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
</svg>`;
export const keyboardIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-keyboard" viewBox="0 0 16 16">
  <path d="M14 5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12zM2 4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H2z"/>
  <path d="M13 10.25a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm0-2a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm-5 0A.25.25 0 0 1 8.25 8h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 8 8.75v-.5zm2 0a.25.25 0 0 1 .25-.25h1.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25v-.5zm1 2a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm-5-2A.25.25 0 0 1 6.25 8h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 6 8.75v-.5zm-2 0A.25.25 0 0 1 4.25 8h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 4 8.75v-.5zm-2 0A.25.25 0 0 1 2.25 8h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 2 8.75v-.5zm11-2a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm-2 0a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm-2 0A.25.25 0 0 1 9.25 6h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 9 6.75v-.5zm-2 0A.25.25 0 0 1 7.25 6h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 7 6.75v-.5zm-2 0A.25.25 0 0 1 5.25 6h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5A.25.25 0 0 1 5 6.75v-.5zm-3 0A.25.25 0 0 1 2.25 6h1.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-1.5A.25.25 0 0 1 2 6.75v-.5zm0 4a.25.25 0 0 1 .25-.25h.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-.5a.25.25 0 0 1-.25-.25v-.5zm2 0a.25.25 0 0 1 .25-.25h5.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-5.5a.25.25 0 0 1-.25-.25v-.5z"/>
</svg>`;

export function addCollapseIcons(element, targetArea, ...buttons) {
  if ( ! targetArea.classList.contains('hide') ){
    targetArea.style.visibility = 'collapse';
  }
  element.innerHTML += `<span class="icons"> ${openViewSVG} ${closeViewSVG} </span> `;
  const openView = element.querySelector(".open_view");
  const closeView = element.querySelector(".close_view");
  const iconsSpan = element.querySelector(".icons");
  iconsSpan.classList.add('cursor_pointer');
  closeView.style.display = 'none';
  iconsSpan.addEventListener('click', event => {
    event.stopImmediatePropagation();
    if (closeView.style.display === 'none') {
      openView.style.display = 'none';
      closeView.style.display = 'inline';
      for ( const button of buttons ){
        if ( ! button.classList.contains('hide') ) button.style.display = 'inline';
      }
      targetArea.style.visibility = 'visible';
      targetArea.style.height = 'auto'; // style.height = 'fit-content';
      // force re-render and showing of ticks
      for ( const checkbox of targetArea.querySelectorAll('[type="checkbox"]') ){
        if ( checkbox.hasAttribute('checked' )) checkbox.checked = true;
      }
    } else {
      openView.style.display = 'inline';
      closeView.style.display = 'none';
      for ( const button of buttons ){
        button.style.display = 'none';
      }
      targetArea.style.visibility = 'collapse';
      targetArea.style.height = '0';
    }
  });
}
