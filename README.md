# QuickFill20 
* fills PDF forms quickly using Mozilla [PDF.js](https://github.com/mozilla/pdf.js).
* rule based automation of filling values into the PDF form fields.
* rule editor for adding and changing rules.
* opens even encoded PDFs thanks to Mozilla [PDF.js](https://github.com/mozilla/pdf.js). No need for [qpdf](https://github.com/qpdf/qpdf).  

## Build newest pdfjs-dist yourself via pdf.js
PDF.js is the main library used.

```shell
# start in quick-fill-20 directory, go one level up
cd ..
git clone https://github.com/mozilla/pdf.js.git
cd pdf.js
npm install
gulp generic # generates build directory
gulp dist-install # generates distribution files and dist
cp -ipr ./build/generic/* ../quick-fill-20 # copies relevant files into QuickFill Directory
```

Otherwise simply use "pdfjs-dist": "^4.1.407" in dependencies in package.json.

## PDF.js Issue #16723
`textContent` has the stored user's value and `fieldFormattedValues` look to has the default value, you can see that `fieldFormattedValues` has more precedence than `textContent`.
Because of PDF.js Issue [Acroform Textfield doesn't set the stored user's value in the html element if it has a default value #16723](https://github.com/mozilla/pdf.js/issues/16723) the file `src/display/annotation_layer.js` line 1217 has to be preceded by the following line:
```javascript
// if `textContent` has user's value `fieldFormattedValues` isn't needed
fieldFormattedValues = textContent ? null : fieldFormattedValues
```
Otherwise when the blur event is dispatched, textfield restores to default value because fieldFormattedValues has the default value.

## Copy into one large HTML file and minify 
```shell
node generateSingleHTMLFile.js index.html deploy/quickfill20.html
```

## Overwrite Mozilla Default URL in PDF Viewer

* Default URL is set in viewer.js by Mozilla on **compressed.tracemonkey-pldi-09.pdf**.
```json
  defaultOptions.defaultUrl = {
    value: "compressed.tracemonkey-pldi-09.pdf",
    kind: OptionKind.VIEWER
  };
```
* has to be overwritten by empty string to avoid loading the **compressed.tracemonkey-pldi-09.pdf** paper.
```json
  defaultOptions.defaultUrl = {
    value: "",
    kind: OptionKind.VIEWER
  };
```

## Tool generateSingleHTMLFile.js
* command line tool for generating *single file stand-alone deployment* aggregating all files into a single HTML file
* e.g. `node generateSingleHTMLFile.js index.html QuickFill.html`
* resolves all import dependencies in HTML file and replaces the import by the source code itself, so that no other files have to be imported any more
* writes CSS style rules directly into HTML
* The final HTML file is complete. No other resources have to be loaded.


## Test Rule Engine with AVA
* [AVA](https://github.com/avajs/ava) "is a test runner for Node.js with a concise API, detailed error output, embrace of new language features and process isolation that lets you develop with confidence."
* call AVA via `npm run test`

## Syntax for Rules for Form Filling Automation
```ÈBNF
Rule ::= Type Left Right
Type ::= 'equal' | 'substring' | 'superstring' | 'similar' | 'regex' | 'formular'
Left ::= Name ( ',' Name )*
Right ::= StringLiteral ( Variable StringLiteral )*
Variable ::= '${' NameOrExpression ( ',' NameOrExpression )* '}$'
NameOrExpression ::= Name | Expression
Expression ::= '(' Operator Operand* ')'
Operator ::= 'and' | 'or' | 'not' | 're-format-date' | 'transform' | 'findrule' | Type
Operand ::= StringLiteral | Expression
```

StringLiteral is a character sequence without any of the following characters or character subsequences:
* ','
* '('
* ')'
* '${'
* '}$'
* '"'

## Using Simple Keyboard
* [simple-keyboard](https://hodgef.com/simple-keyboard/) is used, see [Demos](https://hodgef.com/simple-keyboard/demos/)
* [simple-keyboard](https://hodgef.com/simple-keyboard/) does not support ES6 modules. Therefore the ES6 module `./lib/simple-keyboard.js` has to be generated by the command `rollup -c`. Then edit the last line as follows:
```javascript
export const Keyboard = getDefaultExportFromCjs(build.exports);
```

