/* eslint-disable key-spacing */
/* eslint-disable no-prototype-builtins */

///<reference path='./types.d.ts' />
import cheerio from 'cheerio';
import dir from 'node-dir';
import fs from 'fs';
import async from 'async';
import Puid from 'puid';
import { hasProp, unique, forEach } from './util';
import * as C from './codeTables';
import parsePartOfSpeech from './partOfSpeech';

const dictionary: Record<string, string> = {};
const index: Record<string, Array<string>> = {};
const files: Array<string> = [];
const unknown = new Set<string>();
const unknownPOS = new Map<string, string[]>();

const VERBOSE = false;
const FILEGREP = /CIDE\.[A-Z]/;
const ONLYWEBSTER = true;
const frontBackMatter = 'Front/Back Matter';


/**
 * Replace custom entities in the form <NAME/
 */
function replaceEntities (string: string) {
  return string.replace(/<([?\w]+?)\//g, (_, text: string) => {
    // Check our dictionary objects
    const skipFirstChar = text.slice(1);
    const skipFirstTwoChars = text.slice(2);
    if (hasProp(C.entities, text)) {
      return C.entities[text];
    } else if (hasProp(C.accents, skipFirstChar)) {
      return text.slice(0, 1) + C.accents[skipFirstChar];
    } else if (hasProp(C.doubleAccents, skipFirstTwoChars)) {
      return text.slice(0, 2) + C.doubleAccents[skipFirstTwoChars];
    } else if (text.indexOf('frac') === 0) {
      // There are two forms frac1x5000 and frac34
      text = text.replace(/frac(\d+?)x?(\d+)/g, function (_, a, b) {
        return '<sup>' + a + '</sup>' + '⁄' + '<sub>' + b + '</sub>';
      });
      return text;
    } else if (text.endsWith('it') || text.endsWith('IT')) {
      return `<i>${text.slice(0, -2)}</i>`;
    } else {
      unknown.add(text);
      return `[${text}]`;
    }
  });
}

function replaceVarious (string: string) {
  return (
    string
      // Remove comments
      .replace(/<!?--[\s\S]*?-->/g, '')
      .replace(/<!?--/g, '')

      // Nicer long dashes
      .replace(/--/g, '–')
      .replace(/---/g, '–')

      // Double bar
      .replace(/\|\|/g, '‖')
      .replace(/\\'d8/g, '‖')

      // Empty prounounciation tags
      .replace(/\s*<pr>\(\?\)<\/pr>/g, '')
      .replace(/\s*<pr>\(�\)<\/pr>/g, '')

      // Move whitespace inside tags, twice
      .replace(/<\/(\w+?)>(\s+)/g, '$2</$1>')
      .replace(/<\/(\w+?)>(\s+)/g, '$2</$1>')
  );
}

/**
 * Transcribe the greek (grk) tags
 */
function greekToUTF8 (input: string) {
  let result = '';
  let curPos = 0;

  while (curPos < input.length) {
    // Longest combination is three
    let curLength = 3 + 1;
    while (curLength--) {
      const frag = input.slice(curPos, curPos + curLength);

      if (hasProp(C.greek, frag)) {
        // Fix trailing sigma
        if (frag === 's' && curPos + 1 === input.length) {
          result += 'ς';
        } else {
          result += C.greek[frag];
        }

        curPos += frag.length;
        break;
      }

      // We couln't find anything
      // Add one glyph to the string and try again
      if (curLength === 0) {
        // console.log('Problem when transcribing the greek', input);
        result += input[curPos];
        curPos++;
        break;
      }
    }
  }

  return result;
}

function processFiles () {
  dir.readFiles(
    'srcFiles',
    { match: FILEGREP },
    (err, content, next) => {
      if (err) throw err;
      files.push(content.toString());
      next();
    },
    (err, files) => {
      if (err) throw err;
      console.log('Finished reading files:', files);

      parseFiles(() => {
        const output = JSON.stringify({
          dictionary: dictionary,
          index:      index
        }, null, 4);

        if (unknown.size) {
          console.log('Unknown entities:', [...unknown].join(', '));
        }
        if (parsePartOfSpeech.set.size) {
          console.log('Parts of speech:', parsePartOfSpeech.set.size);
          fs.writeFileSync(
            'output/pos.json',
            JSON.stringify([...parsePartOfSpeech.set]),
            'utf8'
          );
        }
        if (unknownPOS.size) {
          console.log('Unknown parts of speech:', unknownPOS.size);
          fs.writeFileSync(
            'output/unknownPOS.json',
            JSON.stringify([...unknownPOS]),
            'utf8'
          );
        }

        fs.writeFileSync('output/dictPrelim.json', output, 'utf8');
        postProcessDictionary();
        writeOut();
      });
    }
  );
}

function writeOut () {
  console.log('Done; starting to build XML');

  const xml = buildXML();
  const output = JSON.stringify(dictionary, null, 4);

  fs.writeFile('output/dict.json', output, 'utf8', err => {
    if (err) throw err;
    console.log('Wrote file');
  });
  fs.writeFile('template/dict.xml', xml, 'utf8', err => {
    if (err) throw err;
    console.log('Wrote file');
  });
}

function parseFiles (cb: () => void) {
  const q = async.queue((_task, callback) => callback(), 5);
  q.drain(() => {
    console.log('Everything was parsed');
    cb();
  });

  files.forEach(item => {
    q.push({ name: 'Task' }, () => {
      parseFile(item);
    });
  });
}

function parseFile (file: string) {
  file = replaceEntities(file);
  file = replaceVarious(file);

  let curEntryName = frontBackMatter;

  const $ = cheerio.load(file, {
    normalizeWhitespace: true,
    xmlMode:             true,
    decodeEntities:      false
  });

  // Walk through each paragraph. If the paragraph contains a hw tag,
  // Add a new entry.
  forEach($('p'), (el, i) => {
    if (ONLYWEBSTER) {
      let src;
      let p = el;
      while (!src) {
        src = p.find('source');
        p = p.next();
      }

      if (src.text().trim() !== '1913 Webster') {
        return true;
      }

      const next = $(src[0].next);
      const prev = $(src[0].prev);

      src.remove();
      prev.remove();
      next.remove();
    }

    const ent = el.find('ent').remove();
    if (ent.length) {
      curEntryName = ent.first().text();

      if (!index[curEntryName]) {
        index[curEntryName] = [];
      }

      forEach(ent, ent => {
        index[curEntryName].push(ent.text());
        const br = ent.next();
        if (br.is('br')) br.remove();
      });
    }

    // Remove leading and trailing br
    const children = el.children();
    const first = children.first();
    const last = children.last();
    if (first.is('br')) first.remove();
    if (last.is('br')) {
      last.prev().append(' ');
      last.remove();
    }

    const hw = el.find('hw, wf, pr');
    forEach(hw, hw =>
      hw.html(
        hw
          .text()
          .replace(/\*/g, '&#x002d;')
          .replace(/"/g, '&#8242;')
          .replace(/`/g, '&#x02CA;')
          .replace(/'/g, '’')
      )
    );

    forEach(el.find('pos'), el => {
      const parsed = parsePartOfSpeech(el.text());
      if (!parsed) {
        const arr = unknownPOS.get(el.text().trim()) || [];
        unknownPOS.set(el.text().trim(), arr.concat(curEntryName));
      } else {
        el.text(parsed);
      }
    });

    const grk = el.find('grk');
    forEach(grk, grk => grk.text(greekToUTF8(grk.text())));

    if (!dictionary[curEntryName]) {
      dictionary[curEntryName] = '';
    }

    dictionary[curEntryName] += el.html();

    if (i % 1000 === 0) {
      console.log('Parsed', i, curEntryName);
    }
  });
}

function postProcessDictionary () {
  let i = 0;

  console.log(`Postprocessing ${Object.keys(dictionary).length} entries...`);

  for (const entry in dictionary) {
    let text = dictionary[entry].trim();
    text = text.replace(/\s+[-]{2,3}\s+/, ' — ');
    text = text.replace(/'/, '’');

    // Wrap loose sentencens
    const $ = cheerio.load(text, { xmlMode: true });

    forEach($('q'), quote => {
      const next = quote.next();
      const author = next.find('qau');
      if (author.length) {
        quote.append(author);
        next.remove();
      }
    });

    // Change tag types
    forEach($('*'), el => {
      const tagName = el[0].name;
      let newTagName;
      switch (tagName) {
        case 'hw':
          newTagName = 'h2';
          break;
        case 'plain':
          newTagName = 'span';
          break;
        case 'xex':
        case 'it':
          newTagName = 'i';
          break;
        case 'br':
        case 'i':
        case 'b':
        case 'p':
        case 'sup':
        case 'sub':
        case 'a':
          newTagName = tagName;
          break;
        default:
          newTagName = 'div';
          break;
      }
      if (newTagName !== tagName) {
        el[0].name = newTagName;
        el.addClass(tagName);
      }
    });

    dictionary[entry] = $.root().html()!;

    if (i % 1000 === 0 || VERBOSE) {
      console.log('Postprocessing entry', i, entry);
    }

    i++;
  }
}

function buildXML () {
  const ids = new Puid(true);
  console.log('Building xml');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<d:dictionary xmlns="http://www.w3.org/1999/xhtml" ' +
            'xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.rng">\n';

  for (const entry in dictionary) {
    const id =
      entry === frontBackMatter ? 'front_back_matter' : `A${ids.generate()}`;
    xml += `\n<d:entry id="${id}" d:title="${entry}">\n`;
    xml += (index[entry] || [])
      .filter(unique)
      .map(index => `<d:index d:value="${index}"/>`)
      .join('\n');
    xml += '\n';

    xml += `<div>${dictionary[entry]}</div>`;
    xml += '\n</d:entry>\n';
  }

  xml += '</d:dictionary>';

  return xml;
}

processFiles();
