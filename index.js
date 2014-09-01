var cheerio = require('cheerio');
var dir = require('node-dir');
var commander = require('commander');
var fs = require('fs');
var ent = require('ent');
var unorm = require('unorm');
var async = require('async');
var puid = require('puid');

var dictionary = {};
var index = {};
var files = [];
var unknown = [];


var entities = {
  "pound":  "£",
  "frac23": "⅔",
  "frac13": "⅓",
  "frac12": "½",
  "frac14": "¼",
  "?":      "�",   /* Place-holder for unknown or illegible character. */
  "hand":   "☞",   /* pointing hand (printer's "fist") */
  "fist":   "☞",   /* pointing hand (printer's "fist") */
  "asterism": "⁂",
  "sect":   "§",
  "sharp":  "♯",
  "flat":   "♭",
  "natural":"♮",
  "th":     "th",
  "OE":     "Œ",
  "oe":     "œ",
  "ae":     "æ",
  "AE":     "Æ",
  "aemac":  "ǣ",
  "edh":    "ð",
  "EDH":    "Ð",
  "thorn":  "þ",
  "yogh":   "ȝ",
  "deg":    "°",
  "min":    "′",
  "middot": "•",
  "root":   "√",
  "cuberoot": "∛",

  // Asper (see wiki/rough breathing)
  'asper':  'ʽ',
  'cre':    '˘',
  'iques':  '¿',
  'nabla':  '∇',
  'bar':    '|',
  'times':  '×',
  'divide': '÷',
  'umlaut': '¨',
  'dele':   '₰',

 /* Greek alphabet */
  "alpha":    "α",
  "beta":     "β",
  "gamma":    "γ",
  "delta":    "δ",
  "epsilon":  "ε",
  "zeta":     "ζ",
  "eta":      "η",
  "theta":    "θ",
  "iota":     "ι",
  "kappa":    "κ",
  "lambda":   "λ",
  "mu":       "μ",
  "nu":       "ν",
  "xi":       "ξ",
  "omicron":  "ο",
  "pi":       "π",
  "rho":      "ρ",
  "sigma":    "σ",
  "sigmat":   "ς",
  "tau":      "τ",
  "upsilon":  "υ",
  "phi":      "φ",
  "chi":      "χ",
  "psi":      "ψ",
  "omega":    "ω",
  "digamma":  "ϝ",
  "ALPHA":    "Α",
  "BETA":     "Β",
  "GAMMA":    "Γ",
  "DELTA":    "Δ",
  "EPSILON":  "Ε",
  "ZETA":     "Ζ",
  "ETA":      "Η",
  "THETA":    "Θ",
  "IOTA":     "Ι",
  "KAPPA":    "Κ",
  "LAMBDA":   "Λ",
  "MU":       "Μ",
  "NU":       "Ν",
  "XI":       "Ξ",
  "OMICRON":  "Ο",
  "PI":       "Π",
  "RHO":      "Ρ",
  "SIGMA":    "Σ",
  "TAU":      "Τ",
  "UPSILON":  "Υ",
  "PHI":      "Φ",
  "CHI":      "Χ",
  "PSI":      "Ψ",
  "OMEGA":    "Ω",

 /* Accents */
  "prime":    "´",
  "bprime":   "˝",
  "mdash":    "—",

 /* Quotes */
  "lsquo":    "‘",
  "rsquo":    "’",
  "ldquo":    "“",
  "rdquo":    "”",

  "dagger":   "†",
  "dag":      "†",
  "Dagger":   "‡",
  "ddag":     "‡",
  "para":     "§",
  "gt":       ">",
  "lt":       "<",
  "rarr":     "→",
  "larr":     "←",
  "schwa":    "ə",
  "pause":    "𝄐",


  "Mercury": "☿",
  "Female": "♀",
  "Earth": "♁",
  "Male": "♂",
  "Jupiter": "♃",
  "Saturn": "♄",
  "Uranus": "♅",
  "Neptune": "♆",
  "Pluto": "♇",
  "Aries": "♈",
  "Taurus": "♉",
  "Gemini": "♊",
  "Cancer": "♋",
  "Leo": "♌",
  "Virgo": "♍",
  "Libra": "♎",
  "Scorpio": "♏",
  "Sagittarius": "♐",
  "Capricorn": "♑",
  "Aquarius": "♒",
  "Pisces": "♓",
  "Sun": "☉",

  "br":       "\n",
  "nbsp":     "&nbsp;",
  "and":      "and",
  "or":       "or",
  "sec":      "˝"
};

var accents = {
  // Proper
  'cir':    '&#x0302;',
  'circ':   '&#x0302;',
  'til':    '&#x0303;',
  'mac':    '&#x0304;',
  'breve':  '&#x0306;',
  'dot':    '&#x0307;',
  'sdot':   '&#x0323;',
  'dd':     '&#x0324;',
  'sm':     '&#x0331;',
  'cr':     '&#x0306;',
  'um':     '&#x0308;',
  'acute':  '&#x0301;',
  'grave':  '&#x0300;',
  'ring':   '&#x030A;',
  'ced':    '&#x0327;',

  // Semilong (macron with vertical bar on top)
  'sl':     '&#x0304;&#x030d;',

  // Italic
  'it':   '',
  'IT':   '',
};

var doubleAccents = {
  // Double length marks
  'cr':  '&#x035D;',
  'mac': '&#x035E;',
};


var greek = {
  "'A": "Ἀ",
  "'A:": "ᾈ",
  "'A^": "Ἆ",
  "'A`": "Ἄ",
  "'A~": "Ἂ",
  "'E": "Ἐ",
  "'E`": "Ἔ",
  "'E~": "Ἒ",
  "'H": "Ἠ",
  "'H:": "ᾘ",
  "'H^": "Ἦ",
  "'H`": "Ἤ",
  "'H~": "Ἢ",
  "'I": "Ἰ",
  "'I^": "Ἶ",
  "'I`": "Ἴ",
  "'I~": "Ἲ",
  "'O": "Ὀ",
  "'O`": "Ὄ",
  "'O~": "Ὂ",
  "'W": "Ὠ",
  "'W:": "ᾨ",
  "'W^": "Ὦ",
  "'W`": "Ὤ",
  "'W~": "Ὢ",
  "'`O": "Ὄ",
  "'a": "ἀ",
  "'a:": "ᾀ",
  "'a^": "ἆ",
  "'a^:": "ᾆ",
  "'a`": "ἄ",
  "'a`:": "ᾄ",
  "'a~": "ἂ",
  "'a~:": "ᾂ",
  "'e": "ἐ",
  "'e`": "ἔ",
  "'e~": "ἒ",
  "'h": "ἠ",
  "'h:": "ᾐ",
  "'h^": "ἦ",
  "'h^:": "ᾖ",
  "'h`": "῎η",
  "'h`:": "ᾔ",
  "'h~": "ἢ",
  "'h~:": "ᾒ",
  "'i": "ἰ",
  "'i^": "ἶ",
  "'i`": "ἴ",
  "'i~": "ἲ",
  "'o": "ὀ",
  "'o`": "ὄ",
  "'o~": "ὂ",
  "'r": "ῤ",
  "'u": "ὐ",
  "'u^": "ὖ",
  "'u`": "ὔ",
  "'u~": "ὒ",
  "'w": "ὠ",
  "'w:": "ᾠ",
  "'w^": "ὦ",
  "'w^:": "ᾦ",
  "'w`": "ὤ",
  "'w`:": "ᾤ",
  "'w~": "ὢ",
  "'w~:": "ᾢ",
  "'y": "ὐ",
  "'y^": "ὖ",
  "'y`": "ὔ",
  "'y~": "ὒ",
  "A": "Α",
  "A:": "ᾼ",
  "A`": "Ά",
  "A~": "Ἁ",
  "B": "Β",
  "CH": "Χ",
  "Ch": "Χ",
  "D": "Δ",
  "E": "Ε",
  "E`": "Έ",
  "E~": "Ἑ",
  "F": "Φ",
  "G": "Γ",
  "H": "Η",
  "H:": "ῌ",
  "H`": "Ή",
  "H~": "Ἡ",
  "I": "Ι",
  "I`": "Ί",
  "I~": "Ἱ",
  "K": "Κ",
  "L": "Λ",
  "M": "Μ",
  "N": "Ν",
  "O": "Ο",
  "O`": "Ό",
  "O~": "Ὁ",
  "P": "Π",
  "PS": "Ψ",
  "Ps": "Ψ",
  "Q": "Θ",
  "R": "Ρ",
  "S": "Σ",
  "T": "Τ",
  "U": "Υ",
  "U`": "Ύ",
  "U~": "Ὑ",
  "W": "Ω",
  "W:": "ῼ",
  "W`": "Ώ",
  "W~": "Ὡ",
  "X": "Ξ",
  "Y": "Υ",
  "Y`": "Ύ",
  "Y~": "Ὑ",
  "Z": "Ζ",
  "\"A": "Ὰ",
  "\"A:": "ᾉ",
  "\"A^": "Ἇ",
  "\"A^:": "ᾏ",
  "\"A`": "Ἅ",
  "\"A`:": "ᾍ",
  "\"A~": "Ἃ",
  "\"A~:": "ᾋ",
  "\"E": "Ὲ",
  "\"E`": "Ἕ",
  "\"E~": "Ἓ",
  "\"H": "Ὴ",
  "\"H:": "ᾙ",
  "\"H^": "Ἧ",
  "\"H^:": "ᾟ",
  "\"H`": "Ἥ",
  "\"H`:": "ᾝ",
  "\"H~": "Ἣ",
  "\"H~:": "ᾛ",
  "\"I": "Ὶ",
  "\"I^": "Ἷ",
  "\"I`": "Ἵ",
  "\"I~": "Ἳ",
  "\"O": "Ὸ",
  "\"O`": "Ὅ",
  "\"O~": "Ὃ",
  "\"R": "Ῥ",
  "\"U": "Ὺ",
  "\"U^": "Ὗ",
  "\"U`": "Ὕ",
  "\"U~": "Ὓ",
  "\"W": "Ὼ",
  "\"W:": "ᾩ",
  "\"W^": "Ὧ",
  "\"W^:": "ᾯ",
  "\"W`": "Ὥ",
  "\"W`:": "ᾭ",
  "\"W~": "Ὣ",
  "\"W~:": "ᾫ",
  "\"Y": "Ὺ",
  "\"Y^": "Ὗ",
  "\"Y`": "Ὕ",
  "\"Y~": "Ὓ",
  "\"a": "ἁ",
  "\"a:": "ᾁ",
  "\"a^": "ἇ",
  "\"a^:": "ᾇ",
  "\"a`": "ἄ",
  "\"a`:": "ᾅ",
  "\"a~": "ἂ",
  "\"a~:": "ᾃ",
  "\"e": "ἑ",
  "\"e`": "ἕ",
  "\"e~": "ἓ",
  "\"h": "ἡ",
  "\"h:": "ᾑ",
  "\"h^": "ἧ",
  "\"h^:": "ᾗ",
  "\"h`": "ἤ",
  "\"h`:": "ᾕ",
  "\"h~": "ἣ",
  "\"h~:": "ᾓ",
  "\"i": "ἱ",
  "\"i^": "ἷ",
  "\"i`": "ἵ",
  "\"i~": "ἳ",
  "\"o": "ὁ",
  "\"o`": "ὅ",
  "\"o~": "ὃ",
  "\"r": "ῥ",
  "\"u": "ὑ",
  "\"u^": "ὗ",
  "\"u`": "ὕ",
  "\"u~": "ὓ",
  "\"w": "ὡ",
  "\"w:": "ᾡ",
  "\"w^": "ὣ",
  "\"w^:": "ᾧ",
  "\"w`": "ὥ",
  "\"w`:": "ᾥ",
  "\"w~:": "ᾣ",
  "\"y": "ὑ",
  "\"y^": "ὗ",
  "\"y`": "ὕ",
  "\"y~": "ὓ",
  "a": "α",
  "a:": "ᾳ",
  "a^": "ᾶ",
  "a^:": "ᾷ",
  "a`": "ά",
  "a`:": "ᾴ",
  "a~": "ὰ",
  "a~:": "ᾲ",
  "b": "β",
  "ch": "χ",
  "d": "δ",
  "e": "ε",
  "e`": "έ",
  "e~": "ὲ",
  "f": "φ",
  "g": "γ",
  "h": "η",
  "h:": "ῃ",
  "h^": "ῆ",
  "h^:": "ῇ",
  "h`": "ή",
  "h`:": "ῄ",
  "h~": "ὴ",
  "h~:": "ῂ",
  "i": "ι",
  "i:": "ϊ",
  "i:^": "ῗ",
  "i:`": "ῒ",
  "i^": "ῖ",
  "i^:": "ῗ",
  "i`": "ί",
  "i`:": "ῒ",
  "i~": "ὶ",
  "k": "κ",
  "l": "λ",
  "m": "μ",
  "n": "ν",
  "o": "ο",
  "o`": "ό",
  "o~": "ὸ",
  "p": "π",
  "ps": "ψ",
  "q": "θ",
  "r": "ρ",
  "s": "σ",
  "t": "τ",
  "u": "υ",
  "u:": "ϋ",
  "u:^": "ῧ",
  "u:`": "ΰ",
  "u:~": "ῢ",
  "u^": "ῦ",
  "u^:": "ῧ",
  "u`": "ύ",
  "u`:": "ΰ",
  "u~": "ὺ",
  "u~:": "ῢ",
  "w": "ω",
  "w:": "ῳ",
  "w^": "ῶ",
  "w^:": "ῷ",
  "w`": "ώ",
  "w`:": "ῴ",
  "w~": "ὼ",
  "w~:": "ῲ",
  "x": "ξ",
  "y": "υ",
  "y:": "ϋ",
  "y:^": "ῧ",
  "y:`": "ΰ",
  "y:~": "ῢ",
  "y^": "ῦ",
  "y^:": "ῧ",
  "y`": "ύ",
  "y`:": "ΰ",
  "y~": "ὺ",
  "y~:": "ῢ",
  "z": "ζ",
};

// Filter unique
function unique(value, index, self) {
  return self.indexOf(value) === index;
}

/*
* Replace custom entities in the form <NAME/
*/
function replaceEntities(string) {
  var pattern = /<([\?\w]+?)\//g;

  var unknown = [];

  string = string.replace(pattern, function(match, text){
    // Check our dictionary objects
    if (entities.hasOwnProperty(text)) {
      return entities[text];
    } else if (accents.hasOwnProperty(text.substring(1))) {
      return text.substring(0,1) + accents[text.substring(1)];
    } else if (doubleAccents.hasOwnProperty(text.substring(2))) {
      return text.substring(0,2) + accents[text.substring(2)];
    } else {
      unknown.push(text);
      return match;
    }
  });

  unknown = unknown.filter(unique);

  console.log("Unknown entities:", unknown);

  return string;
}

/*
* Transcribe the greek (grk) tags
*/

function greekToUTF8(input) {
  var result = '', curPos = 0, curLength, frag = '';

  while (curPos < input.length) {
    // Longest combination is three
    curLength = 3 + 1;
    while (curLength--) {
      frag = input.substring(curPos, curPos + curLength);

      if (greek.hasOwnProperty(frag)) {
        // Fix trailing sigma
        if (frag === 's' && curPos + 1 == input.length) {
          result += "ς";
        } else {
          result += greek[frag];
        }

        curPos += frag.length;
        break;
      }

      // We couln't find anything
      // Add one glyph to the string and try again
      if (curLength === 0) {
        //console.log('Problem when transcribing the greek', input);
        result += input[curPos];
        curPos++;
        break;
      }
    }
  }

  return result;
}



function processFiles() {
  dir.readFiles('srcFiles', {
    match: /CIDE/
    }, function(err, content, next) {
        if (err) throw err;
        files.push(content);
        next();
    },
    function(err, files){
        if (err) throw err;
        console.log('Finished reading files:', files);

        parseFiles(function () {
          var output = JSON.stringify(dictionary, null, 4);
          fs.writeFileSync('output/dictPrelim.json', output, 'utf8');
          postProcessDictionary();
          writeOut();
        });
    });
}

function writeOut() {
  console.log("Done; starting to build XML");

  var xml = buildXML();
  var output = JSON.stringify(dictionary, null, 4);

  fs.writeFile('output/dict.json', output, 'utf8', function (err) {
    if (err) throw err;
    console.log('Wrote file');
  });
  fs.writeFile('template/dict.xml', xml, 'utf8', function (err) {
    if (err) throw err;
    console.log('Wrote file');
  });
}

function prelim() {
  fs.readFile('output/dictPrelim.json', 'utf8', function (err, data) {
    if (err) throw err;
    dictionary = JSON.parse(data);

    postProcessDictionary();
    writeOut();
  });

}

function jsonToXML() {
  fs.readFile('output/dict.json', 'utf8', function (err, data) {
    if (err) throw err;
    dictionary = JSON.parse(data);

    var xml = buildXML();
    fs.writeFile('template/dict.xml', xml, 'utf8', function (err) {
      if (err) throw err;
      console.log('Wrote file');
    });
  });

}

function parseFiles(cb) {
  var q = async.queue(function (task, callback) {
    callback();
  }, 5);
  q.drain = cb;

  files.forEach(function (item) {
    q.push({name: 'Task'}, function (err) {
      parseFile(item);
    });
  });
}


function parseFile(file) {
  file = replaceEntities(file);

  var curEntryName = 'NOTHING';

  var $ = cheerio.load(file, {
    normalizeWhitespace: true,
    xmlMode: false
  });

  // Walk through each paragraph. If the paragraph contains a hw tag,
  // Add a new entry.
  $('p').each(function (i) {
    var ent = $(this).find('ent');
    if (ent.length) {
      curEntryName = ent.first().text();

      if (!index[curEntryName]) {
        index[curEntryName] = [];
      }

      ent.each(function () {
        index[curEntryName].push($(this).text());
      });

      ent.remove();
    }

    var hw = $(this).find('hw');
    hw.each(function () {
      var text = $(this).text();
      text = text.replace(/\*/g, '&#x002d;');
      text = text.replace(/\"/g, '&#8242;');
      text = text.replace(/`/g, '&#x02CA;');
      text = text.replace(/'/g, '’');
      text = text.replace(/\|\|/g, '');
      $(this).text(text);
    });

    var grk = $(this).find('grk');
    grk.each(function () {
      var text = $(this).text();
      text = greekToUTF8(text);
      $(this).text(text);
    });

    if (!dictionary[curEntryName]) {
      dictionary[curEntryName] = '';
    }

    var text = $(this).html();

    dictionary[curEntryName] += text;

    if (i%5000 === 0) {
      console.log('Parsed', i, curEntryName);
    }
  });
}

function wrapAll(elements, structure, $) {
  var intro = $(structure);
  elements.first().before(intro);
  elements.each(function () {
    intro.append($(this));
  });
}

function postProcessDictionary() {
  var dashes = new RegExp('\\s+[-]{2,3}\\s+','g');
  var col = new RegExp('<col>','g');
  var col2 =  new RegExp('</col>','g');
  var i = 0;

  delete dictionary.NOTHING;

  for (var entry in dictionary) {
    var text = dictionary[entry];
        text = text.replace(dashes, ' — ');
    // Wrap loose sentencens
    var $ = cheerio.load(text);

    $('hw').each(function() {
      var intro = $(this).nextUntil('def, sn');
      wrapAll(intro, '<intro>', $);

      var block = $(this).nextUntil('hw');
      wrapAll(block, '<block>', $);
    });

    $('def').each(function () {
      var extra = $(this).nextUntil('hw, sn');
      wrapAll(extra, '<extra>', $);
    });

    $('blockquote').each(function () {
      var author = $(this).next();
      if (!author.is('i')) {
        author = $(this).children().last();
      }
      if (author.is('i')) {
        author.prepend('— ');
        var wrap = $('<au>');
        wrap.append(author);
        $(this).append(wrap);
      }
      var children = $(this).children();
    });

    // Change tag types
    $('*').each(function () {
      var that = $(this);
      var tagName = that[0].name, newTagName;
      switch (tagName) {
        case 'hw':
          newTagName = 'h2';
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
      if (newTagName != tagName) {
        that[0].name = newTagName;
        that.addClass(tagName);
      }
    });

    $('i div, h2 div').each(function () {
      $(this)[0].name = 'span';
    });

    $('i h2').each(function () {
      $(this).parent()[0].name = 'h2'
      $(this)[0].name = 'i';
    });

    dictionary[entry] = $.root().html();

    if (i%1000 === 0) {
      console.log('Postprocessing entry', i, entry);
    }

    i++;
  }

}


function buildXML() {
  var ids = new puid(true);
  console.log('Building xml');
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<d:dictionary xmlns="http://www.w3.org/1999/xhtml" ' +
            'xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.rng">\n';

  for (var entry in dictionary) {
    xml += '\n<d:entry id="A' + ids.generate() + '" d:title="' + entry + '">\n';
    xml += buildIndex(entry);

    // Cheerio mangles our <br> tags, fix them here
    xml += '<div>' + dictionary[entry].replace(/<br>/ig, '<br/>') + '</div>';
    xml += '\n</d:entry>\n';
  }

  xml += '</d:dictionary>';

  return xml;

  function buildIndex(entry) {
    var result = '';

    index[entry] = index[entry].filter(unique);

    index[entry].forEach(function (index) {
      result += '<d:index d:value="' + index + '" d:title="' + index + '"/>\n';
    });

    return result;
  }
}

processFiles();
