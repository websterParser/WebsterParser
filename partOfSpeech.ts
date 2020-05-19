import { hasProp } from './util';

const clauses = {
  'n..': 'noun',
  'n.':  'noun',
  n:     'noun',

  'a. .':   'adjective',
  'a.':     'adjective',
  a:        'adjective',
  'p. a.':  'past adjective', // ?? ?? ??
  'p.a.':   'past adjective', //  ?? ?? ??
  'pr. a.': 'proper adjective',
  'adj.':   'adjective', // but why also just 'a.'?

  'v.':    'verb',
  'v. i.': 'intransitive verb',
  'v. t.': 'transitive verb',

  'imp.':       'imperfect', // could also be imperative
  'imp. sing.': 'singular imperfect', // could also be imperative
  'imp. pl.':   'plural imperfect', // could also be imperative

  'p. p.':              'past participle',
  'past part.':         'past participle',
  'p. p':               'past participle',
  'imp. p. p.':         'imperfect & past participle', // ?? ?? ??
  'present participle': 'present participle',
  'p. pr.':             'present participle',
  'p. pr':              'present participle', // <3
  'p, pr':              'present participle', // ?? ?? ??
  'p pr.':              'present participle', // <3

  'adv.': 'adverb',
  adv:    'adverb',
  'ads.': 'adverb', // ?

  'superl.':   'superlative',
  superl:      'superlative',
  'comp.':     'comparative',
  compar:      'comparative',
  'compar.':   'comparative',
  'prep.':     'preposition',
  'interj.':   'interjection',
  'pron.':     'pronoun',
  'pron. pl.': 'plural pronoun',
  'conj.':     'conjunction',

  'third pers. sing. pres.': 'third-person singular present',
  '3d. pers. sing. pres.':   'third-person singular present',
  '3d pers. sing. pres.':    'third-person singular present',
  '3d sing. pres.':          'third-person singular present',
  '3d pers. sing. pr.':      'third-person singular present',
  '3d sing. pr.':            'third-person singular present',
  '3d pers. sing. present':  'third-person singular present',
  '3d pers. pres.':          'third-person present',
  '3d pers. sing.':          'third-person singular',
  'imperative sing.':        'imperative singuar',
  '2d pers. sing. imp.':     'second-person singular imperfect',
  '2d pers. sing. pres.':    'second-person singular present',
  'infinitive.':             'infinitive',
  'inf.':                    'infinitive',

  'pref.':   'prefix',
  'prefix.': 'prefix',
  'suff.':   'suffix',
  'suffix.': 'suffix',

  'possess.': 'possessive',
  'poss.':    'possessive',
  'obj.':     'objective',
  'object.':  'objective',
  'dat.':     'dative',

  'pret.': 'preterit',

  'v. inf':        'infinitive verb',
  'v. inf.':       'infinitive verb',
  'v. impers.':    'impersonal verb', // ??
  'v. impersonal': 'impersonal verb',

  'a. superl.':           'superlative adjective',
  'prep. phr.':           'preposition phrase',
  'indic. present':       'plural indicative present',
  'pl. indic. pr.':       'plural indicative present',
  participle:             'participle',
  auxiliary:              'auxiliary verb',
  'auxiliary.':           'auxiliary verb',
  'part. adj':            'participle adjective', // ?? ?? ??
  'part. adj.':           'participle adjective', // ?? ?? ??
  'masc. a.':             'masculine adjective',
  'fem. a.':              'feminine adjective',
  'a. m.':                'masculine adjective',
  'a. f.':                'feminine adjective',
  'strong imp.':          'strong imperfect',
  'nom.':                 'nominative',
  'pl. nom.':             'plural nominative',
  'n.pl.':                'plural noun',
  'peop. n.':             'peop. noun', // ?? ?? ??
  'p. pr. vb. n.':        'present participle verbal noun',
  'pres. sing.':          'present-tense singular',
  'indef. pron.':         'indefinite pronoun',
  'possessive pron.':     'possessive pronoun',
  'pr. n. pl.':           'plural proper noun',
  'pl. pres.':            'plural present',
  'a. pron.':             'adjective pronoun',
  '2d person':            'second-person',
  'a. compar.':           'comparative adjective',
  'n.sing.':              'singular noun',
  'plural pres.':         'plural present',
  'sing. pres.':          'singular present',
  'poss. pron.':          'possessive pronoun',
  'contrac.':             'contraction',
  'pers. pron.':          'personal pronoun',
  'sing. pres. ind.':     'singular present-tense indicative',
  'pres. subj.':          'present subjunctive',
  'pres.':                'present',
  'v. imperative.':       'imperative verb',
  '2d pers. pl.':         'second-person plural',
  '2d pers. sing.':       'second-person singular',
  '2d per. sing.':        'second-person singular',
  'sing. nom.':           'singular nominative',
  'abl.':                 'ablative',
  'subj. 3d pers. sing.': 'subjunctive third-person singular',
  'archaic imp.':         '(archaic) imperfect',
  'syntactically sing.':  'syntactically singular',
  'definite article.':    'definite article',
  'def. art.':            'definite article',
  'imperative.':          'imperative',
  'interrog. adv.':       'interrogative adverb',
  'rare vb. n.':          '(rarely) verbal noun',
  'archaic p. p.':        '(archaic) past participle'
};

const nouns = {
  vb:      'verbal',
  'vb.':   'verbal',
  'vb/':   'verbal', // ?
  'vvb.':  'verbal', // ?
  'pr.':   'proper',
  'fem.':  'feminine',
  'f.':    'feminine',
  'masc.': 'feminine',
  'm.':    'feminine',
  'sing.': 'singular',
  'pl.':   'plural',
  pl:      'plural'
};

const whole = {
  'n. & v. t. & i.':                    'noun, transitive verb, or intransitive verb',
  'v. i. & i.':                         'transitive or intransitive verb', // ?? ?? ??
  'v. t. & i.':                         'transitive or intransitive verb',
  'v. i. & t.':                         'intransitive or transitive verb',
  'p. p. & a.':                         'past participle or predicative adjective',
  'p. & a.':                            '????',
  'p. p. or a.':                        'past participle or predicative adjective',
  'pres. indic. sing., 1st & 3d pers.':
    'present indicative singular; first or third person',

  'pres. indic., 1st & 3d pers. sing.':
    'present indicative; first or third person singular',
  'pres. indic. 1st & 3d pers. sing.':
    'present indicative; first or third person singular',
  'n. collect & pl.':           'collective or plural noun',
  'n. collect. & pl.':          'collective or plural noun',
  'n. sing. & pl.':             'singular or plural noun',
  'pres. & imp. sing. & pl.':   'present, imperative singular or plural',
  'imp. (and rare p. p.)':      `${clauses['imp.']} (and rarely ${clauses['p. p.']})`,
  'a.; also adv.':              `${clauses.a}; also ${clauses.adv}`,
  '1st & 3d pers. sing. pres.': 'first- or third-person singular present',
  'p, pr. & vb. n.':            'present participle or verbal noun' // ?? ?? ??
};

const set = new Set();
const extras = { set };

export default Object.assign((pos: string) => {
  function parse (pos: string): string {
    if (hasProp(whole, pos)) return whole[pos];
    if (hasProp(clauses, pos)) return clauses[pos];
    if (hasProp(nouns, pos)) return nouns[pos];

    const segments = pos.split(/\s*(?:&|or|,(?:\s*(?:&|or))?)[.\s]*/);
    if (segments.length === 1) {
      if (pos.startsWith('prop. ')) {
        return `proper ${parse(pos.slice(6))}`;
      }
      if (pos.startsWith('n. ')) {
        return `${parse(pos.slice(3))} noun`;
      }
      if (pos.endsWith(' n.')) {
        return `${parse(pos.slice(0, -3))} noun`;
      }
      if (pos.endsWith(' n')) {
        return `${parse(pos.slice(0, -2))} noun`;
      }
      if (pos.startsWith('obs. ')) {
        return `obsolete ${parse(pos.slice(5))}`;
      }
      return 'xxxx';
    }
    return segments.map(parse).join(' or ');
  }
  const prefix = pos.match(/^\s*/)![0];
  const suffix = pos.match(/[,\s]*$/)![0];
  pos = pos
    .slice(prefix.length, suffix ? -suffix.length : undefined)
    .toLowerCase();
  const result = parse(pos);
  if (result.includes('xxxx')) {
    // console.log(pos)
    set.add(pos);
    return null;
  }
  return prefix + result + suffix;
}, extras);
