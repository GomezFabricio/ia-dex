# Voice Search Specification

## Purpose

Voice input routes the speech transcript through the exact same hybrid pipeline as typed text. The voice-capture UX (language, error messages, browser hint) is preserved unchanged.

## Requirements

### Requirement: Transcript Pipeline Parity

A voice transcript MUST follow the identical pipeline as a manually typed query — intent extraction, embedding, hybrid RPC, fallback — without any voice-specific branching.

#### Scenario: Successful voice input

- GIVEN the user activates the microphone and speaks "herramientas gratis para diseño"
- WHEN the transcript is produced
- THEN it is submitted to the hybrid pipeline exactly as if the user had typed that text
- AND extracted filters are auto-populated in the UI
- AND ranked results are displayed

#### Scenario: Voice input with no extractable filters

- GIVEN the transcript contains no year, license, or topic signals
- WHEN extraction runs on the transcript
- THEN the full transcript is used as the semantic query
- AND results are returned based on semantic similarity

#### Scenario: Voice input during Edge Function failure

- GIVEN the hybrid pipeline fails after a voice transcript is submitted
- WHEN the fallback activates
- THEN `ilike` search runs on the raw transcript
- AND the user sees results without any error message

---

### Requirement: Voice UX Preservation

Existing voice-capture behavior MUST remain unchanged: locale `es-AR`, user-facing error messages, and the Chrome/Edge availability hint.

#### Scenario: Microphone capture locale

- GIVEN the user activates voice input on any supported browser
- WHEN the Web Speech API is initialized
- THEN the recognition language MUST be set to `es-AR`

#### Scenario: Microphone error

- GIVEN the user denies microphone permission or an audio error occurs
- WHEN the error fires
- THEN the existing error message is displayed to the user
- AND the text field remains usable for manual input

#### Scenario: Unsupported browser

- GIVEN the user accesses the search page on a browser that does not support the Web Speech API
- WHEN the page loads
- THEN the Chrome/Edge availability hint MUST be shown
- AND the text field remains fully functional

---

### Requirement: Single Input Source Contract

The search pipeline MUST accept text input from exactly one active source at a time — typed text or voice transcript. There is no merged or simultaneous input mode.

#### Scenario: Voice replaces typed text

- GIVEN the user has typed a query in the text field
- WHEN the user speaks a new query via voice
- THEN the transcript replaces the text field content
- AND the search re-executes with the transcript

#### Scenario: Typed text after voice

- GIVEN a voice transcript is currently in the text field
- WHEN the user edits the field manually
- THEN the modified text is used for the next search submission
- AND no voice-specific state persists
