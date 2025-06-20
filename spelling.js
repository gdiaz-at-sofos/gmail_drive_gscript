/**
 * Self-implemented function to get correct spelling (with accent) for spanish words
 */
function getAccentCandidates(word) {
  const candidates = new Set();
  const vowels = 'aeiou';

  // Maps unaccented vowels to their accented counterparts
  const accentMap = {
    'a': 'á',
    'e': 'é',
    'i': 'í',
    'o': 'ó',
    'u': 'ú',
  };

  // Add the original word (no accents) as a candidate
  candidates.add(word);

  for (let i = 0; i < word.length; i++) {
    const char = word[i];

    // Check if the current character is an unaccented vowel
    if (vowels.includes(char)) {
      // Get the accented version
      const accentedChar = accentMap[char];

      // Construct the new word with only this vowel accented
      const accentedWord = word.substring(0, i) + accentedChar + word.substring(i + 1);
      candidates.add(accentedWord);
    }
  }

  // Convert Set back to Array
  return Array.from(candidates);
}