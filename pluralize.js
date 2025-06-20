/**
 * JS translation of pluralize function from Python lib 'pattern'
 */

const pluralIrregular = {
  "mamá": "mamás",
  "papá": "papás",
  "sofá": "sofás",
  "dominó": "dominós",
};

const NOUN = "NN";

const VOWELS = ["a", "e", "i", "o", "u"];

// Checks if a given character is a vowel
function isVowel(char) {
  // Ensure char is a single character and convert to lowercase for consistent checking
  if (typeof char !== 'string' || char.length !== 1) {
    return false;
  }
  return VOWELS.includes(char.toLowerCase());
}

// Returns the plural of a given word
function pluralize(word, pos = NOUN, custom = {}) {
  // If word is in custom dictionary, return its custom plural.
  if (word in custom) {
    return custom[word];
  }

  const w = word.toLowerCase();

  // Article: masculine el => los, feminine la => las.
  if (w === "el") {
    return "los";
  }
  if (w === "la") {
    return "las";
  }

  // Irregular inflections.
  if (w in pluralIrregular) {
    return pluralIrregular[w];
  }

  // Words endings that are unlikely to inflect.
  const endingsToAvoidInflecting = [
    "idad",
    "esis", "isis", "osis",
    "dica", "grafía", "logía"
  ];
  if (endingsToAvoidInflecting.some(ending => w.endsWith(ending))) {
    return w;
  }

  // Words ending in a vowel get -s: gato => gatos.
  // Includes words ending in "é" as per Python's explicit check.
  if (VOWELS.some(vowel => w.endsWith(vowel)) || w.endsWith("é")) {
    return w + "s";
  }

  // Words ending in a stressed vowel get -es: hindú => hindúes.
  const stressedVowelEndings = ["á", "é", "í", "ó", "ú"];
  if (stressedVowelEndings.some(ending => w.endsWith(ending))) {
    return w + "es";
  }

  // Words ending in -és get -eses: holandés => holandeses.
  if (w.endsWith("és")) {
    // Python's w[:-2] is equivalent to w.slice(0, -2)
    return w.slice(0, -2) + "eses";
  }

  // Words ending in -s preceded by an unstressed vowel: gafas => gafas.
  // Python's len(w) > 3 and is_vowel(w[-2])
  if (w.endsWith("s") && w.length > 3 && isVowel(w[w.length - 2])) {
    return w;
  }

  // Words ending in -z get -ces: luz => luces
  if (w.endsWith("z")) {
    // Python's w[:-1] is equivalent to w.slice(0, -1)
    return w.slice(0, -1) + "ces";
  }

  // Words that change vowel stress: graduación => graduaciones.
  // Python's `for a, b in ((...)):` is translated using array destructuring.
  const stressChangeEndings = [
    ["án", "anes"],
    ["én", "enes"],
    ["ín", "ines"],
    ["ón", "ones"],
    ["ún", "unes"]
  ];
  for (const [a, b] of stressChangeEndings) {
    if (w.endsWith(a)) {
      // Python's w[:-2] was for 'án', 'én', etc. (all 2 chars).
      // w.slice(0, -a.length) makes it robust for any length of 'a'.
      return w.slice(0, -a.length) + b;
    }
  }

  // Words ending in a consonant get -es.
  return w + "es";
}