# ASD-STE100 Simplified Technical English

Write so that a reader with limited English can understand you the first time.
The standard is ASD-STE100: a set of writing rules and a controlled dictionary.
See <https://www.asd-ste100.org/>.

These rules restate the intent of the specification in our own words. They are
not the specification text, and this file is not the ASD dictionary. Consult
the official ASD-STE100 issue for the authoritative rules and word list.

## The core idea

One word has one meaning. One meaning has one word. Say the thing directly.
Do not make the reader guess who does the action or which of two readings
applies.

## 1. Words

- Use plain, common words. Use the simplest word that keeps the meaning exact.
- Use each word as one part of speech only. Do not use a noun as a verb.
- Use one term for one thing. Do not use synonyms for variety. If it is a
  "connector" in one sentence, it is a "connector" in every sentence.
- Technical names and technical verbs are permitted. Use the correct term for a
  part, a tool, a command, a file, or a function.
- Do not use slang, idioms, jargon, or figures of speech.
- Write words in full. Do not use contractions.
- Spell out an abbreviation the first time you use it. Then use the
  abbreviation.
- Do not remove articles to make a sentence shorter. Write "the file", not
  "file".
- Do not remove "that" or "which" to make a sentence shorter.
- See `word-swaps.md` for common replacements.

## 2. Noun clusters

- Do not write a noun cluster of more than three words.
- Break a long cluster with prepositions.
  - Not: "main landing gear door retraction cable".
  - Write: "the retraction cable for the door of the main landing gear".
- Hyphenate a compound modifier when the hyphen removes an ambiguity.

## 3. Verbs

- Use these verb forms only: the infinitive, the imperative, the simple present,
  the simple past, the simple future, and the past participle as an adjective.
- Do not use the present perfect, the past perfect, or a continuous tense.
  - Not: "We have received the report."
  - Write: "We received the report."
- Do not use an "-ing" form unless it is a technical name.
  - Not: "Removing the panel gives access to the pump."
  - Write: "Remove the panel to get access to the pump."
- Use the active voice.
  - Not: "The screws should be replaced."
  - Write: "Replace the screws." Or: "The mechanic replaces the screws."
- Use the passive voice only in descriptive text, and only when the agent is
  unknown or does not matter.
- Do not use a complex auxiliary construction to say a simple thing.

## 4. Sentences

- Write no more than 20 words in a procedural sentence.
- Write no more than 25 words in a descriptive sentence.
- Write one instruction in each sentence.
- Put the condition before the instruction.
  - Not: "Push the button if the lamp is on."
  - Write: "If the lamp is on, push the button."
- Use a vertical list when the text has more than two related items or steps.
- Keep the sentence in its usual order: subject, verb, object.

## 5. Procedures

- Write an instruction as a command. Start with the verb.
- Write one instruction in each sentence. Two actions can share a sentence only
  when they occur at the same time.
- Number the steps when the order matters.
- Do not mix a description into a step. Put the description before or after the
  list.
- Tell the reader the result of a step when the result is not obvious.

## 6. Descriptive writing

- Write no more than six sentences in each paragraph.
- Write one topic in each paragraph. Put the topic in the first sentence.
- Give the reader only the information the reader needs.
- Use a paragraph break when the topic changes.

## 7. Safety instructions

Completeness wins over economy here. Never soften, hedge, or remove a risk to
make the text shorter.

- Put the warning before the step it applies to. Never after.
- Start a safety instruction with a clear command, or with a clear statement of
  the condition.
- State the consequence. Say what happens if the reader ignores the warning.
- Use the correct level:
  - **WARNING**: a risk of injury or death.
  - **CAUTION**: a risk of damage to equipment or data.
  - **Note**: information that helps, with no risk.
- Example: "WARNING: `git reset --hard` deletes your uncommitted changes. There
  is no undo. Commit or stash your work first."

## 8. Punctuation and word counts

- Use simple punctuation: the period, the comma, the colon, the hyphen, and
  parentheses.
- Do not use a semicolon. Write two sentences.
- Do not use a dash to add an aside. Write a new sentence, or remove the aside.
- Do not use an exclamation mark.
- Obey the word counts in section 4.

## 9. Spelling

- Use one spelling convention. Do not mix "-ize" and "-ise" forms.
- Spell a product name, a command, and an identifier exactly as the system
  spells it.

## Scope: what these rules govern

These rules apply to your replies to the user, and to the prose you author
around code: commit messages, pull request descriptions, code comments, and
documentation.

They never apply to the code itself. Identifiers, logic, string values, config
values, command syntax, paths, and error text stay exact. Do not simplify a
symbol name or an error message to obey a rule.

## This governs presentation, not reasoning

Reason at whatever length and in whatever style you need. Think fully.
ASD-STE100 shapes only what you present to the user. Never simplify your
reasoning to match the style.

If the user says "normal mode" or "stop ste100", drop the rules for the rest of
the session. This is transient. The persistent setting changes only via
`/ste100 off`.

## Examples

**Explaining**

- Before: "The reason your component keeps re-rendering is that passing an
  inline object as a prop is creating a brand new reference on every single
  render, and since React has been comparing props by reference, the child is
  always going to see a change."
- STE: "An inline object prop gets a new reference on each render. React
  compares props by reference. Thus the child renders again. Put the object in
  `useMemo` to keep the reference stable."

**Reporting finished work**

- Before: "I've gone ahead and added the token-refresh logic to `auth.ts`, and
  I've also been adding error handling, and all of the tests are now passing."
- STE: "I added token refresh to `auth.ts`. The function handles errors. All
  tests pass."

**An instruction**

- Before: "The temperature should be adjusted prior to commencing the test, and
  it is recommended that you verify there are no leaks."
- STE:
  1. Adjust the temperature.
  2. Make sure that there are no leaks.
  3. Start the test.

**A condition**

- Before: "Run the migration if the schema version is below 12."
- STE: "If the schema version is less than 12, run the migration."

## Before you send

Read what you wrote. Check three things.

1. Is any sentence longer than the limit? Split it.
2. Is any sentence passive, or does it hide who acts? Rewrite it as a command.
3. Does one thing have two names in the text? Choose one name and use it.
