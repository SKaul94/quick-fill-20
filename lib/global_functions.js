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

export const mergeObjects = (obj1, obj2) => {
  // https://stackoverflow.com/questions/72756258/how-to-merge-two-objects-and-keep-the-hierarchy-between-properties
  if ( ! obj1 ) return obj2;
  if ( ! obj2 ) return obj1;
  const Obj1Keys = Object.keys(obj1)
  const Obj2Keys = Object.keys(obj2)
  const allKeys = [...new Set([...Obj1Keys, ...Obj2Keys])]
  const newObj = {}
  for (let i = 0; i < allKeys.length; i++) {
      const key = allKeys[i]
      if (typeof obj1[key] === "object" && typeof obj2[key] === "object"){
        newObj[key] = mergeObjects(obj1[key], obj2[key])
      }     
  }
  return Object.assign(obj1, obj2, newObj)
};

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

export const filename_language_mapper = filename => {
  // try to infer language from file name
  const defaultLanguage = 'deutsch';
  let parts = filename.split('_'); 
  if ( parts[1]?.match(/[A-Za-z]+/) ) return parts[1];
  const match2 = parts[2]?.match(/\d+([a-z]).*/);
  if ( match2 && match2[1] ){
    switch ( match2[1] ){
      case 'a': return 'englisch';
      // ToDo insert other languages
      default: return defaultLanguage;
    }
  } 
  return defaultLanguage;
};

export async function getFromPasteBuffer( mimeType = 'image/' ){
  const auth = await navigator.permissions.query( { name: "clipboard-read" } );
  if( auth.state !== 'denied' ) {
    const item_list = await navigator.clipboard.read();
    let image_type; // we will feed this later
    const item = item_list.find( item => // choose the one item holding our image
      item.types.some( type => { // does this item have our type
        if( type.startsWith( mimeType ) ) {
          image_type = type; // store which kind of image type it is
          return true;
        }
      } )
    );

    const blob = item && await item.getType( image_type );
    if ( blob ){
      const url = URL.createObjectURL( blob );
      return { blob, url };
    }
  }
}

export async function blobToBase64( blob ){
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onerror = (e) => reject(fileReader.error);
    fileReader.onloadend = (e) => {
      const dataUrl = fileReader.result;
      // remove "data:mime/type;base64," prefix from data url
      const base64 = dataUrl; // dataUrl.substring(dataUrl.indexOf(',') + 1);
      resolve(base64);
    };
    fileReader.readAsDataURL(blob);
  });
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
export const configSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" fill-opacity="0" stroke="currentColor" stroke-width="1" viewBox="0 0 16 16">
  <path d="M 13.375 5.865 L 13.361 0.865 C 13.361 0.865 13.359 3.343 13.354 3.348 C 13.349 3.353 10.573 2.241 9.104 2.075 C 7.656 1.911 6.268 2.054 5.007 2.783 C 3.591 3.601 2.481 4.936 1.996 6.438 C 1.537 7.862 1.938 9.62 2.437 11.031 C 2.886 12.3 4.089 13.388 5.194 14.048 C 6.486 14.82 7.978 14.687 9.277 14.437 C 10.415 14.218 11.296 13.616 12.082 12.895 C 12.61 12.411 13.275 11.108 13.275 11.108 L 13.28 8.625 L 13.317 14.273"/>
</svg>`;
export const archiveSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-archive" viewBox="0 0 16 16">
  <path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
</svg>`;
export const bag_checked = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bag-check" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M10.854 8.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708 0"/>
  <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>
</svg>`;
export const cloudSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-arrow-down" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M7.646 10.854a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 9.293V5.5a.5.5 0 0 0-1 0v3.793L6.354 8.146a.5.5 0 1 0-.708.708z"/>
<path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383m.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
</svg>`;
export const keySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-key" viewBox="0 0 16 16">
<path d="M0 8a4 4 0 0 1 7.465-2H14a.5.5 0 0 1 .354.146l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0L13 9.207l-.646.647a.5.5 0 0 1-.708 0L11 9.207l-.646.647a.5.5 0 0 1-.708 0L9 9.207l-.646.647A.5.5 0 0 1 8 10h-.535A4 4 0 0 1 0 8m4-3a3 3 0 1 0 2.712 4.285A.5.5 0 0 1 7.163 9h.63l.853-.854a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.793-.793-1-1h-6.63a.5.5 0 0 1-.451-.285A3 3 0 0 0 4 5"/>
<path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
</svg>`;
export const keyPlusSVG = `<svg width="16" height="16" fill="currentColor" class="bi bi-key"  viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
<path d="M 0 10.262 C -0.002 7.183 3.331 5.257 5.998 6.796 C 6.607 7.147 7.113 7.653 7.465 8.262 L 14 8.262 C 14.132 8.262 14.26 8.315 14.354 8.408 L 15.854 9.908 C 16.049 10.104 16.049 10.421 15.854 10.616 L 14.354 12.116 C 14.158 12.312 13.841 12.312 13.646 12.116 L 13 11.469 L 12.354 12.116 C 12.158 12.312 11.841 12.312 11.646 12.116 L 11 11.469 L 10.354 12.116 C 10.158 12.312 9.841 12.312 9.646 12.116 L 9 11.469 L 8.354 12.116 C 8.26 12.21 8.132 12.263 8 12.262 L 7.465 12.262 C 5.926 14.93 2.077 14.932 0.536 12.266 C 0.184 11.657 -0.001 10.966 0 10.262 M 4 7.262 C 1.69 7.263 0.248 9.764 1.403 11.763 C 2.559 13.763 5.445 13.762 6.599 11.761 C 6.64 11.692 6.677 11.62 6.712 11.547 C 6.794 11.374 6.97 11.263 7.163 11.262 L 7.793 11.262 L 8.646 10.408 C 8.841 10.213 9.158 10.213 9.354 10.408 L 10 11.055 L 10.646 10.408 C 10.841 10.213 11.158 10.213 11.354 10.408 L 12 11.055 L 12.646 10.408 C 12.841 10.213 13.158 10.213 13.354 10.408 L 14 11.055 L 14.793 10.262 L 13.793 9.262 L 7.163 9.262 C 6.97 9.262 6.794 9.151 6.712 8.977 C 6.215 7.93 5.159 7.262 4 7.262"/>
<path d="M 5.012 10.054 C 5.012 10.823 4.179 11.305 3.512 10.92 C 3.203 10.741 3.012 10.411 3.012 10.054 C 3.012 9.284 3.846 8.803 4.512 9.188 C 4.822 9.366 5.012 9.696 5.012 10.054"/>
<path style="stroke: currentColor; stroke-linecap: round; stroke-linejoin: round;" d="M 7.596 1.069 L 7.55 5.971"/>
<path style="stroke: currentColor; stroke-linecap: round; stroke-linejoin: round;" d="M 4.906 3.368 L 10.395 3.396"/>
</svg>`;
export const keyMinusSVG = `<svg width="16" height="16" fill="currentColor" class="bi bi-key" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
<path d="M 0 10.262 C -0.002 7.183 3.331 5.257 5.998 6.796 C 6.607 7.147 7.113 7.653 7.465 8.262 L 14 8.262 C 14.132 8.262 14.26 8.315 14.354 8.408 L 15.854 9.908 C 16.049 10.104 16.049 10.421 15.854 10.616 L 14.354 12.116 C 14.158 12.312 13.841 12.312 13.646 12.116 L 13 11.469 L 12.354 12.116 C 12.158 12.312 11.841 12.312 11.646 12.116 L 11 11.469 L 10.354 12.116 C 10.158 12.312 9.841 12.312 9.646 12.116 L 9 11.469 L 8.354 12.116 C 8.26 12.21 8.132 12.263 8 12.262 L 7.465 12.262 C 5.926 14.93 2.077 14.932 0.536 12.266 C 0.184 11.657 -0.001 10.966 0 10.262 M 4 7.262 C 1.69 7.263 0.248 9.764 1.403 11.763 C 2.559 13.763 5.445 13.762 6.599 11.761 C 6.64 11.692 6.677 11.62 6.712 11.547 C 6.794 11.374 6.97 11.263 7.163 11.262 L 7.793 11.262 L 8.646 10.408 C 8.841 10.213 9.158 10.213 9.354 10.408 L 10 11.055 L 10.646 10.408 C 10.841 10.213 11.158 10.213 11.354 10.408 L 12 11.055 L 12.646 10.408 C 12.841 10.213 13.158 10.213 13.354 10.408 L 14 11.055 L 14.793 10.262 L 13.793 9.262 L 7.163 9.262 C 6.97 9.262 6.794 9.151 6.712 8.977 C 6.215 7.93 5.159 7.262 4 7.262"/>
<path d="M 5.012 10.054 C 5.012 10.823 4.179 11.305 3.512 10.92 C 3.203 10.741 3.012 10.411 3.012 10.054 C 3.012 9.284 3.846 8.803 4.512 9.188 C 4.822 9.366 5.012 9.696 5.012 10.054"/>
<path style="stroke: currentColor; stroke-linecap: round; stroke-linejoin: round;" d="M 4.906 3.368 L 10.395 3.396"/>
</svg>`;
export const personPlusSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-plus" viewBox="0 0 16 16">
<path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H1s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C9.516 10.68 8.289 10 6 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
<path fill-rule="evenodd" d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5"/>
</svg>`;
export const personBadgeSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-badge" viewBox="0 0 16 16">
<path d="M6.5 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/>
<path d="M4.5 0A2.5 2.5 0 0 0 2 2.5V14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2.5A2.5 2.5 0 0 0 11.5 0zM3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v10.795a4.2 4.2 0 0 0-.776-.492C11.392 12.387 10.063 12 8 12s-3.392.387-4.224.803a4.2 4.2 0 0 0-.776.492z"/>
</svg>`;
export const uploadSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16">
<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
<path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
</svg>`;
export const downloadSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
<path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
</svg>`;
export const zipSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-zip" viewBox="0 0 16 16">
<path d="M5 7.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v.938l.4 1.599a1 1 0 0 1-.416 1.074l-.93.62a1 1 0 0 1-1.11 0l-.929-.62a1 1 0 0 1-.415-1.074L5 8.438zm2 0H6v.938a1 1 0 0 1-.03.243l-.4 1.598.93.62.929-.62-.4-1.598A1 1 0 0 1 7 8.438z"/>
<path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1h-2v1h-1v1h1v1h-1v1h1v1H6V5H5V4h1V3H5V2h1V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z"/>
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
