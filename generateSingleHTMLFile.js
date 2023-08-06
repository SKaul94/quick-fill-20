#!/usr/bin/env node

/**
 * @summary command line tool for generating single file deployment
 *
 *   e.g. root> node generateSingleHTMLFile.js index.html QuickFill.html
 *
 *   löst alle imports in der HTML-Datei auf
 *   und ersetzt diese durch den zugehörigen Quelltext
 *
 * @version 1.0.0
 * @author Kaul
 * @copyright (C) 2021, 2022 All Rights reserved by author
 */

import { promises as fs } from "fs";
import * as path from 'path';
import { minify } from "terser";
// const minify = x => ({code:x})

const MINIFY = true;  // optional true or false
const MINIFY_OPTIONS = {
  module: true,
  ecma: 2021,
  mangle: {
    module: true,
    keep_classnames: true,
    keep_fnames: true
  },
  toplevel: false,
  compress: {
    ecma: 2021,
    passes: 2
  },
  format: {
    preamble: "/* minified */",
    comments: false
  }
};
const NONCE = 'rAnd0m';  // if you use CSP

const pwd = process.cwd();
if ( ! process.argv[2] || ! process.argv[3] ) console.log( 'Usage: node generateSingleHTMLFile.js source.html target.html' );
const source = process.argv[2] || 'index.html';
const target = process.argv[3] || 'QuickFill.html';
console.log( `Reading ${source} writing ${target}.` );
const allImportFiles = new Map();
const scriptTagRegex = /^\s*<script type="module" src="(\w+\.js)"><\/script>/im;

class ImportFile {
  constructor( params ) {
    this.predecessors = [];
    if ( params.pred ) this.predecessors.push( params.pred );
    this.dir = params.dir;
    this.file = params.file;
    allImportFiles.set( this.id(), this );
  }
  static get( dir, file ){
    return allImportFiles.get( path.join( dir, file ) );
  }
  addPred( otherPred ){
    this.predecessors.push( otherPred );
  }
  id(){
    return path.join( this.dir, this.file );
  }
  suffix(){
    return this.file.split('.').slice(-1)[0];
  }
  equals( other ){
    if ( ! other.id ) return false;
    return this.id() === other.id();
  }
  toString(){
    return `${this.id()} <= ${JSON.stringify(this.predecessors)}`;
  }
  toJSON(){
    return `${this.id()} <= ${JSON.stringify(this.predecessors)}`;
  }
  async replacedContent(){
    let output = '';
    for ( const line of this.content.split("\n") ) {
      if (line.trimLeft().startsWith('//# sourceMappingURL')) continue;
      if (line.trimLeft().startsWith('<link rel="stylesheet"')){  // inline style
        const match = line.match(/href="([-_\w\d./]+)"/);
        if ( match ){
          output += "\n";
          output += '<style>';
          output += "\n";
          output += await fs.readFile( path.join(this.dir,match[1]), 'utf8' );
          output += '</style>';
          output += "\n";
        }
      } else if ( line.match( scriptTagRegex ) ) {
        const match = line.match( scriptTagRegex );
        if ( match ){
          const file = match[1];
          output += '<!-- ' + line + ' -->';
          output += "\n";
          output += `<script type="module" nonce="${NONCE}">`;
          output += "\n";
          // Replace line by file contents
          const oldImportFile = ImportFile.get( this.dir, file );
          if ( ! oldImportFile.done ){ // do not copy file contents twice into output
            const jsContents = await oldImportFile.replacedContent();  // recursive replacement
            if ( MINIFY ){
              try {
                const minifiedContents = await minify( jsContents, MINIFY_OPTIONS );
                console.log( `Minified 1 ${oldImportFile.id()} OK.` );
                output += minifiedContents.code;
              } catch (e) {
                console.log( 'Minify 1 Error in ', oldImportFile.id() );
                console.log( e );
                output += jsContents;
              }
            } else {
              output += jsContents;
            }
            oldImportFile.done = true;
            output += "\n";
          }
          output += '</script>';
          output += "\n";
        }
      } else if (line.trimLeft().startsWith('import ')) {
        const match = line.match(/['"]([-_\w\d./]+)['"]/);
        if (match) {
          output += '// ' + line;
          output += "\n";
          const fileTokens = match[1].split('/');
          const file = fileTokens.slice(-1)[0];
          const dir = path.join(this.dir, ...fileTokens.slice(0, -1));
          // Replace line by file contents
          const oldImportFile = ImportFile.get( dir, file );
          if ( ! oldImportFile.done ){ // do not copy file contents twice into output
            oldImportFile.done = true;
            output += await oldImportFile.replacedContent();  // recursive replacement
            output += "\n";
          }
        }
      } else {
        output += line;
        output += "\n";
      }
    }
    if ( this.done ){

    } else {
      if ( ['html','css'].includes( this.suffix() ) ){
        // ToDo minify css and html
      } else {
        if ( MINIFY ){
          try {
            const miniOutput = await minify( output, MINIFY_OPTIONS );
            output = miniOutput.code;
            console.log( `Minification 2 ${this.id()} OK.` );
          } catch (e) {
            console.log( `Minify 2 Error in `, this.id() );
            console.log( e );
          }
        }
      }
    }
    return output;
  }
}

generate();

async function generate(){
  const allFiles = new Set();
  const rootFile = new ImportFile({ dir: pwd, file: source });
  const allImports = [ rootFile ];
  while ( allImports.length > 0 ){
    const next = allImports.shift(); // Queue
    allFiles.add( next );
    allImports.push( ...await getImportedFiles( next ) );
  }
  const output = await rootFile.replacedContent();
  await fs.writeFile( path.join( pwd, target ), output,'utf8' );
  console.log( `Ready. Copied from ${source}. Open ${target}.` );
}

async function getImportedFiles( pred ){  // use relative file import paths
  const allImports = [];
  const fileContent = await fs.readFile( path.join( pred.dir, pred.file ), 'utf8' );
  pred.content = fileContent;
  for ( const line of fileContent.split("\n") ){
    if ( line.trimLeft().startsWith('import') ){
      const match = line.match(/['"]([-_\w\d./]+)['"]/);
      if ( match ){
        const fileTokens = match[1].split('/');
        const file = fileTokens.slice(-1)[0];
        const dir = path.join( pred.dir, ...fileTokens.slice(0,-1) );
        const oldImportFile = ImportFile.get( dir, file );
        if ( oldImportFile ){
          oldImportFile.addPred( pred );
        } else {
          allImports.push( new ImportFile({ pred, dir, file }));
        }
      }
    } else {
      const match = scriptTagRegex.exec(line);
      if ( match ){
        const file = match[1];
        allImports.push( new ImportFile({ pred, dir: pred.dir, file }));
      }
    }
  }
  return allImports;
}

