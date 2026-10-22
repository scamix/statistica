// Public-domain English text. REFERENCE_CORPUS trains the letter frequencies;
// TEST_CORPUS is a different set of passages from which the test plaintexts are cut.
const REFERENCE_CORPUS = `
It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.
However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so
well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of
their daughters. My dear Mr. Bennet, said his lady to him one day, have you heard that Netherfield Park is let at last?
Mr. Bennet replied that he had not. But it is, returned she; for Mrs. Long has just been here, and she told me all about it.
Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing
particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way
I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth;
whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses,
and bringing up the rear of every funeral I meet; then, I account it high time to get to sea as soon as I can.
Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she
had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a
book, thought Alice, without pictures or conversations? So she was considering in her own mind, as well as she could, for
the hot day made her feel very sleepy and stupid, whether the pleasure of making a daisy chain would be worth the trouble
of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
`;

const TEST_CORPUS = `
It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the
epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the
spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going
direct to Heaven, we were all going direct the other way. Four score and seven years ago our fathers brought forth on this
continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are
engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.
We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place
for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.
`;
