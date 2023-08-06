# QuickFill20 
* fills PDF forms quickly using Mozilla [PDF.js](https://github.com/mozilla/pdf.js)
* rule based automation of filling values into the PDF form fields
* rule editor for adding and changing rules
* opens even encoded PDFs thanks to Mozilla [PDF.js](https://github.com/mozilla/pdf.js). No need for [qpdf](https://github.com/qpdf/qpdf)  

## Build newest pdfjs-dist yourself via pdf.js

```shell
# start in analyse directory, go one level up
cd ..
git clone https://github.com/mozilla/pdf.js.git
cd pdf.js
npm install
gulp generic # generates build directory
gulp dist-install # generates distribution files and dist
gulp minified # generates new directory with minified files
cp -ipr ./build/generic/* ../quick-fill-20 # copies relevant files into QuickFill Directory
```

Otherwise simply use "pdfjs-dist": "^3.9.179" in dependencies in package.json.